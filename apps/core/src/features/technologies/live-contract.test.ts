import { categoryRowSchema } from '@/features/categories/schema';
import { unwrap } from '@/lib/core-api';
import { technologyRowSchema, technologyRowsSchema } from './schema';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds a technology and a category, edits
// the technology and deletes both again; the deletes are soft, so rows stay in the tables). It only runs when
// CORE_API_WRITE_URL names a service on a scratch database, never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch db> .venv/bin/uvicorn app.main:create_app --factory --port 5002
//   (here)                 CORE_API_WRITE_URL=http://127.0.0.1:5002/api/v1 pnpm nx test core --skip-nx-cache
const base = process.env.CORE_API_WRITE_URL;

const send = (method: string, path: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const listed = async () => unwrap(await (await send('GET', '/technologies')).json(), technologyRowsSchema);

describe.skipIf(!base)('the running core service, technologies', () => {
  it('takes the bodies the page sends and answers in the shape the app expects', async () => {
    const created = await send('POST', '/technologies', {
      name: 'Wiring check',
      description: 'Made by the live test',
      categoryId: null,
    });
    expect(created.status).toBe(201);
    const row = unwrap(await created.json(), technologyRowSchema);
    expect(row).toMatchObject({ name: 'Wiring check', description: 'Made by the live test', categoryId: null });

    try {
      expect(await listed()).toContainEqual(row);

      const updated = await send('PATCH', `/technologies/${row.id}`, {
        name: 'Wiring check 2',
        description: 'Edited',
        categoryId: null,
      });
      expect(updated.status).toBe(200);
      expect(unwrap(await updated.json(), technologyRowSchema)).toMatchObject({
        id: row.id,
        name: 'Wiring check 2',
        description: 'Edited',
      });
    } finally {
      const deleted = await send('DELETE', `/technologies/${row.id}`);
      expect(deleted.status).toBe(200);
    }
    expect((await listed()).map((technology) => technology.id)).not.toContain(row.id);
  });

  it('stores the category link the dialog sends and embeds the category in the answer', async () => {
    const category = unwrap(
      await (await send('POST', '/categories', { name: 'Wiring category', description: 'Made by the live test' })).json(),
      categoryRowSchema,
    );
    let technologyId: number | undefined;
    try {
      const created = await send('POST', '/technologies', {
        name: 'Wiring check',
        description: 'Made by the live test',
        categoryId: category.id,
      });
      expect(created.status).toBe(201);
      const row = unwrap(await created.json(), technologyRowSchema);
      technologyId = row.id;
      expect(row).toMatchObject({ categoryId: category.id, categoryName: 'Wiring category' });
      expect(await listed()).toContainEqual(row);

      const cleared = await send('PATCH', `/technologies/${row.id}`, {
        name: 'Wiring check',
        description: 'Made by the live test',
        categoryId: null,
      });
      expect(unwrap(await cleared.json(), technologyRowSchema)).toMatchObject({ categoryId: null, categoryName: '' });
    } finally {
      if (technologyId !== undefined) expect((await send('DELETE', `/technologies/${technologyId}`)).status).toBe(200);
      expect((await send('DELETE', `/categories/${category.id}`)).status).toBe(200);
    }
  });

  it('answers a technology that does not exist with an error envelope', async () => {
    const response = await send('DELETE', '/technologies/99999');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, data: null });
  });
});
