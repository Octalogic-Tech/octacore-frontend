# Quotations (frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Quotes page and editor in `apps/core`: build a quotation from line items (description, units, hours per unit), see live totals for time and cost ending in a final quote, and set the rates, headcounts, percentages, day and month lengths and currency in a settings drawer.

**Architecture:** `features/quotes/` replaces the planned-feature skeleton. A pure `calc.ts` mirrors the backend's integer calculation (hours in hundredths, percents in hundredths of a percent, `BigInt` products, half-up division) so the totals update as you type and equal what the service stores. The editor is one `react-hook-form` form (settings included, so closing the drawer keeps values) saved with one POST or PATCH. A new right-edge `Drawer` primitive sits in `components/ui`.

**Tech Stack:** React 19, react-hook-form + zod 4, TanStack Query, axios `coreApi`, Radix Dialog, Tailwind 4 (brand tokens only), vitest + Testing Library, Cypress (stubbed).

**Spec:** `../octacore-backend-quotations/docs/superpowers/specs/2026-10-20-quotations-design.md` (sections 2, 3 and 6). Backend contract and test vectors: `../octacore-backend-quotations/docs/superpowers/plans/2026-10-20-quotations.md` (Task 1 holds the two calculation vectors, copy them exactly).

## Global Constraints

- Follow `apps/core/DESIGN.md` and `src/design-contract.test.ts`: brand palette tokens only, no rounded corners, no shadows, no red, Lucide via `react-icons/lu` for row actions only. Errors are navy with an arm (`Field`), never red.
- Money is whole minor units in `...Cents`; rates are typed as `7.20` text and parsed with `@/lib/money` (`amountProblem`, `parseAmount`); amounts display with `formatMoney(minor, { currencyCode, currencySymbol: currencyCode })` from `@/features/expenses/money` (always two decimals).
- Form fields are text (`inputMode`), never `type=number`, so a comma or sign gets a message instead of being dropped.
- Limits (same as the service): units whole, 1 to 100,000; hours per unit `^\d+(\.\d{1,2})?$`, more than 0, at most 10,000; percents `^\d+(\.\d{1,2})?$`, 0 to 100; counts whole 1 to 1,000; rates 0 up to `MAX_RATE_CENTS` = 10,000,000 cents (100,000.00); hours per day 1 to 24; hours per month 1 to 744; lines 1 to 200; currency three letters (stored in capitals); title required. A quote whose final quote exceeds `MAX_CENTS` (100,000,000.00) is refused by the form.
- Defaults for a new quote (text): currency `INR`; developers `3` at `3100.00`; manager `1` at `3000.00`; tester `1` at `0.00`; buffer `25`, management `25`, testing `0`, bug fixing `0`; `6` hours a day; `160` hours a month; one blank line.
- Routes: `/quotes`, `/quotes/new`, `/quotes/:id`, nav item `Quotes` in the `Work` group after `Projects`.
- API (all under `coreApi`, envelope unwrapped with `unwrap`): `GET /quotations`, `GET /quotations/{id}`, `POST /quotations`, `PATCH /quotations/{id}`, `DELETE /quotations/{id}`. Create and update bodies are flat: `title`, `currencyCode`, `developerCount`, `developerRateCents`, `managerCount`, `managerRateCents`, `testerCount`, `testerRateCents`, `negotiationBufferPercent`, `managementPercent`, `testingPercent`, `bugFixPercent`, `hoursPerDay`, `hoursPerMonth`, `lines: [{description, units, hoursPerUnit}]`. The read adds `id`, `updatedDate`, `lines[].id` and `totals` (`baseHours`, `testingHours`, `bugFixHours`, `developmentHours`, `buildHours`, `managementHours`, `totalHours`, `developmentHoursPerPerson`, `managementHoursPerPerson`, `testingHoursPerPerson`, `personDays`, `elapsedMonths` as decimal-hour numbers; `developmentCostCents`, `managementCostCents`, `testingCostCents`, `subtotalCents`, `negotiationBufferCents`, `finalQuoteCents` as integers).
- Work in this worktree only. Node 24: `export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"`. Run tests from the repo root with `pnpm exec nx test core --skip-nx-cache --testFiles=<path> --reporter=verbose`. The frontend main checkout is shared with other sessions: do not touch it.
- Edit only files this plan names. The repo uses pnpm. Commit only your files.

## Review Focus

1. A setting that is blank or invalid while typing (rate `3,100`, percent `abc`): the totals panel shows a "Check the settings" note, never `NaN`, and the Settings button says so.
2. A line with blank or invalid units or hours counts as zero in the live totals; Save is refused with the field's message, and Save with an error inside the closed drawer opens the drawer.
3. Hours typed as `.5`, `1,5` or `1e3`: each gets a message (not silently changed); `0.5` and `16` are accepted.
4. A quote above 100,000,000.00 (200 lines of 100,000 units at 10,000 hours): the form refuses with a message and the mirror does not overflow or throw.
5. A failed save (network), a 404 on an edit of a deleted quote, and a 422 from the service each show a message and keep every typed value.

---

### Task 1: The calculation mirror

**Files:**
- Create: `apps/core/src/features/quotes/calc.ts`
- Test: `apps/core/src/features/quotes/calc.test.ts`

**Interfaces:**
- Produces:
  - `interface CalcSettings { developerCount; developerRateCents; managerCount; managerRateCents; testerCount; testerRateCents; negotiationBufferBp; managementBp; testingBp; bugFixBp; hoursPerDay; hoursPerMonth }` (all `number`; `...Bp` is hundredths of a percent: 25 % is `2500`).
  - `interface CalcLine { units: number; hoursHundredths: number }`.
  - `interface QuoteTotals` with the same names as the service's `totals` but every hours field, `personDays` and `elapsedMonths` as **integer hundredths** (`baseHours: 118800` is 1,188 hours); costs in cents.
  - `quoteTotals(settings: CalcSettings, lines: readonly CalcLine[]): QuoteTotals`.
  - `hundredthsOf(text: string): number` (text already known to have at most two decimals: `"7.5"` is `750`).
  - `formatHours(hundredths: number): string`: grouped, up to two decimals, trailing zeros dropped (`118800` is `1,188`, `3634` is `36.34`, `250` is `2.5`).

- [ ] **Step 1: Write the failing tests** in `calc.test.ts`: the same two vectors as the backend plan's Task 1, as tests named `the workbook lines give the workbook cost block` and `every step rounds half up`, asserting every field (hours as hundredths: vector one `base 118800`, `management 29700`, `total 148500`, per person `39600 / 29700 / 0`, `personDays 24750`, `elapsedMonths 248`, `final 571_725_000`; vector two `base 2809`, `testing 281`, `bugFix 140`, `development 2949`, `build 3230`, `management 404`, `total 3634`, per person `1475 / 404 / 141`, `personDays 519`, `elapsedMonths 11`, costs `3_640_717 / 808_000 / 280_997`, `subtotal 4_729_714`, `buffer 354_729`, `final 5_084_443`). Add `a huge quote does not overflow` (200 lines of `{units: 100000, hoursHundredths: 1_000_000}` at the maximum rates returns finite numbers, no throw) and `formatHours` cases above plus `0` and `1`.
- [ ] **Step 2: Run** the file; it fails (module missing).
- [ ] **Step 3: Implement** `calc.ts`. Every product and division on `BigInt` with one private `divHalfUp(n: bigint, d: bigint)` = `(2n * n + d) / (2n * d)`; convert to `Number` only at the end. Formulas are spec section 3.
- [ ] **Step 4: Run** the file; passes. `pnpm exec tsc -p apps/core/tsconfig.app.json --noEmit` and eslint on the two files are clean.
- [ ] **Step 5: Commit** both files as `feat: the quotation calculation, mirrored from the service`.

---

### Task 2: Schemas, form values, body and API hooks

**Files:**
- Create: `apps/core/src/features/quotes/schema.ts`, `apps/core/src/features/quotes/api.ts`, `apps/core/src/test/fixtures/quotes.ts`
- Test: `apps/core/src/features/quotes/schema.test.ts`

**Interfaces:**
- Consumes: `CalcSettings`, `CalcLine`, `quoteTotals`, `hundredthsOf` (Task 1); `amountProblem`, `parseAmount`, `toAmountText`, `MAX_CENTS` from `@/lib/money`; the `unwrap`/`coreApi`/`statusOf` pattern of `features/projects/api.ts`.
- Produces in `schema.ts`:
  - `quoteRowSchema` / `quoteRowsSchema` / `type QuoteRow` for the read described in Global Constraints (only fields the pages use; unknown keys dropped; `totals` fields typed `z.number()`).
  - `quoteFormSchema` (zod) and `type QuoteFormValues = { title; currencyCode; developerCount; developerRate; managerCount; managerRate; testerCount; testerRate; negotiationBufferPercent; managementPercent; testingPercent; bugFixPercent; hoursPerDay; hoursPerMonth: string; lines: { description: string; units: string; hoursPerUnit: string }[] }`.
  - `emptyQuoteForm: QuoteFormValues` (the defaults), `blankQuoteLine`, `toQuoteFormValues(row?: QuoteRow): QuoteFormValues`, `type QuoteBody` and `toQuoteBody(values: QuoteFormValues): QuoteBody` (rates to cents with `parseAmount`, percents and hours as numbers, currency in capitals, text trimmed).
  - `SETTINGS_FIELDS: readonly (keyof QuoteFormValues)[]` (every non-title, non-lines field) so the editor can tell a settings error from a line error.
  - `toCalcInput(values: QuoteFormValues): { settings: CalcSettings | null; lines: CalcLine[] }`: `settings` is `null` while any settings field is invalid; a line with an invalid units or hours is left out (counts as zero).
  - `quoteTooLarge(values: QuoteFormValues): boolean` (settings valid and `finalQuoteCents > MAX_CENTS`); `quoteFormSchema` reports it once, on the `lines` path, as `The quote comes to more than 100,000,000.00. Reduce the hours or the rates.`.
- Produces in `api.ts`: `QUOTES = ['quotes']`, `useQuotes()`, `useQuote(id: number)`, `useSaveQuote()` (mutate `{ id: number | undefined; body: QuoteBody }`, resolves to the saved quote's id: on create it reads only `{ id }` from the answer with a lax schema and resolves `undefined` if that fails, never failing a save that happened), `useDeleteQuote()` (404 counts as deleted, like `deleteRecord` in the projects api). Saving or deleting invalidates `QUOTES`.
- Produces in `test/fixtures/quotes.ts`: `quoteRows` (two rows, one the workbook's totals with its lines, built with the real figures) and `quotesEnvelope()` like `fixtures/projects.ts`.

- [ ] **Step 1: Write the failing tests** in `schema.test.ts`: `emptyQuoteForm` equals the Global Constraints defaults; `toQuoteBody` turns `3100.00` into `310000`, `"7.5"` into `7.5`, ` inr ` into `INR`; `toQuoteFormValues(row)` round-trips `toQuoteBody` for the fixture row (rates back to `3100.00`); `quoteFormSchema` messages for each bad input (units `0`, `100001`, `1.5`; hours `0`, `.5`, `1,5`, `1e3`, `10000.01`, `0.005`; percent `100.01`, `-1`, `12.345`; rate `3,100`, `-1`, `100000.01`; counts `0`, `1001`; hours per day `25`; hours per month `745`; currency `RUPEE`; empty title; zero lines) and acceptance of `0.5`, `16`, `0` percent, `0.00` tester rate; `toCalcInput` returns `settings: null` for an invalid percent and drops a line with blank hours; `quoteTooLarge` is true for 200 maximal lines and false for the workbook lines.
- [ ] **Step 2: Run** the file; it fails.
- [ ] **Step 3: Implement** `schema.ts` (messages in the repo's voice: `Enter a whole number, like 3`, `Hours must be more than 0`, etc.; model on `features/projects/schema.ts` invoice and line schemas) and `api.ts`.
- [ ] **Step 4: Run** the file; passes; tsc and eslint clean.
- [ ] **Step 5: Commit** as `feat: quote schemas, form values and api hooks`.

---

### Task 3: The Drawer primitive

**Files:**
- Create: `apps/core/src/components/ui/drawer.tsx`
- Test: `apps/core/src/components/ui/drawer.test.tsx`

**Interfaces:**
- Produces: `Drawer` (= Radix `Dialog.Root`), `DrawerContent({ title, description?, className?, children, fallbackFocusId? })`, `DrawerTitle`. A panel on the **right edge**, full height, `w-[min(28rem,100%)]`, `bg-background`, a hairline `border-l border-rule`, scrolls inside, over the same `bg-scrim` overlay as `Dialog`; the title is visible (`text-title font-semibold`), a 44px close button (`aria-label="Close"`, `CloseMark`) top right; focus returns to the opener via `useReturnFocus`, like `DialogContent`.

- [ ] **Step 1: Write the failing tests** (model on `overlays.test.tsx`): opening shows a `dialog` named by its title; Escape closes it; the Close button closes it; focus returns to the trigger; children render and are scrollable (class `overflow-y-auto`); the content sits on the right (`right-0`).
- [ ] **Step 2: Run** (fails), **Step 3: implement**, **Step 4: run** the file plus `src/design-contract.test.ts` (both pass).
- [ ] **Step 5: Commit** as `feat: a right-edge Drawer primitive`.

---

### Task 4: The editor (lines, totals, settings drawer)

**Files:**
- Create: `apps/core/src/features/quotes/quote-editor-page.tsx`, `quote-settings-drawer.tsx`, `quote-totals-panel.tsx`
- Test: `quote-editor-page.test.tsx`, `quote-settings-drawer.test.tsx`, `quote-totals-panel.test.tsx` (same folder)

**Interfaces:**
- Consumes: Tasks 1 to 3; `PageHeader`, `Field`, `fieldA11y`, `Input`, `Button`, `Panel`, `QueryBoundary`, `serviceMessage`/`statusOf` from `@/lib/core-api`, `formatMoney`.
- Produces:
  - `QuoteEditorPage()`: route component for `/quotes/new` and `/quotes/:id` (id from `useParams`; a non-numeric id shows "This quote does not exist" with a link to `/quotes`). Loads the quote with `useQuote` when editing (loading and error states through `QueryBoundary`; a 404 shows "This quote does not exist, or was deleted." and the link back), then mounts a form keyed by the quote id.
  - `QuoteSettingsDrawer({ open, onOpenChange, control/register/errors from the parent form, currencyCode })` and `QuoteTotalsPanel({ settings: CalcSettings | null, totals: QuoteTotals | null, currencyCode, bufferPercentText })`. (Exact prop shapes are the implementer's; they must take form plumbing from the parent so closing the drawer keeps values.)
- Behavior to build:
  - Header: title `New quote` or the saved title; actions `Settings` (opens the drawer; its label becomes `Settings (check)` while any `SETTINGS_FIELDS` error exists or settings text is invalid) and `Save`. A `Back to quotes` link.
  - Title and currency fields above the lines.
  - Lines table (model on the invoice dialog's lines): `Description`, `Units`, `Hours per unit`, `Total hours` (read-only: units x hours, `formatHours`, `—` while invalid), `Remove` (disabled with one line); `Add line` button below (max 200). Each input has an `aria-label` like `Line 1 units`; messages per row like the invoice dialog.
  - Totals panel, always visible (below the lines on narrow screens, a column beside them from `lg`): Time (`Total effort` hours, `Person-days` with `at N hours a day`, `Elapsed` months `with N developers`); Hours (development incl. bug fixing, management, testing, each with per person), Cost (development, management, testing, `Subtotal`, `Negotiation buffer (X%)`, **Final quote** larger). Settings invalid: the cost and time lines are replaced by `Check the settings to see the totals.`; hours from lines still show. All figures come from `quoteTotals(toCalcInput(watch()))`.
  - Save: `handleSubmit`; on invalid, if any error is in `SETTINGS_FIELDS` open the drawer; on valid call `useSaveQuote`. Create: navigate to `/quotes/{id}` with `replace` (or to `/quotes` when the id is unknown) ; edit: `reset(values)` and show `Saved` (`role="status"`), cleared on the next edit. Failure: a 404 on edit says the quote was deleted elsewhere; a 422 shows `serviceMessage`; anything else `Could not save. Try again.` (`role="alert"`); typed values stay.
  - Drawer sections: **Rates** (a row per role: People, Rate per hour for Developer, Project manager, Tester), **Percentages** (negotiation buffer, management, testing, bug fixing, each with a one-line hint of what it applies to: buffer to the subtotal, management to build hours, testing and bug fixing to the base hours), **Time** (hours in a day, hours in a month), **Currency** (code). Fields carry ids `quote-developer-rate`, `quote-negotiation-buffer`, etc. and visible `Field` labels.

- [ ] **Step 1: Write the failing tests** (mock `coreApi` like `projects-page.test.tsx`): the editor
  - renders defaults on `/quotes/new`; typing units `2` and hours `7.5` on line one shows `Total hours 15` and the totals update for the default settings: management hours `3.75`, development cost `₹46,500.00`, management cost `₹11,250.00`, subtotal `₹57,750.00`, negotiation buffer `₹14,437.50`, Final quote `₹72,187.50`;
  - `Add line` and `Remove` keep at least one line; Remove disabled at one;
  - opening Settings, changing the developer rate to `1000.00` changes the Development cost row; closing the drawer and reopening keeps the value; Save sends a body containing `developerRateCents: 100000`;
  - an invalid percent (`abc`) in the drawer makes the panel say `Check the settings to see the totals.` and the button `Settings (check)`; no `NaN` text anywhere;
  - Save with a bad percent while the drawer is closed opens the drawer and shows the message; Save with a blank hours shows that line's message and calls nothing;
  - a new quote posts, then navigates to `/quotes/12` (answer `{ id: 12 }`), an edit patches `/quotations/7` with the full body and shows `Saved`;
  - failure cases of Review Focus 5 keep the typed values;
  - editing loads `GET /quotations/7` and fills title, settings and lines; a 404 shows the missing-quote message;
  - the totals panel test renders known `QuoteTotals` and asserts each label/value pair as `formatMoney` text (`₹45,73,800.00` style for INR) and the invalid-settings state; the drawer test checks every field label and that each field edits the form.
- [ ] **Step 2: Run** (fail), **Step 3: implement**, **Step 4: run** the three files; tsc, eslint, `design-contract.test.ts` clean.
- [ ] **Step 5: Commit** as `feat: the quote editor with live totals and a settings drawer`.

---

### Task 5: The list page, routes, nav, and removing the skeleton

**Files:**
- Modify (replace): `apps/core/src/features/quotes/quotes-page.tsx`
- Delete: `apps/core/src/features/quotes/spec.ts`, `apps/core/src/features/quotes/quote-dialog.tsx`
- Modify: `apps/core/src/app/app.tsx`, `apps/core/src/app/nav.ts`, `apps/core/src/features/planned/registry.ts`, `apps/core/src/features/planned/planned.test.tsx`; any file that imports the deleted ones (grep `features/quotes/spec` and `quoteDialog`); docs that name the planned Quotes piece (grep `Quote generator` in `apps/core/*.md` and `docs`)
- Test: `quotes-page.test.tsx` (new), plus the existing app, nav and planned tests

**Interfaces:**
- Consumes: Task 2's `useQuotes`, `useDeleteQuote`, `quoteRows` fixture; `formatMoney`, `formatDate`, `formatHours`.
- Produces: `QuotesPage()` at `/quotes`: `PageHeader title="Quotes"` with a `New quote` button (navigates to `/quotes/new`); search field `Search quotes` over the title; a table `Title` (link to `/quotes/{id}`), `Lines`, `Hours` (`totals.totalHours` x 100 through `formatHours`), `Final quote` (in the quote's currency), `Updated` (`formatDate`), `Actions` (`IconButton` Edit `Edit {title}` -> the editor, Delete `Delete {title}` -> `ConfirmDialog` "Delete quote “X”?"), `TablePager`; empty state `No quotes yet.` with `Create the first quote`; `QueryBoundary` for loading and error.

- [ ] **Step 1: Write the failing tests** (model on `projects-page.test.tsx`): asks `/quotations`; each row shows title, line count, hours, final quote in INR grouping, updated date; search narrows and shows `No quotes match “x”.`; delete asks, calls `DELETE /quotations/{id}` and the row goes; empty state; error state with Try again; `New quote` navigates to `/quotes/new`. Update `planned.test.tsx`: `quotes` is gone from both lists and the list order of the remaining pieces is unchanged. App/nav tests: the sidebar has `Quotes` between `Projects` and `People`, and `/quotes`, `/quotes/new`, `/quotes/3` render their pages (the editor ones with the mocked API).
- [ ] **Step 2: Run** (fail), **Step 3: implement**: replace the page, delete the skeleton, register `quotes`, `quotes/new`, `quotes/:id` as real routes inside the authenticated shell (not under `planned`), remove the `planned/quotes` route and the `quotesSpec` registry entry, add the nav item; fix any dangling references.
- [ ] **Step 4: Run** the whole core suite: `pnpm exec nx test core --skip-nx-cache` (compare with the baseline count taken before Task 1; only additions and the removed skeleton tests), `pnpm exec tsc -p apps/core/tsconfig.app.json --noEmit` and `tsconfig.spec.json`, `pnpm exec eslint apps/core/src/features/quotes apps/core/src/components/ui apps/core/src/app`. All clean.
- [ ] **Step 5: Commit** as `feat: quotes page and routes; the planned skeleton is replaced`.

---

### Task 6: Contract and browser checks

**Files:**
- Create: `apps/core/src/features/quotes/live-contract.test.ts`, `apps/core-e2e/src/e2e/quotes.cy.ts`, `apps/core-e2e/src/support/quotes.ts` (stubs, model on `support/expenses.ts` and `e2e/expenses.cy.ts`)

- [ ] **Step 1: Live-contract test** (opt-in, model on `features/projects/live-contract.test.ts`, skipped unless `CORE_API_WRITE_URL` is set): sign in with `signInLive`, create a quote through `toQuoteBody` from the workbook vector (53 lines, defaults) and from vector two; parse each answer with `quoteRowSchema`; assert `quoteTotals(toCalcInput(...))` equals the service's `totals` field by field (hours as `Math.round(x * 100)`), so the two implementations are held to each other; PATCH the lines and a setting and re-assert; refuse a too-large body with a 422; delete and see the 404.
- [ ] **Step 2: Stubbed Cypress spec**: sign in, open Quotes from the sidebar, `New quote`, fill the title, two lines, open `Settings`, change the developer rate, close, `Save`; the address becomes `/quotes/<id>`, the Final quote shows the expected figure; back to the list shows the row. Follow the existing support-file stubbing style exactly.
- [ ] **Step 3: Run** the full core suite and `env -u ELECTRON_RUN_AS_NODE pnpm exec cypress run --project apps/core-e2e --config-file cypress.config.ts --spec apps/core-e2e/src/e2e/quotes.cy.ts` (and the four existing specs once, to see the sidebar change broke none), see them pass.
- [ ] **Step 4: Commit** as `test: quotes contract and e2e checks`.
