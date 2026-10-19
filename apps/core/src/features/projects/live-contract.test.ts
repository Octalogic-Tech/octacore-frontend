import { z } from 'zod';
import { clientRowsSchema, contactRowsSchema } from '@/features/clients/schema';
import { unwrap } from '@/lib/core-api';
import { MAX_CENTS } from '@/lib/money';
import { signInLive, type LiveSend } from '@/test/live-api';
import {
  emptyInvoiceForm,
  emptyProjectForm,
  emptyResourceForm,
  invoiceDraftSchema,
  invoiceRowSchema,
  invoiceRowsSchema,
  invoiceTotals,
  projectRowSchema,
  resourceRowSchema,
  resourceRowsSchema,
  toInvoiceBody,
  toProjectBody,
  toResourceBody,
  toResourceFormValues,
} from './schema';
import { RETAINER_HOURS } from './team-margin';

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
        rateCents: 15000,
      });
      expect(linked.status).toBe(201);
      resourceId = unwrap(await linked.json(), resourceRowSchema).id;
      const open = await send('POST', '/project-resources', {
        projectId: project.id,
        name: 'Open role',
        personId: null,
        categoryId: category.id,
        rateCents: 7500,
      });
      expect(open.status).toBe(201);
      expect((await listedResources(project.id)).map((row) => row.name)).toEqual(['Wiring Person', 'Open role']);
      expect(await listedResources(project.id)).toMatchObject([
        { personName: 'Wiring Person', categoryName: 'Wiring check', rateCents: 15000 },
        { personId: null, personName: '', rateCents: 7500 },
      ]);

      const draft = await readDraft(project.id);
      expect(draft.lineItems).toEqual([
        { description: 'Wiring Person', headcount: 1, quantity: 160, rateCents: 15000 },
        { description: 'Open role', headcount: 1, quantity: 160, rateCents: 7500 },
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
      expect(invoice).toMatchObject({ projectId: project.id, number: 'INV-1', amountCents: 3_600_000 });
      expect(invoice.lineItems).toHaveLength(2);
      expect(await readProject(project.id)).toMatchObject({ totalValueCents: 3_600_000, totalOutstandingCents: 3_600_000 });

      const replaced = await send('PATCH', `/invoices/${invoice.id}`, {
        lineItems: [{ description: 'Wiring Person — Wiring check', quantity: 80, rateCents: 15000 }],
      });
      expect(replaced.status).toBe(200);
      expect(unwrap(await replaced.json(), invoiceRowSchema)).toMatchObject({ amountCents: 1_200_000 });
      expect(await readProject(project.id)).toMatchObject({ totalValueCents: 1_200_000, totalOutstandingCents: 1_200_000 });

      const paid = await send('PATCH', `/invoices/${invoice.id}`, { paidDate: '2026-10-15' });
      expect(unwrap(await paid.json(), invoiceRowSchema)).toMatchObject({ paidDate: '2026-10-15', amountCents: 1_200_000 });
      expect(await readProject(project.id)).toMatchObject({ totalValueCents: 1_200_000, totalOutstandingCents: 0 });

      // A change of resource never changes an invoice already built from it.
      await send('PATCH', `/project-resources/${resourceId}`, { rateCents: 99900 });
      expect((await listedInvoices(project.id))[0]).toMatchObject({ amountCents: 1_200_000 });
      expect((await readDraft(project.id)).lineItems[0]).toMatchObject({ rateCents: 99900 });
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

  it('builds a retainer from a resource at $12.50 an hour, to the cent, and saves the resource again unchanged', async () => {
    const category = unwrap(
      await (await send('POST', '/categories', { name: 'Cents check', description: 'Made by the live test' })).json(),
      createdSchema,
    );
    const created = await send('POST', '/projects', {
      name: 'Cents check',
      description: null,
      clientId: null,
      projectType: 'resource_augmentation',
      billingType: 'retainer',
    });
    expect(created.status).toBe(201);
    const project = unwrap(await created.json(), projectRowSchema);
    try {
      // The body comes from the form's own builder, so the service is shown what the dialog sends.
      const resourceBody = toResourceBody({
        ...emptyResourceForm,
        name: 'Cents check',
        categoryId: String(category.id),
        rate: '12.50',
      });
      expect(resourceBody.rateCents).toBe(1250);
      const linked = await send('POST', '/project-resources', { projectId: project.id, ...resourceBody });
      expect(linked.status).toBe(201);
      const resource = unwrap(await linked.json(), resourceRowSchema);
      expect(resource).toMatchObject({ headcount: 1, rateCents: 1250 });

      const draft = await readDraft(project.id);
      expect(draft.lineItems).toEqual([{ description: 'Cents check', headcount: 1, quantity: 160, rateCents: 1250 }]);

      // One person, 160 hours, 1,250 cents an hour: 200,000 cents.
      const createdInvoice = await send('POST', '/invoices', {
        projectId: project.id,
        number: 'CENTS-1',
        issueDate: '2026-10-01',
        lineItems: draft.lineItems,
      });
      expect(createdInvoice.status).toBe(201);
      const invoice = unwrap(await createdInvoice.json(), invoiceRowSchema);
      expect(invoice).toMatchObject({ subtotalCents: 200000, amountCents: 200000 });
      expect(invoice.lineItems).toMatchObject([{ rateCents: 1250, amountCents: 200000 }]);
      expect(await readProject(project.id)).toMatchObject({ totalValueCents: 200000, totalOutstandingCents: 200000 });

      // Opening the resource and saving it without a change sends the same cents: no drift, and no `projectId`.
      const unchanged = await send('PATCH', `/project-resources/${resource.id}`, toResourceBody(toResourceFormValues(resource)));
      expect(unchanged.status).toBe(200);
      expect((await listedResources(project.id))[0]).toMatchObject({ rateCents: 1250 });
    } finally {
      await send('DELETE', `/projects/${project.id}`);
      await send('DELETE', `/categories/${category.id}`);
    }
  });

  it('refuses a write that still sends rate, on a resource and on an invoice line, and names the old key', async () => {
    const category = unwrap(
      await (await send('POST', '/categories', { name: 'Old name check', description: 'Made by the live test' })).json(),
      createdSchema,
    );
    const project = unwrap(
      await (
        await send('POST', '/projects', { name: 'Old name check', projectType: 'product', billingType: 'fixed_cost' })
      ).json(),
      projectRowSchema,
    );
    // The envelope writes every part of a location as text, so a line's place is '0', not 0.
    const namesKey = (...loc: string[]) =>
      expect.objectContaining({ statusCode: 422, data: expect.arrayContaining([expect.objectContaining({ loc })]) });
    try {
      const resource = unwrap(
        await (
          await send('POST', '/project-resources', {
            projectId: project.id,
            name: 'Old name',
            personId: null,
            categoryId: category.id,
            rateCents: 1250,
          })
        ).json(),
        resourceRowSchema,
      );

      const staleCreate = await send('POST', '/project-resources', {
        projectId: project.id,
        name: 'Stale',
        personId: null,
        categoryId: category.id,
        rate: 12,
      });
      expect(staleCreate.status).toBe(422);
      expect(await staleCreate.json()).toEqual(namesKey('body', 'rate'));

      const stalePatch = await send('PATCH', `/project-resources/${resource.id}`, { rate: 13 });
      expect(stalePatch.status).toBe(422);
      expect(await stalePatch.json()).toEqual(namesKey('body', 'rate'));
      expect(await listedResources(project.id)).toMatchObject([{ id: resource.id, rateCents: 1250 }]);

      const staleLine = await send('POST', '/invoices', {
        projectId: project.id,
        number: 'OLD-1',
        issueDate: '2026-10-01',
        lineItems: [{ description: 'Stale line', quantity: 1, rate: 12 }],
      });
      expect(staleLine.status).toBe(422);
      expect(await staleLine.json()).toEqual(namesKey('body', 'lineItems', '0', 'rate'));
      expect(await listedInvoices(project.id)).toEqual([]);
    } finally {
      await send('DELETE', `/projects/${project.id}`);
      await send('DELETE', `/categories/${category.id}`);
    }
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
        lineItems: [{ description: 'Milestone 1', quantity: 1, rateCents: 500_000 }],
      });
      expect(created.status).toBe(201);
      expect(unwrap(await created.json(), invoiceRowSchema)).toMatchObject({ amountCents: 500_000 });
      expect(await readProject(project.id)).toMatchObject({ totalValueCents: 500_000 });
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
      // 100,000 x 100,001 cents is 10,000,100,000: a hundred thousand cents over the cap.
      const tooLarge = await send('POST', '/invoices', {
        projectId: project.id,
        number: 'INV-1',
        issueDate: '2026-10-01',
        lineItems: [{ description: 'Too large', quantity: 100000, rateCents: 100_001 }],
      });
      expect(tooLarge.status).toBe(422);
      expect(await tooLarge.json()).toMatchObject({ statusCode: 422 });
      const rateAboveCap = await send('POST', '/invoices', {
        projectId: project.id,
        number: 'INV-1',
        issueDate: '2026-10-01',
        lineItems: [{ description: 'Rate above the cap', quantity: 1, rateCents: MAX_CENTS + 1 }],
      });
      expect(rateAboveCap.status).toBe(422);
      expect(await rateAboveCap.json()).toMatchObject({ statusCode: 422 });
      expect(await listedInvoices(project.id)).toEqual([]);
    } finally {
      await send('DELETE', `/projects/${project.id}`);
    }
  });

  it('refuses an invoice or a resource for a project that does not exist, with an error envelope', async () => {
    const invoice = await send('POST', '/invoices', {
      projectId: 99999,
      number: 'INV-1',
      issueDate: '2026-10-01',
      lineItems: [{ description: 'x', quantity: 1, rateCents: 100 }],
    });
    expect(invoice.status).toBe(409);
    expect(await invoice.json()).toMatchObject({ statusCode: 409, data: null });
    const resource = await send('POST', '/project-resources', { projectId: 99999, categoryId: 1, name: 'x', rateCents: 100 });
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
        rateCents: 2700,
      });
      expect(resource.status).toBe(201);
      const draft = await readDraft(project.id);
      expect(draft.lineItems).toEqual([{ description: 'Fullstack Developer', headcount: 3, quantity: 160, rateCents: 2700 }]);

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
      expect(invoice).toMatchObject({ amountCents: 1_296_000, periodStart: '2026-09-01', periodEnd: '2026-09-30' });
      expect(invoice.lineItems[0]).toMatchObject({ headcount: 3, quantity: 160, rateCents: 2700, amountCents: 1_296_000 });

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

      const line = [{ description: 'Work', headcount: 1, quantity: 1, rateCents: 500 }];
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

  // A line as the dialog holds it: text, with the rate in dollars and cents.
  const lineFor = (rate: string, quantity = '1') => ({ description: 'Work', headcount: '1', quantity, rate });

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
        ...toInvoiceBody({ ...emptyInvoiceForm, issueDate: '2026-10-01', lines: [lineFor('10.10')], ...fields }),
      });

      // The dialog opens on the project's 7.5 and sends it: 7.5% of 1,010 cents is 75.75, so 75 off (floored) and 935 to pay.
      const inherited = unwrap(
        await (await send('POST', '/invoices', invoiceBody({ number: 'LD-1', discountPercent: '7.5' }))).json(),
        invoiceRowSchema,
      );
      expect(inherited).toMatchObject({ subtotalCents: 1010, discountPercent: 7.5, amountCents: 935 });

      // One invoice taken off the contract's discount.
      const own = unwrap(
        await (await send('POST', '/invoices', invoiceBody({ number: 'LD-2', discountPercent: '0' }))).json(),
        invoiceRowSchema,
      );
      expect(own).toMatchObject({ subtotalCents: 1010, discountPercent: 0, amountCents: 1010 });

      // Totals add up what each client pays. 935 + 1,010, not the lines' 2,020.
      expect(await readProject(project.id)).toMatchObject({ totalValueCents: 1945, totalOutstandingCents: 1945 });

      // The project's discount changes for later invoices only.
      const changed = await send('PATCH', `/projects/${project.id}`, toProjectBody({ ...emptyProjectForm, name: 'Live discount', key: 'LD1', projectType: 'product', billingType: 'fixed_cost', discountPercent: '50' }));
      expect(changed.status).toBe(200);
      const [again] = (await listedInvoices(project.id)).filter((row) => row.number === 'LD-1');
      expect(again).toMatchObject({ discountPercent: 7.5, amountCents: 935 });

      // Editing an invoice sends its own figure back and keeps it.
      const edited = await send('PATCH', `/invoices/${inherited.id}`, toInvoiceBody({ ...emptyInvoiceForm, number: 'LD-1', issueDate: '2026-10-01', discountPercent: '12.25', lines: [lineFor('10.10')] }));
      expect(edited.status).toBe(200);
      expect(unwrap(await edited.json(), invoiceRowSchema)).toMatchObject({ discountPercent: 12.25, amountCents: 887 });

      const pdf = await send('GET', `/invoices/${inherited.id}/pdf`);
      expect(pdf.status).toBe(200);
      expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 4))).toBe('%PDF');
    } finally {
      expect((await send('DELETE', `/projects/${project.id}`)).status).toBe(200);
    }
  });

  it('saves the amount the dialog previews, to the cent, whatever the rounding', async () => {
    const created = await send(
      'POST',
      '/projects',
      toProjectBody({ ...emptyProjectForm, name: 'Live rounding', key: 'LD2', projectType: 'product', billingType: 'fixed_cost' }),
    );
    const project = unwrap(await created.json(), projectRowSchema);
    try {
      for (const rate of ['12.50', '0.01', '999.99']) {
        for (const percent of ['7.5', '12.25', '33.33', '50']) {
          const lines = [lineFor(rate)];
          const saved = await send('POST', '/invoices', {
            projectId: project.id,
            ...toInvoiceBody({ ...emptyInvoiceForm, number: `R-${rate}-${percent}`, issueDate: '2026-10-01', discountPercent: percent, lines }),
          });
          expect(saved.status, `${rate} at ${percent}%`).toBe(201);
          const row = unwrap(await saved.json(), invoiceRowSchema);
          const preview = invoiceTotals(lines, percent);
          expect(row.subtotalCents, `${rate} at ${percent}%`).toBe(preview.subtotal);
          expect(row.amountCents, `${rate} at ${percent}%`).toBe(preview.total);
        }
      }
    } finally {
      await send('DELETE', `/projects/${project.id}`);
    }
  });

  it('saves the amount the dialog previews at the extremes: 200 lines at the cap, past what a number holds exactly', async () => {
    const created = await send(
      'POST',
      '/projects',
      toProjectBody({ ...emptyProjectForm, name: 'Live extremes', key: 'LD4', projectType: 'product', billingType: 'fixed_cost' }),
    );
    const project = unwrap(await created.json(), projectRowSchema);
    try {
      // 100,000 hours at $1,000.00 is 10,000,000,000 cents, exactly the cap. 199 of them and a line of one cent make
      // an odd subtotal of 1,990,000,000,001, so 50% off is a half cent, and the product before the division
      // (subtotal x 5,000 hundredths of a percent, about 10^16) is past 2^53.
      const lines = [...Array.from({ length: 199 }, () => lineFor('1000.00', '100000')), lineFor('0.01')];
      for (const percent of ['50', '33.33']) {
        const saved = await send('POST', '/invoices', {
          projectId: project.id,
          ...toInvoiceBody({ ...emptyInvoiceForm, number: `X-${percent}`, issueDate: '2026-10-01', discountPercent: percent, lines }),
        });
        expect(saved.status, `${percent}%`).toBe(201);
        const row = unwrap(await saved.json(), invoiceRowSchema);
        const preview = invoiceTotals(lines, percent);
        expect(preview.subtotal).toBe(1_990_000_000_001);
        expect(row.subtotalCents, `${percent}%`).toBe(preview.subtotal);
        expect(row.amountCents, `${percent}%`).toBe(preview.total);
        if (percent === '50') expect(row.amountCents).toBe(995_000_000_001);
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
          lineItems: [{ description: 'Work', headcount: 1, quantity: 1, rateCents: 500 }],
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

  it('saves a project with technologies, replaces them, and loses one that was deleted', async () => {
    const react = unwrap(await (await send('POST', '/technologies', { name: 'Live React' })).json(), createdSchema);
    const nest = unwrap(await (await send('POST', '/technologies', { name: 'Live Nest' })).json(), createdSchema);
    const created = await send('POST', '/projects', {
      name: 'Technology check',
      description: null,
      clientId: null,
      projectType: 'product',
      billingType: 'fixed_cost',
      technologyIds: [react.id, nest.id],
    });
    expect(created.status).toBe(201);
    const project = unwrap(await created.json(), projectRowSchema);
    try {
      expect(project.technologies.map((technology) => technology.name)).toEqual(['Live Nest', 'Live React']);

      const unknown = await send('PATCH', `/projects/${project.id}`, { technologyIds: [999_999] });
      expect(unknown.status).toBe(409);

      const replaced = await send('PATCH', `/projects/${project.id}`, { technologyIds: [nest.id] });
      expect(replaced.status).toBe(200);
      expect((await readProject(project.id)).technologies).toEqual([{ id: nest.id, name: 'Live Nest' }]);

      await send('DELETE', `/technologies/${nest.id}`);
      expect((await readProject(project.id)).technologies).toEqual([]);
    } finally {
      await send('DELETE', `/projects/${project.id}`);
      await send('DELETE', `/technologies/${react.id}`);
      await send('DELETE', `/technologies/${nest.id}`);
    }
  });

  it('lets a project find its client’s city and contact in the two lists the Overview reads', async () => {
    const client = unwrap(
      await (await send('POST', '/clients', { name: 'Contact check client', city: 'Pune' })).json(),
      createdSchema,
    );
    const contact = unwrap(
      await (
        await send('POST', '/client-contacts', {
          clientId: client.id,
          name: 'Contact check person',
          email: 'live@example.com',
          phone: '+91 20 5550 0000',
        })
      ).json(),
      createdSchema,
    );
    const created = await send('POST', '/projects', {
      name: 'Contact check',
      description: null,
      clientId: client.id,
      projectType: 'product',
      billingType: 'fixed_cost',
    });
    expect(created.status).toBe(201);
    const project = unwrap(await created.json(), projectRowSchema);
    try {
      expect(project).toMatchObject({ clientId: client.id, clientName: 'Contact check client' });
      const clients = unwrap(await (await send('GET', '/clients')).json(), clientRowsSchema);
      const contacts = unwrap(await (await send('GET', '/client-contacts')).json(), contactRowsSchema);
      expect(clients.find((row) => row.id === project.clientId)).toMatchObject({ city: 'Pune', countryName: '' });
      expect(contacts.filter((row) => row.clientId === project.clientId)).toMatchObject([
        { id: contact.id, name: 'Contact check person', email: 'live@example.com', phone: '+91 20 5550 0000' },
      ]);
    } finally {
      await send('DELETE', `/projects/${project.id}`);
      await send('DELETE', `/clients/${client.id}`); // the service soft-deletes the client's contact with it
    }
  });

  it('drafts a retainer resource for the same hours a month that the margin sentence uses', async () => {
    const category = unwrap(
      await (await send('POST', '/categories', { name: 'Hours check', description: 'Made by the live test' })).json(),
      createdSchema,
    );
    const created = await send('POST', '/projects', {
      name: 'Hours check',
      description: null,
      clientId: null,
      projectType: 'resource_augmentation',
      billingType: 'retainer',
    });
    expect(created.status).toBe(201);
    const project = unwrap(await created.json(), projectRowSchema);
    try {
      const resource = await send('POST', '/project-resources', {
        projectId: project.id,
        name: 'Hours check',
        personId: null,
        categoryId: category.id,
        rateCents: 5000,
      });
      expect(resource.status).toBe(201);
      const draft = await readDraft(project.id);
      expect(draft.lineItems).toHaveLength(1);
      expect(draft.lineItems[0].quantity).toBe(RETAINER_HOURS);
    } finally {
      await send('DELETE', `/projects/${project.id}`);
      await send('DELETE', `/categories/${category.id}`);
    }
  });
});
