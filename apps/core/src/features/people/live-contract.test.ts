import { z } from 'zod';
import { allocationRowSchema, allocationRowsSchema } from '@/features/allocation/schema';
import { leaveRowSchema, leaveRowsSchema } from '@/features/leave/schema';
import { unwrap } from '@/lib/core-api';
import { MAX_CENTS } from '@/lib/money';
import {
  emptyPersonForm,
  personMatches,
  personRowSchema,
  personRowsSchema,
  toFormValues,
  toPersonBody,
} from './schema';
import { signInLive, type LiveSend } from '@/test/live-api';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds people, technologies, a project, an allocation
// entry and a leave, changes the people's monthly salary in paise and technologies, and deletes them all again; deletes are
// soft, so the rows stay in the tables). It only runs when CORE_API_WRITE_URL names a service on a scratch database,
// never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch db> .venv/bin/uvicorn app.main:create_app --factory --port 5003
//   (here)                 CORE_API_WRITE_URL=http://127.0.0.1:5003/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec nx test core --skip-nx-cache
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const createdSchema = z.object({ id: z.number().int() });

const listedPeople = async () => unwrap(await (await send('GET', '/people')).json(), personRowsSchema);
const readPerson = async (id: number) => unwrap(await (await send('GET', `/people/${id}`)).json(), personRowSchema);

/** Names no earlier run can have left behind: a technology's name is unique among the live ones. */
const unique = (label: string) => `${label} ${Date.now().toString(36)}`;

const createTechnology = async (name: string) =>
  unwrap(await (await send('POST', '/technologies', { name, description: null, categoryId: null })).json(), createdSchema)
    .id;

describe.skipIf(!base)('the running core service, people', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('takes the bodies the page sends, holds the monthly salary in whole paise, and clears it with null', async () => {
    const created = await send('POST', '/people', {
      name: 'Wiring check',
      email: null,
      phone: null,
      joinDate: '2026-01-05',
      leaveDate: null,
      imageLink: null,
      contractLink: null,
      monthlySalaryPaise: 8_500_000,
      technologyIds: [],
    });
    expect(created.status).toBe(201);
    const person = unwrap(await created.json(), personRowSchema);
    expect(person).toMatchObject({
      name: 'Wiring check',
      joinDate: '2026-01-05',
      leaveDate: '',
      monthlySalaryPaise: 8_500_000,
      technologies: [],
    });

    try {
      expect(await listedPeople()).toContainEqual(person);

      const raised = await send('PATCH', `/people/${person.id}`, { monthlySalaryPaise: 9_200_000 });
      expect(raised.status).toBe(200);
      expect(unwrap(await raised.json(), personRowSchema)).toMatchObject({ id: person.id, monthlySalaryPaise: 9_200_000 });

      const cleared = await send('PATCH', `/people/${person.id}`, { monthlySalaryPaise: null });
      expect(cleared.status).toBe(200);
      expect(unwrap(await cleared.json(), personRowSchema)).toMatchObject({ id: person.id, monthlySalaryPaise: null });
    } finally {
      const deleted = await send('DELETE', `/people/${person.id}`);
      expect(deleted.status).toBe(200);
    }
    expect((await listedPeople()).map((row) => row.id)).not.toContain(person.id);
  });

  it('saves a salary typed with paise, reads it back as typed, and does not drift when it is saved unchanged', async () => {
    // The body comes from the form's own builder, so the service is shown what the page sends.
    const body = toPersonBody({ ...emptyPersonForm, name: 'Salary paise', joinDate: '2026-01-05', monthlySalary: '85000.75' });
    expect(body.monthlySalaryPaise).toBe(8_500_075);
    const created = await send('POST', '/people', body);
    expect(created.status).toBe(201);
    const person = unwrap(await created.json(), personRowSchema);
    try {
      expect(person.monthlySalaryPaise).toBe(8_500_075);
      expect((await listedPeople()).find((row) => row.id === person.id)).toEqual(person);
      expect(toFormValues(person).monthlySalary).toBe('85000.75');

      // Opening the person and saving without a change sends the same paise.
      const unchanged = await send('PATCH', `/people/${person.id}`, toPersonBody(toFormValues(person)));
      expect(unchanged.status).toBe(200);
      expect(unwrap(await unchanged.json(), personRowSchema)).toEqual(person);
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
    }
  });

  it.each([
    ['a negative salary', -1],
    ['a salary with a fraction of a paisa', 5650.5],
    ['a salary above the cap', MAX_CENTS + 1],
  ])('refuses %s with a 422 that names the salary field', async (_label, monthlySalaryPaise) => {
    const response = await send('POST', '/people', { name: 'Wiring check', monthlySalaryPaise });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      statusCode: 422,
      data: [{ loc: ['body', 'monthlySalaryPaise'] }],
    });
  });

  it('refuses a write that still sends the old monthlySalaryCents, and names it', async () => {
    const created = await send('POST', '/people', { name: 'Wiring check', monthlySalaryCents: 560000 });
    expect(created.status).toBe(422);
    expect(await created.json()).toMatchObject({ statusCode: 422, data: [{ loc: ['body', 'monthlySalaryCents'] }] });

    const person = unwrap(
      await (await send('POST', '/people', { name: 'Wiring old name', monthlySalaryPaise: 8_500_000 })).json(),
      personRowSchema,
    );
    try {
      const patched = await send('PATCH', `/people/${person.id}`, { monthlySalaryCents: 620000 });
      expect(patched.status).toBe(422);
      expect(await patched.json()).toMatchObject({ statusCode: 422, data: [{ loc: ['body', 'monthlySalaryCents'] }] });
      expect((await listedPeople()).find((row) => row.id === person.id)).toMatchObject({ monthlySalaryPaise: 8_500_000 });
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
    }
  });

  it('takes technologyIds on create and on update, answers them by name, and clears them with an empty list', async () => {
    const zed = unique('Zed live');
    const alpha = unique('Alpha live');
    const zedId = await createTechnology(zed);
    const alphaId = await createTechnology(alpha);
    const created = await send('POST', '/people', {
      name: 'Technology check',
      joinDate: '2026-01-05',
      monthlySalaryPaise: 8_500_000,
      technologyIds: [zedId, alphaId],
    });
    expect(created.status).toBe(201);
    const person = unwrap(await created.json(), personRowSchema);
    try {
      // By name, then id, whatever order they were sent in.
      expect(person.technologies).toEqual([
        { id: alphaId, name: alpha },
        { id: zedId, name: zed },
      ]);
      expect((await listedPeople()).find((row) => row.id === person.id)).toEqual(person);
      expect(await readPerson(person.id)).toEqual(person);
      // The search finds the person by the name of a technology they know, in whatever case.
      expect(personMatches(person, alpha.toLowerCase())).toBe(true);
      expect(personMatches(person, 'not a technology of theirs')).toBe(false);

      // The form's own builder always sends the whole set, so opening a person and saving changes nothing.
      expect(toFormValues(person).technologyIds).toEqual([String(alphaId), String(zedId)]);
      const unchanged = await send('PATCH', `/people/${person.id}`, toPersonBody(toFormValues(person)));
      expect(unchanged.status).toBe(200);
      expect(unwrap(await unchanged.json(), personRowSchema)).toEqual(person);

      // The whole set is replaced.
      const replaced = await send('PATCH', `/people/${person.id}`, { technologyIds: [zedId] });
      expect(replaced.status).toBe(200);
      expect(unwrap(await replaced.json(), personRowSchema).technologies).toEqual([{ id: zedId, name: zed }]);

      // Leaving it out leaves the links alone.
      const renamed = await send('PATCH', `/people/${person.id}`, { name: 'Technology check renamed' });
      expect(renamed.status).toBe(200);
      expect(unwrap(await renamed.json(), personRowSchema)).toMatchObject({
        name: 'Technology check renamed',
        technologies: [{ id: zedId, name: zed }],
      });

      // Deleting a technology takes it off the people who had it.
      expect((await send('DELETE', `/technologies/${zedId}`)).status).toBe(200);
      expect((await readPerson(person.id)).technologies).toEqual([]);

      const again = await send('PATCH', `/people/${person.id}`, { technologyIds: [alphaId] });
      expect(unwrap(await again.json(), personRowSchema).technologies).toEqual([{ id: alphaId, name: alpha }]);
      const cleared = await send('PATCH', `/people/${person.id}`, { technologyIds: [] });
      expect(cleared.status).toBe(200);
      expect(unwrap(await cleared.json(), personRowSchema).technologies).toEqual([]);
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
      await send('DELETE', `/technologies/${alphaId}`);
      await send('DELETE', `/technologies/${zedId}`);
    }
  });

  it('refuses technologyIds the page could not send: null, a repeat, an unknown technology, too many', async () => {
    const techId = await createTechnology(unique('Refusal live'));
    const person = unwrap(
      await (await send('POST', '/people', { name: 'Technology refusals', technologyIds: [techId] })).json(),
      personRowSchema,
    );
    try {
      const explicitNull = await send('PATCH', `/people/${person.id}`, { technologyIds: null });
      expect(explicitNull.status).toBe(422);
      expect(await explicitNull.json()).toMatchObject({ data: [{ loc: ['body', 'technologyIds'] }] });

      const twice = await send('PATCH', `/people/${person.id}`, { technologyIds: [techId, techId] });
      expect(twice.status).toBe(422);
      expect(await twice.json()).toMatchObject({ data: [{ loc: ['body', 'technologyIds'] }] });

      const unknown = await send('PATCH', `/people/${person.id}`, { technologyIds: [2_000_000_000] });
      expect(unknown.status).toBe(409);
      expect(await unknown.json()).toMatchObject({ statusCode: 409, message: 'Referenced record does not exist' });

      const createUnknown = await send('POST', '/people', { name: 'Never saved', technologyIds: [2_000_000_000] });
      expect(createUnknown.status).toBe(409);

      const tooMany = await send('PATCH', `/people/${person.id}`, {
        technologyIds: Array.from({ length: 51 }, (_, index) => index + 1),
      });
      expect(tooMany.status).toBe(422);

      // Nothing above changed the person.
      expect((await readPerson(person.id)).technologies).toHaveLength(1);
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
      await send('DELETE', `/technologies/${techId}`);
    }
  });

  it('deletes a person together with their allocation entries and leaves, and keeps the project', async () => {
    const person = unwrap(
      await (await send('POST', '/people', { name: 'Delete cascade', joinDate: '2026-01-05' })).json(),
      personRowSchema,
    );
    const project = unwrap(
      await (
        await send('POST', '/projects', { name: 'Cascade project', projectType: 'product', billingType: 'retainer' })
      ).json(),
      createdSchema,
    );
    try {
      const entry = unwrap(
        await (
          await send('POST', '/allocations', { personId: person.id, projectId: project.id, effectiveDate: '2026-03-12' })
        ).json(),
        allocationRowSchema,
      );
      const leave = unwrap(
        await (
          await send('POST', '/leaves', {
            personId: person.id,
            startDate: '2026-03-12',
            endDate: '2026-03-12',
            leaveType: 'casual',
          })
        ).json(),
        leaveRowSchema,
      );
      const entriesOf = async () =>
        unwrap(await (await send('GET', `/allocations?personId=${person.id}`)).json(), allocationRowsSchema);
      const leavesOf = async () =>
        unwrap(await (await send('GET', `/leaves?personId=${person.id}`)).json(), leaveRowsSchema);
      expect(await entriesOf()).toHaveLength(1);
      expect(await leavesOf()).toHaveLength(1);

      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);

      // Gone from every list, and from a read by id: the board and the register never show a deleted person's rows.
      expect(await entriesOf()).toEqual([]);
      expect(await leavesOf()).toEqual([]);
      const allEntries = unwrap(await (await send('GET', '/allocations')).json(), allocationRowsSchema);
      const allLeaves = unwrap(await (await send('GET', '/leaves')).json(), leaveRowsSchema);
      expect(allEntries.map((row) => row.id)).not.toContain(entry.id);
      expect(allLeaves.map((row) => row.id)).not.toContain(leave.id);
      expect((await send('GET', `/allocations/${entry.id}`)).status).toBe(404);
      expect((await send('GET', `/leaves/${leave.id}`)).status).toBe(404);
      expect((await send('GET', `/people/${person.id}`)).status).toBe(404);
      // A second delete is a 404, which the page treats as done.
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(404);
      // The project is not touched.
      expect((await send('GET', `/projects/${project.id}`)).status).toBe(200);
    } finally {
      await send('DELETE', `/people/${person.id}`);
      expect((await send('DELETE', `/projects/${project.id}`)).status).toBe(200);
    }
  });
});
