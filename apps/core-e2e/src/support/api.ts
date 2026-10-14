import { countriesBody } from './countries';

export const API = 'http://localhost:3001';
export const CORE_API = 'http://localhost:5001/api/v1';

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

const bill = (id: number, billDate: string, approved: boolean, uploadedBy: string, amount: number): Row => ({
  id,
  billDate,
  amount,
  billType: id % 2 ? 'Regular' : 'Bonus',
  actualExpense: id % 2 === 0,
  billPath: `/path/to/bill/${id}`,
  uploadedBy,
  submittedBy: uploadedBy,
  approved,
  approvedBy: approved ? 'Manager' : '',
});

/**
 * Stubs every collection: categories, technologies, clients, client contacts and countries as the core service
 * answers them, projects and bills as the json-server mock does. `/categories` keeps state so an add or a delete
 * shows up on the next read.
 */
export function stubApi() {
  let rows = categories();

  // `body`: an object that holds `statusCode` would otherwise be read by Cypress as the response itself.
  cy.intercept('GET', `${CORE_API}/categories`, (req) => req.reply({ body: envelope(rows) }));
  cy.intercept('POST', `${CORE_API}/categories`, (req) => {
    const created = record({ id: 100, ...req.body });
    rows = [...rows, created];
    req.reply({ statusCode: 201, body: envelope(created, 201) });
  });
  cy.intercept('DELETE', `${CORE_API}/categories/*`, (req) => {
    const id = Number(req.url.split('/').pop());
    const removed = rows.find((row) => row.id === id);
    rows = rows.filter((row) => row.id !== id);
    req.reply({ body: envelope(removed) });
  });

  cy.intercept('GET', `${CORE_API}/countries`, { body: countriesBody });

  cy.intercept('GET', `${CORE_API}/technologies`, {
    body: envelope([
      record({ id: 1, name: 'React', description: 'A library for user interfaces.', categoryId: 1, category: categories()[0] }),
      record({ id: 2, name: 'Nest', description: 'A Node framework.', categoryId: null, category: null }),
      record({ id: 3, name: 'Express', description: null, categoryId: null, category: null }),
    ]),
  });

  cy.intercept('GET', `${CORE_API}/clients`, {
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
  });

  cy.intercept('GET', `${CORE_API}/client-contacts`, {
    body: envelope([
      record({ id: 1, clientId: 1, name: 'Ada Lovelace', email: 'ada@example.com', phone: '+91 20 5550 0100' }),
    ]),
  });

  cy.intercept(
    'GET',
    `${API}/projects`,
    Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      name: `Project ${index + 1}`,
      description: `anything project-${index + 1}`,
      client: `Client ${String.fromCharCode(65 + (index % 5))}`,
      totalValue: 20000 + index * 7000,
      totalOutstanding: index % 3 === 1 ? 0 : 3000 + index * 2500,
    })),
  );

  cy.intercept('GET', `${API}/bills`, [
    bill(1, '2023-08-10', true, 'John Doe', 100),
    bill(2, '2023-08-09', false, 'Jane Smith', 200),
    bill(3, '2023-08-08', true, 'Michael Johnson', 50),
    bill(4, '2023-08-07', false, 'Priya Nair', 75.5),
    bill(5, '2023-08-06', true, 'John Doe', 300),
    bill(6, '2023-08-05', false, 'Jane Smith', 120),
  ]);
}
