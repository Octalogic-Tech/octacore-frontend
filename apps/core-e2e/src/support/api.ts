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

const project = (fields: Row): Row =>
  record({
    description: null,
    key: null,
    billingAddress: null,
    discountPercent: 0,
    clientId: null,
    client: null,
    billingType: 'retainer',
    projectType: 'product',
    totalValue: 0,
    totalOutstanding: 0,
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
    projectType: 'resource_augmentation',
    totalValue: 48000,
    totalOutstanding: 12000,
  }),
  project({ id: 2, name: 'Mobile app', billingType: 'fixed_cost', totalValue: 32000 }),
  project({ id: 3, name: 'Legacy portal', clientId: 1, client: acme(), projectType: null, billingType: null }),
];

const line = (id: number, invoiceId: number, description: string, quantity: number, rate: number): Row =>
  record({ id, invoiceId, description, headcount: 1, quantity, rate, amount: quantity * rate });

const invoices = (): Row[] => [
  record({
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
  }),
  record({
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
    rate: 150,
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
    rate: 75,
    category: { id: 1, name: 'Web' },
    person: null,
  }),
];

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
 * invoices (and each invoice's PDF, email draft and next number), countries and users as the core service answers them, and the sign-in routes. `signedIn` says
 * whether the refresh cookie is valid when the page loads; `POST /auth/login` accepts E2E_PASSWORD and signs in.
 * `/categories` and `/users` keep state so an add or a delete shows up on the next read.
 */
export function stubApi({ signedIn = true }: { signedIn?: boolean } = {}) {
  let rows = categories();
  let userRows = users();
  let session = signedIn;

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
  stubCore('GET', '/projects/*/invoice-draft', () => ({
    body: envelope({
      lineItems: [
        { description: 'Asha Rao — Mobile', headcount: 1, quantity: 160, rate: 150 },
        { description: 'Ben Cho — Web', headcount: 1, quantity: 160, rate: 75 },
      ],
    }),
  }));
  stubCore('GET', '/project-resources*', () => ({ body: envelope(resources()) }));
  stubCore('GET', '/people', () => ({
    body: envelope([
      record({
        id: 1,
        name: 'Asha Rao',
        joinDate: '2024-01-15',
        leaveDate: null,
        email: 'asha@example.com',
        phone: null,
        imageLink: null,
        contractLink: null,
        monthlySalary: 5600,
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
        monthlySalary: null,
      }),
    ]),
  }));

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
