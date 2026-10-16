import { unwrap } from '@/lib/core-api';
import { personRowSchema, personRowsSchema } from './schema';
import { signInLive, type LiveSend } from '@/test/live-api';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds a person, changes the person's monthly
// salary, clears it and deletes the person again; deletes are soft, so the row stays in the table). It only runs
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

  it('takes the bodies the page sends, holds the monthly salary in whole dollars, and clears it with null', async () => {
    const created = await send('POST', '/people', {
      name: 'Wiring check',
      email: null,
      phone: null,
      joinDate: '2026-01-05',
      leaveDate: null,
      imageLink: null,
      contractLink: null,
      monthlySalary: 5600,
    });
    expect(created.status).toBe(201);
    const person = unwrap(await created.json(), personRowSchema);
    expect(person).toMatchObject({ name: 'Wiring check', joinDate: '2026-01-05', leaveDate: '', monthlySalary: 5600 });

    try {
      expect(await listedPeople()).toContainEqual(person);

      const raised = await send('PATCH', `/people/${person.id}`, { monthlySalary: 6200 });
      expect(raised.status).toBe(200);
      expect(unwrap(await raised.json(), personRowSchema)).toMatchObject({ id: person.id, monthlySalary: 6200 });

      const cleared = await send('PATCH', `/people/${person.id}`, { monthlySalary: null });
      expect(cleared.status).toBe(200);
      expect(unwrap(await cleared.json(), personRowSchema)).toMatchObject({ id: person.id, monthlySalary: null });
    } finally {
      const deleted = await send('DELETE', `/people/${person.id}`);
      expect(deleted.status).toBe(200);
    }
    expect((await listedPeople()).map((row) => row.id)).not.toContain(person.id);
  });

  it.each([
    ['a negative salary', -1],
    ['a salary with cents', 56.5],
  ])('refuses %s with a 422 that names the salary field', async (_label, monthlySalary) => {
    const response = await send('POST', '/people', { name: 'Wiring check', monthlySalary });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      statusCode: 422,
      data: [{ loc: ['body', 'monthlySalary'] }],
    });
  });
});
