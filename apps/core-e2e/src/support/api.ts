import { countriesBody } from './countries';

export const CORE_API = 'http://localhost:5001/api/v1';
/** The password the stubbed sign-in accepts. */
export const E2E_PASSWORD = 'correct horse battery';

// XHRs only: a plain URL match would also swallow a page navigation to the same address.
const xhr = (method: string, path: string, base: string) => ({
  method,
  url: `${base}${path}`,
  resourceType: 'xhr' as const,
});

type Row = Record<string, unknown>;

const stamp = '2023-07-25T09:30:00.000000Z';

/** A row as the core service sends it: the audit fields come with every record. */
const record = (fields: Row): Row => ({
  status: 1,
  createdDate: stamp,
  updatedDate: stamp,
  deletedDate: null,
  ...fields,
});

/** The core service wraps every answer in this envelope. */
const envelope = (data: unknown, statusCode = 200) => ({ statusCode, message: 'ok', data, meta: null });

const categories = (): Row[] =>
  Array.from({ length: 7 }, (_, index) =>
    record({
      id: index + 1,
      name: index === 0 ? 'Web' : `Category ${index + 1}`,
      description: `anything category-${index + 1}`,
    }),
  );

const users = (): Row[] => [
  record({ id: 1, name: 'Ada Admin', email: 'ada@example.com', role: 'admin', lastLoginDate: stamp }),
];

const acme = (): Row => record({ id: 1, name: 'Acme', description: 'Anvils and rockets.', countryId: 99, city: 'Pune' });

// What a new invoice is billed in. Acme is in India (active, 88.25 rupees to the dollar, 18% tax in the countries stub),
// so a project of Acme's with no country of its own bills in rupees; any other project is in dollars by default.
const billedInRupees = { currencyCode: 'INR', currencySymbol: '₹', exchangeRate: 88.25, taxRate: 18, source: 'client' };
const billedInDollars = { currencyCode: 'USD', currencySymbol: '$', exchangeRate: 1, taxRate: 0, source: 'default' };

const project = (fields: Row): Row =>
  record({
    description: null,
    key: null,
    billingAddress: null,
    discountPercent: 0,
    projectStatus: 'active',
    startDate: null,
    endDate: null,
    technologies: [],
    clientId: null,
    client: null,
    countryId: null,
    country: null,
    billing: billedInDollars,
    billingType: 'retainer',
    projectType: 'product',
    totalValueCents: 0,
    totalOutstandingCents: 0,
    ...fields,
  });

const projects = (): Row[] => [
  project({
    id: 1,
    name: 'Website',
    description: 'Marketing site.',
    key: 'WEB',
    billingAddress: 'Acme Corporation\n1 Anvil Road\nPune, India',
    // A long-term contract: every new invoice for this project starts at 10% off.
    discountPercent: 10,
    clientId: 1,
    client: acme(),
    billing: billedInRupees,
    projectType: 'resource_augmentation',
    // The two dollar invoices and the one in rupees (INV-003, $2,266.29), each at its own rate and before tax.
    totalValueCents: 5_026_629,
    totalOutstandingCents: 1_426_629,
  }),
  project({ id: 2, name: 'Mobile app', billingType: 'fixed_cost', totalValueCents: 3_200_000 }),
  project({
    id: 3,
    name: 'Legacy portal',
    clientId: 1,
    client: acme(),
    billing: billedInRupees,
    projectType: null,
    billingType: null,
  }),
];

// Every amount the service sends is whole minor units of the invoice's currency: a rate of 15000 on a dollar invoice is
// $150.00 an hour.
const line = (id: number, invoiceId: number, description: string, quantity: number, rateCents: number): Row =>
  record({ id, invoiceId, description, headcount: 1, quantity, rateCents, amountCents: quantity * rateCents });

// Invoices from before currencies are in dollars at rate 1, with no tax.
const dollars = { currencyCode: 'USD', currencySymbol: '$', exchangeRate: 1, taxRate: 0, taxCents: 0 };

const invoices = (): Row[] => [
  record({
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
  }),
  record({
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
  }),
  // ₹2,00,000.00 (20,000,000 paise) with 18% tax: 3,600,000 paise, 23,600,000 to pay. At 88.25 to the dollar the amount
  // is 226,628.89 US cents, 226,629 when rounded half up.
  record({
    id: 3,
    projectId: 1,
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
    issueDate: '2026-11-02',
    dueDate: null,
    paidDate: null,
    periodStart: null,
    periodEnd: null,
    lineItems: [line(4, 3, 'Mobile app build', 1, 20_000_000)],
  }),
];

const resources = (): Row[] => [
  record({
    id: 1,
    projectId: 1,
    personId: 1,
    categoryId: 2,
    name: 'Asha Rao',
    headcount: 1,
    rateCents: 15000,
    category: { id: 2, name: 'Mobile' },
    person: { id: 1, name: 'Asha Rao' },
  }),
  record({
    id: 2,
    projectId: 1,
    personId: null,
    categoryId: 1,
    name: 'Ben Cho',
    headcount: 1,
    rateCents: 7500,
    category: { id: 1, name: 'Web' },
    person: null,
  }),
];

const people = (): Row[] => [
  record({
    id: 1,
    name: 'Asha Rao',
    joinDate: '2024-01-15',
    leaveDate: null,
    email: 'asha@example.com',
    phone: null,
    imageLink: null,
    contractLink: null,
    monthlySalaryPaise: 8_500_075,
    // By name, as the service sends them.
    technologies: [
      { id: 2, name: 'Nest' },
      { id: 1, name: 'React' },
    ],
  }),
  record({
    id: 2,
    name: 'Ben Cho',
    joinDate: null,
    leaveDate: null,
    email: null,
    phone: '+91 20 5550 0101',
    imageLink: null,
    contractLink: null,
    monthlySalaryPaise: null,
    technologies: [],
  }),
];

// The ledger, newest first as the service sends it: Asha was on the Mobile app, then the bench, and has been on the
// Website since 12 March 2026. Ben has no entry, so he is on the bench with no date. A null project is the bench.
const entry = (fields: Row): Row => record({ note: null, ...fields });

const allocations = (): Row[] => [
  entry({
    id: 3,
    personId: 1,
    projectId: 1,
    effectiveDate: '2026-03-12',
    note: 'Moves to the web build',
    person: { id: 1, name: 'Asha Rao' },
    project: { id: 1, name: 'Website' },
  }),
  entry({
    id: 2,
    personId: 1,
    projectId: null,
    effectiveDate: '2026-01-15',
    person: { id: 1, name: 'Asha Rao' },
    project: null,
  }),
  entry({
    id: 1,
    personId: 1,
    projectId: 2,
    effectiveDate: '2025-06-02',
    person: { id: 1, name: 'Asha Rao' },
    project: { id: 2, name: 'Mobile app' },
  }),
];

const leaves = (): Row[] => [
  record({
    id: 2,
    personId: 1,
    person: { id: 1, name: 'Asha Rao' },
    startDate: '2026-05-04',
    endDate: '2026-05-04',
    leaveType: 'sick',
    reason: null,
  }),
  record({
    id: 1,
    personId: 1,
    person: { id: 1, name: 'Asha Rao' },
    startDate: '2026-03-12',
    endDate: '2026-03-14',
    leaveType: 'casual',
    reason: 'Family wedding',
  }),
];

/** Whether the row passes the list's filters: each named query parameter, when given, must equal the row's value. */
const matchesFilter = (row: Row, query: URLSearchParams, keys: string[]) =>
  keys.every((key) => !query.has(key) || row[key] === Number(query.get(key)));

/**
 * The core service sends credentials (the refresh cookie), and a browser only accepts a credentialed cross-origin
 * answer that names the page's own origin and allows credentials.
 */
const corsHeaders = (origin: unknown) => ({
  'access-control-allow-origin': typeof origin === 'string' ? origin : 'http://localhost:3000',
  'access-control-allow-credentials': 'true',
});

interface CoreAnswer {
  statusCode?: number;
  body: unknown;
}

/** A stub for one core-service route. Every answer carries the CORS headers a credentialed request needs. */
function stubCore(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  answer: (request: { url: string; body: unknown }) => CoreAnswer,
) {
  cy.intercept(xhr(method, path, CORE_API), (req) => {
    const { statusCode = 200, body } = answer({ url: req.url, body: req.body });
    // `body`: an object that holds `statusCode` would otherwise be read by Cypress as the response itself.
    req.reply({ statusCode, body, headers: corsHeaders(req.headers.origin) });
  });
}

/**
 * Stubs every collection: categories, technologies, clients, client contacts, projects, project resources, people,
 * invoices (and each invoice's PDF, email draft and next number), countries, users, allocation entries and leaves as the core service answers them, and the sign-in routes. `signedIn` says
 * whether the refresh cookie is valid when the page loads; `POST /auth/login` accepts E2E_PASSWORD and signs in.
 * `/categories` and `/users` keep state so an add or a delete shows up on the next read.
 */
export function stubApi({ signedIn = true }: { signedIn?: boolean } = {}) {
  let rows = categories();
  let userRows = users();
  let session = signedIn;

  // A request no stub below answers must never reach a real service: the default address is the one a developer's own
  // core service listens on. This is registered first, so it is the last one tried (Cypress tries the newest first), and
  // it answers 501 with a message that names the request, which the page shows as an error state.
  cy.intercept({ url: `${CORE_API}/**`, resourceType: 'xhr' }, (req) => {
    req.reply({
      statusCode: 501,
      body: { statusCode: 501, message: `No e2e stub for ${req.method} ${req.url}`, data: null },
      headers: corsHeaders(req.headers.origin),
    });
  });

  // The preflight a credentialed request with an Authorization header sends first.
  cy.intercept('OPTIONS', `${CORE_API}/**`, (req) => {
    req.reply({
      statusCode: 204,
      headers: {
        ...corsHeaders(req.headers.origin),
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE',
        'access-control-allow-headers': 'authorization, content-type',
      },
    });
  });

  const sessionBody = () => envelope({ accessToken: 'e2e-access-token', expiresIn: 900, user: users()[0] });
  const unauthorized = (): CoreAnswer => ({ statusCode: 401, body: envelope(null, 401) });
  stubCore('POST', '/auth/refresh', () => (session ? { body: sessionBody() } : unauthorized()));
  stubCore('POST', '/auth/login', ({ body }) => {
    if ((body as Row).password !== E2E_PASSWORD) return unauthorized();
    session = true;
    return { body: sessionBody() };
  });
  stubCore('POST', '/auth/logout', () => {
    session = false;
    return { body: envelope(null) };
  });

  stubCore('GET', '/users', () => ({ body: envelope(userRows) }));
  stubCore('POST', '/users', ({ body }) => {
    const { password, ...fields } = body as Row;
    void password; // never echoed back, like the real service
    const created = record({ id: 100, lastLoginDate: null, ...fields });
    userRows = [...userRows, created];
    return { statusCode: 201, body: envelope(created, 201) };
  });

  stubCore('GET', '/categories', () => ({ body: envelope(rows) }));
  stubCore('POST', '/categories', ({ body }) => {
    const created = record({ id: 100, ...(body as Row) });
    rows = [...rows, created];
    return { statusCode: 201, body: envelope(created, 201) };
  });
  stubCore('DELETE', '/categories/*', ({ url }) => {
    const id = Number(url.split('/').pop());
    const removed = rows.find((row) => row.id === id);
    rows = rows.filter((row) => row.id !== id);
    return { body: envelope(removed) };
  });

  stubCore('GET', '/countries', () => ({ body: countriesBody }));
  stubCore('POST', '/countries/sync-rates', () => ({
    body: envelope({
      date: '2026-10-19',
      updatedCountries: 3,
      updatedCurrencies: ['EUR', 'INR'],
      missingCurrencies: ['JPY'],
    }),
  }));

  stubCore('GET', '/technologies', () => ({
    body: envelope([
      record({ id: 1, name: 'React', description: 'A library for user interfaces.', categoryId: 1, category: categories()[0] }),
      record({ id: 2, name: 'Nest', description: 'A Node framework.', categoryId: null, category: null }),
      record({ id: 3, name: 'Express', description: null, categoryId: null, category: null }),
    ]),
  }));

  stubCore('GET', '/clients', () => ({
    body: envelope([
      record({
        id: 1,
        name: 'Acme',
        description: 'Anvils and rockets.',
        countryId: 99,
        city: 'Pune',
        country: record({ id: 99, iso: 'IN', name: 'INDIA', nicename: 'India', iso3: 'IND', numcode: 356, phonecode: 91 }),
      }),
      record({ id: 2, name: 'Globex', description: null, countryId: null, city: null, country: null }),
    ]),
  }));

  stubCore('GET', '/client-contacts', () => ({
    body: envelope([
      record({ id: 1, clientId: 1, name: 'Ada Lovelace', email: 'ada@example.com', phone: '+91 20 5550 0100' }),
    ]),
  }));

  // `*` does not cross a `/`, and the invoices call carries a query string, hence the trailing `*` on that one.
  stubCore('GET', '/projects', () => ({ body: envelope(projects()) }));
  stubCore('GET', '/projects/*', () => ({ body: envelope(projects()[0]) }));
  stubCore('GET', '/invoices*', () => ({ body: envelope(invoices()) }));
  // `*` does not cross a `/`, so the draft (`/projects/1/invoice-draft`) needs its own stub; the resources call
  // carries a query string.
  // Website bills in rupees: the resources' $150.00 and $75.00 an hour converted at 88.25 (₹13,237.50 and ₹6,618.75).
  stubCore('GET', '/projects/*/invoice-draft', () => ({
    body: envelope({
      lineItems: [
        { description: 'Asha Rao — Mobile', headcount: 1, quantity: 160, rateCents: 1_323_750 },
        { description: 'Ben Cho — Web', headcount: 1, quantity: 160, rateCents: 661_875 },
      ],
      currencyCode: 'INR',
      currencySymbol: '₹',
      exchangeRate: 88.25,
      taxRate: 18,
    }),
  }));
  stubCore('GET', '/project-resources*', () => ({ body: envelope(resources()) }));
  stubCore('GET', '/people', () => ({ body: envelope(people()) }));
  // One person, for their own page; `*` does not cross a `/`, so the list's stub does not answer it.
  stubCore('GET', '/people/*', ({ url }) => {
    const found = people().find((person) => person.id === Number(url.split('/').pop()));
    return found ? { body: envelope(found) } : { statusCode: 404, body: envelope(null, 404) };
  });
  // Both lists carry a query string (`?personId=1`), hence the trailing `*`, and are filtered like the service does.
  stubCore('GET', '/allocations*', ({ url }) => {
    const query = new URL(url).searchParams;
    return { body: envelope(allocations().filter((row) => matchesFilter(row, query, ['personId', 'projectId']))) };
  });
  stubCore('GET', '/leaves*', ({ url }) => {
    const query = new URL(url).searchParams;
    return { body: envelope(leaves().filter((row) => matchesFilter(row, query, ['personId']))) };
  });

  // `*` does not cross a `/`: each invoice document route and the next-number route needs its own stub.
  stubCore('GET', '/invoices/*/pdf', () => ({ body: '%PDF-1.4\n%%EOF' }));
  stubCore('GET', '/invoices/*/email-draft', () => ({
    body: envelope({
      to: ['michael@example.com'],
      subject: 'Invoice INV-001 from Test Company LLP',
      message: 'Hello Michael Jordan,\n\nPlease find attached invoice INV-001.\n\nRegards,\nTest Company LLP',
    }),
  }));
  stubCore('GET', '/projects/*/next-invoice-number*', () => ({ body: envelope({ number: 'OCTA/26-27/WEB/001' }) }));
}
