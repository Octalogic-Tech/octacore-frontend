import { stubApi } from '../support/api';

const nav = 'nav[aria-label="Main"]';

describe('core', () => {
  beforeEach(() => {
    stubApi();
    cy.viewport(1280, 800);
    cy.visit('/');
  });

  it('moves through every page from the sidebar', () => {
    cy.contains('h1', 'Overview');
    for (const page of ['Clients', 'Projects', 'People', 'Invoices', 'Categories', 'Technologies', 'Countries', 'Overview']) {
      cy.get(nav).contains('a', page).click();
      cy.contains('h1', page);
    }
  });

  it('marks only the current page', () => {
    cy.get(nav).contains('a', 'Categories').click();
    cy.get(`${nav} a[aria-current="page"]`).should('have.length', 1).and('contain', 'Categories');
  });

  it('lists the clients with their primary contact', () => {
    cy.get(nav).contains('a', 'Clients').click();
    cy.contains('td', 'Acme').should('be.visible');
    cy.contains('td', 'Ada Lovelace').should('be.visible');
    cy.contains('td', 'ada@example.com').should('be.visible');
    cy.contains('td', 'Globex').should('be.visible');
  });

  it('lists the people with their monthly salary in dollars and cents', () => {
    cy.get(nav).contains('a', 'People').click();
    cy.contains('h1', 'People');
    cy.contains('td', 'Asha Rao').should('be.visible');
    cy.contains('td', 'asha@example.com').should('be.visible');
    cy.contains('td', '$5,600.75').should('be.visible');
    cy.contains('td', 'Ben Cho').should('be.visible');
    cy.get(`${nav} a[aria-current="page"]`).should('have.length', 1).and('contain', 'People');
  });

  it('lists the projects and opens one with its resources and invoices', () => {
    cy.get(nav).contains('a', 'Projects').click();
    cy.contains('td', 'Website').should('be.visible');
    cy.contains('td', 'Resource augmentation').should('be.visible');
    cy.contains('td', 'Legacy portal').should('be.visible');
    cy.contains('a', 'Website').click();
    cy.contains('h1', 'Website');
    cy.contains('p', '$12,000.00 outstanding of $48,000.00 invoiced.').should('be.visible');
    cy.contains('dt', 'Discount').next().should('have.text', '10%');
    // The overview holds the facts and what is owed; the tables are one tab each, and the tab is in the address.
    cy.contains('td', 'INV-001').should('not.exist');
    cy.contains('[role="tab"]', 'Invoices').click();
    cy.location('search').should('eq', '?tab=invoices');
    cy.contains('td', 'INV-001').should('be.visible');
    cy.contains('Paid 12 Oct 2026').should('be.visible');
    cy.contains('Unpaid').should('be.visible');
    cy.contains('[role="tab"]', 'Resources').click();
    cy.location('search').should('eq', '?tab=resources');
    cy.contains('h2', 'Resources').should('be.visible');
    cy.contains('td', 'Asha Rao').should('be.visible');
    cy.contains('td', '$150.00').should('be.visible');
    cy.contains('th', 'Qty').should('be.visible');
    cy.contains('button', 'Add invoice').click();
    cy.get('[role="dialog"]').invoke('outerWidth').should('be.gt', 1000);
    cy.get('[role="dialog"]').within(() => {
      cy.get('input[aria-label="Line 1 description"]').should('have.value', 'Asha Rao — Mobile');
      // The project's 10% starts the invoice's discount, and the total is after it.
      cy.get('#invoice-discount').should('have.value', '10');
      cy.contains('Subtotal $36,000.00').should('be.visible');
      cy.contains('Discount (10%) -$3,600.00').should('be.visible');
      cy.contains('Total $32,400.00').should('be.visible');
      cy.get('#invoice-discount').clear();
      cy.get('#invoice-discount').type('0');
      cy.contains('Total $36,000.00').should('be.visible');
      cy.contains('button', 'Cancel').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('[role="tab"]', 'Invoices').click();
    cy.get('button[aria-label="Preview INV-001"]').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('iframe[title="Invoice INV-001"]').should('have.attr', 'src').and('match', /^blob:/);
    });
    cy.get('[role="dialog"]').find('button[aria-label="Close"]').click();
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('button[aria-label="Email INV-001"]').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#email-to').should('have.value', 'michael@example.com');
      cy.contains('button', 'Cancel').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.get(`${nav} a[aria-current="page"]`).should('have.length', 1).and('contain', 'Projects');
  });

  it('adds a category and deletes it through the confirmation', () => {
    cy.get(nav).contains('a', 'Categories').click();
    cy.contains('button', 'Add category').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#category-name').type('Data');
      cy.get('#category-description').type('Data work');
      cy.contains('button', 'Save').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('td', 'Data').should('be.visible');

    cy.get('button[aria-label="Delete Data"]').click();
    cy.get('[role="alertdialog"]').should('contain', 'This cannot be undone.');
    cy.get('[role="alertdialog"]').contains('button', 'Delete category').click();
    cy.contains('td', 'Data').should('not.exist');
  });

  it('lists the countries from the core service and finds one by calling code', () => {
    cy.get(nav).contains('a', 'Countries').click();
    cy.contains('td', 'Afghanistan').should('be.visible');
    cy.get('#country-search').type('+44');
    cy.contains('td', 'United Kingdom').should('be.visible');
    cy.contains('td', 'Afghanistan').should('not.exist');
  });

  it('lists the unpaid invoices, and the paid ones when asked', () => {
    cy.get(nav).contains('a', 'Invoices').click();
    cy.contains('h1', 'Invoices');
    cy.get('#invoices-status').should('have.value', 'active');
    cy.contains('td', 'INV-002').should('be.visible');
    cy.contains('td', 'INV-001').should('not.exist');
    cy.get('#invoices-status').select('Paid');
    cy.contains('td', 'INV-001').should('be.visible');
    cy.contains('td', 'INV-002').should('not.exist');
  });

  it('exports the filtered invoices as a CSV file', () => {
    cy.get(nav).contains('a', 'Invoices').click();
    cy.contains('button', 'Export CSV').click();
    cy.readFile(`${Cypress.config('downloadsFolder')}/invoices.csv`)
      .should('contain', 'Number,Client,Project,Issued,Due,Paid,Amount,Status')
      .and('contain', 'INV-002,Acme,Website,2026-11-01,,,12000.00,Unpaid')
      .and('not.contain', 'INV-001');
  });
});
