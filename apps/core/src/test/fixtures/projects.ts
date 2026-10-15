// Rows shaped like GET http://localhost:5001/api/v1/projects and /invoices (octacore-backend, FastAPI), in the
// service's own envelope; the values are made up. A project embeds its client's own columns (no country) or null.
// A project from before the type columns existed has null for both types. The totals are what the service
// calculates from a project's live invoices: project 1's match the two invoices below, and project 2's invoices
// are simply not listed here.
const stamp = '2026-10-15T09:30:00.000000Z';
const audit = { status: 1, createdDate: stamp, updatedDate: stamp, deletedDate: null };

const acme = { ...audit, id: 1, name: 'Acme', description: 'Anvils and rockets.', countryId: null, city: null };

export const projectRows = [
  {
    ...audit,
    id: 1,
    name: 'Website',
    description: 'Marketing site.',
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
    clientId: 1,
    client: acme,
    billingType: null,
    projectType: null,
    totalValue: 0,
    totalOutstanding: 0,
  },
];

export const invoiceRows = [
  {
    ...audit,
    id: 1,
    projectId: 1,
    number: 'INV-001',
    description: 'October retainer',
    amount: 36000,
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    paidDate: '2026-10-12',
  },
  {
    ...audit,
    id: 2,
    projectId: 1,
    number: 'INV-002',
    description: null,
    amount: 12000,
    issueDate: '2026-11-01',
    dueDate: null,
    paidDate: null,
  },
];

const envelope = (message: string, data: unknown) => ({ statusCode: 200, message, data, meta: null });

export const projectsEnvelope = (data: unknown = projectRows) => envelope('Successfully fetched projects', data);

export const projectEnvelope = (data: unknown = projectRows[0]) => envelope('Successfully fetched project', data);

export const invoicesEnvelope = (data: unknown = invoiceRows) => envelope('Successfully fetched invoices', data);
