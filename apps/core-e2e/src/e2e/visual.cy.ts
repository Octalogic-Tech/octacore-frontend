import { stubApi } from '../support/api';

const pages = [
  ['overview', '/'],
  ['clients', '/clients'],
  ['projects', '/projects'],
  ['project', '/projects/1'],
  ['project-invoices', '/projects/1?tab=invoices'],
  ['project-resources', '/projects/1?tab=resources'],
  ['people', '/resources/people'],
  ['person', '/resources/people/1'],
  ['person-allocations', '/resources/people/1?tab=allocations'],
  ['person-leave', '/resources/people/1?tab=leave'],
  ['allocation-board', '/resources/allocation'],
  ['allocation-ledger', '/resources/allocation?tab=ledger'],
  ['leave', '/resources/leave'],
  ['invoices', '/finance/invoices'],
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
        // The loading state, not every live region: the board's drag-and-drop announcer is one too, and is always there.
        cy.get('[role="status"][aria-label="Loading"]').should('not.exist');
        cy.screenshot(`${name}-${width}`, { capture: 'fullPage' });
      });
    }
  }
});

// A person with two cards on the board, at each width: made through the card's menu, as a person does.
describe('visual captures: a person with two cards', () => {
  beforeEach(() => {
    stubApi();
  });

  for (const [width, height] of viewports) {
    it(`allocation board with a duplicated card at ${width}px`, () => {
      cy.viewport(width, height);
      cy.visit('/resources/allocation');
      cy.get('main h1').should('be.visible');
      // The Website column is past the edge of the board on a phone: scroll to it first.
      cy.get('[aria-labelledby="col-1-name"]').scrollIntoView();
      cy.get('button[aria-label="Actions for Asha Rao"]').click();
      cy.contains('[role="menu"] [role="menuitem"]', 'Duplicate').click();
      cy.get('li[aria-label="Asha Rao, card 2 of 2"]').should('exist');
      cy.get('li[aria-label="Asha Rao, card 1 of 2"]').scrollIntoView();
      cy.get('[role="status"][aria-label="Loading"]').should('not.exist');
      cy.screenshot(`allocation-board-two-cards-${width}`, { capture: 'fullPage' });
    });
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

  it('the delete confirmation at 1440px', () => {
    cy.viewport(1440, 900);
    cy.visit('/categories');
    cy.get('button[aria-label="Delete Web"]').click();
    cy.get('[role="alertdialog"]').should('be.visible');
    cy.screenshot('confirm-delete-1440', { capture: 'viewport' });
  });
});
