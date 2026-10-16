// Rows shaped like GET http://localhost:5001/api/v1/projects and /invoices (octacore-backend, FastAPI), in the
// service's own envelope; the values are made up. A project embeds its client's own columns (no country) or null.
// A project from before the type columns existed has null for both types. The totals are what the service
// calculates from a project's live invoices: project 1's match the two invoices below, and project 2's invoices
// are simply not listed here. An invoice carries its lines, whose amount is headcount x quantity x rate (INV-001:
// 1 x 160 x 150 + 1 x 160 x 75), and, from the second invoice on, a billing period that may be null. Nothing here
// is discounted (discountPercent 0), so an invoice's amount equals its subtotal; tests that need a discount
// override it on a copy.
const stamp = '2026-10-15T09:30:00.000000Z';
const audit = { status: 1, createdDate: stamp, updatedDate: stamp, deletedDate: null };

const acme = { ...audit, id: 1, name: 'Acme', description: 'Anvils and rockets.', countryId: null, city: null };

export const projectRows = [
  {
    ...audit,
    id: 1,
    name: 'Website',
    description: 'Marketing site.',
    key: 'WEB',
    billingAddress: 'Acme Corporation\n1 Anvil Road\nPune, India',
    discountPercent: 0,
    clientId: 1,
    client: acme,
    billingType: 'retainer',
    projectType: 'resource_augmentation',
    totalValue: 48000,
    totalOutstanding: 12000,
  },
  {
    ...audit,
    id: 2,
    name: 'Mobile app',
    description: null,
    key: null,
    billingAddress: null,
    discountPercent: 0,
    clientId: null,
    client: null,
    billingType: 'fixed_cost',
    projectType: 'product',
    totalValue: 32000,
    totalOutstanding: 0,
  },
  {
    ...audit,
    id: 3,
    name: 'Legacy portal',
    description: 'Built before types.',
    key: null,
    billingAddress: null,
    discountPercent: 0,
    clientId: 1,
    client: acme,
    billingType: null,
    projectType: null,
    totalValue: 0,
    totalOutstanding: 0,
  },
];

const line = (id: number, invoiceId: number, description: string, quantity: number, rate: number) => ({
  ...audit,
  id,
  invoiceId,
  description,
  headcount: 1,
  quantity,
  rate,
  amount: quantity * rate,
});

export const invoiceRows = [
  {
    ...audit,
    id: 1,
    projectId: 1,
    number: 'INV-001',
    description: 'October retainer',
    subtotal: 36000,
    discountPercent: 0,
    amount: 36000,
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    paidDate: '2026-10-12',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    lineItems: [line(1, 1, 'Asha Rao — Mobile', 160, 150), line(2, 1, 'Ben Cho — Web', 160, 75)],
  },
  {
    ...audit,
    id: 2,
    projectId: 1,
    number: 'INV-002',
    description: null,
    subtotal: 12000,
    discountPercent: 0,
    amount: 12000,
    issueDate: '2026-11-01',
    dueDate: null,
    paidDate: null,
    periodStart: null,
    periodEnd: null,
    lineItems: [line(3, 2, 'Ben Cho — Web', 160, 75)],
  },
];

// Project 1's resources, shaped like GET /project-resources?projectId=1: a person and a category embedded as
// { id, name }, or null (a resource with no person; or a person or category deleted since it was saved).
export const resourceRows = [
  {
    ...audit,
    id: 1,
    projectId: 1,
    personId: 1,
    categoryId: 2,
    name: 'Asha Rao',
    headcount: 1,
    rate: 150,
    category: { id: 2, name: 'Mobile' },
    person: { id: 1, name: 'Asha Rao' },
  },
  {
    ...audit,
    id: 2,
    projectId: 1,
    personId: null,
    categoryId: 1,
    name: 'Ben Cho',
    headcount: 1,
    rate: 75,
    category: { id: 1, name: 'Web' },
    person: null,
  },
];

// GET /people: every column of the person; the resource form reads only the id and the name.
export const peopleRows = [
  { ...audit, id: 1, name: 'Asha Rao', joinDate: null, leaveDate: null, email: 'asha@example.com', phone: null, imageLink: null, contractLink: null, monthlySalary: null },
  { ...audit, id: 2, name: 'Ben Cho', joinDate: '2026-01-05', leaveDate: null, email: null, phone: '+91 20 5550 0101', imageLink: null, contractLink: null, monthlySalary: 4800 },
];

// GET /projects/1/invoice-draft for a retainer project: one line per resource, 160 hours at its rate.
export const draftBody = {
  lineItems: [
    { description: 'Asha Rao — Mobile', headcount: 1, quantity: 160, rate: 150 },
    { description: 'Ben Cho — Web', headcount: 1, quantity: 160, rate: 75 },
  ],
};

const envelope = (message: string, data: unknown) => ({ statusCode: 200, message, data, meta: null });

export const projectsEnvelope = (data: unknown = projectRows) => envelope('Successfully fetched projects', data);

export const projectEnvelope = (data: unknown = projectRows[0]) => envelope('Successfully fetched project', data);

export const invoicesEnvelope = (data: unknown = invoiceRows) => envelope('Successfully fetched invoices', data);

export const resourcesEnvelope = (data: unknown = resourceRows) =>
  envelope('Successfully fetched project resources', data);

export const peopleEnvelope = (data: unknown = peopleRows) => envelope('Successfully fetched people', data);

export const draftEnvelope = (data: unknown = draftBody) => envelope('Successfully built invoice draft', data);

// GET /projects/1/next-invoice-number?issueDate=...: what the next invoice would be numbered, null with no key.
export const nextNumberEnvelope = (number: string | null = 'OCTA/26-27/WEB/001') =>
  envelope('Successfully built next invoice number', { number });

// GET /invoices/1/email-draft: the client contact's email, a subject and a message to start from.
export const emailDraftBody = {
  to: ['michael@example.com'],
  subject: 'Invoice INV-001 from Test Company LLP',
  message:
    'Hello Michael Jordan,\n\nPlease find attached invoice INV-001 for the period 1 Sep – 30 Sep 2026, for $36,000.\n\nPayment details are on the invoice.\n\nRegards,\nTest Company LLP',
};

export const emailDraftEnvelope = (data: unknown = emailDraftBody) => envelope('Successfully built email draft', data);
