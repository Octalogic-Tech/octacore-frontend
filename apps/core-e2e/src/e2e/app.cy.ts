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
    for (const page of [
      'Clients',
      'Projects',
      'People',
      'Allocation',
      'Leave',
      'Invoices',
      'Categories',
      'Technologies',
      'Countries',
      'Overview',
    ]) {
      cy.get(nav).contains('a', page).click();
      cy.contains('h1', page);
    }
  });

  it('groups People, Allocation and Leave under Resources, and sends each to its own address', () => {
    // The group's name heads its links, between the Work and Finance groups.
    cy.get(nav).contains('Resources').should('be.visible');
    cy.get(nav).contains('a', 'People').click();
    cy.location('pathname').should('eq', '/resources/people');
    cy.get(nav).contains('a', 'Allocation').click();
    cy.location('pathname').should('eq', '/resources/allocation');
    cy.get(nav).contains('a', 'Allocation').should('have.attr', 'aria-current', 'page');
    cy.get(nav).contains('a', 'Leave').click();
    cy.location('pathname').should('eq', '/resources/leave');
    cy.get(nav).contains('a', 'Leave').should('have.attr', 'aria-current', 'page');
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

  it('lists the people under Resources with their technologies and monthly salary in rupees and paise', () => {
    cy.get(nav).contains('a', 'People').click();
    cy.location('pathname').should('eq', '/resources/people');
    cy.contains('h1', 'People');
    cy.contains('td', 'Asha Rao').should('be.visible');
    cy.contains('td', 'asha@example.com').should('be.visible');
    cy.contains('td', 'Nest, React').should('be.visible');
    cy.contains('td', '₹85,000.75').should('be.visible');
    cy.contains('td', 'Ben Cho').should('be.visible');
    cy.get(`${nav} a[aria-current="page"]`).should('have.length', 1).and('contain', 'People');
    // Search finds a person by a technology they know.
    cy.get('#person-search').type('nest');
    cy.contains('td', 'Asha Rao').should('be.visible');
    cy.contains('td', 'Ben Cho').should('not.exist');
  });

  it('opens a person from the list: where they are now, their pay and technologies, their ledger and their leave', () => {
    cy.get(nav).contains('a', 'People').click();
    cy.contains('a', 'Asha Rao').click();
    cy.location('pathname').should('eq', '/resources/people/1');
    cy.contains('h1', 'Asha Rao');
    // Placement comes from the latest entry on or before today.
    cy.contains('On Website since 12 Mar 2026').should('be.visible');
    cy.contains('dt', 'Monthly salary').next().should('have.text', '₹85,000.75');
    cy.contains('dt', 'Technologies').next().should('have.text', 'Nest, React');
    cy.contains('[role="tab"]', 'Allocations').should('contain', '3');
    cy.contains('[role="tab"]', 'Leave').should('contain', '2');

    // The ledger is newest first, with the bench named as such.
    cy.contains('[role="tab"]', 'Allocations').click();
    cy.location('search').should('eq', '?tab=allocations');
    cy.get('table[aria-label="Allocation ledger"] tbody tr').then((rows) => {
      expect([...rows].map((row) => row.querySelector('td')?.textContent)).to.deep.equal([
        '12 Mar 2026',
        '15 Jan 2026',
        '2 Jun 2025',
      ]);
    });
    cy.contains('td', 'Bench').should('be.visible');

    cy.contains('[role="tab"]', 'Leave').click();
    cy.location('search').should('eq', '?tab=leave');
    cy.contains('td', '12 Mar 2026 to 14 Mar 2026').should('be.visible');
    cy.contains('td', 'Family wedding').should('be.visible');
    cy.contains('td', '4 May 2026').should('be.visible');
    // Only this person's: the table has no Person column here.
    cy.contains('th', 'Person').should('not.exist');
    cy.get(`${nav} a[aria-current="page"]`).should('have.length', 1).and('contain', 'People');
  });

  it('shows a person who does not exist as not found, with a way back', () => {
    cy.visit('/resources/people/999');
    cy.contains('h1', 'Person not found').should('be.visible');
    cy.contains('a', 'Back to people').click();
    cy.location('pathname').should('eq', '/resources/people');
    cy.contains('h1', 'People');
  });

  it('puts everyone on the allocation board today: the bench first, then the active projects, each with its monthly cost', () => {
    cy.get(nav).contains('a', 'Allocation').click();
    cy.contains('h1', 'Allocation');
    cy.contains('[role="tab"]', 'Board').should('have.attr', 'aria-selected', 'true');
    cy.location('search').should('eq', '');
    // Bench first, then the projects by name; the head says how many and what they cost a month in rupees.
    cy.get('main [role="group"] h2').then((heads) => {
      expect([...heads].map((head) => head.textContent)).to.deep.equal(['Bench', 'Legacy portal', 'Mobile app', 'Website']);
    });
    cy.get('[aria-labelledby="col-bench-name"]').within(() => {
      cy.contains('1 person, ₹0.00 a month').should('be.visible');
      cy.contains('1 without a salary').should('be.visible');
      cy.contains('a', 'Ben Cho').should('be.visible');
    });
    // Four columns are wider than the page, so the board scrolls sideways: the last one is scrolled to first.
    cy.get('[aria-labelledby="col-1-name"]').scrollIntoView();
    cy.get('[aria-labelledby="col-1-name"]').within(() => {
      cy.contains('1 person, ₹85,000.75 a month').should('be.visible');
      cy.contains('a', 'Asha Rao').should('be.visible');
      cy.contains('since 12 Mar 2026').should('be.visible');
    });
    // Every card has the Move to select, the way to move without dragging, and a drag handle.
    cy.get('select[aria-label="Move Asha Rao to"]').should('be.visible');
    cy.get('button[aria-label="Drag Asha Rao"]').should('be.visible');
    cy.get('select[aria-label="Move Asha Rao to"] option').then((options) => {
      expect([...options].map((option) => option.textContent)).to.deep.equal([
        'Move to…',
        'Bench',
        'Legacy portal',
        'Mobile app',
        'Website',
      ]);
    });

    cy.contains('[role="tab"]', 'Ledger').click();
    cy.location('search').should('eq', '?tab=ledger');
    cy.get('table[aria-label="Allocation ledger"] tbody tr').should('have.length', 3);
    cy.get('#allocation-search').type('mobile');
    cy.get('table[aria-label="Allocation ledger"] tbody tr').should('have.length', 1);
    cy.contains('td', '2 Jun 2025').should('be.visible');
  });

  it('lists every leave in the register and finds one by its reason', () => {
    cy.get(nav).contains('a', 'Leave').click();
    cy.contains('h1', 'Leave');
    // Newest first, with the type, and a range or a single day.
    cy.get('table[aria-label="Leave"] tbody tr').then((rows) => {
      expect([...rows].map((row) => row.querySelector('td')?.textContent)).to.deep.equal([
        '4 May 2026',
        '12 Mar 2026 to 14 Mar 2026',
      ]);
    });
    cy.contains('td', 'Sick').should('be.visible');
    cy.contains('td', 'Casual').should('be.visible');
    cy.get('#leave-search').type('wedding');
    cy.get('table[aria-label="Leave"] tbody tr').should('have.length', 1);
    cy.contains('td', 'Asha Rao').should('be.visible');
  });

  it('sends the old /people address to the People page in Resources', () => {
    cy.visit('/people');
    cy.location('pathname').should('eq', '/resources/people');
    cy.contains('h1', 'People');
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
