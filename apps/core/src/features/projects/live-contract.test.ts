import { unwrap } from '@/lib/core-api';
import { signInLive, type LiveSend } from '@/test/live-api';
import { invoiceRowSchema, invoiceRowsSchema, projectRowSchema } from './schema';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds a project and invoices, marks one paid
// and unpaid, and deletes the project again; deletes are soft, so rows stay in the tables). It only runs when
// CORE_API_WRITE_URL names a service on a scratch database, never one you care about.
//   (in octacore-backend-projects)  ./run-be uvicorn app.main:create_app --factory --port 5003
//   (here, in apps/core)            CORE_API_WRITE_URL=http://127.0.0.1:5003/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec vitest run src/features/projects/live-contract.test.ts
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const readProject = async (id: number) => unwrap(await (await send('GET', `/projects/${id}`)).json(), projectRowSchema);
const listedInvoices = async (projectId: number) =>
  unwrap(await (await send('GET', `/invoices?projectId=${projectId}`)).json(), invoiceRowsSchema);

describe.skipIf(!base)('the running core service, projects and their invoices', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('takes the bodies the pages send, calculates the totals from the invoices, and removes them with the project', async () => {
    const createdProject = await send('POST', '/projects', {
      name: 'Wiring check',
      description: null,
      clientId: null,
      projectType: 'product',
      billingType: 'fixed_cost',
    });
    expect(createdProject.status).toBe(201);
    const project = unwrap(await createdProject.json(), projectRowSchema);
    expect(project).toMatchObject({
      name: 'Wiring check',
      description: '',
      clientId: null,
      clientName: '',
      projectType: 'product',
      billingType: 'fixed_cost',
      totalValue: 0,
      totalOutstanding: 0,
    });

    let invoiceId: number | undefined;
    try {
      const createdInvoice = await send('POST', '/invoices', {
        projectId: project.id,
        number: 'INV-1',
        description: null,
        amount: 1000,
        issueDate: '2026-10-01',
        dueDate: null,
        paidDate: null,
      });
      expect(createdInvoice.status).toBe(201);
      const invoice = unwrap(await createdInvoice.json(), invoiceRowSchema);
      invoiceId = invoice.id;
      expect(invoice).toMatchObject({ projectId: project.id, number: 'INV-1', description: '', amount: 1000, paidDate: null });
      expect(await readProject(project.id)).toMatchObject({ totalValue: 1000, totalOutstanding: 1000 });

      const paid = await send('PATCH', `/invoices/${invoice.id}`, { paidDate: '2026-10-15' });
      expect(paid.status).toBe(200);
      expect(unwrap(await paid.json(), invoiceRowSchema)).toMatchObject({ paidDate: '2026-10-15' });
      expect(await readProject(project.id)).toMatchObject({ totalValue: 1000, totalOutstanding: 0 });

      const unpaid = await send('PATCH', `/invoices/${invoice.id}`, { paidDate: null });
      expect(unwrap(await unpaid.json(), invoiceRowSchema)).toMatchObject({ paidDate: null });
      expect(await readProject(project.id)).toMatchObject({ totalValue: 1000, totalOutstanding: 1000 });

      expect((await listedInvoices(project.id)).map((row) => row.id)).toEqual([invoice.id]);
    } finally {
      const deleted = await send('DELETE', `/projects/${project.id}`);
      expect(deleted.status).toBe(200);
    }
    expect(await listedInvoices(project.id)).toEqual([]);
    expect((await send('GET', `/invoices/${invoiceId}`)).status).toBe(404);
  });

  it('refuses a project without its types, with an error envelope', async () => {
    const response = await send('POST', '/projects', { name: 'No types' });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ statusCode: 422 });
  });

  it('refuses an invoice for a project that does not exist, with an error envelope', async () => {
    const response = await send('POST', '/invoices', {
      projectId: 99999,
      number: 'INV-1',
      amount: 1,
      issueDate: '2026-10-01',
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ statusCode: 409, data: null });
  });

  it('answers an invoice that does not exist with an error envelope', async () => {
    const response = await send('DELETE', '/invoices/99999');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, data: null });
  });
});
