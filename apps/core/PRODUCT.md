# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite 4.3 and React 19 in the Nx 16.5 workspace `octacore-frontend`. Tailwind 4, shadcn-structured components (Radix for dialogs), TanStack Query 5, react-hook-form with zod, react-router 6. Data and sign-in come from the FastAPI core service in `octacore-backend`. A json-server mock (`json-server/db.json`, now empty) is still in the repository, but no page reads it. Versions are recorded in `docs/superpowers/specs/2026-10-14-core-redesign-design.md`, section 15. Hosting is undecided.

## Users

The four Octalogic partners, the company's co-founders. They run the company and look in on money and delivery between client work: what is owed, what needs approving, which projects exist and for whom. They know the data already and want to answer a question and leave, not be guided.

Which devices they use is not confirmed. The app must work on a phone and on a desktop.

## Product Purpose

One place for the partners to do four jobs:

- See what is owed: what is outstanding across projects, and which invoices are unpaid.
- Review invoices: every project's invoices in one list, the unpaid ones by default, filtered by status, client, project or issue date, with a CSV export.
- Look up projects and the clients they belong to.
- Keep the reference data (categories, technologies) accurate so everything else stays consistent.

It replaces three separate apps (Core, Projects, Finance) that only linked to each other by port number. Success means the four jobs work end to end in this one app, with no second app or address to remember.

## Operating Context

- Everything is on the real backend, the FastAPI core service in `octacore-backend` (port 5001, base path `/api/v1`, every response in a `{statusCode, message, data, meta}` envelope). It has users, categories, clients, countries, projects, people, technologies and invoices. Sign-in and the Categories, Technologies, Clients, Projects, People, Invoices, Countries and Users pages use it (Countries read-only). A technology has an optional category. A person has an optional current monthly salary, one figure with no history; like every other record it is visible to anyone who is signed in. A project has a project type (resource augmentation or product) and a billing type (retainer or fixed cost); it has resources (people with a category and an hourly rate) and invoices made of lines; every rate, salary and invoice amount is stored as whole US cents (the service sends and takes `rateCents`, `monthlySalaryCents`, `amountCents` and so on), forms take dollars and cents (`12.50`) and every figure shows two decimals (`$1,234.56`); an invoice's amount is the sum of its lines, a retainer invoice starts from the resources at 160 hours each, and the project's total value and what is outstanding are calculated from its invoices, each marked paid when the client pays. Each invoice can be previewed, downloaded as a PDF and emailed; a project's key numbers its invoices. An invoice has no status of its own: it is paid once it has a paid date, overdue when unpaid and past its due date, and unpaid otherwise. On the Invoices page "active" means every invoice not yet paid, overdue ones included; its date filters work on the issue date.
- Expenses are built: one Expenses page under Finance with three tabs (Overview, One-time, Recurring; the tab is in the address), and Expense types and Currencies under Reference data. An expense is one charge in US dollars (stored as cents) with a type, a charge date, an optional project and an optional person from People. The Overview shows one month at a time (this month first; previous and next month buttons): its total split into one-time and recurring, the total by type, and every expense in it, with filters for type, project and person. One-time is the expenses typed in by hand, with filters, a search and a CSV export. Recurring is the recurring expenses: monthly, quarterly or yearly, from a start date to an optional end date, for which the core service creates an expense for each charge date (at startup and every 24 hours; a start date in the past creates its charges at once), each carrying the recurring expense's person; they can be paused, resumed, cancelled or deleted, and the charges are ordinary expenses that can be edited one by one. An amount can be typed in another currency: Currencies holds one hand-typed rate per currency (units per US dollar, US dollars fixed at 1), and an expense keeps the amount typed and the rate it was converted at. Open decisions: a live rate feed for Currencies (the table is where it would write), profit against invoices, a by-person breakdown, and charts.
- The service's country data comes from a legacy dump: it stores 0 for a missing numeric or calling code and the text NULL for a missing ISO3 code. The app shows a dash for all three.
- The Invoices page keeps the CSV export the old Finance app had for bills; it exports the rows shown.
- The old Projects and Finance apps are retired; their working parts live here.

## Capabilities and Constraints

- Nine areas: Overview, Clients, Projects, People, Invoices, Categories, Technologies, Countries (read-only, from the core service), and Users (admins only). The old navigation's Documents, Supports and Setting were dead links and are not part of the app.
- Sign-in is built. Every page sits behind an email and password checked by the core service (it issues the tokens; there is no third-party provider), and the sidebar shows who is signed in with Change password and Sign out. One role exists, `admin`, with full access; admins manage accounts on the Users page.
- Open decisions: hosting; whether to remove the json-server mock now that no page reads it; the currency (the app shows `$` through one formatter, as the old cards did); which roles beyond `admin` will exist.
- Terminology: the page is "Invoices" (it was "Receipts and bills"); an invoice is paid, overdue or unpaid, and "active" means not yet paid.

## Brand Commitments

- This is an Octalogic product. Its visual system follows the octa-website (recorded in DESIGN.md) rather than being invented here.
- The supplied logo SVG is used as shipped: never redrawn, never recoloured beyond its approved reversal for dark backgrounds.
- Voice: plain, confident, precise. No agency language.

## Evidence on Hand

- `json-server/db.json` is empty: everything now lives in the core service.
- No real client names or amounts are in the repository, so none may be invented in the interface.

## Product Principles

1. **One app, no hand-offs.** Everything a partner does is reachable from one sidebar.
2. **Answers before controls.** The Overview states the numbers in a sentence; tables and forms come after.
3. **Honest about its data.** Loading, empty and failed states say what is true. A missing API is an error with a retry, never a blank panel.
4. **Careful with money.** Destructive actions ask with explicit wording; an exported file is safe to open in a spreadsheet.
5. **Plain and quick.** Short labels and no onboarding or marketing language; the partners know the business.

## Accessibility & Inclusion

WCAG 2.2 AA: semantic landmarks, visible focus, text contrast of 4.5:1 or better, a label on every field, 44px interactive targets, keyboard-operable dialogs and menus, and reduced motion respected.
