// Rows shaped like GET http://localhost:5001/api/v1/projects and /invoices (octacore-backend, FastAPI), in the
// service's own envelope; the values are made up. A project embeds its client's own columns (no country) or null.
// A project from before the type columns existed has null for both types. The totals are what the service
// calculates from a project's live invoices: project 1's match the two invoices below, and project 2's invoices
// are simply not listed here. Every amount is whole US cents, as the service sends it (a rate of 150 dollars is
// `rateCents` 15000). An invoice carries its lines, whose amount is headcount x quantity x rate (INV-001:
// 1 x 160 x 15000 + 1 x 160 x 7500), and, from the second invoice on, a billing period that may be null. Nothing here
// is discounted (discountPercent 0), so an invoice's amount equals its subtotal; tests that need a discount
// override it on a copy. Each project has a status and optional start and end dates: Website is active and started,
// Mobile app is on hold with no dates, Legacy portal is completed and has both. A project lists the technologies it
// uses as { id, name }, by name (Website uses Nest and React, the ids in fixtures/technologies.ts).
//
// Currency: a project names a billing country (`countryId`, and `country` as { id, name, currencyCode, currencySymbol })
// or leaves it null, and `billing` is what a new invoice starts from: its currency, the rate (units per US dollar, null
// when the project's own country has lost its rate), the tax rate in percent and where they came from. Website has no
// country of its own, so it bills in its client's (Acme is in India: INR, 18%); Mobile app names Germany (EUR, 19%);
// Legacy portal names the United States, so an Indian client is billed in dollars. An invoice keeps the currency, rate
// and tax rate it was issued with, its amounts are minor units of that currency, and `amountUsdCents` is its amount
// (after the discount, before tax) at its own rate: what the projects' totals add up. INV-001 and INV-002 are in
// dollars at rate 1 with no tax, as every invoice from before currencies is. The invoice in rupees is separate
// (`inrInvoiceRow`): the lists the tests count are the two dollar ones.
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
    projectStatus: 'active',
    startDate: '2026-01-01',
    endDate: null,
    technologies: [
      { id: 2, name: 'Nest' },
      { id: 1, name: 'React' },
    ],
    clientId: 1,
    client: acme,
    countryId: null,
    country: null,
    billing: { currencyCode: 'INR', currencySymbol: '₹', exchangeRate: 88.25, taxRate: 18, source: 'client' },
    billingType: 'retainer',
    projectType: 'resource_augmentation',
    totalValueCents: 4_800_000,
    totalOutstandingCents: 1_200_000,
  },
  {
    ...audit,
    id: 2,
    name: 'Mobile app',
    description: null,
    key: null,
    billingAddress: null,
    discountPercent: 0,
    projectStatus: 'on_hold',
    startDate: null,
    endDate: null,
    technologies: [],
    clientId: null,
    client: null,
    countryId: 80,
    country: { id: 80, name: 'Germany', currencyCode: 'EUR', currencySymbol: '€' },
    billing: { currencyCode: 'EUR', currencySymbol: '€', exchangeRate: 0.92, taxRate: 19, source: 'project' },
    billingType: 'fixed_cost',
    projectType: 'product',
    totalValueCents: 3_200_000,
    totalOutstandingCents: 0,
  },
  {
    ...audit,
    id: 3,
    name: 'Legacy portal',
    description: 'Built before types.',
    key: null,
    billingAddress: null,
    discountPercent: 0,
    projectStatus: 'completed',
    startDate: '2025-03-01',
    endDate: '2025-09-30',
    technologies: [],
    clientId: 1,
    client: acme,
    countryId: 226,
    country: { id: 226, name: 'United States', currencyCode: 'USD', currencySymbol: '$' },
    billing: { currencyCode: 'USD', currencySymbol: '$', exchangeRate: 1, taxRate: 0, source: 'project' },
    billingType: null,
    projectType: null,
    totalValueCents: 0,
    totalOutstandingCents: 0,
  },
];

const dollars = { currencyCode: 'USD', currencySymbol: '$', exchangeRate: 1, taxRate: 0, taxCents: 0 };

const line = (id: number, invoiceId: number, description: string, quantity: number, rateCents: number) => ({
  ...audit,
  id,
  invoiceId,
  description,
  headcount: 1,
  quantity,
  rateCents,
  amountCents: quantity * rateCents,
});

export const invoiceRows = [
  {
    ...audit,
    id: 1,
    projectId: 1,
    number: 'INV-001',
    description: 'October retainer',
    ...dollars,
    subtotalCents: 3_600_000,
    discountPercent: 0,
    amountCents: 3_600_000,
    totalCents: 3_600_000,
    amountUsdCents: 3_600_000,
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    paidDate: '2026-10-12',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    lineItems: [line(1, 1, 'Asha Rao — Mobile', 160, 15000), line(2, 1, 'Ben Cho — Web', 160, 7500)],
  },
  {
    ...audit,
    id: 2,
    projectId: 1,
    number: 'INV-002',
    description: null,
    ...dollars,
    subtotalCents: 1_200_000,
    discountPercent: 0,
    amountCents: 1_200_000,
    totalCents: 1_200_000,
    amountUsdCents: 1_200_000,
    issueDate: '2026-11-01',
    dueDate: null,
    paidDate: null,
    periodStart: null,
    periodEnd: null,
    lineItems: [line(3, 2, 'Ben Cho — Web', 160, 7500)],
  },
];

/**
 * An invoice in rupees with 18% tax, for the Mobile app project: one unit of ₹2,00,000.00 (20,000,000 paise), no
 * discount. The tax is 3,600,000 paise, the total 23,600,000, and at 88.25 per dollar the amount is $2,266.29
 * (20,000,000 / 88.25 = 226,628.89 cents, half up). Unpaid, due in the past of the fixtures' clock.
 */
export const inrInvoiceRow = {
  ...audit,
  id: 3,
  projectId: 2,
  number: 'INV-003',
  description: 'Mobile app build',
  currencyCode: 'INR',
  currencySymbol: '₹',
  exchangeRate: 88.25,
  taxRate: 18,
  subtotalCents: 20_000_000,
  discountPercent: 0,
  amountCents: 20_000_000,
  taxCents: 3_600_000,
  totalCents: 23_600_000,
  amountUsdCents: 226_629,
  issueDate: '2026-10-05',
  dueDate: '2026-10-20',
  paidDate: null,
  periodStart: null,
  periodEnd: null,
  lineItems: [line(4, 3, 'Mobile app build', 1, 20_000_000)],
};

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
    rateCents: 15000,
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
    rateCents: 7500,
    category: { id: 1, name: 'Web' },
    person: null,
  },
];

// GET /people: every column of the person; the resource form reads only the id and the name.
export const peopleRows = [
  { ...audit, id: 1, name: 'Asha Rao', joinDate: null, leaveDate: null, email: 'asha@example.com', phone: null, imageLink: null, contractLink: null, monthlySalaryCents: null },
  { ...audit, id: 2, name: 'Ben Cho', joinDate: '2026-01-05', leaveDate: null, email: null, phone: '+91 20 5550 0101', imageLink: null, contractLink: null, monthlySalaryCents: 480000 },
];

// GET /projects/1/invoice-draft for a retainer project: one line per resource, 160 hours at its rate, and the billing
// terms the invoice starts from. These are US dollars with no tax, so most tests read in dollars; `draftInrBody` is the
// same project billed in rupees, each rate converted at 88.25 (150.00 x 88.25 = 13,237.50) to a minor unit, half up.
export const draftBody = {
  lineItems: [
    { description: 'Asha Rao — Mobile', headcount: 1, quantity: 160, rateCents: 15000 },
    { description: 'Ben Cho — Web', headcount: 1, quantity: 160, rateCents: 7500 },
  ],
  currencyCode: 'USD',
  currencySymbol: '$',
  exchangeRate: 1,
  taxRate: 0,
};

export const draftInrBody = {
  lineItems: [
    { description: 'Asha Rao — Mobile', headcount: 1, quantity: 160, rateCents: 1_323_750 },
    { description: 'Ben Cho — Web', headcount: 1, quantity: 160, rateCents: 661_875 },
  ],
  currencyCode: 'INR',
  currencySymbol: '₹',
  exchangeRate: 88.25,
  taxRate: 18,
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
    'Hello Michael Jordan,\n\nPlease find attached invoice INV-001 for the period 1 Sep – 30 Sep 2026, for $36,000.00.\n\nPayment details are on the invoice.\n\nRegards,\nTest Company LLP',
};

export const emailDraftEnvelope = (data: unknown = emailDraftBody) => envelope('Successfully built email draft', data);
