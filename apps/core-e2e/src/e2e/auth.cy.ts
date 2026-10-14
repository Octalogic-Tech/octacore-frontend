import { E2E_PASSWORD, stubApi } from '../support/api';

const nav = 'nav[aria-label="Main"]';

describe('sign-in', () => {
  beforeEach(() => {
    stubApi({ signedIn: false });
    cy.viewport(1280, 800);
  });

  it('sends a signed-out visitor to the login page, then back to the page they asked for', () => {
    cy.visit('/users');
    cy.location('pathname').should('eq', '/login');
    cy.get(nav).should('not.exist');
    cy.signIn('ada@example.com', E2E_PASSWORD);
    cy.location('pathname').should('eq', '/users');
    cy.contains('h1', 'Users');
  });

  it('refuses a wrong password and stays on the login page', () => {
    cy.visit('/');
    cy.signIn('ada@example.com', 'not the password');
    cy.get('[role="alert"]').should('contain', 'Invalid email or password');
    cy.location('pathname').should('eq', '/login');
  });

  it('adds a user and signs out', () => {
    cy.visit('/');
    cy.signIn('ada@example.com', E2E_PASSWORD);
    cy.get(nav).contains('a', 'Users').click();
    cy.contains('td', 'Ada Admin').should('be.visible');

    cy.contains('button', 'Add user').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#user-name').type('Linus Torvalds');
      cy.get('#user-email').type('linus@example.com');
      cy.get('#user-password').type('a long enough password');
      cy.contains('button', 'Save').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('td', 'linus@example.com').should('be.visible');

    cy.contains('button', 'Sign out').click();
    cy.location('pathname').should('eq', '/login');
    cy.visit('/categories');
    cy.location('pathname').should('eq', '/login');
  });
});
