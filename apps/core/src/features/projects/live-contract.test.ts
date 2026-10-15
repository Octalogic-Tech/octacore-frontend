import { z } from 'zod';
import { unwrap } from '@/lib/core-api';
import { signInLive, type LiveSend } from '@/test/live-api';
import {
  invoiceDraftSchema,
  invoiceRowSchema,
  invoiceRowsSchema,
  projectRowSchema,
  resourceRowSchema,
  resourceRowsSchema,
} from './schema';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds a project, a category, a person, resources
// and invoices, changes them, and deletes the project again; deletes are soft, so rows stay in the tables). It only
// runs when CORE_API_WRITE_URL names a service on a scratch database, never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch> .venv/bin/uvicorn app.main:create_app --factory --port 5002
//   (here, in apps/core)   CORE_API_WRITE_URL=http://127.0.0.1:5002/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec vitest run src/features/projects/live-contract.test.ts
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const createdSchema = z.object({ id: z.number().int() });

const readProject = async (id: number) => unwrap(await (await send('GET', `/projects/${id}`)).json(), projectRowSchema);
const listedInvoices = async (projectId: number) =>
  unwrap(await (await send('GET', `/invoices?projectId=${projectId}`)).json(), invoiceRowsSchema);
const listedResources = async (projectId: number) =>
  unwrap(await (await send('GET', `/project-resources?projectId=${projectId}`)).json(), resourceRowsSchema);
const readDraft = async (projectId: number) =>
  unwrap(await (await send('GET', `/projects/${projectId}/invoice-draft`)).json(), invoiceDraftSchema);

describe.skipIf(!base)('the running core service, projects, their resources and invoices', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('builds a retainer invoice from the resources, calculates its amount from the lines, and removes everything with the project', async () => {
    const category = unwrap(
      await (await send('POST', '/categories', { name: 'Wiring check', description: 'Made by the live test' })).json(),
      createdSchema,
    );
    const person = unwrap(await (await send('POST', '/people', { name: 'Wiring Person' })).json(), createdSchema);
    const createdProject = await send('POST', '/projects', {
      name: 'Wiring check',
      description: null,
      clientId: null,
      projectType: 'resource_augmentation',
      billingType: 'retainer',
    });
    expect(createdProject.status).toBe(201);
    const project = unwrap(await createdProject.json(), projectRowSchema);
    expect(await readDraft(project.id)).toEqual({ lineItems: [] });

    let resourceId: number | undefined;
    let invoiceId: number | undefined;
    try {
      const linked = await send('POST', '/project-resources', {
        projectId: project.id,
        name: 'Wiring Person',
        personId: person.id,
        categoryId: category.id,
        rate: 150,
      });
      expect(linked.status).toBe(201);
      resourceId = unwrap(await linked.json(), resourceRowSchema).id;
      const open = await send('POST', '/project-resources', {
        projectId: project.id,
        name: 'Open role',
        personId: null,
        categoryId: category.id,
        rate: 75,
      });
      expect(open.status).toBe(201);
      expect((await listedResources(project.id)).map((row) => row.name)).toEqual(['Wiring Person', 'Open role']);
      expect(await listedResources(project.id)).toMatchObject([
        { personName: 'Wiring Person', categoryName: 'Wiring check', rate: 150 },
        { personId: null, personName: '', rate: 75 },
      ]);

      const draft = await readDraft(project.id);
      expect(draft.lineItems).toEqual([
        { description: 'Wiring Person — Wiring check', quantity: 160, rate: 150 },
        { description: 'Open role — Wiring check', quantity: 160, rate: 75 },
      ]);

      const createdInvoice = await send('POST', '/invoices', {
        projectId: project.id,
        number: 'INV-1',
        description: null,
        issueDate: '2026-10-01',
        dueDate: null,
        paidDate: null,
        lineItems: draft.lineItems,
      });
      expect(createdInvoice.status).toBe(201);
      const invoice = unwrap(await createdInvoice.json(), invoiceRowSchema);
      invoiceId = invoice.id;
      expect(invoice).toMatchObject({ projectId: project.id, number: 'INV-1', amount: 36000 });
      expect(invoice.lineItems).toHaveLength(2);
      expect(await readProject(project.id)).toMatchObject({ totalValue: 36000, totalOutstanding: 36000 });

      const replaced = await send('PATCH', `/invoices/${invoice.id}`, {
        lineItems: [{ description: 'Wiring Person — Wiring check', quantity: 80, rate: 150 }],
      });
      expect(replaced.status).toBe(200);
      expect(unwrap(await replaced.json(), invoiceRowSchema)).toMatchObject({ amount: 12000 });
      expect(await readProject(project.id)).toMatchObject({ totalValue: 12000, totalOutstanding: 12000 });

      const paid = await send('PATCH', `/invoices/${invoice.id}`, { paidDate: '2026-10-15' });
      expect(unwrap(await paid.json(), invoiceRowSchema)).toMatchObject({ paidDate: '2026-10-15', amount: 12000 });
      expect(await readProject(project.id)).toMatchObject({ totalValue: 12000, totalOutstanding: 0 });

      // A change of resource never changes an invoice already built from it.
      await send('PATCH', `/project-resources/${resourceId}`, { rate: 999 });
      expect((await listedInvoices(project.id))[0]).toMatchObject({ amount: 12000 });
      expect((await readDraft(project.id)).lineItems[0]).toMatchObject({ rate: 999 });
    } finally {
      const deleted = await send('DELETE', `/projects/${project.id}`);
      expect(deleted.status).toBe(200);
      await send('DELETE', `/categories/${category.id}`);
      await send('DELETE', `/people/${person.id}`);
    }
    expect(await listedInvoices(project.id)).toEqual([]);
    expect(await listedResources(project.id)).toEqual([]);
    expect((await send('GET', `/invoices/${invoiceId}`)).status).toBe(404);
    expect((await send('GET', `/project-resources/${resourceId}`)).status).toBe(404);
  });

  it('takes a fixed cost invoice with a line typed by hand, and has no draft for it', async () => {
    const project = unwrap(
      await (
        await send('POST', '/projects', {
          name: 'Wiring fixed',
          description: null,
          clientId: null,
          projectType: 'product',
          billingType: 'fixed_cost',
        })
      ).json(),
      projectRowSchema,
    );
    try {
      expect(await readDraft(project.id)).toEqual({ lineItems: [] });
      const created = await send('POST', '/invoices', {
        projectId: project.id,
        number: 'INV-F1',
        description: null,
        issueDate: '2026-10-01',
        dueDate: null,
        paidDate: null,
        lineItems: [{ description: 'Milestone 1', quantity: 1, rate: 5000 }],
      });
      expect(created.status).toBe(201);
      expect(unwrap(await created.json(), invoiceRowSchema)).toMatchObject({ amount: 5000 });
      expect(await readProject(project.id)).toMatchObject({ totalValue: 5000 });
    } finally {
      expect((await send('DELETE', `/projects/${project.id}`)).status).toBe(200);
    }
  });

  it('refuses a project without its types, with an error envelope', async () => {
    const response = await send('POST', '/projects', { name: 'No types' });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ statusCode: 422 });
  });

  it('refuses an invoice with no lines, and a line the service cannot hold, with an error envelope', async () => {
    const project = unwrap(
      await (
        await send('POST', '/projects', { name: 'Wiring refuse', projectType: 'product', billingType: 'fixed_cost' })
      ).json(),
      projectRowSchema,
    );
    try {
      const noLines = await send('POST', '/invoices', {
        projectId: project.id,
        number: 'INV-1',
        issueDate: '2026-10-01',
        lineItems: [],
      });
      expect(noLines.status).toBe(422);
      const tooLarge = await send('POST', '/invoices', {
        projectId: project.id,
        number: 'INV-1',
        issueDate: '2026-10-01',
        lineItems: [{ description: 'Too large', quantity: 100000, rate: 21475 }],
      });
      expect(tooLarge.status).toBe(422);
      expect(await tooLarge.json()).toMatchObject({ statusCode: 422 });
    } finally {
      await send('DELETE', `/projects/${project.id}`);
    }
  });

  it('refuses an invoice or a resource for a project that does not exist, with an error envelope', async () => {
    const invoice = await send('POST', '/invoices', {
      projectId: 99999,
      number: 'INV-1',
      issueDate: '2026-10-01',
      lineItems: [{ description: 'x', quantity: 1, rate: 1 }],
    });
    expect(invoice.status).toBe(409);
    expect(await invoice.json()).toMatchObject({ statusCode: 409, data: null });
    const resource = await send('POST', '/project-resources', { projectId: 99999, categoryId: 1, name: 'x', rate: 1 });
    expect(resource.status).toBe(409);
    expect(await resource.json()).toMatchObject({ statusCode: 409, data: null });
  });

  it('answers an invoice, a resource and a draft that do not exist with an error envelope', async () => {
    for (const [method, path] of [
      ['DELETE', '/invoices/99999'],
      ['DELETE', '/project-resources/99999'],
      ['GET', '/projects/99999/invoice-draft'],
    ] as const) {
      const response = await send(method, path);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ statusCode: 404, data: null });
    }
  });
});
