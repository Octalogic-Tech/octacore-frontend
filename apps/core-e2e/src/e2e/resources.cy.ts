// The Resources module in a real browser against a REAL core service, not the stubs the other specs use: a drag, a
// ledger and a leave register are only worth checking if the service answers them. It is skipped unless the three
// Cypress env values below are given, and it WRITES (people, a technology, two projects, allocation entries and leaves,
// all deleted again at the end; deletes are soft, so the rows stay in the tables), so it must only ever point at a
// scratch database, one with no other people on it: the board's cost per column is checked to the paisa.
//   (in octacore-backend)  DB_NAME=<scratch> CORS_ORIGINS=http://localhost:3013 SMTP_HOST= SMTP_FROM= SMTP_USERNAME= SMTP_PASSWORD= \
//                          .venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 5013
//   (in this repo)         VITE_CORE_API_URL=http://127.0.0.1:5013/api/v1 pnpm exec nx serve core --port=3013
//                          env -u ELECTRON_RUN_AS_NODE pnpm exec cypress run --project apps/core-e2e --config-file cypress.config.ts \
//                            --config baseUrl=http://localhost:3013 --spec apps/core-e2e/src/e2e/resources.cy.ts \
//                            --env CORE_API_WRITE_URL=http://127.0.0.1:5013/api/v1,CORE_API_TEST_EMAIL=<email>,CORE_API_TEST_PASSWORD=<password>
// The page is opened once and then moved around with the sidebar: a reload would lose the access token, which lives in
// memory, and the refresh cookie does not cross from localhost to 127.0.0.1.
const api = Cypress.env('CORE_API_WRITE_URL') as string | undefined;
const email = Cypress.env('CORE_API_TEST_EMAIL') as string | undefined;
const password = Cypress.env('CORE_API_TEST_PASSWORD') as string | undefined;

const nav = 'nav[aria-label="Main"]';

/** Everything the spec adds is named with this, so a run that stopped half way can be cleaned up by the next. */
const PREFIX = 'E2E Resources';
const TECH = `${PREFIX} React`;
const APOLLO = `${PREFIX} Apollo`;
const BOREALIS = `${PREFIX} Borealis`;

const pad = (value: number) => String(value).padStart(2, '0');
/** The browser's local day as `YYYY-MM-DD`, which is the day the board dates a move with. */
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
/** A day as the pages write it: `12 Mar 2026`. */
const shown = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
};

const column = (key: string) => `[aria-labelledby="${key}-name"]`;
const ledgerRows = 'table[aria-label="Allocation ledger"] tbody tr';

/** The first cells of each row of the table, as text: the day, the person, the project and the note. */
const cellsOf = (rows: JQuery<HTMLElement>, count = 4) =>
  [...rows].map((row) => Array.from(row.querySelectorAll('td')).slice(0, count).map((cell) => cell.textContent?.trim()));

interface Named {
  id: number;
  name: string;
}

(api && email && password ? describe : describe.skip)('resources, against a real core service', () => {
  let token = '';
  let technologyId = 0;
  let apolloId = 0;
  let borealisId = 0;

  // The token is read when the request is sent, not when it is queued: it is only known once the sign-in has answered.
  const call = (method: 'GET' | 'POST' | 'DELETE', path: string, body?: Cypress.RequestBody) =>
    cy.then(() => cy.request({ method, url: `${api}${path}`, headers: { authorization: `Bearer ${token}` }, body }));

  /** Soft-deletes what an earlier or this run added, whose names start with the prefix. */
  const removeAll = (collection: 'people' | 'projects' | 'technologies') =>
    call('GET', `/${collection}`).then((response) => {
      for (const row of response.body.data as Named[]) {
        if (row.name.startsWith(PREFIX)) call('DELETE', `/${collection}/${row.id}`);
      }
    });

  /** A person through the API, with their salary in paise and optionally a technology; answers the new row. */
  const addPerson = (name: string, monthlySalaryPaise: number | null, technologyIds: number[] = []) =>
    call('POST', '/people', { name, monthlySalaryPaise, technologyIds }).then((response) => response.body.data as Named);

  const signIn = () => {
    cy.viewport(1440, 900);
    cy.visit('/');
    cy.signIn(email as string, password as string);
    cy.contains('h1', 'Overview');
  };

  /** A screenshot of the page once its web font has loaded: before that it is drawn in the fallback face. */
  const shoot = (name: string) => {
    cy.document().then((document) => document.fonts.ready);
    cy.screenshot(name, { capture: 'fullPage' });
  };

  const openPerson = (name: string) => {
    cy.get(nav).contains('a', 'People').click();
    cy.contains('h1', 'People');
    cy.contains('a', name).click();
    cy.contains('h1', name);
  };

  /**
   * A real pointer drag, the way dnd-kit's MouseSensor reads one: a mouse down on the card itself (the whole card is what
   * is dragged), mouse moves and a mouse up over the target column. The events are the browser's own mouse events at real
   * screen coordinates, so the sensor, the collision detection and the drop handler all run as they do for a person. The
   * sensor starts a drag only once the pointer has moved 6px, so the first move is a long one (a tenth of the way to the
   * column). dnd-kit works out where the card is over after a render, so each step waits for the board's own announcement
   * (the live region a screen reader hears) instead of a fixed pause.
   */
  const dragCardTo = (person: string, targetName: string, target: string) => {
    const card = `li[aria-label="${person}"]`;
    const live = '[id^="DndLiveRegion"]';
    // dnd-kit tells a mouse event by `instanceof MouseEvent`, and `trigger` makes a plain Event unless it is told otherwise.
    const mouse = { eventConstructor: 'MouseEvent', force: true } as const;
    cy.get(card).then(($card) => {
      cy.get(target).then(($target) => {
        const from = $card[0].getBoundingClientRect();
        const to = $target[0].getBoundingClientRect();
        // Where the card is empty: its left padding, not the name or the menu button.
        const start = { clientX: Math.round(from.x + 6), clientY: Math.round(from.y + from.height / 2) };
        const end = { clientX: Math.round(to.x + to.width / 2), clientY: Math.round(to.y + to.height / 2) };
        const along = (step: number) => ({
          ...mouse,
          buttons: 1,
          clientX: Math.round(start.clientX + (end.clientX - start.clientX) * step),
          clientY: Math.round(start.clientY + (end.clientY - start.clientY) * step),
        });
        cy.get(card).trigger('mousedown', { ...mouse, button: 0, buttons: 1, ...start });
        // Pressing is not dragging: nothing is picked up until the pointer moves.
        cy.get(card).should('not.have.attr', 'data-dragging');
        cy.get('body').trigger('mousemove', along(0.1));
        cy.get(card).should('have.attr', 'data-dragging');
        cy.get('body').trigger('mousemove', along(0.5));
        cy.get('body').trigger('mousemove', along(1));
        cy.get(live).should('contain.text', `${person} is over ${targetName}.`);
        cy.get('body').trigger('mouseup', { ...mouse, button: 0, buttons: 0, ...end });
        cy.get(live).should('contain.text', `${person} was dropped on ${targetName}.`);
      });
    });
  };

  before(() => {
    cy.request('POST', `${api}/auth/login`, { email, password }).then((response) => {
      token = response.body.data.accessToken;
    });
    removeAll('people');
    removeAll('projects');
    removeAll('technologies');
    // The board's cost per column is exact, so nobody else may be on it.
    call('GET', '/people').then((response) => {
      expect(response.body.data, 'people on the scratch database besides this spec’s own').to.have.length(0);
    });
    call('POST', '/technologies', { name: TECH, description: null, categoryId: null }).then((response) => {
      technologyId = response.body.data.id;
    });
    call('POST', '/projects', { name: APOLLO, projectType: 'product', billingType: 'retainer' }).then((response) => {
      apolloId = response.body.data.id;
    });
    call('POST', '/projects', { name: BOREALIS, projectType: 'product', billingType: 'retainer' }).then((response) => {
      borealisId = response.body.data.id;
    });
  });

  // Each test starts from nobody on the board, whatever an earlier one left.
  beforeEach(() => {
    removeAll('people');
  });

  after(() => {
    removeAll('people');
    removeAll('projects');
    removeAll('technologies');
  });

  it('adds a person with a salary in rupees and a technology, finds them by the technology, opens them, and deletes them', () => {
    const grace = `${PREFIX} Grace`;
    const other = `${PREFIX} Other`;
    addPerson(other, null);
    signIn();

    cy.get(nav).contains('a', 'People').click();
    cy.location('pathname').should('eq', '/resources/people');
    cy.contains('button', 'Add person').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#person-name').type(grace);
      cy.get('#person-email').type('grace.e2e@example.com');
      cy.get('#person-monthly-salary').type('85000');
      cy.contains('label', TECH).find('input[type=checkbox]').check({ force: true });
      cy.contains('button', 'Save').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('tr', grace).within(() => {
      cy.contains('td', '₹85,000.00').should('be.visible');
      cy.contains('td', TECH).should('be.visible');
    });

    // The search finds a person by a technology they know, and hides the one who does not.
    cy.contains('td', other).should('be.visible');
    cy.get('#person-search').type(TECH.toLowerCase());
    cy.contains('td', grace).should('be.visible');
    cy.contains('td', other).should('not.exist');

    // The name opens the person's page, with nobody allocating them yet.
    cy.contains('a', grace).click();
    cy.location('pathname').should('match', /^\/resources\/people\/\d+$/);
    cy.contains('h1', grace);
    cy.contains('Not allocated yet').should('be.visible');
    cy.contains('dt', 'Monthly salary').next().should('have.text', '₹85,000.00');
    cy.contains('dt', 'Technologies').next().should('have.text', TECH);
    cy.contains('dt', 'Email').next().should('have.text', 'grace.e2e@example.com');

    // Delete them from their page: back on the list without them.
    cy.contains('button', 'Delete person').click();
    cy.get('[role="alertdialog"]').contains('button', 'Delete person').click();
    cy.location('pathname').should('eq', '/resources/people');
    cy.contains('td', grace).should('not.exist');
    cy.contains('td', other).should('be.visible');
  });

  it('allocates a person to a project, shows them on the board with its cost, moves them to the bench by dragging, and keeps the history in the ledger', () => {
    const ada = `${PREFIX} Ada`;
    const ben = `${PREFIX} Ben`;
    const cara = `${PREFIX} Cara`;
    const day = today();

    // Ben and Cara are already on Borealis (Cara has no salary on file); Ada has joined and is not placed yet.
    addPerson(ada, 8_500_000, [technologyId]);
    addPerson(ben, 6_000_050).then((person) =>
      call('POST', '/allocations', { personId: person.id, projectId: borealisId, effectiveDate: '2026-02-01' }),
    );
    addPerson(cara, null).then((person) =>
      call('POST', '/allocations', { personId: person.id, projectId: borealisId, effectiveDate: '2026-02-01' }),
    );
    cy.intercept('POST', '**/allocations/move').as('move');
    signIn();

    // Allocate from the person's page, backdated to 12 March.
    openPerson(ada);
    cy.contains('Not allocated yet').should('be.visible');
    cy.contains('button', 'Allocate').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#allocation-person').should('not.exist');
      cy.get('#allocation-project').select(APOLLO);
      cy.get('#allocation-date').clear();
      cy.get('#allocation-date').type('2026-03-12');
      cy.get('#allocation-note').type('Joins the platform team');
      cy.contains('button', 'Save').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains(`On ${APOLLO} since 12 Mar 2026`).should('be.visible');
    shoot('resources-person');

    // The board: the bench first, then the active projects by name, each head with its count and monthly cost.
    cy.get(nav).contains('a', 'Allocation').click();
    cy.contains('h1', 'Allocation');
    cy.get('main [role="group"] h2').then((heads) => {
      expect([...heads].map((head) => head.textContent)).to.deep.equal(['Bench', APOLLO, BOREALIS]);
    });
    cy.get(column('col-bench')).within(() => {
      cy.contains('0 people, ₹0.00 a month').should('be.visible');
      cy.contains('Nobody is on the bench.').should('be.visible');
    });
    cy.get(column(`col-${apolloId}`)).within(() => {
      cy.contains('1 person, ₹85,000.00 a month').should('be.visible');
      cy.contains('a', ada).should('be.visible');
      cy.contains('₹85,000.00').should('be.visible');
      // A card carries no date: the ledger and the person's page have those.
      cy.contains('since').should('not.exist');
    });
    cy.get(column(`col-${borealisId}`)).within(() => {
      cy.contains('2 people, ₹60,000.50 a month').should('be.visible');
      cy.contains('1 without a salary').should('be.visible');
    });
    shoot('resources-board-allocated');

    // Drag Ada's card to the Bench: a real pointer drag from the card itself.
    dragCardTo(ada, 'Bench', column('col-bench'));
    cy.wait('@move').then(({ request, response }) => {
      expect(response?.statusCode).to.eq(200);
      expect(request.body).to.include({ projectId: null, effectiveDate: day });
      expect(request.body.personId).to.be.a('number');
    });
    cy.get(column('col-bench')).within(() => {
      cy.contains('1 person, ₹85,000.00 a month').should('be.visible');
      cy.contains('a', ada).should('be.visible');
    });
    cy.get(column(`col-${apolloId}`)).within(() => {
      cy.contains('0 people, ₹0.00 a month').should('be.visible');
      cy.contains('Nobody is on this project.').should('be.visible');
    });
    // The card in flight glides into place for a moment after the drop; the screenshot waits for it to land.
    cy.get('.cursor-grabbing').should('not.exist');
    shoot('resources-board-benched');

    // The ledger has both entries, newest first: the move of today, then 12 March.
    cy.contains('[role="tab"]', 'Ledger').click();
    cy.location('search').should('eq', '?tab=ledger');
    cy.get('#allocation-search').type(ada);
    cy.get(ledgerRows).should('have.length', 2);
    cy.get(ledgerRows).then((rows) => {
      expect(cellsOf(rows)).to.deep.equal([
        [shown(day), ada, 'Bench', '—'],
        ['12 Mar 2026', ada, APOLLO, 'Joins the platform team'],
      ]);
    });

    // Adding an entry on a day that has one is refused in the service's words, on the date.
    cy.contains('button', 'Add entry').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#allocation-person').select(ada);
      cy.get('#allocation-date').clear();
      cy.get('#allocation-date').type('2026-03-12');
      cy.contains('button', 'Save').click();
      cy.contains('This person already has an entry on that date; edit it instead').should('be.visible');
      // A backfilled entry on an earlier day: Ada was on the bench before the project.
      cy.get('#allocation-date').clear();
      cy.get('#allocation-date').type('2026-01-05');
      cy.get('#allocation-note').type('Joined, not placed yet');
      cy.contains('button', 'Save').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.get(ledgerRows).should('have.length', 3);
    cy.get(ledgerRows).then((rows) => {
      expect(cellsOf(rows)).to.deep.equal([
        [shown(day), ada, 'Bench', '—'],
        ['12 Mar 2026', ada, APOLLO, 'Joins the platform team'],
        ['5 Jan 2026', ada, 'Bench', 'Joined, not placed yet'],
      ]);
    });

    shoot('resources-ledger');

    // The history is filled in, and where Ada is today did not change: still on the bench.
    cy.contains('[role="tab"]', 'Board').click();
    cy.get(column('col-bench')).within(() => {
      cy.contains('a', ada).should('be.visible');
    });

    // The card's menu does what the drag does. Two moves on one day leave one entry, so the ledger stays at three. A press
    // on the menu button is a click and not the start of a drag, and the menu offers every column but the one she is in.
    cy.get(`button[aria-label="Actions for ${ada}"]`).click();
    cy.get('[role="menu"]').within(() => {
      cy.contains('Move to').should('be.visible');
      cy.get('[role="menuitem"]').then((items) => {
        expect([...items].map((item) => item.textContent)).to.deep.equal([APOLLO, BOREALIS]);
      });
      cy.contains('[role="menuitem"]', APOLLO).click();
    });
    cy.wait('@move').its('response.statusCode').should('eq', 200);
    cy.get(column(`col-${apolloId}`)).within(() => {
      cy.contains('1 person, ₹85,000.00 a month').should('be.visible');
      cy.contains('a', ada).should('be.visible');
    });
    cy.contains('[role="tab"]', 'Ledger').click();
    cy.get('#allocation-search').clear();
    cy.get('#allocation-search').type(ada);
    cy.get(ledgerRows).should('have.length', 3);
    cy.get(ledgerRows).first().should('contain', shown(day)).and('contain', APOLLO);

    // The person's own page tells the same story: on the project since today, three entries.
    openPerson(ada);
    cy.contains(`On ${APOLLO} since ${shown(day)}`).should('be.visible');
    cy.contains('[role="tab"]', 'Allocations').should('contain', '3').click();
    cy.get(ledgerRows).should('have.length', 3);
  });

  it('adds a leave on the person’s page, lists it in the register, refuses an overlap, and deletes it', () => {
    const lee = `${PREFIX} Lee`;
    addPerson(lee, 4_000_000);
    signIn();

    openPerson(lee);
    cy.contains('[role="tab"]', 'Leave').click();
    cy.location('search').should('eq', '?tab=leave');
    cy.contains('No leave recorded for this person yet.').should('be.visible');
    cy.contains('button', 'Add leave').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#leave-person').should('not.exist');
      cy.get('#leave-type').select('Sick');
      cy.get('#leave-start').type('2026-05-04');
      cy.get('#leave-end').type('2026-05-06');
      cy.get('#leave-reason').type('Fever');
      cy.contains('button', 'Save').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('table[aria-label="Leave"] tbody tr').should('have.length', 1);
    cy.get('table[aria-label="Leave"] tbody tr').then((rows) => {
      expect(cellsOf(rows, 3)).to.deep.equal([['4 May 2026 to 6 May 2026', 'Sick', 'Fever']]);
    });
    cy.contains('[role="tab"]', 'Leave').should('contain', '1');

    // A leave that overlaps this one is refused, naming the days it clashes with.
    cy.contains('button', 'Add leave').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('#leave-type').select('Casual');
      cy.get('#leave-start').type('2026-05-06');
      cy.get('#leave-end').type('2026-05-08');
      cy.contains('button', 'Save').click();
      cy.contains('This person already has leave from 2026-05-04 to 2026-05-06').should('be.visible');
      // The last day before the first is caught by the form before anything is sent.
      cy.get('#leave-end').clear();
      cy.get('#leave-end').type('2026-05-01');
      cy.contains('button', 'Save').click();
      cy.contains('The last day must not be before the first').should('be.visible');
      cy.contains('button', 'Cancel').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('table[aria-label="Leave"] tbody tr').should('have.length', 1);

    // The register lists it, with the person's name.
    cy.get(nav).contains('a', 'Leave').click();
    cy.contains('h1', 'Leave');
    cy.get('table[aria-label="Leave"] tbody tr').then((rows) => {
      expect(cellsOf(rows)).to.deep.equal([['4 May 2026 to 6 May 2026', lee, 'Sick', 'Fever']]);
    });
    shoot('resources-leave');

    // Delete it from the person's page, after confirming; the register is empty again.
    openPerson(lee);
    cy.contains('[role="tab"]', 'Leave').click();
    cy.get(`button[aria-label="Delete ${lee} from 4 May 2026"]`).click();
    cy.get('[role="alertdialog"]').contains('button', 'Delete leave').click();
    cy.contains('No leave recorded for this person yet.').should('be.visible');
    cy.get(nav).contains('a', 'Leave').click();
    cy.contains('No leave recorded yet.').should('be.visible');
  });
});
