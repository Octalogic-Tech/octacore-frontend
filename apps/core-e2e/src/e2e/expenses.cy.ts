import { stubExpenses } from '../support/expenses';

const nav = 'nav[aria-label="Main"]';

describe('expenses', () => {
  beforeEach(() => {
    stubExpenses();
    cy.viewport(1280, 800);
    cy.visit('/');
  });

  it('adds a recurring expense and finds its charges in the ledger', () => {
    cy.get(nav).contains('a', 'Recurring').click();
    cy.contains('h1', 'Recurring expenses');
    cy.contains('No recurring expenses yet.').should('be.visible');

    cy.contains('button', 'Add recurring expense').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#recurring-name').type('Figma');
      cy.get('#recurring-type').select('Software subscription');
      cy.get('#recurring-start-date').type('2026-08-01');
      cy.get('#recurring-amount').type('15');
      cy.contains('button', 'Save').click();
    });
    cy.get('[role="dialog"]').should('not.exist');

    cy.contains('[role="status"]', 'Created 3 charges.').should('be.visible');
    cy.contains('td', 'Figma').should('be.visible');
    cy.contains('Active: $15.00 per month').should('be.visible');

    cy.get(nav).contains('a', 'Expenses').click();
    cy.contains('h1', 'Expenses');
    cy.contains('td', '1 Aug 2026').should('be.visible');
    // en-GB abbreviates September as "Sept" in newer browsers and "Sep" in older ones.
    cy.contains('td', /^1 Sept? 2026$/).should('be.visible');
    cy.contains('td', '1 Oct 2026').should('be.visible');
    // The first table is the ledger; the second, further down, is the by-type breakdown.
    cy.get('table').first().find('tbody tr').should('have.length', 3);
    cy.contains('3 expenses · $45.00').should('be.visible');
    cy.get('table').first().contains('Recurring').should('be.visible');
  });

  it('shows the new expense dialog with US dollars chosen', () => {
    cy.get(nav).contains('a', 'Expenses').click();
    cy.contains('button', 'Add expense').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#expense-currency').should('have.value', '1');
      cy.get('#expense-currency').select('2');
      cy.get('#expense-amount').type('8825');
      cy.contains('About $100.00 at 88.25 INR per $1.').should('be.visible');
      cy.contains('button', 'Cancel').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
  });

  it('lists the currencies and keeps US dollars locked', () => {
    cy.get(nav).contains('a', 'Currencies').click();
    cy.contains('h1', 'Currencies');
    cy.contains('td', 'Indian rupee').should('be.visible');
    cy.contains('td', '88.25').should('be.visible');
    cy.contains('Primary').should('be.visible');
    cy.get('button[aria-label="Edit US dollar"]').should('not.exist');
    cy.get('button[aria-label="Edit Indian rupee"]').should('be.visible');
  });
});
