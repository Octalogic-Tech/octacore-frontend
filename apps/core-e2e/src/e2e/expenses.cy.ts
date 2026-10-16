import { stubExpenses } from '../support/expenses';

const nav = 'nav[aria-label="Main"]';

describe('expenses', () => {
  beforeEach(() => {
    stubExpenses();
    cy.viewport(1280, 800);
    cy.visit('/');
  });

  it('keeps one Expenses page with three tabs, the Overview first', () => {
    cy.get(nav).contains('a', 'Expenses').click();
    cy.contains('h1', 'Expenses');
    cy.get('[role="tab"]').then((tabs) => {
      expect([...tabs].map((tab) => tab.textContent)).to.deep.equal(['Overview', 'One-time', 'Recurring']);
    });
    cy.contains('[role="tab"]', 'Overview').should('have.attr', 'aria-selected', 'true');
    cy.location('search').should('eq', '');
    // Recurring expenses are a tab, not a page of their own.
    cy.get(nav).contains('a', 'Recurring').should('not.exist');
  });

  it('adds a recurring expense and finds its charges on the Overview', () => {
    cy.get(nav).contains('a', 'Expenses').click();
    cy.contains('[role="tab"]', 'Recurring').click();
    cy.location('search').should('eq', '?tab=recurring');
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

    // The charges are expenses: the Overview lists them, tagged, and adds them up.
    cy.contains('[role="tab"]', 'Overview').click();
    cy.location('search').should('eq', '');
    cy.get('table').first().find('tbody tr').should('have.length', 3);
    cy.get('table').first().contains('Recurring').should('be.visible');
    cy.get('dl[aria-label^="Spend in"]').within(() => {
      cy.contains('dt', 'Total').next().should('have.text', '$45.00');
      cy.contains('dt', 'Recurring').next().should('have.text', '$45.00');
      cy.contains('dt', 'One-time').next().should('have.text', '$0.00');
    });

    // They were not typed by hand, so the One-time tab has none.
    cy.contains('[role="tab"]', 'One-time').click();
    cy.location('search').should('eq', '?tab=one-time');
    cy.contains('No one-time expenses yet.').should('be.visible');
  });

  it('moves between months on the Overview, keeping the month in the address', () => {
    cy.get(nav).contains('a', 'Expenses').click();
    cy.contains('button', 'Previous month').click();
    cy.location('search').should('match', /^\?month=\d{4}-\d{2}$/);
    cy.contains('button', 'This month').click();
    cy.location('search').should('eq', '');
  });

  it('sends the old Recurring link to the Recurring tab', () => {
    cy.visit('/finance/recurring');
    cy.location('pathname').should('eq', '/finance/expenses');
    cy.location('search').should('eq', '?tab=recurring');
    cy.contains('[role="tab"]', 'Recurring').should('have.attr', 'aria-selected', 'true');
  });

  it('shows the new expense dialog with US dollars chosen and a person to pick', () => {
    cy.get(nav).contains('a', 'Expenses').click();
    cy.contains('button', 'Add expense').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#expense-currency').should('have.value', '1');
      cy.get('#expense-person').select('Asha Rao');
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
