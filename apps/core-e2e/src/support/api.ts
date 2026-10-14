import { countriesBody } from './countries';

export const API = 'http://localhost:3001';
export const CORE_API = 'http://localhost:5001/api/v1';

type Row = Record<string, unknown>;

const categories = (): Row[] =>
  Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    name: index === 0 ? 'Web' : `Category ${index + 1}`,
    description: `anything category-${index + 1}`,
    created: '2023-07-25',
    updated: '2023-07-25',
  }));

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

/** Stubs every collection. `/categories` keeps state so an add or a delete shows up on the next read. */
export function stubApi() {
  let rows = categories();

  cy.intercept('GET', `${API}/categories`, (req) => req.reply(rows));
  cy.intercept('POST', `${API}/categories`, (req) => {
    const created = { id: 100, ...req.body };
    rows = [...rows, created];
    req.reply(201, created);
  });
  cy.intercept('DELETE', `${API}/categories/*`, (req) => {
    const id = Number(req.url.split('/').pop());
    rows = rows.filter((row) => row.id !== id);
    req.reply({});
  });

  // `body`: an object that holds `statusCode` would otherwise be read by Cypress as the response itself.
  cy.intercept('GET', `${CORE_API}/countries`, { body: countriesBody });

  cy.intercept('GET', `${API}/technologies`, [
    { id: 1, name: 'React', description: 'A library for user interfaces.', category: 'Frontend' },
    { id: 2, name: 'Nest', description: 'A Node framework.', category: 'Backend' },
    { id: 3, name: 'Express', description: 'A web framework for Node.' },
  ]);

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
