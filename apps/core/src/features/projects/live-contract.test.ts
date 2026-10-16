import { z } from 'zod';
import { unwrap } from '@/lib/core-api';
import { signInLive, type LiveSend } from '@/test/live-api';
import {
  emptyInvoiceForm,
  emptyProjectForm,
  invoiceDraftSchema,
  invoiceRowSchema,
  invoiceRowsSchema,
  invoiceTotals,
  projectRowSchema,
  resourceRowSchema,
  resourceRowsSchema,
  toInvoiceBody,
  toProjectBody,
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
        { description: 'Wiring Person', headcount: 1, quantity: 160, rate: 150 },
        { description: 'Open role', headcount: 1, quantity: 160, rate: 75 },
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

describe.skipIf(!base)('numbering, billing period, Qty and the invoice document, on a service with no mail set up', () => {
  // Run the scratch service with COMPANY_NAME and BANK_ACCOUNT_NUMBER set and SMTP_HOST blank: see the run notes.
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('numbers an invoice from the project key, prices Qty x hours x rate, keeps the period, and draws the PDF', async () => {
    const category = unwrap(
      await (await send('POST', '/categories', { name: 'Live docs', description: 'Made by the live test' })).json(),
      createdSchema,
    );
    const created = await send('POST', '/projects', {
      name: 'Live docs',
      description: null,
      clientId: null,
      projectType: 'resource_augmentation',
      billingType: 'retainer',
      key: ' lv1 ',
      billingAddress: 'Michael Jordan,\nVenice,\nCalifornia 90291, USA',
    });
    expect(created.status).toBe(201);
    const project = unwrap(await created.json(), projectRowSchema);
    expect(project).toMatchObject({ key: 'LV1', billingAddress: 'Michael Jordan,\nVenice,\nCalifornia 90291, USA' });

    try {
      const resource = await send('POST', '/project-resources', {
        projectId: project.id,
        name: 'Fullstack Developer',
        personId: null,
        categoryId: category.id,
        headcount: 3,
        rate: 27,
      });
      expect(resource.status).toBe(201);
      const draft = await readDraft(project.id);
      expect(draft.lineItems).toEqual([{ description: 'Fullstack Developer', headcount: 3, quantity: 160, rate: 27 }]);

      const next = await send('GET', `/projects/${project.id}/next-invoice-number?issueDate=2026-10-01`);
      expect(next.status).toBe(200);
      expect(((await next.json()) as { data: { number: string } }).data.number).toMatch(/26-27\/LV1\/001$/);

      const body = {
        projectId: project.id,
        description: null,
        issueDate: '2026-10-01',
        dueDate: '2027-01-01',
        paidDate: null,
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        lineItems: draft.lineItems,
      };
      const first = await send('POST', '/invoices', { ...body, number: null });
      expect(first.status).toBe(201);
      const invoice = unwrap(await first.json(), invoiceRowSchema);
      expect(invoice.number).toMatch(/26-27\/LV1\/001$/);
      expect(invoice).toMatchObject({ amount: 12_960, periodStart: '2026-09-01', periodEnd: '2026-09-30' });
      expect(invoice.lineItems[0]).toMatchObject({ headcount: 3, quantity: 160, rate: 27, amount: 12_960 });

      const second = unwrap(await (await send('POST', '/invoices', { ...body, number: null })).json(), invoiceRowSchema);
      expect(second.number).toMatch(/26-27\/LV1\/002$/);

      const pdf = await send('GET', `/invoices/${invoice.id}/pdf`);
      expect(pdf.status).toBe(200);
      expect(pdf.headers.get('content-type')).toBe('application/pdf');
      expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 4))).toBe('%PDF');

      const email = await send('GET', `/invoices/${invoice.id}/email-draft`);
      expect(email.status).toBe(200);
      expect(((await email.json()) as { data: { subject: string } }).data.subject).toContain(invoice.number);

      const sent = await send('POST', `/invoices/${invoice.id}/send`, {
        to: ['someone@example.com'],
        subject: 'Invoice',
        message: 'Attached.',
      });
      expect(sent.status).toBe(503);
      expect(await sent.json()).toMatchObject({ statusCode: 503, message: 'Email is not set up on the server' });
    } finally {
      expect((await send('DELETE', `/projects/${project.id}`)).status).toBe(200);
      await send('DELETE', `/categories/${category.id}`);
    }
  });

  it('refuses a key another project uses, a lopsided period and a numberless invoice on a project with no key', async () => {
    const make = (extra: object) =>
      send('POST', '/projects', { name: 'Live keys', projectType: 'product', billingType: 'fixed_cost', ...extra });
    const first = unwrap(await (await make({ key: 'LK1' })).json(), projectRowSchema);
    const keyless = unwrap(await (await make({})).json(), projectRowSchema);
    try {
      const twin = await make({ key: 'lk1' });
      expect(twin.status).toBe(409);
      expect(await twin.json()).toMatchObject({ message: 'Another project already uses the key "LK1"' });

      const line = [{ description: 'Work', headcount: 1, quantity: 1, rate: 5 }];
      const lopsided = await send('POST', '/invoices', {
        projectId: first.id,
        number: 'X-1',
        issueDate: '2026-10-01',
        periodStart: '2026-09-01',
        lineItems: line,
      });
      expect(lopsided.status).toBe(422);

      const numberless = await send('POST', '/invoices', { projectId: keyless.id, issueDate: '2026-10-01', lineItems: line });
      expect(numberless.status).toBe(422);
      expect(await numberless.json()).toMatchObject({
        message: 'Give an invoice number, or add a key to the project so one can be generated',
      });
    } finally {
      await send('DELETE', `/projects/${first.id}`);
      await send('DELETE', `/projects/${keyless.id}`);
    }
  });
});

describe.skipIf(!base)('the discount, on a service with its migration applied', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  const lineFor = (rate: number) => ({ description: 'Work', headcount: '1', quantity: '1', rate: String(rate) });

  it('takes a project’s discount to its invoices, off their amounts and the project’s totals, and lets one invoice differ', async () => {
    // The bodies come from the form's own builders, so what the dialogs send is what the service is shown.
    const created = await send(
      'POST',
      '/projects',
      toProjectBody({
        ...emptyProjectForm,
        name: 'Live discount',
        key: 'LD1',
        projectType: 'product',
        billingType: 'fixed_cost',
        discountPercent: '7.5',
      }),
    );
    expect(created.status).toBe(201);
    const project = unwrap(await created.json(), projectRowSchema);
    expect(project.discountPercent).toBe(7.5);

    try {
      const invoiceBody = (fields: object) => ({
        projectId: project.id,
        ...toInvoiceBody({ ...emptyInvoiceForm, issueDate: '2026-10-01', lines: [lineFor(1010)], ...fields }),
      });

      // The dialog opens on the project's 7.5 and sends it: 7.5% of 1,010 is 75.75, so 76 off and 934 to pay.
      const inherited = unwrap(
        await (await send('POST', '/invoices', invoiceBody({ number: 'LD-1', discountPercent: '7.5' }))).json(),
        invoiceRowSchema,
      );
      expect(inherited).toMatchObject({ subtotal: 1010, discountPercent: 7.5, amount: 934 });

      // One invoice taken off the contract's discount.
      const own = unwrap(
        await (await send('POST', '/invoices', invoiceBody({ number: 'LD-2', discountPercent: '0' }))).json(),
        invoiceRowSchema,
      );
      expect(own).toMatchObject({ subtotal: 1010, discountPercent: 0, amount: 1010 });

      // Totals add up what each client pays. 934 + 1,010, not the lines' 2,020.
      expect(await readProject(project.id)).toMatchObject({ totalValue: 1944, totalOutstanding: 1944 });

      // The project's discount changes for later invoices only.
      const changed = await send('PATCH', `/projects/${project.id}`, toProjectBody({ ...emptyProjectForm, name: 'Live discount', key: 'LD1', projectType: 'product', billingType: 'fixed_cost', discountPercent: '50' }));
      expect(changed.status).toBe(200);
      const [again] = (await listedInvoices(project.id)).filter((row) => row.number === 'LD-1');
      expect(again).toMatchObject({ discountPercent: 7.5, amount: 934 });

      // Editing an invoice sends its own figure back and keeps it.
      const edited = await send('PATCH', `/invoices/${inherited.id}`, toInvoiceBody({ ...emptyInvoiceForm, number: 'LD-1', issueDate: '2026-10-01', discountPercent: '12.25', lines: [lineFor(1010)] }));
      expect(edited.status).toBe(200);
      expect(unwrap(await edited.json(), invoiceRowSchema)).toMatchObject({ discountPercent: 12.25, amount: 886 });

      const pdf = await send('GET', `/invoices/${inherited.id}/pdf`);
      expect(pdf.status).toBe(200);
      expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 4))).toBe('%PDF');
    } finally {
      expect((await send('DELETE', `/projects/${project.id}`)).status).toBe(200);
    }
  });

  it('saves the amount the dialog previews, to the dollar, whatever the rounding', async () => {
    const created = await send(
      'POST',
      '/projects',
      toProjectBody({ ...emptyProjectForm, name: 'Live rounding', key: 'LD2', projectType: 'product', billingType: 'fixed_cost' }),
    );
    const project = unwrap(await created.json(), projectRowSchema);
    try {
      for (const [rate, percent] of [
        [1010, '7.5'],
        [1005, '7.5'],
        [5, '10'],
        [15, '10'],
        [25, '10'],
        [1, '50'],
        [99_999, '33.33'],
        [21_600, '12.25'],
      ] as const) {
        const lines = [lineFor(rate)];
        const saved = await send('POST', '/invoices', {
          projectId: project.id,
          ...toInvoiceBody({ ...emptyInvoiceForm, number: `R-${rate}-${percent}`, issueDate: '2026-10-01', discountPercent: percent, lines }),
        });
        expect(saved.status).toBe(201);
        const row = unwrap(await saved.json(), invoiceRowSchema);
        expect(row.amount, `${rate} at ${percent}%`).toBe(invoiceTotals(lines, percent).total);
      }
    } finally {
      await send('DELETE', `/projects/${project.id}`);
    }
  });

  it('refuses a discount above 50 or with a third decimal, on a project and on an invoice, with an error envelope', async () => {
    const project = unwrap(
      await (
        await send('POST', '/projects', toProjectBody({ ...emptyProjectForm, name: 'Live limits', key: 'LD3', projectType: 'product', billingType: 'fixed_cost' }))
      ).json(),
      projectRowSchema,
    );
    try {
      for (const bad of [50.01, 1.234, -1]) {
        const onProject = await send('PATCH', `/projects/${project.id}`, { discountPercent: bad });
        expect(onProject.status, `project ${bad}`).toBe(422);
        expect(await onProject.json()).toMatchObject({ statusCode: 422 });
        const onInvoice = await send('POST', '/invoices', {
          projectId: project.id,
          number: 'BAD-1',
          issueDate: '2026-10-01',
          discountPercent: bad,
          lineItems: [{ description: 'Work', headcount: 1, quantity: 1, rate: 5 }],
        });
        expect(onInvoice.status, `invoice ${bad}`).toBe(422);
      }
      expect(await readProject(project.id)).toMatchObject({ discountPercent: 0 });
    } finally {
      await send('DELETE', `/projects/${project.id}`);
    }
  });

  it('keeps a project’s status and dates, refuses an end before the start, and clears the dates again', async () => {
    const created = await send('POST', '/projects', {
      name: 'Status check',
      description: null,
      clientId: null,
      projectType: 'product',
      billingType: 'fixed_cost',
      projectStatus: 'on_hold',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(created.status).toBe(201);
    const project = unwrap(await created.json(), projectRowSchema);
    try {
      expect(project).toMatchObject({ projectStatus: 'on_hold', startDate: '2026-01-01', endDate: '2026-12-31' });

      const early = await send('PATCH', `/projects/${project.id}`, { endDate: '2025-12-31' });
      expect(early.status).toBe(422);
      expect(await readProject(project.id)).toMatchObject({ startDate: '2026-01-01', endDate: '2026-12-31' });

      const cleared = await send('PATCH', `/projects/${project.id}`, {
        projectStatus: 'completed',
        startDate: null,
        endDate: null,
      });
      expect(cleared.status).toBe(200);
      expect(await readProject(project.id)).toMatchObject({
        projectStatus: 'completed',
        startDate: null,
        endDate: null,
      });
    } finally {
      await send('DELETE', `/projects/${project.id}`);
    }
  });
});
