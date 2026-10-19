import { stubApi } from '../support/api';

const nav = 'nav[aria-label="Main"]';

/** Scrolls the invoice dialog to the text and checks it is shown: the dialog is taller than the viewport. */
const seen = (text: string) => {
  cy.contains(text).scrollIntoView();
  cy.contains(text).should('be.visible');
};

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
    // The totals are in dollars: the invoice in rupees counts as its amount at its own rate, before tax.
    cy.contains('p', '$14,266.29 outstanding of $50,266.29 invoiced.').should('be.visible');
    cy.contains('dt', 'Discount').next().should('have.text', '10%');
    // The overview holds the facts and what is owed; the tables are one tab each, and the tab is in the address.
    cy.contains('td', 'INV-001').should('not.exist');
    cy.contains('[role="tab"]', 'Invoices').click();
    cy.location('search').should('eq', '?tab=invoices');
    cy.contains('td', 'INV-001').should('be.visible');
    cy.contains('Paid 12 Oct 2026').should('be.visible');
    cy.contains('Unpaid').should('be.visible');
    // Each invoice is in its own currency.
    cy.contains('td', '$36,000.00').should('be.visible');
    cy.contains('td', '₹2,36,000.00').should('be.visible');
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
      // Acme is in India: the invoice is billed in rupees with the country's 18% tax, and the rates are typed in rupees.
      cy.contains('Billed in INR · ₹88.25 per $1 · tax 18%').should('be.visible');
      cy.contains('Rate (INR)').should('be.visible');
      cy.get('input[aria-label="Line 1 rate"]').should('have.value', '13237.50');
      cy.get('#invoice-tax-rate').should('have.value', '18');
      // The project's 10% starts the invoice's discount; the tax is on what is left, and the dollars are before tax.
      cy.get('#invoice-discount').should('have.value', '10');
      seen('Subtotal ₹31,77,000.00');
      seen('Discount (10%) -₹3,17,700.00');
      seen('Tax (18%) ₹5,14,674.00');
      seen('Total ₹33,73,974.00');
      seen('About $32,400.00 in US dollars, before tax');
      cy.get('#invoice-discount').clear();
      cy.get('#invoice-discount').type('0');
      seen('Total ₹37,48,860.00');
      cy.get('#invoice-tax-rate').clear();
      cy.get('#invoice-tax-rate').type('0');
      seen('Total ₹31,77,000.00');
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

  it('names a project’s billing country and says what a new invoice would be billed in', () => {
    cy.get(nav).contains('a', 'Projects').click();
    cy.contains('a', 'Website').click();
    cy.contains('button', 'Edit project').click();
    cy.get('[role="dialog"]').within(() => {
      // None: the client's country decides, and the service says it is India's.
      cy.get('#project-country').should('have.value', '');
      cy.get('#project-country-hint').should(
        'have.text',
        'New invoices are billed in INR · ₹88.25 per $1 · tax 18%, from the client’s country.',
      );
      // The active countries with a rate, labelled with their currency; Japan has none yet.
      cy.get('#project-country option').then((options) => {
        expect([...options].map((option) => option.textContent)).to.deep.equal([
          'None',
          'Germany · EUR',
          'India · INR',
          'United States · USD',
        ]);
      });
      cy.get('#project-country').select('United States · USD');
      cy.get('#project-country-hint').should('have.text', 'Once saved, new invoices are billed in USD.');
      cy.contains('button', 'Cancel').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
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

  it('shows each country’s currency and rate, shows only the active ones when asked, and syncs the rates', () => {
    cy.get(nav).contains('a', 'Countries').click();
    cy.contains('h1', 'Countries');
    cy.contains('td', 'Afghanistan').should('be.visible');
    cy.get('#country-show').select('Active countries');
    cy.contains('td', 'Afghanistan').should('not.exist');
    cy.contains('td', 'India')
      .parent('tr')
      .within(() => {
        cy.contains('INR').should('be.visible');
        cy.contains('88.25').should('be.visible');
        cy.contains('18%').should('be.visible');
        cy.contains('Active').should('be.visible');
      });
    cy.contains('button', 'Sync rates').click();
    cy.contains('[role="status"]', 'Updated 3 rates as of 2026-10-19.').should('be.visible');
    cy.contains('[role="status"]', 'No rate found for JPY.').should('be.visible');
  });

  it('lists the unpaid invoices, and the paid ones when asked', () => {
    cy.get(nav).contains('a', 'Invoices').click();
    cy.contains('h1', 'Invoices');
    cy.get('#invoices-status').should('have.value', 'active');
    cy.contains('td', 'INV-002').should('be.visible');
    // Each invoice is listed at what its client pays, in its own currency.
    cy.contains('td', 'INV-002').parent('tr').contains('$12,000.00').should('be.visible');
    cy.contains('td', 'INV-003').parent('tr').contains('₹2,36,000.00').should('be.visible');
    cy.contains('td', 'INV-001').should('not.exist');
    cy.get('#invoices-status').select('Paid');
    cy.contains('td', 'INV-001').should('be.visible');
    cy.contains('td', 'INV-002').should('not.exist');
  });

  it('exports the filtered invoices as a CSV file', () => {
    cy.get(nav).contains('a', 'Invoices').click();
    cy.contains('button', 'Export CSV').click();
    cy.readFile(`${Cypress.config('downloadsFolder')}/invoices.csv`)
      .should('contain', 'Number,Client,Project,Issued,Due,Paid,Amount,Tax,Total,Currency,Status')
      .and('contain', 'INV-002,Acme,Website,2026-11-01,,,12000.00,0.00,12000.00,USD,Unpaid')
      // The amount before tax, the tax and the total stay in the invoice's own currency, with its code beside them.
      .and('contain', 'INV-003,Acme,Website,2026-11-02,,,200000.00,36000.00,236000.00,INR,Unpaid')
      .and('not.contain', 'INV-001');
  });
});
