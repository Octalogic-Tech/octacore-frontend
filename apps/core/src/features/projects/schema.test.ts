import { invoiceRows, projectRows } from '@/test/fixtures/projects';
import {
  emptyInvoiceForm,
  emptyProjectForm,
  invoiceFormSchema,
  invoiceRowsSchema,
  projectFormSchema,
  projectRowsSchema,
  sortInvoices,
  toInvoiceBody,
  toInvoiceFormValues,
  toProjectBody,
  toProjectFormValues,
  type InvoiceFormValues,
  type ProjectFormValues,
} from './schema';

const projects = projectRowsSchema.parse(projectRows);
const invoices = invoiceRowsSchema.parse(invoiceRows);

const projectForm = (over: Partial<ProjectFormValues> = {}): ProjectFormValues => ({
  ...emptyProjectForm,
  name: 'Website',
  projectType: 'product',
  billingType: 'retainer',
  ...over,
});

const invoiceForm = (over: Partial<InvoiceFormValues> = {}): InvoiceFormValues => ({
  ...emptyInvoiceForm,
  number: 'INV-001',
  amount: '1200',
  issueDate: '2026-10-01',
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

describe('invoice form schema', () => {
  it('accepts the three required fields', () => {
    expect(invoiceMessages(invoiceForm())).toEqual([]);
  });

  it('asks for a number, an amount and an issue date', () => {
    expect(invoiceMessages(emptyInvoiceForm)).toEqual([
      'Number is required',
      'Amount is required',
      'Issue date is required',
    ]);
  });

  it('refuses a number of only spaces', () => {
    expect(invoiceMessages(invoiceForm({ number: '   ' }))).toEqual(['Number is required']);
  });

  it.each(['1,000', '$1000', '12.5', '-5', '1e3', 'lots', '١٢٣'])(
    'says an amount of %s is not a whole number',
    (amount) => {
      expect(invoiceMessages(invoiceForm({ amount }))).toEqual(['Enter a whole number, like 1200']);
    },
  );

  it('accepts the smallest and the largest amount, and refuses one past the limit', () => {
    expect(invoiceMessages(invoiceForm({ amount: '0' }))).toEqual([]);
    expect(invoiceMessages(invoiceForm({ amount: '2147483647' }))).toEqual([]);
    expect(invoiceMessages(invoiceForm({ amount: '2147483648' }))).toEqual(['Amount is too large']);
    expect(invoiceMessages(invoiceForm({ amount: '99999999999999999999' }))).toEqual(['Amount is too large']);
  });
});

describe('toInvoiceBody', () => {
  it('sends the amount as a number and empty optional fields as null', () => {
    expect(toInvoiceBody(invoiceForm())).toEqual({
      number: 'INV-001',
      description: null,
      amount: 1200,
      issueDate: '2026-10-01',
      dueDate: null,
      paidDate: null,
    });
  });

  it('reads leading zeros as the number they spell', () => {
    expect(toInvoiceBody(invoiceForm({ amount: '007' })).amount).toBe(7);
  });

  it('carries the optional dates and description when they are filled', () => {
    const body = toInvoiceBody(invoiceForm({ description: 'Final', dueDate: '2026-10-31', paidDate: '2026-10-15' }));
    expect(body).toMatchObject({ description: 'Final', dueDate: '2026-10-31', paidDate: '2026-10-15' });
  });
});

describe('toInvoiceFormValues', () => {
  it('opens empty for a new invoice', () => {
    expect(toInvoiceFormValues()).toEqual(emptyInvoiceForm);
  });

  it('opens on an invoice as text', () => {
    expect(toInvoiceFormValues(invoices[0])).toEqual({
      number: 'INV-001',
      description: 'October retainer',
      amount: '36000',
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      paidDate: '2026-10-12',
    });
    expect(toInvoiceFormValues(invoices[1])).toMatchObject({ description: '', dueDate: '', paidDate: '' });
  });
});
