import { MAX_CENTS, toAmountText } from '@/lib/money';
import { draftBody, emailDraftBody, invoiceRows, projectRows, resourceRows } from '@/test/fixtures/projects';
import {
  blankLine,
  discountAmount,
  draftToLines,
  emailFormSchema,
  emptyInvoiceForm,
  emptyProjectForm,
  emptyResourceForm,
  invoiceDraftSchema,
  invoiceFormSchema,
  invoiceRowsSchema,
  invoiceTotals,
  lineAmount,
  linesTotal,
  makeInvoiceFormSchema,
  overdueTotal,
  parseRecipients,
  projectFormSchema,
  projectRowsSchema,
  resourceFormSchema,
  resourceRowsSchema,
  sortInvoices,
  toInvoiceBody,
  toEmailFormValues,
  toInvoiceFormValues,
  toProjectBody,
  toProjectFormValues,
  toResourceBody,
  toResourceFormValues,
  toSendBody,
  type EmailFormValues,
  type InvoiceFormValues,
  type LineFormValues,
  type ProjectFormValues,
  type ResourceFormValues,
} from './schema';

const projects = projectRowsSchema.parse(projectRows);
const invoices = invoiceRowsSchema.parse(invoiceRows);
const resources = resourceRowsSchema.parse(resourceRows);

const projectForm = (over: Partial<ProjectFormValues> = {}): ProjectFormValues => ({
  ...emptyProjectForm,
  name: 'Website',
  projectType: 'product',
  billingType: 'retainer',
  ...over,
});

const lineForm = (over: Partial<LineFormValues> = {}): LineFormValues => ({
  description: 'Backend work',
  headcount: '1',
  quantity: '160',
  rate: '150',
  ...over,
});

const invoiceForm = (over: Partial<InvoiceFormValues> = {}): InvoiceFormValues => ({
  ...emptyInvoiceForm,
  number: 'INV-001',
  issueDate: '2026-10-01',
  lines: [lineForm()],
  ...over,
});

const projectMessages = (values: ProjectFormValues) => {
  const result = projectFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

const invoiceMessages = (values: InvoiceFormValues) => {
  const result = invoiceFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('project row schema', () => {
  it('flattens the embedded client to its name, turns nulls into empty text and adds the type labels', () => {
    const [website, mobile] = projects;
    expect(website).toMatchObject({
      id: 1,
      name: 'Website',
      description: 'Marketing site.',
      clientId: 1,
      clientName: 'Acme',
      projectType: 'resource_augmentation',
      billingType: 'retainer',
      projectTypeLabel: 'Resource augmentation',
      billingTypeLabel: 'Retainer',
      totalValueCents: 4_800_000,
      totalOutstandingCents: 1_200_000,
    });
    expect(website).not.toHaveProperty('client');
    expect(mobile).toMatchObject({ description: '', clientId: null, clientName: '' });
    expect(mobile).toMatchObject({ projectTypeLabel: 'Product', billingTypeLabel: 'Fixed cost' });
  });

  it('keeps null types, with empty labels, for a project saved before they existed', () => {
    expect(projects[2]).toMatchObject({
      projectType: null,
      billingType: null,
      projectTypeLabel: '',
      billingTypeLabel: '',
    });
  });

  it('keeps the id of a client the service no longer embeds', () => {
    const [row] = projectRowsSchema.parse([{ ...projectRows[0], client: null }]);
    expect(row).toMatchObject({ clientId: 1, clientName: '' });
  });

  it.each([
    ['an id', { ...projectRows[0], id: undefined }],
    ['a name', { ...projectRows[0], name: undefined }],
    ['a billing type field', { ...projectRows[0], billingType: undefined }],
    ['a total value', { ...projectRows[0], totalValueCents: undefined }],
    ['a total outstanding', { ...projectRows[0], totalOutstandingCents: undefined }],
    ['a known billing type', { ...projectRows[0], billingType: 'monthly' }],
    ['a known project type', { ...projectRows[0], projectType: 'service' }],
    ['a numeric total', { ...projectRows[0], totalValueCents: '4800000' }],
    ['a whole-cent total', { ...projectRows[0], totalValueCents: 4_800_000.5 }],
  ])('rejects a project row without %s', (_label, row) => {
    expect(projectRowsSchema.safeParse([row]).success).toBe(false);
  });

  it('rejects a bare array of the mock shape, where the client was a string', () => {
    const mock = {
      id: 1,
      name: 'Project 1',
      description: '',
      client: 'Client A',
      totalValueCents: 1,
      totalOutstandingCents: 0,
    };
    expect(projectRowsSchema.safeParse([mock]).success).toBe(false);
  });
});

describe('invoice row schema', () => {
  it('turns a null description into empty text and keeps null dates', () => {
    expect(invoices[0]).toMatchObject({
      number: 'INV-001',
      amountCents: 3_600_000,
      dueDate: '2026-10-31',
      paidDate: '2026-10-12',
    });
    expect(invoices[1]).toMatchObject({ description: '', dueDate: null, paidDate: null });
  });

  it.each([
    ['a project id', { ...invoiceRows[0], projectId: undefined }],
    ['a number', { ...invoiceRows[0], number: undefined }],
    ['an amount', { ...invoiceRows[0], amountCents: undefined }],
    ['a subtotal', { ...invoiceRows[0], subtotalCents: undefined }],
    ['a readable issue date', { ...invoiceRows[0], issueDate: '15/10/2026' }],
    ['a readable paid date', { ...invoiceRows[0], paidDate: 'yesterday' }],
  ])('rejects an invoice row without %s', (_label, row) => {
    expect(invoiceRowsSchema.safeParse([row]).success).toBe(false);
  });
});

describe('sortInvoices', () => {
  const row = (id: number, issueDate: string) => ({ ...invoices[0], id, issueDate });

  it('puts the newest issue date first and the later-entered invoice first on a tie', () => {
    const sorted = sortInvoices([row(1, '2026-10-01'), row(2, '2026-11-01'), row(3, '2026-10-01')]);
    expect(sorted.map((invoice) => invoice.id)).toEqual([2, 3, 1]);
  });

  it('leaves the list it was given alone', () => {
    const rows = [row(1, '2026-10-01'), row(2, '2026-11-01')];
    sortInvoices(rows);
    expect(rows.map((invoice) => invoice.id)).toEqual([1, 2]);
  });
});

describe('overdueTotal', () => {
  // INV-002: unpaid, $12,000.00 (1_200_000 cents). Each case changes only what the name says.
  const unpaid = invoices[1];
  const today = '2026-11-20';

  it.each([
    ['unpaid and due yesterday', { dueDate: '2026-11-19' }, 1_200_000],
    ['unpaid and due today', { dueDate: '2026-11-20' }, 0],
    ['unpaid and due tomorrow', { dueDate: '2026-11-21' }, 0],
    ['unpaid with no due date', { dueDate: null }, 0],
    ['paid, though past its due date', { dueDate: '2026-11-01', paidDate: '2026-11-10' }, 0],
  ])('counts an invoice that is %s as %i', (_name, over, expected) => {
    expect(overdueTotal([{ ...unpaid, ...over }], today)).toBe(expected);
  });

  it('adds up what each overdue invoice asks of the client, after its discount', () => {
    const late = {
      ...unpaid,
      subtotalCents: 1_000_000,
      discountPercent: 10,
      amountCents: 900_000,
      dueDate: '2026-11-01',
    };
    const later = { ...unpaid, id: 9, subtotalCents: 500_000, amountCents: 500_000, dueDate: '2026-11-10' };
    const notYet = { ...unpaid, id: 10, amountCents: 70_000, dueDate: '2026-12-01' };
    expect(overdueTotal([late, later, notYet], today)).toBe(1_400_000);
  });

  it('is zero for no invoices', () => {
    expect(overdueTotal([], today)).toBe(0);
  });
});

describe('project form schema', () => {
  it('accepts a name with both types', () => {
    expect(projectMessages(projectForm())).toEqual([]);
  });

  it('asks for a name and both types', () => {
    expect(projectMessages(emptyProjectForm)).toEqual([
      'Name is required',
      'Choose a project type',
      'Choose a billing type',
    ]);
  });

  it('refuses a name of only spaces and a type it does not know', () => {
    expect(projectMessages(projectForm({ name: '   ' }))).toEqual(['Name is required']);
    expect(projectMessages(projectForm({ projectType: 'service' }))).toEqual(['Choose a project type']);
    expect(projectMessages(projectForm({ billingType: 'monthly' }))).toEqual(['Choose a billing type']);
  });
});

describe('toProjectBody', () => {
  it('sends empty optional fields as null and the client as a number', () => {
    expect(toProjectBody(projectForm())).toEqual({
      name: 'Website',
      description: null,
      clientId: null,
      projectType: 'product',
      billingType: 'retainer',
      key: null,
      billingAddress: null,
      discountPercent: 0,
      projectStatus: 'active',
      startDate: null,
      endDate: null,
      technologyIds: [],
    });
    expect(toProjectBody(projectForm({ description: 'Marketing site.', clientId: '12' }))).toMatchObject({
      description: 'Marketing site.',
      clientId: 12,
    });
  });
});

describe('toProjectFormValues', () => {
  it('opens empty for a new project', () => {
    expect(toProjectFormValues()).toEqual(emptyProjectForm);
  });

  it('opens on a project as text, with the client id as a string', () => {
    expect(toProjectFormValues(projects[0])).toEqual({
      name: 'Website',
      description: 'Marketing site.',
      key: 'WEB',
      billingAddress: 'Acme Corporation\n1 Anvil Road\nPune, India',
      clientId: '1',
      projectType: 'resource_augmentation',
      billingType: 'retainer',
      discountPercent: '0',
      projectStatus: 'active',
      startDate: '2026-01-01',
      endDate: '',
      technologyIds: ['2', '1'],
    });
  });

  it('opens a legacy project with no types chosen', () => {
    expect(toProjectFormValues(projects[2])).toMatchObject({ projectType: '', billingType: '' });
  });

  it('opens on None for a client the service no longer embeds, not on a stale id', () => {
    const [orphan] = projectRowsSchema.parse([{ ...projectRows[0], client: null }]);
    expect(toProjectFormValues(orphan).clientId).toBe('');
  });
});

describe('line helpers', () => {
  it('multiplies whole numbers by a rate in dollars and cents, and gives the amount in cents', () => {
    expect(lineAmount({ headcount: '1', quantity: '160', rate: '150' })).toBe(2_400_000);
    expect(lineAmount({ headcount: '3', quantity: '160', rate: '12.50' })).toBe(600_000);
    expect(lineAmount({ headcount: '1', quantity: ' 2 ', rate: '0' })).toBe(0);
  });

  it('reads the rate on its digits, not through a float', () => {
    expect(lineAmount({ headcount: '1', quantity: '1', rate: '4.35' })).toBe(435);
    expect(lineAmount({ headcount: '1', quantity: '1', rate: '0.07' })).toBe(7);
  });

  it('gives null for a quantity that is not whole and for a rate the form refuses', () => {
    for (const bad of [
      { headcount: '1', quantity: '', rate: '5' },
      { headcount: '1', quantity: '1.5', rate: '5' },
      { headcount: '1', quantity: '3', rate: '$5' },
      { headcount: '1', quantity: '3', rate: '12.505' },
      { headcount: '1', quantity: '3', rate: '1,200' },
      { headcount: '1', quantity: '3', rate: '' },
      { headcount: '1', quantity: '3', rate: '100000000.01' },
    ]) {
      expect(lineAmount(bad)).toBeNull();
    }
  });

  it('totals only the lines that have an amount', () => {
    expect(linesTotal([lineForm(), lineForm({ quantity: '', rate: '' }), lineForm({ quantity: '1', rate: '5' })])).toBe(
      2_400_500,
    );
  });

  it('turns the draft into text fields, the rate as dollars and cents', () => {
    expect(draftToLines(draftBody)).toEqual([
      { description: 'Asha Rao — Mobile', headcount: '1', quantity: '160', rate: '150.00' },
      { description: 'Ben Cho — Web', headcount: '1', quantity: '160', rate: '75.00' },
    ]);
  });
});

describe('invoice form schema', () => {
  it('accepts a number, an issue date and one complete line', () => {
    expect(invoiceMessages(invoiceForm())).toEqual([]);
  });

  it('asks for a number, an issue date and, on the blank line, a description, quantity and rate', () => {
    expect(invoiceMessages(emptyInvoiceForm)).toEqual([
      'Number is required',
      'Issue date is required',
      'Description is required',
      'Quantity is required',
      'Rate is required',
    ]);
  });

  it('refuses a number of only spaces and an invoice with no lines', () => {
    expect(invoiceMessages(invoiceForm({ number: '   ' }))).toEqual(['Number is required']);
    expect(invoiceMessages(invoiceForm({ lines: [] }))).toEqual(['Add at least one line']);
  });

  it.each(['1,000', '12.5', '-5', '1e3', 'lots', '١٢٣'])('says a quantity of %s is not a whole number', (quantity) => {
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity })] }))).toEqual(['Enter a whole number, like 160']);
  });

  it.each(['1,200', '$85', '12.505', '-5', '1e3', 'lots', '.5', '5.'])(
    'says a rate of %s is not dollars and cents',
    (rate) => {
      expect(invoiceMessages(invoiceForm({ lines: [lineForm({ rate })] }))).toEqual([
        'Enter an amount like 7.20, with no commas or signs',
      ]);
    },
  );

  it.each(['12.50', '12.5', '85', '0', '0.00', '0.05'])('accepts a rate of %s', (rate) => {
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ rate })] }))).toEqual([]);
  });

  it('keeps the quantity from 1 to 100,000 and the rate to the cap', () => {
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '1', rate: '0' })] }))).toEqual([]);
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '0' })] }))).toEqual([
      'Quantity must be from 1 to 100,000',
    ]);
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '100001' })] }))).toEqual([
      'Quantity must be from 1 to 100,000',
    ]);
    const atTheCap = lineForm({ quantity: '1', rate: toAmountText(MAX_CENTS) });
    expect(invoiceMessages(invoiceForm({ lines: [atTheCap] }))).toEqual([]);
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '1', rate: '100000000.01' })] }))).toEqual([
      'The amount is too large',
    ]);
  });

  it('asks for a rate, which is told apart from a rate of 0', () => {
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ rate: '' })] }))).toEqual(['Rate is required']);
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ rate: '   ' })] }))).toEqual(['Rate is required']);
  });

  it('refuses a line whose amount would pass the cap, though each field is in range', () => {
    // 100,000 hours at $1,000.01 is 10,000,100,000 cents, a hundred cents over MAX_CENTS.
    const line = lineForm({ quantity: '100000', rate: '1000.01' });
    expect(invoiceMessages(invoiceForm({ lines: [line] }))).toEqual(['This line is too large']);
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '100000', rate: '1000' })] }))).toEqual([]);
  });

  it('reports a rate above the cap once, not again as a large line', () => {
    const line = lineForm({ quantity: '100000', rate: '100000000.01' });
    expect(invoiceMessages(invoiceForm({ lines: [line] }))).toEqual(['The amount is too large']);
  });
});

describe('toInvoiceBody', () => {
  it('sends the lines as numbers, empty optional fields as null, and no amount', () => {
    expect(toInvoiceBody(invoiceForm())).toEqual({
      number: 'INV-001',
      description: null,
      issueDate: '2026-10-01',
      dueDate: null,
      paidDate: null,
      periodStart: null,
      periodEnd: null,
      discountPercent: 0,
      lineItems: [{ description: 'Backend work', headcount: 1, quantity: 160, rateCents: 15000 }],
    });
  });

  it('sends a rate of 12.50 as 1250 cents, and each line with only the keys the service takes', () => {
    const body = toInvoiceBody(invoiceForm({ lines: [lineForm({ rate: '12.50' })] }));
    expect(body.lineItems).toEqual([{ description: 'Backend work', headcount: 1, quantity: 160, rateCents: 1250 }]);
  });

  it('reads leading zeros as the number they spell', () => {
    const body = toInvoiceBody(invoiceForm({ lines: [lineForm({ quantity: '007', rate: '085' })] }));
    expect(body.lineItems).toEqual([{ description: 'Backend work', headcount: 1, quantity: 7, rateCents: 8500 }]);
  });

  it('carries the optional dates and description when they are filled', () => {
    const body = toInvoiceBody(invoiceForm({ description: 'Final', dueDate: '2026-10-31', paidDate: '2026-10-15' }));
    expect(body).toMatchObject({ description: 'Final', dueDate: '2026-10-31', paidDate: '2026-10-15' });
  });
});

describe('toInvoiceFormValues', () => {
  it('opens empty, with one blank line, for a new invoice', () => {
    expect(toInvoiceFormValues()).toEqual(emptyInvoiceForm);
    expect(emptyInvoiceForm.lines).toEqual([blankLine]);
  });

  it('opens on an invoice and its lines as text', () => {
    expect(toInvoiceFormValues(invoices[0])).toEqual({
      number: 'INV-001',
      description: 'October retainer',
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      paidDate: '2026-10-12',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      discountPercent: '0',
      lines: [
        { description: 'Asha Rao — Mobile', headcount: '1', quantity: '160', rate: '150.00' },
        { description: 'Ben Cho — Web', headcount: '1', quantity: '160', rate: '75.00' },
      ],
    });
    expect(toInvoiceFormValues(invoices[1])).toMatchObject({
      description: '',
      dueDate: '',
      paidDate: '',
      periodStart: '',
      periodEnd: '',
    });
  });

  it.each([0, 1, 5, 1250, 15000, MAX_CENTS])(
    'sends a saved line at %i cents back as the same cents, so saving it unchanged cannot drift',
    (cents) => {
      const [invoice] = invoiceRowsSchema.parse([
        { ...invoiceRows[0], lineItems: [{ ...invoiceRows[0].lineItems[0], rateCents: cents }] },
      ]);
      const values = toInvoiceFormValues(invoice);

      // Quantity 1 keeps the line at or under the cap even at a rate of MAX_CENTS.
      const line = { ...values.lines[0], quantity: '1' };
      expect(invoiceMessages({ ...values, lines: [line] })).toEqual([]);
      expect(toInvoiceBody({ ...values, lines: [line] }).lineItems[0].rateCents).toBe(cents);
    },
  );
});

describe('invoice rows with their lines', () => {
  it('keeps the lines and the calculated amount', () => {
    expect(invoices[0].lineItems).toHaveLength(2);
    expect(invoices[0].lineItems[0]).toMatchObject({
      description: 'Asha Rao — Mobile',
      quantity: 160,
      rateCents: 15000,
      amountCents: 2_400_000,
    });
    expect(invoices[0].amountCents).toBe(3_600_000);
  });

  it('rejects an invoice row without its lines', () => {
    expect(invoiceRowsSchema.safeParse([{ ...invoiceRows[0], lineItems: undefined }]).success).toBe(false);
  });

  it('rejects a line without a rate', () => {
    const line = { ...invoiceRows[0].lineItems[0], rateCents: undefined };
    expect(invoiceRowsSchema.safeParse([{ ...invoiceRows[0], lineItems: [line] }]).success).toBe(false);
  });
});

describe('invoice draft schema', () => {
  it('reads the lines a new invoice would start with', () => {
    expect(invoiceDraftSchema.parse(draftBody)).toEqual(draftBody);
  });

  it('accepts an empty draft', () => {
    expect(invoiceDraftSchema.parse({ lineItems: [] })).toEqual({ lineItems: [] });
  });

  it('rejects a bare array and a line with a text quantity', () => {
    expect(invoiceDraftSchema.safeParse([]).success).toBe(false);
    expect(
      invoiceDraftSchema.safeParse({ lineItems: [{ description: 'x', quantity: '160', rateCents: 1 }] }).success,
    ).toBe(false);
  });
});

describe('resource row schema', () => {
  it('flattens the embedded person and category to their names', () => {
    expect(resources[0]).toMatchObject({
      id: 1,
      projectId: 1,
      personId: 1,
      categoryId: 2,
      name: 'Asha Rao',
      rateCents: 15000,
      personName: 'Asha Rao',
      categoryName: 'Mobile',
    });
    expect(resources[0]).not.toHaveProperty('person');
    expect(resources[0]).not.toHaveProperty('category');
  });

  it('uses empty text for a resource with no person, keeping the null id', () => {
    expect(resources[1]).toMatchObject({ personId: null, personName: '', categoryName: 'Web' });
  });

  it('keeps the ids of a person and a category the service no longer embeds', () => {
    const [row] = resourceRowsSchema.parse([{ ...resourceRows[0], person: null, category: null }]);
    expect(row).toMatchObject({ personId: 1, personName: '', categoryId: 2, categoryName: '' });
  });

  it.each([
    ['an id', { ...resourceRows[0], id: undefined }],
    ['a name', { ...resourceRows[0], name: undefined }],
    ['a rate', { ...resourceRows[0], rateCents: undefined }],
    ['a whole-cent rate', { ...resourceRows[0], rateCents: 42.5 }],
    ['a category id', { ...resourceRows[0], categoryId: undefined }],
  ])('rejects a resource row without %s', (_label, row) => {
    expect(resourceRowsSchema.safeParse([row]).success).toBe(false);
  });
});

const resourceForm = (over: Partial<ResourceFormValues> = {}): ResourceFormValues => ({
  ...emptyResourceForm,
  name: 'Asha Rao',
  categoryId: '2',
  rate: '150',
  ...over,
});

const resourceMessages = (values: ResourceFormValues) => {
  const result = resourceFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('resource form schema', () => {
  it('accepts a name, a category and a rate, with no person', () => {
    expect(resourceMessages(resourceForm())).toEqual([]);
  });

  it('asks for a name, a category and a rate', () => {
    expect(resourceMessages(emptyResourceForm)).toEqual([
      'Name is required',
      'Choose a category',
      'Rate is required',
    ]);
  });

  it('refuses a name of only spaces', () => {
    expect(resourceMessages(resourceForm({ name: '   ' }))).toEqual(['Name is required']);
  });

  it.each(['1,200', '$85', '12.505', '-5', '1e3', 'lots', '١٢٣', '.5', '5.'])(
    'says a rate of %s is not dollars and cents',
    (rate) => {
      expect(resourceMessages(resourceForm({ rate }))).toEqual(['Enter an amount like 7.20, with no commas or signs']);
    },
  );

  it.each(['12.50', '12.5', '85', '0', '0.00', '0.05', toAmountText(MAX_CENTS)])('accepts a rate of %s', (rate) => {
    expect(resourceMessages(resourceForm({ rate }))).toEqual([]);
  });

  it('refuses a rate above the cap', () => {
    expect(resourceMessages(resourceForm({ rate: '100000000.01' }))).toEqual(['The amount is too large']);
  });

  it('asks for a rate, which is told apart from a rate of 0', () => {
    expect(resourceMessages(resourceForm({ rate: '' }))).toEqual(['Rate is required']);
    expect(resourceMessages(resourceForm({ rate: '  ' }))).toEqual(['Rate is required']);
  });
});

describe('toResourceBody', () => {
  it('sends an empty person as null and the ids and the rate in cents as numbers, and nothing else', () => {
    // Exactly these keys: the service refuses an unknown one, and an update must not carry a projectId.
    expect(toResourceBody(resourceForm())).toEqual({
      name: 'Asha Rao',
      personId: null,
      categoryId: 2,
      headcount: 1,
      rateCents: 15000,
    });
    expect(toResourceBody(resourceForm({ personId: '7' }))).toMatchObject({ personId: 7 });
  });

  it('sends a rate of 12.50 as 1250 cents', () => {
    expect(toResourceBody(resourceForm({ rate: '12.50' })).rateCents).toBe(1250);
  });

  it('reads leading zeros as the number they spell', () => {
    expect(toResourceBody(resourceForm({ rate: '085' })).rateCents).toBe(8500);
  });
});

describe('toResourceFormValues', () => {
  it('opens empty for a new resource', () => {
    expect(toResourceFormValues()).toEqual(emptyResourceForm);
  });

  it('opens on a resource as text', () => {
    expect(toResourceFormValues(resources[0])).toEqual({
      name: 'Asha Rao',
      personId: '1',
      categoryId: '2',
      headcount: '1',
      rate: '150.00',
    });
    expect(toResourceFormValues(resources[1])).toMatchObject({ personId: '' });
  });

  it.each([0, 1, 5, 1250, 15000, MAX_CENTS])(
    'sends a saved resource at %i cents back as the same cents, so saving it unchanged cannot drift',
    (cents) => {
      const [row] = resourceRowsSchema.parse([{ ...resourceRows[0], rateCents: cents }]);
      const values = toResourceFormValues(row);

      expect(resourceMessages(values)).toEqual([]);
      expect(toResourceBody(values).rateCents).toBe(cents);
    },
  );

  it('opens on None and Choose for a person and a category the service no longer embeds', () => {
    const [orphan] = resourceRowsSchema.parse([{ ...resourceRows[0], person: null, category: null }]);
    expect(toResourceFormValues(orphan)).toMatchObject({ personId: '', categoryId: '' });
  });
});

describe('the new fields the pages read', () => {
  it('reads a project key and billing address, empty text when there are none', () => {
    expect(projects[0]).toMatchObject({ key: 'WEB', billingAddress: 'Acme Corporation\n1 Anvil Road\nPune, India' });
    expect(projects[1]).toMatchObject({ key: '', billingAddress: '' });
  });

  it('reads a resource headcount and each line headcount', () => {
    expect(resources[0].headcount).toBe(1);
    expect(invoices[0].lineItems.map((line) => line.headcount)).toEqual([1, 1]);
  });

  it('reads an invoice billing period, null for both when it has none', () => {
    expect(invoices[0]).toMatchObject({ periodStart: '2026-09-01', periodEnd: '2026-09-30' });
    expect(invoices[1]).toMatchObject({ periodStart: null, periodEnd: null });
  });

  it.each([
    ['a project without its key field', { ...projectRows[0], key: undefined }],
    ['a project without its billing address field', { ...projectRows[0], billingAddress: undefined }],
    ['a resource without its headcount', { ...resourceRows[0], headcount: undefined }],
    ['an invoice without its period fields', { ...invoiceRows[0], periodStart: undefined }],
    ['a line without its headcount', { ...invoiceRows[0], lineItems: [{ ...invoiceRows[0].lineItems[0], headcount: undefined }] }],
  ])('rejects %s', (_label, row) => {
    const schema = _label.startsWith('a project')
      ? projectRowsSchema
      : _label.startsWith('a resource')
        ? resourceRowsSchema
        : invoiceRowsSchema;
    expect(schema.safeParse([row]).success).toBe(false);
  });
});

describe('project key and billing address in the form', () => {
  const form = (over: Partial<ProjectFormValues> = {}) => projectForm(over);

  it('accepts no key, a key of 2 to 10 letters or digits in any case, and spaces around it', () => {
    for (const key of ['', 'tk', 'TKO', 'a1', 'ABCDEFGHIJ', '  tko  ']) {
      expect(projectMessages(form({ key }))).toEqual([]);
    }
  });

  it.each(['T', 'ABCDEFGHIJK', 'T-K', 'T K', 'TK!', 'É1'])('says a key of %j is not 2 to 10 letters or digits', (key) => {
    expect(projectMessages(form({ key }))).toEqual(['Use 2 to 10 letters or digits']);
  });

  it('sends the key trimmed and in capitals, and null when empty', () => {
    expect(toProjectBody(form({ key: '  tko ' })).key).toBe('TKO');
    expect(toProjectBody(form({ key: '' })).key).toBeNull();
  });

  it('sends the billing address with its line breaks, and null when empty', () => {
    expect(toProjectBody(form({ billingAddress: 'Michael Jordan,\nVenice' })).billingAddress).toBe('Michael Jordan,\nVenice');
    expect(toProjectBody(form({ billingAddress: '   ' })).billingAddress).toBeNull();
  });

  it('refuses an address over 1,000 characters', () => {
    expect(projectMessages(form({ billingAddress: 'x'.repeat(1001) }))).toEqual(['Keep the address under 1,000 characters']);
    expect(projectMessages(form({ billingAddress: 'x'.repeat(1000) }))).toEqual([]);
  });

  it('opens on a project’s key and address', () => {
    expect(toProjectFormValues(projects[0])).toMatchObject({ key: 'WEB', billingAddress: 'Acme Corporation\n1 Anvil Road\nPune, India' });
    expect(toProjectFormValues(projects[2])).toMatchObject({ key: '', billingAddress: '' });
  });
});

describe('resource headcount in the form', () => {
  it('starts at one person', () => {
    expect(emptyResourceForm.headcount).toBe('1');
  });

  it.each(['1', '3', '1000', ' 7 '])('accepts %j people', (headcount) => {
    expect(resourceMessages(resourceForm({ headcount }))).toEqual([]);
  });

  it.each(['', '0', '1001', '2.5', '-1', 'many', '1,000'])('refuses %j people', (headcount) => {
    expect(resourceMessages(resourceForm({ headcount }))).toHaveLength(1);
  });

  it('sends the headcount as a number and opens on a resource’s', () => {
    expect(toResourceBody(resourceForm({ headcount: '3' })).headcount).toBe(3);
    expect(toResourceFormValues(resources[0]).headcount).toBe('1');
  });
});

describe('Qty on a line', () => {
  it('multiplies Qty, hours and rate', () => {
    expect(lineAmount({ headcount: '3', quantity: '160', rate: '27' })).toBe(1_296_000);
    expect(lineAmount({ headcount: '', quantity: '160', rate: '27' })).toBeNull();
  });

  it('totals the owner’s sample', () => {
    expect(
      linesTotal([
        { headcount: '3', quantity: '160', rate: '27' },
        { headcount: '1', quantity: '160', rate: '54' },
      ]),
    ).toBe(2_160_000);
  });

  it.each(['1', '3', '1000'])('accepts a Qty of %s', (headcount) => {
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ headcount })] }))).toEqual([]);
  });

  it.each([
    ['', 'Qty is required'],
    ['0', 'Qty must be from 1 to 1,000'],
    ['1001', 'Qty must be from 1 to 1,000'],
    ['2.5', 'Enter a whole number, like 3'],
    ['-1', 'Enter a whole number, like 3'],
    ['many', 'Enter a whole number, like 3'],
  ])('says a Qty of %j is wrong: %s', (headcount, message) => {
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ headcount })] }))).toEqual([message]);
  });

  it('counts the Qty in the line limit', () => {
    // 1,000 people for 100 hours at $1,000.01 is 10,000,100,000 cents; at $1,000.00 it is exactly the cap.
    const big = lineForm({ headcount: '1000', quantity: '100', rate: '1000.01' });
    const fine = lineForm({ headcount: '1000', quantity: '100', rate: '1000' });

    expect(invoiceMessages(invoiceForm({ lines: [big] }))).toEqual(['This line is too large']);
    expect(invoiceMessages(invoiceForm({ lines: [fine] }))).toEqual([]);
  });

  it('sends the Qty as a number', () => {
    const body = toInvoiceBody(invoiceForm({ lines: [lineForm({ headcount: '3' })] }));

    expect(body.lineItems).toEqual([{ description: 'Backend work', headcount: 3, quantity: 160, rateCents: 15000 }]);
  });
});

describe('the billing period in the invoice form', () => {
  it('accepts both dates, neither, and a one-day period', () => {
    expect(invoiceMessages(invoiceForm({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }))).toEqual([]);
    expect(invoiceMessages(invoiceForm({ periodStart: '', periodEnd: '' }))).toEqual([]);
    expect(invoiceMessages(invoiceForm({ periodStart: '2026-09-15', periodEnd: '2026-09-15' }))).toEqual([]);
  });

  it('wants both dates or neither', () => {
    expect(invoiceMessages(invoiceForm({ periodStart: '2026-09-01', periodEnd: '' }))).toEqual(['Give both dates, or neither']);
    expect(invoiceMessages(invoiceForm({ periodStart: '', periodEnd: '2026-09-30' }))).toEqual(['Give both dates, or neither']);
  });

  it('wants the end on or after the start', () => {
    expect(invoiceMessages(invoiceForm({ periodStart: '2026-09-30', periodEnd: '2026-09-01' }))).toEqual([
      'The period must end on or after it starts',
    ]);
  });

  it('sends both dates, or null for both', () => {
    expect(toInvoiceBody(invoiceForm({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }))).toMatchObject({
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    });
    expect(toInvoiceBody(invoiceForm())).toMatchObject({ periodStart: null, periodEnd: null });
  });
});

describe('the number in the invoice form', () => {
  const withoutNumber = invoiceForm({ number: '' });

  it('is required when the project has no key, or when editing', () => {
    expect(makeInvoiceFormSchema({ numberRequired: true }).safeParse(withoutNumber).success).toBe(false);
    expect(invoiceMessages(withoutNumber)).toEqual(['Number is required']);
  });

  it('may be empty when the server can number the invoice', () => {
    expect(makeInvoiceFormSchema({ numberRequired: false }).safeParse(withoutNumber).success).toBe(true);
  });

  it('is sent as null when empty and as typed otherwise', () => {
    expect(toInvoiceBody(withoutNumber).number).toBeNull();
    expect(toInvoiceBody(invoiceForm({ number: 'INV-9' })).number).toBe('INV-9');
  });
});

describe('parseRecipients', () => {
  it('splits on commas, semicolons, spaces and line breaks, and trims', () => {
    expect(parseRecipients(' a@x.com; b@y.com ,  c@z.com\nd@w.com\t e@v.com ')).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
      'd@w.com',
      'e@v.com',
    ]);
  });

  it('drops repeats whatever their case, keeping the first spelling', () => {
    expect(parseRecipients('A@x.com, a@X.com, b@y.com, B@y.com')).toEqual(['A@x.com', 'b@y.com']);
  });

  it('gives nothing for blanks and separators alone', () => {
    expect(parseRecipients('')).toEqual([]);
    expect(parseRecipients(' ; , \n ')).toEqual([]);
  });
});

describe('email form schema', () => {
  const form = (over: Partial<EmailFormValues> = {}): EmailFormValues => ({
    to: 'a@x.com',
    subject: 'Invoice INV-001',
    message: 'Please find it attached.',
    ...over,
  });
  const messages = (values: EmailFormValues) => {
    const result = emailFormSchema.safeParse(values);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it('accepts one address, several, and an empty message', () => {
    expect(messages(form())).toEqual([]);
    expect(messages(form({ to: 'a@x.com; b@y.com, c@z.com' }))).toEqual([]);
    expect(messages(form({ message: '' }))).toEqual([]);
  });

  it('wants at least one address', () => {
    expect(messages(form({ to: '' }))).toEqual(['Enter at least one email address']);
    expect(messages(form({ to: ' ; , ' }))).toEqual(['Enter at least one email address']);
  });

  it('names the first address that does not look right', () => {
    expect(messages(form({ to: 'a@x.com, oops, b@y.com' }))).toEqual([
      'That does not look like an email address: oops',
    ]);
    expect(messages(form({ to: 'a@@x.com' }))).toEqual(['That does not look like an email address: a@@x.com']);
  });

  it('allows ten addresses and not eleven', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `p${i}@x.com`).join(', ');
    expect(messages(form({ to: ten }))).toEqual([]);
    expect(messages(form({ to: `${ten}, p10@x.com` }))).toEqual(['Send to 10 addresses or fewer']);
  });

  it('wants a subject of 1 to 200 characters and a message of at most 10,000', () => {
    expect(messages(form({ subject: '   ' }))).toEqual(['Subject is required']);
    expect(messages(form({ subject: 's'.repeat(201) }))).toEqual(['Keep the subject under 200 characters']);
    expect(messages(form({ subject: 's'.repeat(200) }))).toEqual([]);
    expect(messages(form({ message: 'm'.repeat(10_001) }))).toEqual(['Keep the message under 10,000 characters']);
  });

  it('sends the cleaned list, the trimmed subject and the message as typed', () => {
    expect(toSendBody(form({ to: ' A@x.com; a@x.com ,b@y.com ', subject: '  Invoice  ' }))).toEqual({
      to: ['A@x.com', 'b@y.com'],
      subject: 'Invoice',
      message: 'Please find it attached.',
    });
  });

  it('opens on the draft, the addresses joined with commas', () => {
    expect(toEmailFormValues(emailDraftBody)).toEqual({
      to: 'michael@example.com',
      subject: 'Invoice INV-001 from Test Company LLP',
      message: emailDraftBody.message,
    });
    expect(toEmailFormValues({ to: [], subject: 's', message: 'm' }).to).toBe('');
  });
});

describe('the discount: rows', () => {
  it('reads a project’s discount and an invoice’s subtotal and discount', () => {
    const [discounted] = projectRowsSchema.parse([{ ...projectRows[0], discountPercent: 7.5 }]);
    const [invoice] = invoiceRowsSchema.parse([
      { ...invoiceRows[0], subtotalCents: 4_000_000, discountPercent: 10, amountCents: 3_600_000 },
    ]);

    expect(discounted.discountPercent).toBe(7.5);
    expect(invoice).toMatchObject({ subtotalCents: 4_000_000, discountPercent: 10, amountCents: 3_600_000 });
  });

  it('reads no discount as zero on the fixtures', () => {
    expect(projects.map((project) => project.discountPercent)).toEqual([0, 0, 0]);
    expect(invoices.map((invoice) => [invoice.subtotalCents, invoice.discountPercent])).toEqual([
      [3_600_000, 0],
      [1_200_000, 0],
    ]);
  });

  it('rejects a project or an invoice row that has no discount', () => {
    const { discountPercent: _project, ...bareProject } = projectRows[0];
    const { discountPercent: _invoice, ...bareInvoice } = invoiceRows[0];

    expect(projectRowsSchema.safeParse([bareProject]).success).toBe(false);
    expect(invoiceRowsSchema.safeParse([bareInvoice]).success).toBe(false);
  });
});

describe('discountAmount', () => {
  // The same cases as the service's own table (octacore-backend tests/test_discount.py): the dialog's preview
  // must never differ from the amount the service saves. The subtotal and the answer are in cents, and the answer
  // is floored: 7.5% of 1010 is 75.75, so 75.
  it.each([
    [1000, '10', 100],
    [1000, '7.5', 75],
    [1005, '7.5', 75],
    [1010, '7.5', 75],
    [5, '10', 0],
    [25, '10', 2],
    [1, '50', 0],
    [0, '50', 0],
    [1000, '0', 0],
    [21_600, '12.25', 2_646],
    [2_147_483_647 * 200, '50', 214_748_364_700],
    // 200 lines at the cap, half off: the product with 5,000 hundredths is 10^16, which a number holds exactly, so
    // this pins the extreme, not BigInt; the 49.99% case below is the one a float gets wrong.
    [2_000_000_000_000, '50', 1_000_000_000_000],
  ])('takes %i cents at %s percent down by %i cents, floored', (subtotal, percent, expected) => {
    expect(discountAmount(subtotal, percent)).toBe(expected);
  });

  it('floors on the exact product where a float would land on the next cent', () => {
    // 1_801_800_215_001 x 4_999 hundredths of a percent is exactly 9_007_199_274_789_999, past 2^53, and the floor of
    // that over 10_000 is 900_719_927_478. A float rounds the product up to 9_007_199_274_790_000 and answers
    // 900_719_927_479, a cent too much. Worked out with Python integers, not with the function under test.
    expect(discountAmount(1_801_800_215_001, '49.99')).toBe(900_719_927_478);
  });

  it('takes nothing off for an empty or unreadable percentage, which the form reports on its own', () => {
    expect(discountAmount(1000, '')).toBe(0);
    expect(discountAmount(1000, '  ')).toBe(0);
    expect(discountAmount(1000, 'abc')).toBe(0);
    expect(discountAmount(1000, '1.234')).toBe(0);
  });

  it('takes nothing off a subtotal that is not a safe whole number, which the form is already refusing', () => {
    expect(discountAmount(Number.MAX_SAFE_INTEGER + 2, '10')).toBe(0);
    expect(discountAmount(Number.POSITIVE_INFINITY, '10')).toBe(0);
  });

  it('reads spaces around the percentage and a trailing zero', () => {
    expect(discountAmount(1000, ' 7.50 ')).toBe(75);
  });
});

describe('invoiceTotals', () => {
  it('gives the subtotal of the lines, the discount and the total payable, all in cents', () => {
    const lines = [lineForm({ quantity: '10', rate: '100' })];

    expect(invoiceTotals(lines, '10')).toEqual({ subtotal: 100_000, discount: 10_000, total: 90_000 });
    expect(invoiceTotals(lines, '0')).toEqual({ subtotal: 100_000, discount: 0, total: 100_000 });
  });

  it('works to the cent: 3 people for 160 hours at 12.50, ten percent off', () => {
    const lines = [{ headcount: '3', quantity: '160', rate: '12.50' }];

    expect(invoiceTotals(lines, '10')).toEqual({ subtotal: 600_000, discount: 60_000, total: 540_000 });
  });

  it('floors the discount once, on the subtotal, as the service does', () => {
    // 7.5% of 10.10 is 0.7575: 75 cents off, not 76.
    const lines = [{ headcount: '1', quantity: '1', rate: '10.10' }];

    expect(invoiceTotals(lines, '7.5')).toEqual({ subtotal: 1010, discount: 75, total: 935 });
  });

  it('counts only the lines that have an amount', () => {
    const lines = [lineForm({ quantity: '10', rate: '100' }), lineForm({ quantity: '', rate: '' })];

    expect(invoiceTotals(lines, '50')).toEqual({ subtotal: 100_000, discount: 50_000, total: 50_000 });
  });

  it('is exact at the extreme: 200 lines at the cap, half off', () => {
    const atTheCap = { headcount: '1', quantity: '1', rate: toAmountText(MAX_CENTS) };
    const lines = Array.from({ length: 200 }, () => atTheCap);

    expect(invoiceTotals(lines, '50')).toEqual({
      subtotal: 2_000_000_000_000,
      discount: 1_000_000_000_000,
      total: 1_000_000_000_000,
    });
  });
});

describe('the discount in the project form', () => {
  it('starts at 0', () => {
    expect(emptyProjectForm.discountPercent).toBe('0');
  });

  it.each(['', '0', '7.5', '12.25', '50', '50.00', ' 10 '])('accepts %j', (value) => {
    expect(projectMessages(projectForm({ discountPercent: value }))).toEqual([]);
  });

  it.each(['50.01', '51', '100'])('refuses %j as above 50', (value) => {
    expect(projectMessages(projectForm({ discountPercent: value }))).toEqual(['Discount must be from 0 to 50']);
  });

  it.each(['-1', '1.234', 'abc', '1,5', '10%', '.5', '5.', '1e1'])('refuses %j as not a percentage', (value) => {
    expect(projectMessages(projectForm({ discountPercent: value }))).toEqual(['Enter a percentage like 7.5']);
  });

  it('sends the discount as a number, and an empty one as 0', () => {
    expect(toProjectBody(projectForm({ discountPercent: '7.50' })).discountPercent).toBe(7.5);
    expect(toProjectBody(projectForm({ discountPercent: ' 12.25 ' })).discountPercent).toBe(12.25);
    expect(toProjectBody(projectForm({ discountPercent: '' })).discountPercent).toBe(0);
  });

  it('opens on a project’s discount as text', () => {
    const [discounted] = projectRowsSchema.parse([{ ...projectRows[0], discountPercent: 12.25 }]);

    expect(toProjectFormValues(discounted).discountPercent).toBe('12.25');
    expect(toProjectFormValues(projects[0]).discountPercent).toBe('0');
  });
});

describe('the discount in the invoice form', () => {
  it('starts at 0', () => {
    expect(emptyInvoiceForm.discountPercent).toBe('0');
  });

  it.each(['', '0', '7.5', '12.25', '50', '50.00'])('accepts %j', (value) => {
    expect(invoiceMessages(invoiceForm({ discountPercent: value }))).toEqual([]);
  });

  it('refuses a figure above 50 and one that is not a percentage, each on its own field', () => {
    expect(invoiceMessages(invoiceForm({ discountPercent: '50.01' }))).toEqual(['Discount must be from 0 to 50']);
    expect(invoiceMessages(invoiceForm({ discountPercent: '1.234' }))).toEqual(['Enter a percentage like 7.5']);

    const result = invoiceFormSchema.safeParse(invoiceForm({ discountPercent: '51' }));
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toEqual([['discountPercent']]);
  });

  it('sends the discount as a number, and an empty one as 0', () => {
    expect(toInvoiceBody(invoiceForm({ discountPercent: '7.5' })).discountPercent).toBe(7.5);
    expect(toInvoiceBody(invoiceForm({ discountPercent: '' })).discountPercent).toBe(0);
  });

  it('opens on an invoice’s own discount, whatever its project has now', () => {
    const [discounted] = invoiceRowsSchema.parse([{ ...invoiceRows[0], discountPercent: 7.5 }]);

    expect(toInvoiceFormValues(discounted).discountPercent).toBe('7.5');
  });

  it('is still checked when the number may be left to the server', () => {
    const schema = makeInvoiceFormSchema({ numberRequired: false });

    expect(schema.safeParse(invoiceForm({ number: '', discountPercent: '60' })).success).toBe(false);
    expect(schema.safeParse(invoiceForm({ number: '', discountPercent: '10' })).success).toBe(true);
  });
});

describe('a new invoice and its project’s discount', () => {
  it('opens on the project’s discount as text', () => {
    expect(toInvoiceFormValues(undefined, 10).discountPercent).toBe('10');
    expect(toInvoiceFormValues(undefined, 7.5).discountPercent).toBe('7.5');
    expect(toInvoiceFormValues(undefined, 12.25).discountPercent).toBe('12.25');
  });

  it('opens on 0 when the project has none, or when it is not known', () => {
    expect(toInvoiceFormValues(undefined, 0).discountPercent).toBe('0');
    expect(toInvoiceFormValues().discountPercent).toBe('0');
    expect(toInvoiceFormValues()).toEqual(emptyInvoiceForm);
  });

  it('leaves everything else of a new invoice as it was', () => {
    expect(toInvoiceFormValues(undefined, 10)).toEqual({ ...emptyInvoiceForm, discountPercent: '10' });
  });

  it('ignores the project’s discount for an invoice already saved: it keeps its own', () => {
    expect(toInvoiceFormValues(invoices[0], 10).discountPercent).toBe('0');
  });
});

describe('project status and dates', () => {
  it('reads the status, its label and the dates from a project row', () => {
    expect(projects[0]).toMatchObject({
      projectStatus: 'active',
      projectStatusLabel: 'Active',
      startDate: '2026-01-01',
      endDate: null,
    });
    expect(projects[1]).toMatchObject({ projectStatus: 'on_hold', projectStatusLabel: 'On hold', startDate: null });
    expect(projects[2]).toMatchObject({
      projectStatus: 'completed',
      projectStatusLabel: 'Completed',
      startDate: '2025-03-01',
      endDate: '2025-09-30',
    });
  });

  it('refuses a row whose status the service does not know', () => {
    expect(() => projectRowsSchema.parse([{ ...projectRows[0], projectStatus: 'paused' }])).toThrow();
  });

  it('sends a new project as active with no dates', () => {
    expect(toProjectBody(projectForm())).toMatchObject({ projectStatus: 'active', startDate: null, endDate: null });
  });

  it('sends the status and dates that were chosen', () => {
    const body = toProjectBody(projectForm({ projectStatus: 'on_hold', startDate: '2026-02-01', endDate: '2026-11-30' }));
    expect(body).toMatchObject({ projectStatus: 'on_hold', startDate: '2026-02-01', endDate: '2026-11-30' });
  });

  it('opens an edit on the stored status, and a missing date as an empty field', () => {
    expect(toProjectFormValues(projects[0])).toMatchObject({ projectStatus: 'active', startDate: '2026-01-01', endDate: '' });
  });

  it.each([
    ['end after start', '2026-01-01', '2026-12-31', true],
    ['the same day', '2026-06-01', '2026-06-01', true],
    ['end before start', '2026-06-02', '2026-06-01', false],
    ['only a start', '2026-01-01', '', true],
    ['only an end', '', '2026-12-31', true],
    ['neither', '', '', true],
  ])('checks the dates: %s', (_name, startDate, endDate, valid) => {
    const result = projectFormSchema.safeParse(projectForm({ startDate, endDate }));
    expect(result.success).toBe(valid);
    if (!valid) {
      expect(result.error?.issues[0]).toMatchObject({
        path: ['endDate'],
        message: 'The project must end on or after it starts',
      });
    }
  });

  it('refuses a status that is not one of the three', () => {
    expect(projectFormSchema.safeParse(projectForm({ projectStatus: 'paused' })).success).toBe(false);
    expect(projectFormSchema.safeParse(projectForm({ projectStatus: '' })).success).toBe(false);
  });
});

describe('project technologies', () => {
  it('reads the technologies a project uses', () => {
    expect(projects[0].technologies).toEqual([
      { id: 2, name: 'Nest' },
      { id: 1, name: 'React' },
    ]);
    expect(projects[1].technologies).toEqual([]);
  });

  it('opens a new project with none chosen, and an edit with its own ticked', () => {
    expect(toProjectFormValues().technologyIds).toEqual([]);
    expect(toProjectFormValues(projects[0]).technologyIds).toEqual(['2', '1']);
  });

  it('sends the whole set as numbers, and an empty list when none are chosen', () => {
    expect(toProjectBody(projectForm({ technologyIds: ['3', '1'] })).technologyIds).toEqual([3, 1]);
    expect(toProjectBody(projectForm({ technologyIds: [] })).technologyIds).toEqual([]);
  });
});
