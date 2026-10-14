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
    for (const page of ['Projects', 'Receipts and bills', 'Categories', 'Technologies', 'Countries', 'Overview']) {
      cy.get(nav).contains('a', page).click();
      cy.contains('h1', page);
    }
  });

  it('marks only the current page', () => {
    cy.get(nav).contains('a', 'Categories').click();
    cy.get(`${nav} a[aria-current="page"]`).should('have.length', 1).and('contain', 'Categories');
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

  it('exports the filtered bills as a CSV file', () => {
    cy.get(nav).contains('a', 'Receipts and bills').click();
    cy.get('#bills-approval').select('approved');
    cy.contains('button', 'Export CSV').click();
    cy.readFile(`${Cypress.config('downloadsFolder')}/receipts-and-bills.csv`)
      .should('contain', 'Bill date,Amount,Bill type')
      .and('contain', 'John Doe')
      .and('not.contain', 'Jane Smith');
  });
});
