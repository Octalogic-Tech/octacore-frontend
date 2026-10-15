import { draftBody, invoiceRows, projectRows, resourceRows } from '@/test/fixtures/projects';
import {
  blankLine,
  draftToLines,
  emptyInvoiceForm,
  emptyProjectForm,
  emptyResourceForm,
  invoiceDraftSchema,
  invoiceFormSchema,
  invoiceRowsSchema,
  lineAmount,
  linesTotal,
  projectFormSchema,
  projectRowsSchema,
  resourceFormSchema,
  resourceRowsSchema,
  sortInvoices,
  toInvoiceBody,
  toInvoiceFormValues,
  toProjectBody,
  toProjectFormValues,
  toResourceBody,
  toResourceFormValues,
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
      totalValue: 48000,
      totalOutstanding: 12000,
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
    ['a total value', { ...projectRows[0], totalValue: undefined }],
    ['a total outstanding', { ...projectRows[0], totalOutstanding: undefined }],
    ['a known billing type', { ...projectRows[0], billingType: 'monthly' }],
    ['a known project type', { ...projectRows[0], projectType: 'service' }],
    ['a numeric total', { ...projectRows[0], totalValue: '48000' }],
  ])('rejects a project row without %s', (_label, row) => {
    expect(projectRowsSchema.safeParse([row]).success).toBe(false);
  });

  it('rejects a bare array of the mock shape, where the client was a string', () => {
    const mock = { id: 1, name: 'Project 1', description: '', client: 'Client A', totalValue: 1, totalOutstanding: 0 };
    expect(projectRowsSchema.safeParse([mock]).success).toBe(false);
  });
});

describe('invoice row schema', () => {
  it('turns a null description into empty text and keeps null dates', () => {
    expect(invoices[0]).toMatchObject({ number: 'INV-001', amount: 36000, dueDate: '2026-10-31', paidDate: '2026-10-12' });
    expect(invoices[1]).toMatchObject({ description: '', dueDate: null, paidDate: null });
  });

  it.each([
    ['a project id', { ...invoiceRows[0], projectId: undefined }],
    ['a number', { ...invoiceRows[0], number: undefined }],
    ['an amount', { ...invoiceRows[0], amount: undefined }],
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
  it('multiplies whole numbers and gives null for anything else', () => {
    expect(lineAmount({ quantity: '160', rate: '150' })).toBe(24000);
    expect(lineAmount({ quantity: ' 2 ', rate: '0' })).toBe(0);
    for (const bad of [{ quantity: '', rate: '5' }, { quantity: '1.5', rate: '5' }, { quantity: '3', rate: '$5' }]) {
      expect(lineAmount(bad)).toBeNull();
    }
  });

  it('totals only the lines that have an amount', () => {
    expect(linesTotal([lineForm(), lineForm({ quantity: '', rate: '' }), lineForm({ quantity: '1', rate: '5' })])).toBe(
      24005,
    );
  });

  it('turns the draft into text fields', () => {
    expect(draftToLines(draftBody)).toEqual([
      { description: 'Asha Rao — Mobile', quantity: '160', rate: '150' },
      { description: 'Ben Cho — Web', quantity: '160', rate: '75' },
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

  it.each(['1,200', '$85', '42.50', '-5', '1e3', 'lots'])('says a rate of %s is not a whole number', (rate) => {
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ rate })] }))).toEqual(['Enter a whole number, like 85']);
  });

  it('keeps the quantity from 1 to 100,000 and the rate to the service’s limit', () => {
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '1', rate: '0' })] }))).toEqual([]);
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '0' })] }))).toEqual([
      'Quantity must be from 1 to 100,000',
    ]);
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '100001' })] }))).toEqual([
      'Quantity must be from 1 to 100,000',
    ]);
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '1', rate: '2147483647' })] }))).toEqual([]);
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '1', rate: '2147483648' })] }))).toEqual([
      'Rate is too large',
    ]);
  });

  it('refuses a line whose amount would pass the limit, though each field is in range', () => {
    const line = lineForm({ quantity: '100000', rate: '21475' });
    expect(invoiceMessages(invoiceForm({ lines: [line] }))).toEqual(['This line is too large']);
    expect(invoiceMessages(invoiceForm({ lines: [lineForm({ quantity: '100000', rate: '21474' })] }))).toEqual([]);
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
      lineItems: [{ description: 'Backend work', quantity: 160, rate: 150 }],
    });
  });

  it('reads leading zeros as the number they spell', () => {
    const body = toInvoiceBody(invoiceForm({ lines: [lineForm({ quantity: '007', rate: '085' })] }));
    expect(body.lineItems).toEqual([{ description: 'Backend work', quantity: 7, rate: 85 }]);
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
      lines: [
        { description: 'Asha Rao — Mobile', quantity: '160', rate: '150' },
        { description: 'Ben Cho — Web', quantity: '160', rate: '75' },
      ],
    });
    expect(toInvoiceFormValues(invoices[1])).toMatchObject({ description: '', dueDate: '', paidDate: '' });
  });
});

describe('invoice rows with their lines', () => {
  it('keeps the lines and the calculated amount', () => {
    expect(invoices[0].lineItems).toHaveLength(2);
    expect(invoices[0].lineItems[0]).toMatchObject({ description: 'Asha Rao — Mobile', quantity: 160, rate: 150, amount: 24000 });
    expect(invoices[0].amount).toBe(36000);
  });

  it('rejects an invoice row without its lines', () => {
    expect(invoiceRowsSchema.safeParse([{ ...invoiceRows[0], lineItems: undefined }]).success).toBe(false);
  });

  it('rejects a line without a rate', () => {
    const line = { ...invoiceRows[0].lineItems[0], rate: undefined };
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
    expect(invoiceDraftSchema.safeParse({ lineItems: [{ description: 'x', quantity: '160', rate: 1 }] }).success).toBe(
      false,
    );
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
      rate: 150,
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
    ['a rate', { ...resourceRows[0], rate: undefined }],
    ['a whole-number rate', { ...resourceRows[0], rate: 42.5 }],
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

  it.each(['1,200', '$85', '42.50', '-5', '1e3', 'lots', '١٢٣'])('says a rate of %s is not a whole number', (rate) => {
    expect(resourceMessages(resourceForm({ rate }))).toEqual(['Enter a whole number, like 85']);
  });

  it('accepts a rate of 0 and 1,000,000 and refuses one above', () => {
    expect(resourceMessages(resourceForm({ rate: '0' }))).toEqual([]);
    expect(resourceMessages(resourceForm({ rate: '1000000' }))).toEqual([]);
    expect(resourceMessages(resourceForm({ rate: '1000001' }))).toEqual(['Rate is too large']);
  });
});

describe('toResourceBody', () => {
  it('sends an empty person as null and the ids and rate as numbers', () => {
    expect(toResourceBody(resourceForm())).toEqual({
      name: 'Asha Rao',
      personId: null,
      categoryId: 2,
      headcount: 1,
      rate: 150,
    });
    expect(toResourceBody(resourceForm({ personId: '7' }))).toMatchObject({ personId: 7 });
  });

  it('reads leading zeros as the number they spell', () => {
    expect(toResourceBody(resourceForm({ rate: '085' })).rate).toBe(85);
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
      rate: '150',
    });
    expect(toResourceFormValues(resources[1])).toMatchObject({ personId: '' });
  });

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
