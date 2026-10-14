# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite 4.3 and React 19 in the Nx 16.5 workspace `octacore-frontend`. Tailwind 4, shadcn-structured components (Radix for dialogs), TanStack Query 5, react-hook-form with zod, react-router 6. Data comes from a json-server mock on `http://localhost:3001` (`json-server/db.json`); the FastAPI core service in `octacore-backend` is wired in for Categories, Technologies and Countries. Versions are recorded in `docs/superpowers/specs/2026-10-14-core-redesign-design.md`, section 15. Hosting is undecided.

## Users

The four Octalogic partners, the company's co-founders. They run the company and look in on money and delivery between client work: what is owed, what needs approving, which projects exist and for whom. They know the data already and want to answer a question and leave, not be guided.

Which devices they use is not confirmed. The app must work on a phone and on a desktop.

## Product Purpose

One place for the partners to do four jobs:

- See what is owed: what is outstanding across projects, and what bills are waiting for approval.
- Record and review bills: add a bill with a picture of it, filter by date or approval, export a CSV.
- Look up projects and the clients they belong to.
- Keep the reference data (categories, technologies) accurate so everything else stays consistent.

It replaces three separate apps (Core, Projects, Finance) that only linked to each other by port number. Success means the four jobs work end to end in this one app, with no second app or address to remember.

## Operating Context

- Most data is still a mock (json-server). The real backend is the FastAPI core service in `octacore-backend` (port 5001, base path `/api/v1`, every response in a `{statusCode, message, data, meta}` envelope). It has categories, clients, countries, projects, people and technologies, but nothing for bills, and its fields differ from the mock's. The Categories, Technologies and Countries pages use it (Countries read-only). A technology has an optional category; wiring in the rest is a later step.
- The service's country data comes from a legacy dump: it stores 0 for a missing numeric or calling code and the text NULL for a missing ISO3 code. The app shows a dash for all three.
- A bill is recorded with an image. The mock cannot store files, so only the file name is kept until real storage exists.
- The bills CSV export came from the old Finance app and is kept.
- The old Projects and Finance apps are retired; their working parts live here.

## Capabilities and Constraints

- Six areas: Overview, Projects, Receipts and bills, Categories, Technologies, and Countries (read-only, from the core service). The old navigation's People, Documents, Supports and Setting were dead links and are not part of the app.
- Sign-in is built. Every page sits behind an email and password checked by the core service (it issues the tokens; there is no third-party provider), and the sidebar shows who is signed in with Change password and Sign out. One role exists, `admin`, with full access; admins manage accounts on the Users page. The json-server mock (Projects, Bills) does not check tokens until those move to the core service.
- Open decisions: hosting; how and when the rest of the FastAPI service is wired in and how its fields map to the mock's; where bill images are stored; the currency (the app shows `$` through one formatter, as the old cards did); which roles beyond `admin` will exist.
- Terminology: the page is "Receipts and bills"; "Reimbursement" is stored as `actualExpense`.

## Brand Commitments

- This is an Octalogic product. Its visual system follows the octa-website (recorded in DESIGN.md) rather than being invented here.
- The supplied logo SVG is used as shipped: never redrawn, never recoloured beyond its approved reversal for dark backgrounds.
- Voice: plain, confident, precise. No agency language.

## Evidence on Hand

- Mock data in `json-server/db.json`: bills from the old apps (categories and technologies now live in the core service). Projects are added during this build with placeholder names such as "Project 1" and "Client A".
- No real client names, amounts or bill images are in the repository, so none may be invented in the interface.

## Product Principles

1. **One app, no hand-offs.** Everything a partner does is reachable from one sidebar.
2. **Answers before controls.** The Overview states the numbers in a sentence; tables and forms come after.
3. **Honest about its data.** Loading, empty and failed states say what is true. A missing API is an error with a retry, never a blank panel.
4. **Careful with money.** Destructive actions ask with explicit wording; an exported file is safe to open in a spreadsheet.
5. **Plain and quick.** Short labels and no onboarding or marketing language; the partners know the business.

## Accessibility & Inclusion

WCAG 2.2 AA: semantic landmarks, visible focus, text contrast of 4.5:1 or better, a label on every field, 44px interactive targets, keyboard-operable dialogs and menus, and reduced motion respected.
