import { unwrap } from '@/lib/core-api';
import { categoryRowSchema, categoryRowsSchema } from './schema';
import { signInLive, type LiveSend } from '@/test/live-api';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds one category, edits it and
// deletes it again; the delete is soft, so a row stays in the table). It only runs when CORE_API_WRITE_URL
// names a service on a scratch database, never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch db> .venv/bin/uvicorn app.main:create_app --factory --port 5002
//   (here)                 CORE_API_WRITE_URL=http://localhost:5002/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec nx test core --skip-nx-cache
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const listed = async () => unwrap(await (await send('GET', '/categories')).json(), categoryRowsSchema);

describe.skipIf(!base)('the running core service, categories', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('takes the bodies the page sends and answers in the shape the app expects', async () => {
    const created = await send('POST', '/categories', { name: 'Wiring check', description: 'Made by the live test' });
    expect(created.status).toBe(201);
    const row = unwrap(await created.json(), categoryRowSchema);
    expect(row).toMatchObject({ name: 'Wiring check', description: 'Made by the live test' });
    expect(row.createdDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    try {
      expect(await listed()).toContainEqual(row);

      const updated = await send('PATCH', `/categories/${row.id}`, { name: 'Wiring check 2', description: 'Edited' });
      expect(updated.status).toBe(200);
      expect(unwrap(await updated.json(), categoryRowSchema)).toMatchObject({
        id: row.id,
        name: 'Wiring check 2',
        description: 'Edited',
      });
    } finally {
      const deleted = await send('DELETE', `/categories/${row.id}`);
      expect(deleted.status).toBe(200);
    }
    expect((await listed()).map((category) => category.id)).not.toContain(row.id);
  });

  it('answers a category that does not exist with an error envelope', async () => {
    const response = await send('DELETE', '/categories/99999');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, data: null });
  });
});
