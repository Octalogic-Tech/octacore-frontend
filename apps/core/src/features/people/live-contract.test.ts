import { unwrap } from '@/lib/core-api';
import { MAX_CENTS } from '@/lib/money';
import { emptyPersonForm, personRowSchema, personRowsSchema, toFormValues, toPersonBody } from './schema';
import { signInLive, type LiveSend } from '@/test/live-api';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds a person, changes the person's monthly
// salary in paise, clears it and deletes the person again; deletes are soft, so the row stays in the table). It only runs
// when CORE_API_WRITE_URL names a service on a scratch database, never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch db> .venv/bin/uvicorn app.main:create_app --factory --port 5003
//   (here)                 CORE_API_WRITE_URL=http://127.0.0.1:5003/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec nx test core --skip-nx-cache
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const listedPeople = async () => unwrap(await (await send('GET', '/people')).json(), personRowsSchema);

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
});
