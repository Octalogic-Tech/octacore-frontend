import { FIRST_QUOTE_ID, stubQuotes } from '../support/quotes';

const nav = 'nav[aria-label="Main"]';

// The defaults of a new quote: 3 developers at 3,100.00, a manager at 3,000.00, 25% management, 25% negotiation buffer, in
// rupees. Two lines, 2 x 7.5 and 3 x 4 hours, are 27 hours of build and 6.75 of management (33.75 in all). At the default
// rate a developer hour costs 3,100.00: 83,700.00 + 20,250.00 = 103,950.00, and the buffer brings it to 1,29,937.50.
// With the developer rate changed to 3,200.00: 86,400.00 + 20,250.00 = 106,650.00, plus 26,662.50, is 1,33,312.50.
const AT_DEFAULT_RATE = '₹1,29,937.50';
const AT_NEW_RATE = '₹1,33,312.50';
// The second line's hours changed from 4 to 5: 30 hours of build and 7.5 of management. 96,000.00 + 22,500.00 =
// 1,18,500.00, plus 29,625.00, is 1,48,125.00.
const AFTER_EDIT = '₹1,48,125.00';

const finalQuote = () => cy.contains('dt', 'Final quote').next();

/** Types over what a field holds. Cypress advises against chaining `type` after `clear`, so each is its own command. */
function replaceText(selector: string, text: string) {
  cy.get(selector).clear();
  cy.get(selector).type(text);
}

/** On `/quotes`: a new quote with a title, two lines and the developer rate changed in the settings drawer. */
function fillNewQuote() {
  cy.contains('button', 'New quote').click();
  cy.location('pathname').should('eq', '/quotes/new');
  cy.contains('h1', 'New quote');

  cy.get('#quote-title').type('Website rebuild');
  // A new quote starts with one section, General, holding one blank line: fill that line.
  cy.get('#section-1-title').should('have.value', 'General');
  // Each line is a title and the figures in one row; the units start at 1: clear them first.
  cy.get('#line-1-title').type('Home page');
  replaceText('#line-1-units', '2');
  cy.get('#line-1-hoursPerUnit').type('7.5');
  // The description lives in a dialog, opened from the line's own button.
  cy.get('button[aria-label="Add description to line 1"]').click();
  cy.get('[role="dialog"]').within(() => {
    cy.get('#line-1-description').type('The hero, the services and the contact form');
    cy.contains('button', 'Done').click();
  });
  cy.get('[role="dialog"]').should('not.exist');
  cy.get('button[aria-label="Edit description of line 1"]').should('be.visible');
  // Add line, in the footer row under the section's lines, puts the new line in that section and moves to its title.
  // This one has no description.
  cy.get('button[aria-label="Add line to section 1"]').click();
  cy.focused().should('have.id', 'line-2-title');
  cy.get('#line-2-title').type('Checkout');
  replaceText('#line-2-units', '3');
  cy.get('#line-2-hoursPerUnit').type('4');

  // The totals follow the typing, at the default rates.
  cy.contains('dt', 'From the lines').next().should('have.text', '27 hours');
  cy.contains('dt', 'Total effort').next().should('have.text', '33.75 hours');
  finalQuote().should('have.text', AT_DEFAULT_RATE);

  cy.contains('button', 'Settings').click();
  cy.get('[role="dialog"]').within(() => {
    cy.get('#quote-developer-rate').should('have.value', '3100.00');
    replaceText('#quote-developer-rate', '3200.00');
    cy.contains('button', 'Done').click();
  });
  cy.get('[role="dialog"]').should('not.exist');
  finalQuote().should('have.text', AT_NEW_RATE);
}

describe('quotes', () => {
  // Signed in already: the stubbed refresh cookie is valid, as in the other specs.
  beforeEach(() => {
    stubQuotes();
    cy.viewport(1280, 800);
    cy.visit('/');
  });

  it('opens Quotes from the sidebar, in the Work group, with none yet', () => {
    cy.get(nav).contains('a', 'Quotes').click();
    cy.location('pathname').should('eq', '/quotes');
    cy.contains('h1', 'Quotes');
    cy.get(`${nav} a[aria-current="page"]`).should('have.length', 1).and('contain', 'Quotes');
    cy.contains('No quotes yet.').should('be.visible');
  });

  it('builds a quote from two lines and a changed rate, saves it to its own address and finds it on the list', () => {
    cy.get(nav).contains('a', 'Quotes').click();
    fillNewQuote();

    cy.contains('button', 'Save').click();
    cy.location('pathname').should('eq', `/quotes/${FIRST_QUOTE_ID}`);
    // The quote now comes from the service's answer: the title, the section, both lines, the changed rate and the figure.
    cy.contains('h1', 'Website rebuild');
    cy.get('#quote-title').should('have.value', 'Website rebuild');
    cy.get('#section-1-title').should('have.value', 'General');
    cy.get('#line-1-title').should('have.value', 'Home page');
    cy.get('button[aria-label="Edit description of line 1"]').click();
    cy.get('#line-1-description').should('have.value', 'The hero, the services and the contact form');
    cy.contains('[role="dialog"] button', 'Done').click();
    cy.get('button[aria-label="Add description to line 2"]').should('be.visible');
    cy.get('#line-2-title').should('have.value', 'Checkout');
    cy.get('#line-1-units').should('have.value', '2');
    cy.get('#line-2-hoursPerUnit').should('have.value', '4');
    finalQuote().should('have.text', AT_NEW_RATE);
    cy.contains('button', 'Settings').click();
    cy.get('#quote-developer-rate').should('have.value', '3200.00');
    cy.contains('button', 'Done').click();

    // The list shows the row with the service's own totals: two lines, 33.75 hours and the same figure.
    cy.contains('a', 'Back to quotes').click();
    cy.location('pathname').should('eq', '/quotes');
    cy.get('tbody tr').should('have.length', 1);
    cy.contains('tbody tr', 'Website rebuild').within(() => {
      cy.contains('td', '₹1,33,312.50').should('be.visible');
      cy.contains('td', '33.75').should('be.visible');
    });
  });

  it('edits a saved quote and saves the change to the same address', () => {
    cy.get(nav).contains('a', 'Quotes').click();
    fillNewQuote();
    cy.contains('button', 'Save').click();
    cy.location('pathname').should('eq', `/quotes/${FIRST_QUOTE_ID}`);
    cy.contains('h1', 'Website rebuild');

    replaceText('#line-2-hoursPerUnit', '5');
    finalQuote().should('have.text', AFTER_EDIT);
    cy.contains('button', 'Save').click();
    cy.contains('[role="status"]', 'Saved').should('be.visible');
    cy.location('pathname').should('eq', `/quotes/${FIRST_QUOTE_ID}`);

    cy.contains('a', 'Back to quotes').click();
    cy.get('tbody tr').should('have.length', 1);
    cy.contains('tbody tr', 'Website rebuild').within(() => {
      cy.contains('td', AFTER_EDIT).should('be.visible');
      cy.contains('td', '37.5').should('be.visible');
    });
  });
});
