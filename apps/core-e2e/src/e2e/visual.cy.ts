import { stubApi } from '../support/api';

const pages = [
  ['overview', '/'],
  ['projects', '/projects'],
  ['bills', '/finance/receipts-bills'],
  ['categories', '/categories'],
  ['technologies', '/technologies'],
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
