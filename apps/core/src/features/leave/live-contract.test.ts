import { personRowSchema } from '@/features/people/schema';
import { unwrap } from '@/lib/core-api';
import { signInLive, type LiveSend } from '@/test/live-api';
import { leaveRowSchema, leaveRowsSchema, toLeaveBody, toLeaveFormValues } from './schema';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds people and their leaves, changes and deletes
// them again; deletes are soft, so the rows stay in the tables). It only runs when CORE_API_WRITE_URL names a service on a
// scratch database, never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch db> .venv/bin/uvicorn app.main:create_app --factory --port 5013
//   (here, in apps/core)   CORE_API_WRITE_URL=http://127.0.0.1:5013/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec vitest run src/features/leave/live-contract.test.ts
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const createPerson = async (name: string) =>
  unwrap(await (await send('POST', '/people', { name, joinDate: '2026-01-05' })).json(), personRowSchema);

const leavesOf = async (personId: number) =>
  unwrap(await (await send('GET', `/leaves?personId=${personId}`)).json(), leaveRowsSchema);

/** The body the leave form sends for a new leave: from the form's own builder, so the service is shown what the page sends. */
const formBody = (personId: number, startDate: string, endDate: string, leaveType = 'casual', reason = '') =>
  toLeaveBody({ ...toLeaveFormValues(), personId: String(personId), startDate, endDate, leaveType, reason });

describe.skipIf(!base)('the running core service, leave', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('creates, takes a single day, lists newest first, edits, clears the reason, and deletes', async () => {
    const person = await createPerson('Leave check');
    try {
      expect(await leavesOf(person.id)).toEqual([]);

      const created = await send('POST', '/leaves', formBody(person.id, '2026-03-12', '2026-03-14', 'sick', 'Fever'));
      expect(created.status).toBe(201);
      const range = unwrap(await created.json(), leaveRowSchema);
      expect(range).toEqual({
        id: range.id,
        personId: person.id,
        person: { id: person.id, name: 'Leave check' },
        startDate: '2026-03-12',
        endDate: '2026-03-14',
        leaveType: 'sick',
        reason: 'Fever',
      });

      // A single day has the same date in both, and a reason left out comes back null, read as empty.
      const single = await send('POST', '/leaves', formBody(person.id, '2026-05-04', '2026-05-04'));
      expect(single.status).toBe(201);
      const oneDay = unwrap(await single.json(), leaveRowSchema);
      expect(oneDay).toMatchObject({ startDate: '2026-05-04', endDate: '2026-05-04', leaveType: 'casual', reason: '' });

      // A leave earlier than the others goes under them: newest first by first day, not by id.
      const earlier = unwrap(
        await (await send('POST', '/leaves', formBody(person.id, '2026-01-12', '2026-01-13', 'unpaid'))).json(),
        leaveRowSchema,
      );
      expect((await leavesOf(person.id)).map((row) => [row.id, row.startDate])).toEqual([
        [oneDay.id, '2026-05-04'],
        [range.id, '2026-03-12'],
        [earlier.id, '2026-01-12'],
      ]);

      // The whole register lists them too, and the row by id reads like a row of the list.
      const everyone = unwrap(await (await send('GET', '/leaves')).json(), leaveRowsSchema);
      expect(everyone.map((row) => row.id)).toEqual(expect.arrayContaining([oneDay.id, range.id, earlier.id]));
      expect(unwrap(await (await send('GET', `/leaves/${range.id}`)).json(), leaveRowSchema)).toEqual(range);

      // An overlap with another leave of the same person is a 409 that names the days it clashes with, ISO dates.
      const overlap = await send('POST', '/leaves', formBody(person.id, '2026-03-14', '2026-03-16'));
      expect(overlap.status).toBe(409);
      expect(await overlap.json()).toMatchObject({
        statusCode: 409,
        message: 'This person already has leave from 2026-03-12 to 2026-03-14',
        data: null,
      });
      const overlapDay = await send('POST', '/leaves', formBody(person.id, '2026-05-04', '2026-05-04'));
      expect(overlapDay.status).toBe(409);
      expect(await overlapDay.json()).toMatchObject({ message: 'This person already has leave on 2026-05-04' });
      expect(await leavesOf(person.id)).toHaveLength(3);

      // The last day before the first is a 422 the service words as the form does.
      const backwards = await send('POST', '/leaves', {
        personId: person.id,
        startDate: '2026-07-10',
        endDate: '2026-07-09',
        leaveType: 'casual',
        reason: null,
      });
      expect(backwards.status).toBe(422);
      expect(await backwards.json()).toMatchObject({
        statusCode: 422,
        data: [{ msg: 'Value error, The last day must not be before the first' }],
      });

      // An edit sends the days, the type and the reason, never the person (the hook's own body). It does not clash with itself.
      const edited = await send('PATCH', `/leaves/${range.id}`, {
        startDate: '2026-03-12',
        endDate: '2026-03-15',
        leaveType: 'earned',
        reason: null,
      });
      expect(edited.status).toBe(200);
      expect(unwrap(await edited.json(), leaveRowSchema)).toMatchObject({
        id: range.id,
        endDate: '2026-03-15',
        leaveType: 'earned',
        reason: '',
      });

      // An edit onto another leave's days is a 409; an edit to a last day before the stored first day is a 422.
      const editOnto = await send('PATCH', `/leaves/${range.id}`, { endDate: '2026-05-04' });
      expect(editOnto.status).toBe(409);
      const editBackwards = await send('PATCH', `/leaves/${range.id}`, { endDate: '2026-03-01' });
      expect(editBackwards.status).toBe(422);
      expect(await editBackwards.json()).toMatchObject({ message: 'The last day must not be before the first' });

      // The person of a leave cannot change, and nothing but the five types is a type.
      const withPerson = await send('PATCH', `/leaves/${range.id}`, { personId: person.id, leaveType: 'sick' });
      expect(withPerson.status).toBe(422);
      expect(await withPerson.json()).toMatchObject({ data: [{ loc: ['body', 'personId'] }] });
      const badType = await send('PATCH', `/leaves/${range.id}`, { leaveType: 'holiday' });
      expect(badType.status).toBe(422);
      expect(await badType.json()).toMatchObject({ data: [{ loc: ['body', 'leaveType'] }] });
      expect((await leavesOf(person.id)).find((row) => row.id === range.id)).toMatchObject({ endDate: '2026-03-15' });

      // Delete: gone from the list and from a read by id; a second delete is a 404, which the page treats as done.
      expect((await send('DELETE', `/leaves/${oneDay.id}`)).status).toBe(200);
      expect((await leavesOf(person.id)).map((row) => row.id)).toEqual([range.id, earlier.id]);
      expect((await send('GET', `/leaves/${oneDay.id}`)).status).toBe(404);
      expect((await send('DELETE', `/leaves/${oneDay.id}`)).status).toBe(404);

      // Its days are free again.
      expect((await send('POST', '/leaves', formBody(person.id, '2026-05-04', '2026-05-04'))).status).toBe(201);
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
    }
  });

  it('lets two people take the same days, and each type the form offers', async () => {
    const ada = await createPerson('Leave Ada');
    const ben = await createPerson('Leave Ben');
    try {
      for (const [index, type] of ['casual', 'sick', 'earned', 'unpaid', 'other'].entries()) {
        const day = `2026-04-0${index + 1}`;
        const saved = await send('POST', '/leaves', formBody(ada.id, day, day, type));
        expect(saved.status).toBe(201);
        expect(unwrap(await saved.json(), leaveRowSchema).leaveType).toBe(type);
      }
      const sameDays = await send('POST', '/leaves', formBody(ben.id, '2026-04-01', '2026-04-05'));
      expect(sameDays.status).toBe(201);
      expect(await leavesOf(ada.id)).toHaveLength(5);
      expect(await leavesOf(ben.id)).toHaveLength(1);
    } finally {
      expect((await send('DELETE', `/people/${ada.id}`)).status).toBe(200);
      expect((await send('DELETE', `/people/${ben.id}`)).status).toBe(200);
    }
  });

  it('refuses what the pages cannot send: a person that does not exist, a bad date, an unknown key', async () => {
    const person = await createPerson('Leave refusals');
    try {
      const noPerson = await send('POST', '/leaves', {
        personId: 2_000_000_000,
        startDate: '2026-03-12',
        endDate: '2026-03-12',
        leaveType: 'casual',
      });
      expect(noPerson.status).toBe(409);
      expect(await noPerson.json()).toMatchObject({ message: 'Referenced record does not exist' });
      const badDate = await send('POST', '/leaves', {
        personId: person.id,
        startDate: '12/03/2026',
        endDate: '2026-03-12',
        leaveType: 'casual',
      });
      expect(badDate.status).toBe(422);
      expect(await badDate.json()).toMatchObject({ data: [{ loc: ['body', 'startDate'] }] });
      const stray = await send('POST', '/leaves', {
        personId: person.id,
        startDate: '2026-03-12',
        endDate: '2026-03-12',
        leaveType: 'casual',
        approved: true,
      });
      expect(stray.status).toBe(422);
      expect(await stray.json()).toMatchObject({ data: [{ loc: ['body', 'approved'] }] });
      expect((await send('GET', '/leaves?personId=0')).status).toBe(422);
      expect((await send('PATCH', '/leaves/2000000000', { reason: 'x' })).status).toBe(404);
      expect(await leavesOf(person.id)).toEqual([]);
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
    }
  });
});
