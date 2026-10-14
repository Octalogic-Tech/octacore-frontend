# Core app redesign: design spec

Status: draft for review
Date: 2026-10-14
Repo: `octacore-frontend` (Nx 16.5.1 workspace, branch `develop`)

## 1. Outcome

One app, `core`, replaces the three apps staff use today (Core, Projects, Finance). It is built on shadcn and Tailwind, looks like the octa-website (navy, teal, grey; Schibsted Grotesk; square corners; hairlines), and navigates without leaving the app. The nav no longer links to other apps by localhost port.

Success looks like this:

- Every feature that really works today is available in `core`: categories, technologies, bills with CSV export, plus the projects list and the overview that the old apps only sketched (see section 8).
- No MUI, Emotion, styled-components, Vue or Vuetify remains in the workspace.
- A staff member can move between every page with the keyboard, on a phone and on a desktop, and no page needs a second dev server except the json-server mock API.

Audience: Octalogic staff using an internal operations tool. In impeccable's terms the surface is **Operate** mode (scanning, consistency, forms and tables), not **Persuade** like the website.

## 2. Decisions already made

| Decision | Choice |
|---|---|
| Component layer | shadcn and Tailwind only. All MUI, Emotion and styled-components code is replaced. |
| What moves into core | Real features only. Empty stubs wait until they are built. |
| Old `projects` and `finance` apps | Deleted after their pages are ported. Git history keeps them. |
| Look | Faithful adaptation of octa-website: brand tokens, arm mark for current page and primary buttons, one 45 degree cut on main panels, text-led nav, no icon set. |
| Data | UI only, on json-server. Create, edit and delete really work against json-server. Wiring to the Nest `core-service` is a later step. |
| Foundation | New Vite app replaces the webpack `core` app. Nx stays at 16.5.1 and Vite at 4.3.9. |
| Impeccable | Run from the marketplace checkout at `~/.claude/plugins/marketplaces/impeccable` (v4.5.2). Its launcher may download a binary on first run. |

## 3. Current state (verified by reading the code)

- `apps/core` is React 18.2 and MUI 5 on webpack with Babel, with react-query 3, Formik and Yup. `apps/projects` is the same stack. `apps/finance` is Vue 3 and Vuetify on `@nx-plus/vue`. `apps/external/portfolio` is a Vite and Tailwind 3 app and is independent of the shared libs.
- The side nav (`libs/shared-ui`, `libs/constant/src/lib/navbarConstant.ts`) links across apps by hard-coded ports (Core 4200, Projects 4201, Finance 8080). People, Documents, Supports and Setting point at routes that do not exist. Logout has no handler.
- Real behaviour today:
  - Categories and Technologies are paged tables that read from json-server on `:3001`. Their add, edit and delete handlers do nothing (the category services are stubs, and the technology handlers return immediately or just refetch).
  - Finance "Receipts and bills" reads `GET :3001/getBills`, shows a paged table, and has an add-bill dialog and a CSV export dialog. The add-bill submit is `alert('axios call')`. The on-page Search button and the row menu (four items labelled "Menu Item-1" to "Menu Item-4") do nothing.
- Everything else is placeholder:
  - The Overview and Projects tables render the word "column" in every cell.
  - The summary cards show hard-coded figures ("$5600 from $4400", "7000 from 1,40,400") over an empty chart box.
  - Project Industry is an empty `<h1>`.
  - Six of the seven Finance views (Overview, Accounts payable, Accounts receivable, Budgets, Assets tracking, Reports) are breadcrumb-only stubs. Receipts and bills is the only real one.
- The Nest `core-service` has CRUD for categories, clients, countries, projects, technologies and people. It has nothing for finance or bills, and its entity fields differ from the json-server shapes.
- Tests are scaffolds. The core unit spec only checks that the app renders. The Cypress spec asserts "Welcome core" and calls `cy.login`, which cannot pass.
- The uncommitted working tree holds a move to pnpm (`package-lock.json` deleted, `pnpm-lock.yaml` and `pnpm-workspace.yaml` new) and two tiny `package.json` edits (`clsx` added, `vuetify` pinned). This work builds on top of that state.

## 4. Scope

In scope: the `core` app rebuild, the shell, the design system, the ported pages, the json-server data changes, removal of the retired apps and libs, tests, and the PRODUCT.md and DESIGN.md that impeccable produces.

Out of scope: the Nest API wiring, authentication, the People, Documents, Supports and Setting sections, the `external/portfolio` app (beyond keeping it building), dark mode, and anything on the Finance or Projects side that is a stub today.

## 5. Foundation

### 5.1 Workspace

- `apps/core` is recreated as an `@nx/vite` app, modelled on `apps/external/portfolio`'s executors. It keeps the project name `core` and port 4200, so `nx serve core` still works.
- App code lives under `apps/core/src` with the alias `@/` pointing at it (shadcn convention). `components.json` is added by hand at `apps/core/components.json`.
- The libs `constant`, `shared-ui` and `services/*` are deleted, not ported. After the old apps go, only the replaced `core` app used them.

### 5.2 Dependencies

Root `package.json` is a single shared manifest (the portfolio app uses it too), so changes are made with the portfolio in mind. Exact versions are chosen and verified in the probe (5.3).

- Add: `tailwindcss` 4 with `@tailwindcss/postcss`, `tw-animate-css`, `class-variance-authority`, `tailwind-merge` (current major), `radix-ui`, `@tanstack/react-query` 5, `@tanstack/react-table`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@fontsource-variable/schibsted-grotesk`, React 19 with matching `@types`, and a Testing Library release that supports React 19. `clsx` and `axios` are already present.
- Remove: `@mui/*`, `@emotion/*`, `styled-components` with its Babel plugin and types, `formik`, `yup`, react-query 3, `vue`, `vuetify`, `vue-router`, `@vuelidate/*`, `vue3-datepicker`, `vue-material-design-icons`, `@mdi/font`, `@date-io/dayjs`, `csv-writer`, `@nx-plus/vue`, the Vue lint and test packages, `@nx/webpack` and the webpack-only tooling, if nothing else uses them.
- The root `postinstall` script runs `node node_modules/@nx-plus/vue/patch-nx-dep-graph.js`. It must be removed together with `@nx-plus/vue`, or `pnpm install` fails.
- `tsconfig.base.json` path entries for the deleted libs are removed, along with three entries that already point at libs that do not exist (`constants`, `design-system`, `my-library`).

### 5.3 Probe (first task of the plan, throwaway)

The plan opens with a short probe on a scratch branch, before any real work. It answers four questions:

1. Does Vite 4.3.9 build `apps/core` with Tailwind 4 through `@tailwindcss/postcss`?
2. Do shadcn components (Button and Dialog as the sample) install and render on React 19 with this setup?
3. Does `external/portfolio` still build, given the shared root? It is on Tailwind 3 (`@tailwind base` directives and a v3 PostCSS plugin config), so the plan is to keep it on v3 through an npm alias, with a one-line change to its `postcss.config.js`. The probe confirms that works and that React 19 does not break it.
4. Does `@nx/vite` 16.5.1 serve, build and test (Vitest 0.32) the app?

If answer 1 or 3 is no, the fallback is **Tailwind 3.4 and React 18** (both already installed and shared with the portfolio), with the website's tokens expressed in `tailwind.config.js` and shadcn's older React 18 components. Only the token file and the component source change. Nothing else in this spec depends on the choice.

### 5.4 Nx project setup

- `core`: `@nx/vite` build, serve, preview and test targets, plus the existing eslint lint target.
- `core-e2e`: keep the Cypress project, delete the generated spec and the `cy.login` support command, and add the smoke test in section 11.
- The root `dev:all` script keeps working. It serves whatever remains, which is `core` and the portfolio.

## 6. Information architecture and shell

Navigation is text-led and has no icon set. The current page is marked by the website's arm mark. The groups and their routes:

| Group | Item | Route |
|---|---|---|
| Work | Overview | `/` |
| Work | Projects | `/projects` |
| Finance | Receipts and bills | `/finance/receipts-bills` |
| Reference data | Categories | `/categories` |
| Reference data | Technologies | `/technologies` |

- One `react-router` 6 router. Unknown paths show a not-found page inside the shell.
- Below 1024px the sidebar becomes a shadcn Sheet opened from a header toggle, the same breakpoint the website uses for its nav.
- Dropped on purpose: Logout (there is no auth to log out of), People, Documents, Supports and Setting (dead links).
- The logo is the website's supplied SVG (`octa-website/brand/logo.svg` and `logo-mark.svg`), copied unmodified, with the approved reversal on navy. It replaces `Logo.png`.
- The exact composition of the shell (sidebar ground, header, page title placement) is decided in impeccable's `shape` step inside the rules of section 7, and recorded in DESIGN.md.

## 7. Design system

### 7.1 Tokens

The website's `DESIGN.md` is the source. The app maps it onto shadcn's CSS variables:

| shadcn variable | Value | Note |
|---|---|---|
| `--background` | `#f2f2f0` (Paper Grey) | page ground. No white surfaces. |
| `--foreground` | `#0d3a5c` (Octalogic Navy) | ink |
| `--card`, `--popover` | `#f2f2f0` | panels are framed, not filled |
| `--primary` / `--primary-foreground` | `#0d3a5c` / `#ffffff` | |
| `--secondary`, `--muted`, `--accent` | `#e0e3e4` (Soft Hairline) | `accent` is shadcn's hover fill, **not** teal |
| `--muted-foreground` | `#3f627d` (Slate Navy) | `#4d6e85` (Muted Navy) only on the grey ground |
| `--border` | `#c4cdd2` (Hairline) | |
| `--input` | `#4d6e85` (Muted Navy) | the resting colour of underline fields |
| `--ring` | `#0d3a5c`, teal on navy surfaces | 2px, 3px offset |
| `--destructive` | `#0d3a5c` | the website has no red (see 7.3) |
| `--radius` | `0` | |
| `--signal` (new) | `#60e4cf` (Arm Teal) | action, current state, the arm. Never text on grey. |

Teal keeps the website's meaning: it is a signal, never decoration, and never carries text on the grey ground. Contrast pairs are re-measured in the audit step, not assumed.

### 7.2 Type and layout

- Schibsted Grotesk, self-hosted as a variable font through `@fontsource-variable/schibsted-grotesk`, replacing the Google Fonts Nunito link in `index.html`.
- App text never goes below 14px. Page titles use the website's Headline size. Tables and controls use Small and Body. Amounts and dates use tabular figures.
- Interactive targets are at least 44px high, as on the website.
- Hairlines separate rows. There are no shadows and no gradients.

### 7.3 Component rules

- **Components used:** Button, Input, Textarea, Label, Select, RadioGroup, Table, Dialog, AlertDialog, Sheet, Badge, Form (react-hook-form with zod), and a pagination control with rows-per-page of 5, 10 and 20, as the current tables have.
- **Inputs** are the website's underline fields: a 1px Muted Navy rule that turns navy on hover and firms to 3px navy on focus, with an arm leading each label. Errors use a 2px navy rule, a navy arm and the message, with no red.
- **Buttons** are a label plus a square arm cell, as on the website. One primary button per screen.
- **Drawn marks, not glyphs:** the checkbox tick, select chevron, dialog close and pagination arrows are small drawn SVGs (squares, bars and the 45 degree arm). There is no lucide or other icon dependency.
- **Delete** is an AlertDialog with explicit wording ("Delete category 'X'? This cannot be undone.") and a navy button. It is not red.
- **Status:** a bill's status is a Badge, navy filled for Approved and outlined for Pending.
- **Panels:** the main data panel and dialogs use the website's single bottom-right 45 degree cut, drawn the way the website draws it (a small corner SVG over a real 1px frame, not `clip-path`).
- **States:** loading shows skeleton rows. Errors show an inline message with a Retry button. Empty tables say what is missing and offer the add action. After a mutation the table updates and failures show inside the dialog.
- **Motion:** hover and focus transitions plus the arm swing only. No scroll reveals. Everything respects `prefers-reduced-motion`.
- **Narrow screens:** tables scroll horizontally inside their panel below 768px.

## 8. Pages

All pages are built from the five routes in section 6.

**Overview** replaces both near-identical placeholder overviews. Its numbers come from the data, not from constants:
- A sentence on a ruled line: "$X outstanding across N projects, of $Y in total", with an arrow link to Projects.
- A sentence: "N bills are waiting for approval", with an arrow link to Receipts and bills.
- Two short ruled lists: the five projects with the largest outstanding amount, and the five newest pending bills.
- There are no metric tiles and no chart box. Currency is a single formatter constant, `$`, matching the current cards.

**Projects** is one table: Name, Client, Total value, Outstanding, with text search. Data is a new seeded `projects` collection (section 9.2).

**Receipts and bills** carries over the working parts of the Finance app:
- A paged table with columns Bill date, Amount, Bill type, Reimbursement, Uploaded by and Status.
- Filters on the page: from-date, to-date (native date inputs styled as underline fields) and an approval filter (All, Pending, Approved).
- Export CSV downloads exactly the filtered rows. The separate export dialog is removed.
- Add bill dialog fields: Date, Amount, Bill type (Regular, Incentive, Bonus), Reimbursement (Yes or No), Added by (text), and a required image attachment. All fields are required, as today.

**Categories** and **Technologies** keep their tables, add and edit dialogs, search and paging.
- Categories columns: Name, Created, Updated, Actions. The dialogs capture name and description.
- Technologies columns: Name, Category, Description, Actions. The dialogs capture name, description and an optional category.
- Row actions are two visible text buttons, Edit and Delete, in place of the kebab menu.

## 9. Data layer

### 9.1 Structure

- `src/lib/api.ts` creates one axios instance with `baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'`.
- Each feature folder (`categories`, `technologies`, `projects`, `bills`) owns its types, its axios calls and its TanStack Query hooks (list, create, update, delete). Mutations invalidate the list query.
- Those feature files are the only place that knows the HTTP shape. Moving to the Nest API later means changing them and mapping the entity fields, not touching the pages.

### 9.2 json-server changes (`json-server/db.json`)

- Rename the `getBills` collection to `bills`. The new bills feature uses `/bills`, and the only old caller (the Vue table) is deleted.
- Add a `projects` collection of about eight rows with fields `id`, `name`, `description`, `client`, `totalValue`, `totalOutstanding`, shaped like the Nest `Project` entity. Names follow the existing fixture style ("Project 1", "Client A").
- Create, update and delete use json-server's native REST routes. The client sets `created` and `updated` (`YYYY-MM-DD`) because json-server does not.
- The attachment on a new bill is validated as required, but json-server cannot store files, so only the file name is saved in `billPath`. Real storage waits for the backend.

## 10. Removal list

Deleted: `apps/projects`, `apps/projects-e2e`, `apps/finance`, `apps/finance-e2e`, `libs/constant`, `libs/shared-ui`, `libs/services/categories`, `libs/services/core-technologies`, the old webpack `core` sources and config, the Nunito font link, and the dependency and script entries in section 5.2.

Kept: `apps/external/portfolio` (and its e2e), `apps/core-e2e`, `json-server/`, `assets/`.

## 11. Testing and verification

- **Unit and component tests** (Vitest, Testing Library, jsdom), for logic that can regress:
  - CSV building with correct quoting of commas, quotes and newlines (the old export did not quote).
  - Bill filtering by date range and approval.
  - Overview aggregates.
  - The form schemas.
  - Create and delete flows with the API mocked.
  - Nav current-state marking.
- **E2E smoke** (Cypress): with json-server running, visit each of the five routes from the nav, add a category, delete it through the confirm dialog, and export a CSV. This replaces the broken generated spec.
- **Before calling it done:** `nx build core`, `nx test core`, `nx lint core`, `nx e2e core-e2e` and `nx build external--portfolio` all pass, and the app has been run against json-server with screenshots taken at 1440px and 390px.
- **Accessibility:** target WCAG 2.2 AA. Check visible focus, 44px targets, a label on every field, keyboard-operable dialogs and sheet, and reduced motion. Impeccable's `audit` and `critique` run once each after the build.

## 12. Risks

- **Tailwind 4 on Vite 4.3 and the shared root.** Not yet tried in this workspace. The probe (5.3) decides, and a Tailwind 3.4 and React 18 fallback is defined.
- **The portfolio shares the root.** A Tailwind or React bump can break it. The probe checks its build, and it stays on Tailwind 3 through an alias if v4 is used.
- **Largest piece is the Finance port** (Vue to React): a table, a form dialog and filtered export, but it has no backend, so it runs on json-server only.
- **Impeccable launcher.** It may download a binary on first run. If it cannot run, the fallback is to read PRODUCT.md and DESIGN.md directly and apply its method by hand, as its own instructions allow.
- **Visible behaviour changes** (section 13) need your review, since several differ from a literal port.

## 13. Calls to review

These are judgement calls where this spec differs from a literal port of what exists. Each is easy to reverse.

1. **One Projects table, no development and support split.** The existing tables are placeholders and the Nest `Project` entity has no such field.
2. **Overview is computed** from projects and bills (two sentences and two lists) instead of the hard-coded cards.
3. **Technologies drops the IconType and IconName columns.** They hold MUI icon names that were printed as plain text. The fields stay in the data. The dialogs gain an optional Category.
4. **Row actions are visible Edit and Delete buttons.** The kebab menu goes. Bills rows have no actions, because their menu items were placeholders.
5. **Bills filters live on the page** and drive both the table and the CSV export. The separate export dialog is removed.
6. **Add bill:** "Added by" becomes a free-text field (the three options were placeholders), and only the attachment's file name is stored.
7. **Delete uses a confirm dialog** with explicit wording, and no red, following the website's rule.
8. **Logout and the dead nav links are dropped.**
9. **Tables scroll horizontally** on narrow screens rather than restacking.
10. **Logo** is the website's SVG, replacing `Logo.png`.
11. **Currency** is `$` through one formatter constant.

## 14. Process

1. Create a feature branch from `develop`. The uncommitted pnpm changes come along and are left as they are.
2. Probe (5.3) and decide the Tailwind and React versions.
3. Impeccable `init` writes PRODUCT.md for the core app (platform web, Operate mode, users are Octalogic staff). `document` writes DESIGN.md from the website's, applying section 7. `shape` settles the shell and page compositions.
4. Build in this order: foundation and shell, Categories and Technologies (they already work), Projects and Overview, Receipts and bills.
5. Remove the retired apps, libs and dependencies. Verify as in section 11. Run impeccable's `critique`, `audit` and `polish` once each.

An implementation plan with these steps broken into tasks is written after this spec is approved.
