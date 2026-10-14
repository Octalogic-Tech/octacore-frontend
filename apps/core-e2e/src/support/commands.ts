// Custom commands go here.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Fills in the login page and submits it. */
      signIn(email: string, password: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('signIn', (email: string, password: string) => {
  cy.get('#login-email').type(email);
  cy.get('#login-password').type(password);
  cy.contains('button', 'Sign in').click();
});

export {};
