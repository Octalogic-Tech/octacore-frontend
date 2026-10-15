import { stubApi } from '../support/api';

const pages = [
  ['overview', '/'],
  ['clients', '/clients'],
  ['projects', '/projects'],
  ['project', '/projects/1'],
  ['bills', '/finance/receipts-bills'],
  ['categories', '/categories'],
  ['technologies', '/technologies'],
  ['countries', '/countries'],
  ['users', '/users'],
] as const;

const viewports = [
  [1440, 900],
  [390, 844],
] as const;

describe('visual captures', () => {
  beforeEach(() => {
    stubApi();
  });

  for (const [width, height] of viewports) {
    for (const [name, path] of pages) {
      it(`${name} at ${width}px`, () => {
        cy.viewport(width, height);
        cy.visit(path);
        cy.get('main h1').should('be.visible');
        cy.get('[role="status"]').should('not.exist');
        cy.screenshot(`${name}-${width}`, { capture: 'fullPage' });
      });
    }
  }
});

describe('visual captures: signed out', () => {
  beforeEach(() => {
    stubApi({ signedIn: false });
  });

  for (const [width, height] of viewports) {
    it(`login at ${width}px`, () => {
      cy.viewport(width, height);
      cy.visit('/login');
      cy.get('main h1').should('have.text', 'Sign in');
      cy.screenshot(`login-${width}`, { capture: 'fullPage' });
    });
  }
});

describe('visual captures: overlays', () => {
  beforeEach(() => {
    stubApi();
  });

  it('the mobile menu at 390px', () => {
    cy.viewport(390, 844);
    cy.visit('/');
    cy.get('button[aria-label="Open menu"]').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.screenshot('menu-390', { capture: 'viewport' });
  });

  it('the add bill dialog at 1440px', () => {
    cy.viewport(1440, 900);
    cy.visit('/finance/receipts-bills');
    cy.contains('button', 'Add bill').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.screenshot('add-bill-1440', { capture: 'viewport' });
  });

  it('the add bill dialog with its errors showing at 1440px', () => {
    cy.viewport(1440, 900);
    cy.visit('/finance/receipts-bills');
    cy.contains('button', 'Add bill').click();
    cy.get('[role="dialog"]').contains('button', 'Save').click();
    cy.get('[role="dialog"]').contains('Date is required').should('be.visible');
    cy.screenshot('add-bill-errors-1440', { capture: 'viewport' });
  });

  it('the delete confirmation at 1440px', () => {
    cy.viewport(1440, 900);
    cy.visit('/categories');
    cy.get('button[aria-label="Delete Web"]').click();
    cy.get('[role="alertdialog"]').should('be.visible');
    cy.screenshot('confirm-delete-1440', { capture: 'viewport' });
  });
});
