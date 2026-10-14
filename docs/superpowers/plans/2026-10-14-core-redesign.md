# Core App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Core, Projects and Finance apps with one shadcn and Tailwind app, `core`, styled after octa-website, with no links between apps.

**Architecture:** `apps/core` is rebuilt as an `@nx/vite` app (React 19, Tailwind 4 through PostCSS) with shadcn-structured components that are written by hand to the website's rules (square corners, hairlines, the arm mark, no icon glyphs). One router serves five routes inside one shell. Each feature (categories, technologies, projects, bills, overview) owns its types, its json-server calls and its TanStack Query hooks, so the pages never know the HTTP shape. The retired apps and the MUI-based libs are deleted.

**Tech Stack:** Nx 16.5.1, Vite 4.3.9, Vitest 0.32, React 19, Tailwind 4 (`@tailwindcss/postcss`), Radix (dialog, alert-dialog), class-variance-authority, TanStack Query 5, react-hook-form with zod, axios, react-router 6, Cypress, json-server, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-14-core-redesign-design.md` (read it first; this plan implements it and the executor reads both).

## Global Constraints

Every task's requirements include these. Values are copied from the spec.

- Work from `/Users/glenn/Code/octalogic/octacore-frontend`, on branch `feature/core-redesign`. Package manager is pnpm; run targets as `pnpm nx <target> core`.
- Nx stays at 16.5.1 and Vite at 4.3.9. The project is named `core` and serves on port 4200.
- Stack is React 19 and Tailwind 4 through `@tailwindcss/postcss`. The fallback (Tailwind 3.4 with React 18) is used only if gate G1 or G3 in Task 1 fails, and then only after the human partner agrees.
- No MUI, Emotion, styled-components, Vue, Vuetify, Formik, Yup, lucide or any other icon library. The checkbox tick, select chevron, dialog close and pagination arrows are drawn marks from `src/components/ui/marks.tsx`.
- Colours are only these tokens: Paper Grey `#f2f2f0`, Octalogic Navy `#0d3a5c`, Night Navy `#0a2f4b`, Slate Navy `#3f627d`, Muted Navy `#4d6e85`, Hairline `#c4cdd2`, Soft Hairline `#e0e3e4`, Arm Teal `#60e4cf`, white (`#ffffff`) only as text on navy, Mist `#c2ced6`, Navy Rule `#2f5672`, scrim `rgb(3 17 29 / 0.45)`.
- Teal is a signal: action, current state, the arm. It never carries text on the grey ground.
- Radius is 0 everywhere. No shadows (the one exception is the button's 1px inset seam). No gradients. No red: delete is a confirm dialog with explicit wording and a navy button; status is a navy-filled Badge for Approved and an outlined Badge for Pending.
- Font is Schibsted Grotesk Variable. App text is never below 14px. Interactive targets are at least 44px high (`min-h-11`). Amounts and dates use tabular figures (`tabular`).
- Panels use the website's single bottom-right 45 degree cut: `Panel` on the grey ground, `cut-br` for dialogs.
- Routes: `/` Overview, `/projects`, `/finance/receipts-bills`, `/categories`, `/technologies`. Anything else is a not-found page inside the shell.
- Data comes from json-server at `import.meta.env.VITE_API_URL ?? 'http://localhost:3001'`, collections `/categories`, `/technologies`, `/projects` and `/bills`. Currency is `$` through `formatCurrency` only.
- Accessibility target is WCAG 2.2 AA: a label on every field, visible focus, keyboard-operable dialogs and sheet, `prefers-reduced-motion` respected.
- Git: stage explicit paths only. Never stage `.agents/` or `skills-lock.json` (the user's, unrelated). Task 1's commit also stages the user's pnpm migration files (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, deleted `package-lock.json`), because the lockfile has to travel with the dependency changes. Confirm this with the human partner before running Task 1's commit step.
- Every commit message ends with the trailer shown in the Conventions section.

## Review Focus

Failure modes the spec implies that are most likely to bite someone using the app. Each has a pinning test in the task that owns the code.

1. **A bill's text fields start with `=`, `+`, `-` or `@`, or contain commas, quotes or newlines.** The CSV must stay one valid row per bill, and a spreadsheet must not execute the value as a formula. Pinned in Task 13.
2. **The From date is after the To date, or only one date is set.** Both bounds are inclusive, one bound alone works, and an inverted range shows no rows, a visible message, and a disabled export. Pinned in Tasks 13 and 14.
3. **Add bill with an amount of 0, a negative or non-numeric amount, or a non-image attachment.** The form blocks it with a message next to the field and sends nothing. Pinned in Task 14.
4. **The current page runs past the end after rows disappear** (deleting the only row on the last page, or searching while on page 3). The pager clamps to the last page and search resets to page 1. Pinned in Tasks 7 and 10.
5. **json-server is not running, or a collection is empty.** Every page shows an error with a Retry button, or an empty state with the add action, never a blank panel or a crash. Pinned in Task 8 (the shared boundary) and in the page tests of Tasks 10 to 15.

## Conventions

- All paths are relative to `/Users/glenn/Code/octalogic/octacore-frontend` unless stated.
- Files are kebab-case. Tests sit next to the code as `*.test.ts` or `*.test.tsx`. Imports inside `apps/core/src` use the `@/` alias.
- Run one app target with `pnpm nx <target> core`. Run one test file with `pnpm nx test core --testFile=<path relative to apps/core>`.
- Commit with two `-m` flags, the second being the trailer:

```bash
git commit -m "<subject>" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- Do not run `pnpm dlx shadcn add` during this plan. The components are written by hand in shadcn's structure. `components.json` is kept so the CLI can be used later; anything it generates must have its icon imports replaced with marks, and `src/design-contract.test.ts` fails until that is done.

## File Structure

```
apps/core/
  project.json  vite.config.ts  postcss.config.js  components.json  index.html  .eslintrc.json
  tsconfig.json  tsconfig.app.json  tsconfig.spec.json  .env.example
  public/favicon.ico
  src/
    main.tsx  styles.css  test-setup.ts  design-contract.test.ts
    assets/brand/logo.svg  logo-mark.svg                 (copied unmodified from octa-website/src/assets/brand)
    lib/        utils.ts  api.ts  query-client.ts  format.ts  filter.ts   (+ tests)
    hooks/      use-paged-rows.ts                                          (+ test)
    test/       utils.tsx                                                  (render helper)
    components/
      ui/       marks  button  input  textarea  select  label  field  badge  table  panel
                link-arrow  dialog  sheet  confirm-dialog                  (+ tests)
      logo.tsx  page-header.tsx  search-field.tsx  query-boundary.tsx  table-pager.tsx
    app/        app.tsx  app-shell.tsx  sidebar-nav.tsx  nav.ts  not-found-page.tsx  page-stub.tsx (temporary)
    features/
      categories/    types.ts  schema.ts  api.ts  category-form-dialog.tsx  categories-page.tsx
      technologies/  types.ts  schema.ts  api.ts  technology-form-dialog.tsx  technologies-page.tsx
      projects/      types.ts  api.ts  projects-page.tsx
      bills/         types.ts  filters.ts  csv.ts  schema.ts  api.ts  add-bill-dialog.tsx  bills-page.tsx
      overview/      summary.ts  overview-page.tsx
apps/core-e2e/src/e2e/  app.cy.ts  visual.cy.ts
json-server/db.json     (bills renamed, ids added, projects seeded)
PRODUCT.md  DESIGN.md   (repo root, written with impeccable)
```

Each task below lists the files it touches, what it consumes from earlier tasks and what it produces for later ones.

---

## Task 1: Foundation and probe

This task answers the four open questions from spec section 5.3 with real builds, and leaves a working empty `core` app if they all pass. Nothing else in the plan starts until it passes.

**Files:**
- Delete: the old webpack `core` sources and config (`apps/core/src/**`, `apps/core/project.json`, `apps/core/jest.config.ts`, `apps/core/webpack.config.js`, `apps/core/tsconfig*.json`)
- Create: `apps/core/project.json`, `vite.config.ts`, `postcss.config.js`, `components.json`, `index.html`, `.eslintrc.json`, `.env.example`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`, `public/favicon.ico` (moved), `src/main.tsx`, `src/styles.css`, `src/test-setup.ts`, `src/lib/utils.ts`, `src/app/app.tsx`, `src/probe.test.tsx` (temporary)
- Modify: `package.json`, `pnpm-lock.yaml`, `apps/external/portfolio/postcss.config.js`, `docs/superpowers/specs/2026-10-14-core-redesign-design.md` (probe result)

**Interfaces:**
- Produces: the `core` Nx project with targets `build`, `serve`, `preview`, `test`, `lint`, `typecheck`, `serve-static`; the `@/` alias for `apps/core/src`; `cn()` in `src/lib/utils.ts`; the test setup that every later test relies on (jest-dom matchers, `ResizeObserver` stub).

- [ ] **Step 1: Record the baseline for the portfolio app**

The portfolio shares the root `package.json`, so first prove it builds today.

Run: `pnpm nx build external--portfolio`
Expected: build succeeds. If it fails before any change, stop and tell the human partner; the probe cannot be judged against a broken baseline.

- [ ] **Step 2: Install dependencies**

```bash
pnpm add react@^19 react-dom@^19 @tanstack/react-query@^5 react-hook-form zod @hookform/resolvers class-variance-authority tailwind-merge@^3 @radix-ui/react-dialog @radix-ui/react-alert-dialog @fontsource-variable/schibsted-grotesk
pnpm add -D @types/react@^19 @types/react-dom@^19 tailwindcss@^4 @tailwindcss/postcss @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event "tailwindcss3@npm:tailwindcss@^3.4.19"
pnpm remove react-query
```

`tailwindcss3` is Tailwind 3 under another name, so the portfolio keeps working while the root `tailwindcss` moves to 4.

- [ ] **Step 3: Point the portfolio at Tailwind 3**

Edit `apps/external/portfolio/postcss.config.js`, changing only the plugin key:

```js
const { join } = require('path');

module.exports = {
  plugins: {
    tailwindcss3: {
      config: join(__dirname, 'tailwind.config.js'),
    },
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Remove the old core app, keeping its favicon**

```bash
mkdir -p apps/core/public
[ -f apps/core/src/favicon.ico ] && git mv apps/core/src/favicon.ico apps/core/public/favicon.ico
git rm -r -q apps/core/src apps/core/project.json apps/core/jest.config.ts apps/core/webpack.config.js apps/core/tsconfig.app.json apps/core/tsconfig.json apps/core/tsconfig.spec.json
git rm -q -f --ignore-unmatch apps/core/.babelrc apps/core/.eslintrc.json
mkdir -p apps/core/src/lib apps/core/src/app
```

- [ ] **Step 5: Create the Nx and Vite configuration**

`apps/core/project.json`:

```json
{
  "name": "core",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/core/src",
  "projectType": "application",
  "tags": [],
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/apps/core",
        "postcssConfig": "apps/core/postcss.config.js"
      },
      "configurations": {
        "development": { "mode": "development" },
        "production": { "mode": "production" }
      }
    },
    "serve": {
      "executor": "@nx/vite:dev-server",
      "defaultConfiguration": "development",
      "options": { "buildTarget": "core:build" },
      "configurations": {
        "development": { "buildTarget": "core:build:development", "hmr": true },
        "production": { "buildTarget": "core:build:production", "hmr": false }
      }
    },
    "preview": {
      "executor": "@nx/vite:preview-server",
      "defaultConfiguration": "development",
      "options": { "buildTarget": "core:build" },
      "configurations": {
        "development": { "buildTarget": "core:build:development" },
        "production": { "buildTarget": "core:build:production" }
      }
    },
    "test": {
      "executor": "@nx/vite:test",
      "outputs": ["coverage/apps/core"],
      "options": {
        "passWithNoTests": true,
        "reportsDirectory": "../../coverage/apps/core"
      }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": { "lintFilePatterns": ["apps/core/**/*.{ts,tsx,js,jsx}"] }
    },
    "typecheck": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsc -p apps/core/tsconfig.app.json --noEmit && tsc -p apps/core/tsconfig.spec.json --noEmit"
      }
    },
    "serve-static": {
      "executor": "@nx/web:file-server",
      "options": { "buildTarget": "core:build" }
    }
  }
}
```

`apps/core/vite.config.ts`:

```ts
/// <reference types="vitest" />
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/core',
  server: { port: 4200, host: 'localhost' },
  preview: { port: 4300, host: 'localhost' },
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  css: { postcss: __dirname },
  build: {
    outDir: '../../dist/apps/core',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
  test: {
    globals: true,
    cache: { dir: '../../node_modules/.vitest' },
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

`apps/core/postcss.config.js`:

```js
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

`apps/core/components.json` (kept so the shadcn CLI can be used later):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

`apps/core/.eslintrc.json`:

```json
{
  "extends": ["plugin:@nx/react", "../../.eslintrc.json"],
  "ignorePatterns": ["!**/*"],
  "overrides": [
    { "files": ["*.ts", "*.tsx", "*.js", "*.jsx"], "rules": {} },
    { "files": ["*.ts", "*.tsx"], "rules": {} },
    { "files": ["*.js", "*.jsx"], "rules": {} }
  ]
}
```

`apps/core/.env.example`:

```
VITE_API_URL=http://localhost:3001
```

`apps/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "allowJs": false,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "isolatedModules": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2020",
    "lib": ["es2020", "dom", "dom.iterable"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vite/client", "vitest"]
  },
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.spec.json" }]
}
```

`apps/core/tsconfig.app.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "types": ["node", "vite/client"]
  },
  "exclude": [
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.tsx",
    "src/**/*.test.tsx",
    "src/test-setup.ts",
    "src/test/**"
  ],
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

`apps/core/tsconfig.spec.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "types": ["vitest/globals", "vitest/importMeta", "vite/client", "node"]
  },
  "include": [
    "vite.config.ts",
    "src/test-setup.ts",
    "src/test/**/*.ts",
    "src/test/**/*.tsx",
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/*.d.ts"
  ]
}
```

- [ ] **Step 6: Create the minimal app and the probe test**

`apps/core/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Octacore</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/core/src/styles.css` (temporary; Task 4 replaces it):

```css
@import 'tailwindcss' source('./');

@theme {
  --color-navy: #0d3a5c;
  --color-grey: #f2f2f0;
}
```

`apps/core/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/schibsted-grotesk';
import './styles.css';
import App from './app/app';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`apps/core/src/app/app.tsx` (temporary; Task 8 replaces it):

```tsx
export default function App() {
  return (
    <main className="min-h-dvh bg-grey p-8 text-navy">
      <h1 className="text-3xl font-semibold">Octacore</h1>
    </main>
  );
}
```

`apps/core/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The app's own font-size tokens (see styles.css) must be known to tailwind-merge,
// or `text-lead` would be read as a colour and dropped next to `text-navy`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['headline', 'title', 'statement', 'lead', 'body', 'small'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

`apps/core/src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
window.HTMLElement.prototype.scrollIntoView ??= () => {};
window.HTMLElement.prototype.hasPointerCapture ??= () => false;
window.HTMLElement.prototype.releasePointerCapture ??= () => {};
```

`apps/core/src/probe.test.tsx` (deleted in Step 11; it proves Radix and cva work on React 19 in this workspace):

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { render, screen } from '@testing-library/react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const box = cva('p-2', { variants: { tone: { navy: 'bg-navy' } } });

describe('foundation probe', () => {
  it('renders a Radix dialog styled through cva and cn on React 19', () => {
    render(
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Content className={cn(box({ tone: 'navy' }), 'text-white')}>
            <Dialog.Title>Probe</Dialog.Title>
            <Dialog.Description>Probe description</Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('bg-navy');
  });

  it('keeps a font-size token next to a colour', () => {
    expect(cn('text-lead text-navy')).toBe('text-lead text-navy');
  });
});
```

- [ ] **Step 7: Gate G2, tests**

Run: `pnpm nx test core`
Expected: both probe tests PASS (Vitest 0.32 with React 19 and Testing Library 16).

- [ ] **Step 8: Gate G1, build**

```bash
pnpm nx build core
grep -c "bg-grey" dist/apps/core/assets/*.css
```
Expected: the build succeeds and the grep prints a count of at least 1, proving Tailwind 4 generated the utilities used in `app.tsx` through the PostCSS plugin.

- [ ] **Step 9: Gate G4, dev server**

```bash
LOG="$(mktemp)"
pnpm nx serve core > "$LOG" 2>&1 &
sleep 10
curl -s http://localhost:4200/ | head -5
curl -s 'http://localhost:4200/src/styles.css?direct' | grep -c "bg-grey"
lsof -ti :4200 | xargs kill
```
Expected: the first curl prints the HTML shell and the second prints a count of at least 1. If the second prints 0, the dev server is not running PostCSS; fix the `css.postcss` setting in `vite.config.ts` before going on.

- [ ] **Step 10: Gates G3, G5 and G6, portfolio, lint and types**

```bash
pnpm nx build external--portfolio
pnpm nx lint core
pnpm nx typecheck core
```
Expected: all three succeed.

If **G1 or G3 fails**: stop. If only G3 fails, ask the human partner whether to migrate the portfolio to Tailwind 4 (`pnpm dlx @tailwindcss/upgrade` run in `apps/external/portfolio`) or take the fallback. If G1 fails, or the partner picks the fallback, the fallback is Tailwind 3.4 with React 18: `pnpm add react@18.2.0 react-dom@18.2.0` and `pnpm add -D @types/react@18.2.14 @types/react-dom@18.2.6 tailwindcss@^3.4.19 autoprefixer`, remove `@tailwindcss/postcss` and `tailwindcss3`, use `{ tailwindcss: {}, autoprefixer: {} }` in `apps/core/postcss.config.js`, use `@tailwind base; @tailwind components; @tailwind utilities;` and a `tailwind.config.js` in `styles.css`, restore the portfolio's `postcss.config.js` key to `tailwindcss`, and use `forwardRef`-based shadcn components. Then Task 4's CSS must be rewritten as a `tailwind.config.js` theme plus CSS variables; do not improvise it, report back and get the rewrite approved first.

- [ ] **Step 11: Remove the probe and record the result in the spec**

```bash
rm apps/core/src/probe.test.tsx
pnpm ls react react-dom tailwindcss @tailwindcss/postcss tailwindcss3 vite @nx/vite vitest @tanstack/react-query zod react-hook-form @hookform/resolvers @radix-ui/react-dialog --depth 0
```

Append this section to `docs/superpowers/specs/2026-10-14-core-redesign-design.md`, filling the versions from the `pnpm ls` output:

```markdown

## 15. Probe result

Run on <date>. All six gates passed with Tailwind 4 and React 19.

| Package | Version |
|---|---|
| react, react-dom | <from pnpm ls> |
| tailwindcss, @tailwindcss/postcss | <from pnpm ls> |
| tailwindcss3 (portfolio alias) | <from pnpm ls> |
| vite, @nx/vite, vitest | <from pnpm ls> |
| @tanstack/react-query, react-hook-form, zod, @hookform/resolvers | <from pnpm ls> |
| @radix-ui/react-dialog | <from pnpm ls> |
```

- [ ] **Step 12: Commit**

```bash
git add apps/core apps/external/portfolio/postcss.config.js package.json pnpm-lock.yaml pnpm-workspace.yaml docs/superpowers/specs/2026-10-14-core-redesign-design.md
git add package-lock.json
git status --short
git commit -m "feat(core): rebuild core as a Vite app on Tailwind 4 and React 19" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Expected: `git status --short` shows only `.agents/` and `skills-lock.json` as untracked.

---

## Task 2: Retire the old apps, libs and dependencies

**Files:**
- Delete: `apps/projects`, `apps/projects-e2e`, `apps/finance`, `apps/finance-e2e`, `libs/constant`, `libs/shared-ui`, `libs/services`
- Modify: `package.json`, `pnpm-lock.yaml`, `tsconfig.base.json`

**Interfaces:**
- Consumes: Task 1's passing `core` project.
- Produces: a workspace containing only `core`, `core-e2e` and the portfolio projects, with no MUI, Vue or webpack dependencies.

- [ ] **Step 1: Delete the retired apps and libs**

```bash
git rm -r -q apps/projects apps/projects-e2e apps/finance apps/finance-e2e libs/constant libs/shared-ui libs/services
rm -rf apps/projects apps/finance libs/constant libs/shared-ui libs/services
```
The `rm -rf` clears leftover untracked directories such as `apps/finance/node_modules`.

- [ ] **Step 2: Remove the now-unused packages**

Remove the root `postinstall` script first. In `package.json`, delete the line:

```json
    "postinstall": "node node_modules/@nx-plus/vue/patch-nx-dep-graph.js",
```
Left in place it runs a file from a package this task removes, and `pnpm install` then fails.

```bash
pnpm remove @date-io/dayjs @emotion/react @emotion/styled @mdi/font @mui/icons-material @mui/material @mui/x-data-grid @vuelidate/core @vuelidate/validators core-js csv-writer formik react-is styled-components vue vue-material-design-icons vue-router vue3-datepicker vuetify yup
pnpm remove @babel/preset-react @nx-plus/vue @nx/webpack @pmmmwh/react-refresh-webpack-plugin @svgr/webpack @types/react-is @types/styled-components @vue/cli-plugin-babel @vue/cli-plugin-typescript @vue/cli-service @vue/compiler-sfc @vue/eslint-config-prettier @vue/eslint-config-typescript @vue/test-utils @vue/vue3-jest babel-plugin-styled-components eslint-plugin-vue jest-serializer-vue react-refresh url-loader
```
Leave the other jest packages, `@nrwl/*` and `@swc/*` alone; nothing in this plan needs them gone. If a gate in Step 4 fails because a package was removed, add that one package back and note why.

- [ ] **Step 3: Remove the dead path aliases**

In `tsconfig.base.json`, delete the whole `"paths": { ... }` block (seven entries, three of which pointed at libs that never existed). The result:

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "rootDir": ".",
    "sourceMap": true,
    "declaration": false,
    "moduleResolution": "node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "es2015",
    "module": "esnext",
    "lib": ["es2020", "dom"],
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "baseUrl": "."
  },
  "exclude": ["node_modules", "tmp"]
}
```

- [ ] **Step 4: Gate, the workspace is whole**

```bash
pnpm install
pnpm nx show projects
grep -rnE "@octacore-frontend/|@mui/|@emotion/|vuetify|formik" apps libs package.json tsconfig.base.json --include='*.ts' --include='*.tsx' --include='*.json' --include='*.vue' -l | grep -v node_modules
pnpm nx run-many -t build lint test typecheck -p core
pnpm nx build external--portfolio
```
Expected: `pnpm install` succeeds; `show projects` lists `core`, `core-e2e` and the portfolio projects only; the grep prints nothing; the run-many and the portfolio build succeed.

- [ ] **Step 5: Commit**

```bash
git add -A apps libs package.json pnpm-lock.yaml tsconfig.base.json
git commit -m "chore: delete the projects and finance apps and the MUI libs" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 3: PRODUCT.md with impeccable `init`

**Files:**
- Create: `PRODUCT.md` (repo root), and `.impeccable/` config if the tool writes one

**Interfaces:**
- Consumes: spec sections 1 to 4 (users, purpose, constraints) and Task 1's stack.
- Produces: the product context that impeccable's later commands (`document`, `critique`, `audit`, `polish`) load.

Impeccable is not an installed plugin. Run it from its marketplace checkout.

- [ ] **Step 1: Load the skill context**

```bash
IMPECCABLE="$HOME/.claude/plugins/marketplaces/impeccable/plugin/skills/impeccable"
"$IMPECCABLE/scripts/impeccable" context
```
Run from the repo root. The launcher may download a binary on first run and ask for permission; that is expected. If it fails, send this message before the next tool call: "Context loading did not run; I'll read the existing project context directly." Then read `$IMPECCABLE/SKILL.md` and continue by hand.

- [ ] **Step 2: Read and follow the init flow**

Read `$IMPECCABLE/SKILL.md` and `$IMPECCABLE/reference/init.md` completely. Follow `init`: it interviews with the question tool and writes only product truth, not a visual world. Use these answers as the starting point and let the human partner correct them:
- Platform: web.
- Stack: Vite, React 19, Tailwind 4, shadcn-structured components, TanStack Query, json-server mock API (versions from the spec's section 15).
- Users: Octalogic staff running the company's internal operations (projects, bills, reference data). Surface mode is Operate.
- Purpose: one place for staff to see what is outstanding, record and export bills, and maintain categories and technologies.
- Constraints: WCAG 2.2 AA; the visual system comes from the octa-website (`../octa-website/DESIGN.md` and `PRODUCT.md`) and is not restated in PRODUCT.md; no auth yet; data is mock until the Nest API is wired.
- Do not ask for or record an aesthetic direction.

- [ ] **Step 3: Check the result**

Run: `grep -nE "^## (Platform|Stack|Users|Product Purpose|Accessibility)" PRODUCT.md`
Expected: all four headings are present, `## Platform` reads `web`, and PRODUCT.md contains no palette, type or component descriptions.

- [ ] **Step 4: Commit**

```bash
git add PRODUCT.md
[ -d .impeccable ] && git add .impeccable
git commit -m "docs(core): add PRODUCT.md for the core app" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Design tokens, base styles and drawn marks

**Files:**
- Replace: `apps/core/src/styles.css`
- Create: `apps/core/src/components/ui/marks.tsx`, `apps/core/src/components/ui/marks.test.tsx`, `apps/core/src/lib/utils.test.ts`, `apps/core/src/design-contract.test.ts`

**Interfaces:**
- Consumes: `cn()` from Task 1.
- Produces: the Tailwind theme (`bg-navy`, `text-navy-80`, `border-rule`, `text-teal`, `bg-scrim`, `text-headline|statement|title|lead|body|small`, `ease-out-quart`), shadcn's semantic classes (`bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `border-input`, `bg-secondary`, `text-muted-foreground`), the `tabular` utility, the `.arm`, `.arm-arrow`, `.cut-br`, `.skip-link` classes and the `.on-navy` logo reversal; and from `marks.tsx`: `Arm`, `ArmArrow`, `CheckMark`, `ChevronDownMark`, `CloseMark`.
- `src/design-contract.test.ts` becomes the standing check for the Global Constraints (no icon libraries, no rounding, no shadows, no red, palette only). Every later task runs it.

- [ ] **Step 1: Write the failing tests**

`apps/core/src/lib/utils.test.ts`:

```ts
import { cn } from './utils';

describe('cn', () => {
  it('keeps a font-size token next to a colour', () => {
    expect(cn('text-lead text-navy')).toBe('text-lead text-navy');
  });

  it('lets the later font-size token win', () => {
    expect(cn('text-lead', 'text-small')).toBe('text-small');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});
```

`apps/core/src/components/ui/marks.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { Arm, ArmArrow, CheckMark, ChevronDownMark, CloseMark } from './marks';

describe('marks', () => {
  it('hides every drawn mark from assistive technology', () => {
    const { container } = render(
      <>
        <Arm />
        <ArmArrow />
        <CheckMark />
        <ChevronDownMark />
        <CloseMark />
      </>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(5);
  });

  it('lets the caller size and colour a mark', () => {
    const { container } = render(<ArmArrow className="size-6 text-teal" />);
    expect(container.querySelector('svg')).toHaveClass('size-6', 'text-teal', 'arm-arrow');
  });
});
```

`apps/core/src/design-contract.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = __dirname;

const PALETTE = [
  '#f2f2f0', '#0d3a5c', '#0a2f4b', '#3f627d', '#4d6e85', '#c4cdd2',
  '#e0e3e4', '#60e4cf', '#ffffff', '#c2ced6', '#2f5672',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const code = files.filter((f) => /\.tsx?$/.test(f.path));
const css = files.filter((f) => f.path.endsWith('.css'));

describe('design contract', () => {
  it('uses no icon or legacy UI libraries', () => {
    const banned = /from ['"](lucide-react|@mui\/[^'"]*|@emotion\/[^'"]*|styled-components|formik|yup)['"]/;
    expect(code.filter((f) => banned.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('rounds no corners', () => {
    const rounded = /(?<![\w-])rounded(?!-none\b)(?:-[\w/[\]]+)?(?![\w])/;
    expect(code.filter((f) => rounded.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('casts no shadows apart from the button seam', () => {
    const hits = code
      .flatMap((f) => (f.text.match(/(?<![\w-])shadow(?:-[^\s'"`]+)?(?![\w])/g) ?? []).map((m) => `${f.path}: ${m}`))
      .filter((hit) => !hit.includes('shadow-[inset_1px_0_0'));
    expect(hits).toEqual([]);
  });

  it('uses no CSS box-shadow or gradients', () => {
    expect(css.filter((f) => /box-shadow|gradient\(/.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('uses no red, rose or pink colour utilities', () => {
    const red = /(?<![\w-])(?:bg|text|border|ring|outline|fill|stroke|decoration)-(?:red|rose|pink)-\d/;
    expect(code.filter((f) => red.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('defines the whole brand palette and a zero radius', () => {
    const styles = css.map((f) => f.text).join('\n').toLowerCase();
    for (const hex of PALETTE) expect(styles).toContain(hex);
    expect(styles).toContain('--radius: 0px');
  });

  it('uses no colour outside the brand palette', () => {
    const stray = [...code, ...css].flatMap((f) =>
      (f.text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])
        .filter((hex) => !PALETTE.includes(hex.toLowerCase()))
        .map((hex) => `${f.path}: ${hex}`),
    );
    expect(stray).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: `marks.test.tsx` FAILS (module not found) and the "defines the whole brand palette" test FAILS (the temporary stylesheet has two colours). `utils.test.ts` already passes.

- [ ] **Step 3: Write the stylesheet**

`apps/core/src/styles.css`:

```css
@import 'tailwindcss' source('./');

/* Metric-matched fallback so the font swap does not shift layout (as on octa-website). */
@font-face {
  font-family: 'Schibsted Fallback';
  src: local('Arial');
  size-adjust: 99%;
  ascent-override: 96%;
  descent-override: 25%;
  line-gap-override: 0%;
}

/* Brand palette, copied from octa-website/src/styles/global.css.
   No colour enters the app that is not navy, teal, grey or a tint of them. */
@theme static {
  --color-grey: #f2f2f0;
  --color-navy: #0d3a5c;
  --color-navy-deep: #0a2f4b;
  --color-navy-80: #3f627d;
  --color-navy-72: #4d6e85;
  --color-rule: #c4cdd2;
  --color-rule-soft: #e0e3e4;
  --color-teal: #60e4cf;
  --color-on-navy: #ffffff;
  --color-on-navy-muted: #c2ced6;
  --color-rule-on-navy: #2f5672;
  --color-scrim: rgb(3 17 29 / 0.45);

  --font-sans: 'Schibsted Grotesk Variable', 'Schibsted Fallback', system-ui, sans-serif;

  /* Type scale, fluid between 360px and 1280px viewports (octa-website). Never below 14px. */
  --text-headline: clamp(1.875rem, 1.6rem + 1.2vw, 2.75rem);
  --text-headline--line-height: 1.1;
  --text-headline--letter-spacing: -0.022em;
  --text-statement: clamp(1.375rem, 1.25rem + 0.55vw, 1.625rem);
  --text-statement--line-height: 1.35;
  --text-statement--letter-spacing: -0.01em;
  --text-title: clamp(1.25rem, 1.15rem + 0.45vw, 1.5rem);
  --text-title--line-height: 1.3;
  --text-title--letter-spacing: -0.005em;
  --text-lead: clamp(1.1875rem, 1.139rem + 0.217vw, 1.3125rem);
  --text-lead--line-height: 1.5;
  --text-body: clamp(1rem, 0.976rem + 0.109vw, 1.0625rem);
  --text-body--line-height: 1.6;
  --text-small: clamp(0.875rem, 0.851rem + 0.109vw, 0.9375rem);
  --text-small--line-height: 1.5;

  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

/* shadcn's semantic variables, mapped onto the palette.
   `accent` is shadcn's hover fill, not teal; teal is `signal`. There is no red: destructive is navy. */
:root {
  --background: var(--color-grey);
  --foreground: var(--color-navy);
  --card: var(--color-grey);
  --card-foreground: var(--color-navy);
  --popover: var(--color-grey);
  --popover-foreground: var(--color-navy);
  --primary: var(--color-navy);
  --primary-foreground: var(--color-on-navy);
  --secondary: var(--color-rule-soft);
  --secondary-foreground: var(--color-navy);
  --muted: var(--color-rule-soft);
  --muted-foreground: var(--color-navy-80);
  --accent: var(--color-rule-soft);
  --accent-foreground: var(--color-navy);
  --destructive: var(--color-navy);
  --border: var(--color-rule);
  --input: var(--color-navy-72);
  --ring: var(--color-navy);
  --radius: 0px;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-signal: var(--color-teal);
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --radius-xl: 0px;
}

@layer base {
  *,
  ::before,
  ::after {
    border-color: var(--color-border);
  }
  html {
    background: var(--color-grey);
    color: var(--color-navy);
    font-family: var(--font-sans);
    -webkit-text-size-adjust: 100%;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    scrollbar-color: var(--color-navy-72) var(--color-rule-soft);
  }
  body {
    min-height: 100dvh;
    font-size: var(--text-body);
    line-height: var(--text-body--line-height);
  }
  h1,
  h2,
  h3,
  h4 {
    font-weight: 600;
    text-wrap: balance;
  }
  p,
  li {
    text-wrap: pretty;
  }
  ::selection {
    background: var(--color-navy);
    color: var(--color-on-navy);
  }
  :focus-visible {
    outline: 2px solid var(--color-navy);
    outline-offset: 3px;
  }
  .on-navy :focus-visible {
    outline-color: var(--color-teal);
  }
  input,
  textarea,
  select {
    caret-color: var(--color-navy);
    accent-color: var(--color-navy);
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    ::before,
    ::after {
      transition: none !important;
      animation: none !important;
      scroll-behavior: auto !important;
    }
  }
}

@layer components {
  /* The arm: a short bar at 45 degrees, the logo's offset arm. It takes the colour it is given. */
  .arm {
    display: inline-block;
    flex: none;
    width: 1rem;
    height: 2px;
    background: currentColor;
    transform: rotate(-45deg);
    transform-origin: left center;
    transition:
      width 220ms var(--ease-out-quart),
      color 220ms var(--ease-out-quart);
  }

  /* The arm that becomes an arrow when its link or button is hovered or focused. */
  .arm-arrow {
    flex: none;
    overflow: visible;
  }
  .arm-arrow__shaft {
    transform-origin: 12px 12px;
    transform: rotate(-45deg) scaleX(0.72);
    transition: transform 320ms var(--ease-out-expo);
  }
  .arm-arrow__head {
    opacity: 0;
    transform: translateX(-4px);
    transition:
      opacity 160ms var(--ease-out-quart),
      transform 320ms var(--ease-out-expo);
  }
  :is(a, button):is(:hover, :focus-visible) .arm-arrow__shaft {
    transform: rotate(0deg) scaleX(1);
  }
  :is(a, button):is(:hover, :focus-visible) .arm-arrow__head {
    opacity: 1;
    transform: translateX(0);
  }

  /* One 45 degree cut at the bottom right, for dialogs sitting on the scrim. */
  .cut-br {
    clip-path: polygon(
      0 0,
      100% 0,
      100% calc(100% - var(--cut, 1.75rem)),
      calc(100% - var(--cut, 1.75rem)) 100%,
      0 100%
    );
  }

  /* The supplied logo on navy: white wordmark and mark, the offset arm keeps its teal. */
  .on-navy .logo .cls-1 {
    fill: var(--color-on-navy);
  }

  .skip-link {
    position: absolute;
    left: 1rem;
    top: -4rem;
    z-index: 60;
    padding: 0.75rem 1rem;
    background: var(--color-navy);
    color: var(--color-on-navy);
    font-weight: 550;
  }
  .skip-link:focus {
    top: 1rem;
  }
}

@utility tabular {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: Write the marks**

`apps/core/src/components/ui/marks.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type SvgProps = Omit<ComponentProps<'svg'>, 'children'>;

/** A short bar at 45 degrees: the logo's offset arm. It rests in the colour it is given. */
export function Arm({ className, ...props }: ComponentProps<'span'>) {
  return <span aria-hidden="true" className={cn('arm', className)} {...props} />;
}

/** The arm that swings into an arrow when its link or button is hovered or focused (see styles.css). */
export function ArmArrow({ className, ...props }: SvgProps) {
  return (
    <svg
      className={cn('arm-arrow', className)}
      width="1.25em"
      height="1.25em"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g className="arm-arrow__shaft">
        <path d="M4 12h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="butt" />
      </g>
      <path
        className="arm-arrow__head"
        d="M14.5 6.5 20 12l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function CheckMark({ className, ...props }: SvgProps) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="M4 12.5 9.5 18 20 6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

export function ChevronDownMark({ className, ...props }: SvgProps) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="m5 9 7 7 7-7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

export function CloseMark({ className, ...props }: SvgProps) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="m5 5 14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}
```

- [ ] **Step 5: Run the tests and the build**

```bash
pnpm nx test core
pnpm nx build core
grep -c "cut-br" dist/apps/core/assets/*.css
```
Expected: all tests PASS, the build succeeds, and the grep prints at least 1.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src
git commit -m "feat(core): add brand tokens, base styles and drawn marks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Form and content primitives

**Files:**
- Create: `apps/core/src/components/ui/{button,label,field,input,textarea,select,badge,table,panel,link-arrow}.tsx` and `apps/core/src/components/ui/primitives.test.tsx`

**Interfaces:**
- Consumes: Task 4's theme classes and marks.
- Produces (exact signatures later tasks rely on):
  - `Button({ variant?: 'primary' | 'quiet', type?, ...button props })` and `buttonVariants`. Default `type="button"`.
  - `Label`, `Field({ label: string, htmlFor: string, error?: string, hint?: string, className?, children })`, `fieldA11y(id: string, error?: string)` returning `{ id, 'aria-invalid', 'aria-describedby' }` to spread onto a control.
  - `Input`, `Textarea`, `Select` (native, with a drawn chevron), `underlineField` (class string), `Badge({ variant?: 'solid' | 'outline' })`.
  - `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`.
  - `Panel({ cut?: string })` (framed panel on the grey ground), `LinkArrow` (a router `Link` with an arm arrow).

- [ ] **Step 1: Write the failing tests**

`apps/core/src/components/ui/primitives.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Badge } from './badge';
import { Button } from './button';
import { Field, fieldA11y } from './field';
import { Input } from './input';
import { LinkArrow } from './link-arrow';
import { Panel } from './panel';
import { Select } from './select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Textarea } from './textarea';

describe('Button', () => {
  it('renders its label with a decorative arm cell', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('does not submit a form unless it is a submit button', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Plain</Button>
        <Button type="submit">Send</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Plain' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('has no arm cell in the quiet variant', () => {
    render(<Button variant="quiet">Edit</Button>);
    expect(screen.getByRole('button', { name: 'Edit' }).querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('cannot be clicked while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('links the label to the control', () => {
    render(
      <Field label="Name" htmlFor="name">
        <Input id="name" />
      </Field>,
    );
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('announces an error and points the control at it', () => {
    render(
      <Field label="Name" htmlFor="name" error="Name is required">
        <Input {...fieldA11y('name', 'Name is required')} />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'name-error');
  });

  it('shows the hint only while there is no error', () => {
    const { rerender } = render(
      <Field label="Phone" htmlFor="phone" hint="If you would rather we call.">
        <Input id="phone" />
      </Field>,
    );
    expect(screen.getByText('If you would rather we call.')).toBeInTheDocument();
    rerender(
      <Field label="Phone" htmlFor="phone" hint="If you would rather we call." error="Too short">
        <Input id="phone" />
      </Field>,
    );
    expect(screen.queryByText('If you would rather we call.')).not.toBeInTheDocument();
  });

  it('gives fieldA11y no error attributes when valid', () => {
    expect(fieldA11y('x')).toEqual({ id: 'x', 'aria-invalid': undefined, 'aria-describedby': undefined });
  });
});

describe('Textarea and Select', () => {
  it('accept typing and selection', async () => {
    render(
      <>
        <Textarea aria-label="Notes" />
        <Select aria-label="Type">
          <option value="a">A</option>
          <option value="b">B</option>
        </Select>
      </>,
    );
    await userEvent.type(screen.getByLabelText('Notes'), 'hello');
    expect(screen.getByLabelText('Notes')).toHaveValue('hello');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'b');
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveValue('b');
  });
});

describe('Badge', () => {
  it('is navy filled by default and outlined on request', () => {
    render(
      <>
        <Badge>Approved</Badge>
        <Badge variant="outline">Pending</Badge>
      </>,
    );
    expect(screen.getByText('Approved')).toHaveClass('bg-navy');
    expect(screen.getByText('Pending')).toHaveClass('border-navy');
    expect(screen.getByText('Pending')).not.toHaveClass('bg-navy');
  });
});

describe('Table', () => {
  it('renders column headers and cells', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Web</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Web' })).toBeInTheDocument();
  });
});

describe('Panel', () => {
  it('shows its content and draws the cut corner as a decorative svg', () => {
    const { container } = render(<Panel>Inside</Panel>);
    expect(screen.getByText('Inside')).toBeInTheDocument();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('LinkArrow', () => {
  it('is a link with the arm arrow', () => {
    render(
      <MemoryRouter>
        <LinkArrow to="/projects">All projects</LinkArrow>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'All projects' });
    expect(link).toHaveAttribute('href', '/projects');
    expect(link.querySelector('.arm-arrow')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: `primitives.test.tsx` FAILS with "Failed to resolve import './badge'" (and the others).

- [ ] **Step 3: Write the components**

`apps/core/src/components/ui/button.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ArmArrow } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'group/button inline-flex font-semibold leading-tight select-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'min-h-[3.25rem] items-stretch bg-primary text-primary-foreground',
        quiet:
          'min-h-11 items-center px-3 text-foreground decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

/** A label and a square arm cell; the arm does the signalling. One primary button per screen. */
export function Button({ className, variant, type = 'button', children, ...props }: ButtonProps) {
  return (
    <button data-slot="button" type={type} className={cn(buttonVariants({ variant }), className)} {...props}>
      {variant === 'quiet' ? (
        children
      ) : (
        <>
          <span className="flex items-center px-[1.4rem] py-3">{children}</span>
          <span
            aria-hidden="true"
            className="grid w-[3.25rem] flex-none place-items-center bg-navy-deep text-teal shadow-[inset_1px_0_0_rgb(255_255_255/0.08)] transition-colors duration-200 ease-out-quart group-hover/button:bg-teal group-hover/button:text-navy group-focus-visible/button:bg-teal group-focus-visible/button:text-navy"
          >
            <ArmArrow className="size-[1.6rem]" />
          </span>
        </>
      )}
    </button>
  );
}
```

`apps/core/src/components/ui/label.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { Arm } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

/** A field label led by the arm; the arm lengthens and turns teal while the field has focus. */
export function Label({ className, children, ...props }: ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn('flex min-h-6 items-center gap-2 text-small font-semibold text-foreground', className)}
      {...props}
    >
      <Arm className="w-3 text-rule group-focus-within/field:w-4 group-focus-within/field:text-teal" />
      {children}
    </label>
  );
}
```

`apps/core/src/components/ui/field.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Arm } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** A label, a control and its message. Errors are navy with an arm, never red. */
export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div data-slot="field" className={cn('group/field grid gap-1', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-start gap-2 text-small text-foreground">
          <Arm className="mt-[0.85em] w-3 text-foreground" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-small text-navy-72">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Spread onto a control so it is linked to its error message. */
export function fieldA11y(id: string, error?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  } as const;
}
```

`apps/core/src/components/ui/input.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** The website's underline field: a 1px rule that firms to 3px on focus, with padding compensating so nothing moves. */
export const underlineField = cn(
  'block w-full min-h-12 bg-transparent px-0 pt-1 pb-[calc(0.25rem+2px)] text-lead text-foreground placeholder:text-navy-72',
  'rounded-none border-0 border-b border-input outline-none transition-colors',
  'hover:border-foreground focus:border-b-[3px] focus:border-foreground focus:pb-1 focus-visible:outline-none',
  'aria-invalid:border-b-2 aria-invalid:border-foreground aria-invalid:pb-[calc(0.25rem+1px)]',
  'disabled:opacity-50',
);

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" type={type} className={cn(underlineField, className)} {...props} />;
}
```

`apps/core/src/components/ui/textarea.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { underlineField } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(underlineField, 'min-h-28 resize-y', className)} {...props} />;
}
```

`apps/core/src/components/ui/select.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { underlineField } from '@/components/ui/input';
import { ChevronDownMark } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

/** A native select (best on phones and for keyboards) with the website's underline field and a drawn chevron. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select data-slot="select" className={cn(underlineField, 'appearance-none pr-8', className)} {...props}>
        {children}
      </select>
      <ChevronDownMark className="pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2 text-foreground" />
    </div>
  );
}
```

`apps/core/src/components/ui/badge.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex min-h-7 items-center px-2.5 text-small font-semibold', {
  variants: {
    variant: {
      solid: 'bg-navy text-on-navy',
      outline: 'border border-navy text-navy',
    },
  },
  defaultVariants: { variant: 'solid' },
});

/** Status is carried by the word and by fill versus outline, never by colour alone. */
export function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

`apps/core/src/components/ui/table.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn('w-full min-w-[40rem] border-collapse text-left text-small', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('border-b border-navy', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn('border-b border-rule last:border-b-0 hover:bg-secondary', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn('whitespace-nowrap px-4 py-3 font-semibold text-navy-80', className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('px-4 py-3 align-middle', className)} {...props} />;
}
```

`apps/core/src/components/ui/panel.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * The website's framed panel: the page grey, a real 1px navy frame, one 45 degree cut at the bottom right.
 * The cut is a small svg over the corner (a grey triangle plus a 1px navy diagonal), not a clip-path,
 * so all four sides weigh the same. Use it on the grey page ground only; dialogs use `cut-br`.
 */
export function Panel({ className, cut = '1.75rem', children, ...props }: ComponentProps<'div'> & { cut?: string }) {
  return (
    <div data-slot="panel" className={cn('relative border border-navy bg-background', className)} {...props}>
      {children}
      <svg
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute -bottom-px -right-px"
        style={{ width: `calc(${cut} + 1px)`, height: `calc(${cut} + 1px)` }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon points="100,0 100,100 0,100" fill="var(--color-grey)" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="var(--color-navy)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
```

`apps/core/src/components/ui/link-arrow.tsx`:

```tsx
import { Link, type LinkProps } from 'react-router-dom';
import { ArmArrow } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

/** A section's onward link: the label, then the arm that swings into an arrow on hover and focus. */
export function LinkArrow({ className, children, ...props }: LinkProps) {
  return (
    <Link
      className={cn('inline-flex min-h-11 items-center gap-[0.55em] font-semibold text-foreground', className)}
      {...props}
    >
      {children}
      <ArmArrow className="size-[1.35em]" />
    </Link>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm nx test core`
Expected: all tests PASS, including the design contract.

- [ ] **Step 5: Lint and typecheck**

Run: `pnpm nx run-many -t lint typecheck -p core`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src
git commit -m "feat(core): add button, field, table, panel and badge primitives" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Overlays (dialog, confirm dialog, sheet)

**Files:**
- Create: `apps/core/src/components/ui/{dialog,confirm-dialog,sheet}.tsx` and `apps/core/src/components/ui/overlays.test.tsx`

**Interfaces:**
- Consumes: `Button`, `buttonVariants` (Task 5), `CloseMark` (Task 4).
- Produces:
  - `Dialog` (Radix root), `DialogContent`, `DialogTitle`, `DialogDescription`. A dialog is controlled with `open` and `onOpenChange`.
  - `ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm: () => Promise<void> })`. It closes after `onConfirm` resolves; if it rejects it stays open and shows an alert. It disables its buttons while pending.
  - `Sheet` (Radix root) and `SheetContent({ title: string, ... })`, a navy left panel whose title is for screen readers only.

- [ ] **Step 1: Write the failing tests**

`apps/core/src/components/ui/overlays.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';
import { Sheet, SheetContent } from './sheet';

describe('Dialog', () => {
  it('is named by its title, described, and closes on Escape', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>Give it a name.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'New category' });
    expect(dialog).toHaveAccessibleDescription('Give it a name.');
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('has a 44px close button with an accessible name', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Text</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass('size-11');
    await userEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('ConfirmDialog', () => {
  function setup(onConfirm: () => Promise<void>) {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete category “Web”?"
        description="This cannot be undone."
        confirmLabel="Delete category"
        onConfirm={onConfirm}
      />,
    );
    return onOpenChange;
  }

  it('shows the explicit wording', () => {
    setup(vi.fn().mockResolvedValue(undefined));
    expect(screen.getByRole('alertdialog', { name: 'Delete category “Web”?' })).toHaveAccessibleDescription(
      'This cannot be undone.',
    );
  });

  it('confirms, then closes', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = setup(onConfirm);
    await userEvent.click(screen.getByRole('button', { name: 'Delete category' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('stays open and says so when the action fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('network'));
    const onOpenChange = setup(onConfirm);
    await userEvent.click(screen.getByRole('button', { name: 'Delete category' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'Delete category' })).toBeEnabled();
  });

  it('cancels without confirming', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = setup(onConfirm);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('Sheet', () => {
  it('opens with a screen-reader title and a close button', () => {
    render(
      <Sheet open>
        <SheetContent title="Menu">
          <p>Links</p>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: `overlays.test.tsx` FAILS with "Failed to resolve import './confirm-dialog'".

- [ ] **Step 3: Write the components**

`apps/core/src/components/ui/dialog.tsx`:

```tsx
import type { ComponentProps } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CloseMark } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;

/** A grey object on the scrim with the website's one 45 degree cut at the bottom right. */
export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-50 bg-scrim" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'cut-br fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-background p-6 [--cut:1.75rem] sm:p-8',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-2 top-2 grid size-11 place-items-center text-foreground"
        >
          <CloseMark className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('pr-10 text-title font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('mt-2 text-body text-navy-80', className)}
      {...props}
    />
  );
}
```

`apps/core/src/components/ui/confirm-dialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

/** Destructive actions ask with explicit wording and a navy button, never red. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (open) {
      setPending(false);
      setFailed(false);
    }
  }, [open]);

  async function confirm() {
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <AlertDialog.Content className="cut-br fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 bg-background p-6 [--cut:1.75rem] sm:p-8">
          <AlertDialog.Title className="text-title font-semibold text-foreground">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-body text-navy-80">{description}</AlertDialog.Description>
          {failed ? (
            <p role="alert" className="mt-4 text-small font-semibold text-foreground">
              That did not work. Try again.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={confirm} disabled={pending}>
              {confirmLabel}
            </Button>
            <AlertDialog.Cancel className={buttonVariants({ variant: 'quiet' })} disabled={pending}>
              Cancel
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
```

`apps/core/src/components/ui/sheet.tsx`:

```tsx
import type { ComponentProps } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CloseMark } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

export const Sheet = DialogPrimitive.Root;

/** A navy panel from the left edge, for the phone and tablet menu. The title is for screen readers. */
export function SheetContent({
  className,
  children,
  title,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="sheet-overlay" className="fixed inset-0 z-50 bg-scrim" />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        aria-describedby={undefined}
        className={cn(
          'on-navy fixed inset-y-0 left-0 z-50 flex w-[min(22rem,100%)] flex-col overflow-y-auto bg-navy text-on-navy',
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {children}
        <DialogPrimitive.Close
          aria-label="Close menu"
          className="absolute right-2 top-2 grid size-11 place-items-center text-on-navy"
        >
          <CloseMark className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm nx test core`
Expected: all tests PASS. If a Radix warning about a missing `Description` appears for `ConfirmDialog` or `Dialog`, that is a real bug: every dialog needs a description.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src
git commit -m "feat(core): add dialog, confirm dialog and sheet" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Data layer and shared helpers

**Files:**
- Create: `apps/core/src/lib/{api,query-client,format,filter}.ts`, `apps/core/src/lib/format.test.ts`, `apps/core/src/lib/filter.test.ts`, `apps/core/src/hooks/use-paged-rows.ts`, `apps/core/src/hooks/use-paged-rows.test.ts`, `apps/core/src/test/utils.tsx`
- Modify: `json-server/db.json`

**Interfaces:**
- Produces:
  - `api` (an axios instance) from `@/lib/api`. `queryClient` from `@/lib/query-client`.
  - `formatCurrency(amount: number): string`, `formatDate(iso: string): string`, `today(): string`, `pluralize(count: number, singular: string, plural?: string): string`.
  - `filterBy<T>(rows: T[], query: string, keys: (keyof T)[]): T[]`.
  - `usePagedRows<T>(rows: readonly T[], initialPageSize?: number)` returning `{ page, pageSize, pageCount, pageRows, total, setPage(n), setPageSize(n) }`. `page` is clamped to the last page.
  - `renderWithProviders(ui, { route? })` from `@/test/utils`, returning the Testing Library result plus `client`.
  - json-server collections `categories`, `technologies`, `projects`, `bills`.

- [ ] **Step 1: Write the failing tests**

`apps/core/src/lib/format.test.ts`:

```ts
import { formatCurrency, formatDate, pluralize, today } from './format';

describe('formatCurrency', () => {
  it('drops the cents on whole amounts', () => {
    expect(formatCurrency(5600)).toBe('$5,600');
    expect(formatCurrency(0)).toBe('$0');
  });

  it('keeps two decimals otherwise', () => {
    expect(formatCurrency(12.5)).toBe('$12.50');
  });
});

describe('formatDate', () => {
  it('formats an ISO date without shifting the day', () => {
    expect(formatDate('2023-07-25')).toBe('25 Jul 2023');
  });

  it('returns what it cannot read, untouched', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('nonsense')).toBe('nonsense');
  });
});

describe('today', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is the local date as YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 5, 12));
    expect(today()).toBe('2024-01-05');
  });
});

describe('pluralize', () => {
  it('counts one, none and many', () => {
    expect(pluralize(1, 'project')).toBe('1 project');
    expect(pluralize(0, 'project')).toBe('0 projects');
    expect(pluralize(3, 'bill')).toBe('3 bills');
    expect(pluralize(2, 'category', 'categories')).toBe('2 categories');
  });
});
```

`apps/core/src/lib/filter.test.ts`:

```ts
import { filterBy } from './filter';

const rows = [
  { id: 1, name: 'Web', description: 'Websites and portals' },
  { id: 2, name: 'Mobile', description: 'Phone apps' },
];

describe('filterBy', () => {
  it('returns every row for a blank query', () => {
    expect(filterBy(rows, '', ['name'])).toEqual(rows);
    expect(filterBy(rows, '   ', ['name'])).toEqual(rows);
  });

  it('matches case-insensitively on any of the keys', () => {
    expect(filterBy(rows, 'PHONE', ['name', 'description'])).toEqual([rows[1]]);
    expect(filterBy(rows, 'web', ['name'])).toEqual([rows[0]]);
  });

  it('does not look at keys it was not given', () => {
    expect(filterBy(rows, 'phone', ['name'])).toEqual([]);
  });

  it('treats a missing value as empty text', () => {
    expect(filterBy([{ name: undefined }], 'x', ['name'])).toEqual([]);
  });
});
```

`apps/core/src/hooks/use-paged-rows.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { usePagedRows } from './use-paged-rows';

const rows = Array.from({ length: 12 }, (_, index) => index + 1);

describe('usePagedRows', () => {
  it('slices the current page', () => {
    const { result } = renderHook(() => usePagedRows(rows, 5));
    expect(result.current.pageRows).toEqual([1, 2, 3, 4, 5]);
    expect(result.current.pageCount).toBe(3);
    act(() => result.current.setPage(2));
    expect(result.current.pageRows).toEqual([11, 12]);
    expect(result.current.total).toBe(12);
  });

  it('clamps to the last page when the rows shrink under it', () => {
    const { result, rerender } = renderHook(({ data }) => usePagedRows(data, 5), { initialProps: { data: rows } });
    act(() => result.current.setPage(2));
    rerender({ data: rows.slice(0, 10) });
    expect(result.current.page).toBe(1);
    expect(result.current.pageRows).toEqual([6, 7, 8, 9, 10]);
  });

  it('goes back to the first page when the page size changes', () => {
    const { result } = renderHook(() => usePagedRows(rows, 5));
    act(() => result.current.setPage(2));
    act(() => result.current.setPageSize(10));
    expect(result.current.page).toBe(0);
    expect(result.current.pageRows).toHaveLength(10);
  });

  it('has one empty page when there are no rows', () => {
    const { result } = renderHook(() => usePagedRows([], 5));
    expect(result.current.pageCount).toBe(1);
    expect(result.current.page).toBe(0);
    expect(result.current.pageRows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: the three new test files FAIL with "Failed to resolve import".

- [ ] **Step 3: Write the helpers**

`apps/core/src/lib/format.ts`:

```ts
export function formatCurrency(amount: number): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Formats `YYYY-MM-DD` from the parts, so the day never shifts with the time zone. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return shortDate.format(new Date(Number(year), Number(month) - 1, Number(day)));
}

/** The local date as `YYYY-MM-DD`; json-server does not stamp `created` and `updated` itself. */
export function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
```

`apps/core/src/lib/filter.ts`:

```ts
/** Case-insensitive substring search across the given keys. A blank query keeps every row. */
export function filterBy<T>(rows: T[], query: string, keys: (keyof T)[]): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => keys.some((key) => String(row[key] ?? '').toLowerCase().includes(needle)));
}
```

`apps/core/src/hooks/use-paged-rows.ts`:

```ts
import { useMemo, useState } from 'react';

/** Client-side paging. The page is clamped, so rows disappearing never strands the table past its end. */
export function usePagedRows<T>(rows: readonly T[], initialPageSize = 5) {
  const [requestedPage, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, pageCount - 1);
  const pageRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  function setPageSize(size: number) {
    setPageSizeState(size);
    setPage(0);
  }

  return { page, pageSize, pageCount, pageRows, total: rows.length, setPage, setPageSize };
}
```

`apps/core/src/lib/api.ts`:

```ts
import axios from 'axios';

/** The one place that knows where the data lives. json-server today, the Nest core-service later. */
export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001',
});
```

`apps/core/src/lib/query-client.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
});
```

`apps/core/src/test/utils.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

/** Renders with a fresh query client (no retries) and a router, so pages can be tested whole. */
export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}
```

- [ ] **Step 4: Update the mock database**

Rename `getBills` to `bills`, give every bill an `id` (json-server needs one to find a row), and seed `projects` in the shape of the Nest `Project` entity. Run from the repo root:

```bash
node --input-type=module -e "
import fs from 'node:fs';
const file = 'json-server/db.json';
const db = JSON.parse(fs.readFileSync(file, 'utf8'));
if (db.getBills) {
  db.bills = db.getBills.map((bill, index) => ({ id: index + 1, ...bill }));
  delete db.getBills;
}
db.projects ??= [
  { id: 1, name: 'Project 1', description: 'anything project-1', client: 'Client A', totalValue: 48000, totalOutstanding: 12000 },
  { id: 2, name: 'Project 2', description: 'anything project-2', client: 'Client B', totalValue: 32000, totalOutstanding: 0 },
  { id: 3, name: 'Project 3', description: 'anything project-3', client: 'Client A', totalValue: 75000, totalOutstanding: 25000 },
  { id: 4, name: 'Project 4', description: 'anything project-4', client: 'Client C', totalValue: 18000, totalOutstanding: 4500 },
  { id: 5, name: 'Project 5', description: 'anything project-5', client: 'Client D', totalValue: 62000, totalOutstanding: 31000 },
  { id: 6, name: 'Project 6', description: 'anything project-6', client: 'Client B', totalValue: 27000, totalOutstanding: 9000 },
  { id: 7, name: 'Project 7', description: 'anything project-7', client: 'Client E', totalValue: 41000, totalOutstanding: 0 },
  { id: 8, name: 'Project 8', description: 'anything project-8', client: 'Client C', totalValue: 54000, totalOutstanding: 18000 },
];
fs.writeFileSync(file, JSON.stringify(db, null, 2) + '\n');
"
node -e "const d = require('./json-server/db.json'); console.log(Object.keys(d).join(','), d.bills.length, d.bills[0].id, d.projects.length)"
```
Expected output: `technologies,categories,bills,projects 9 1 8`.

- [ ] **Step 5: Run the tests and the checks**

Run: `pnpm nx run-many -t test lint typecheck -p core`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src json-server/db.json
git commit -m "feat(core): add data layer helpers, paging hook and seeded mock data" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Shared page parts

**Files:**
- Create: `apps/core/src/components/{page-header,search-field,query-boundary,table-pager}.tsx` and `apps/core/src/components/page-parts.test.tsx`

**Interfaces:**
- Consumes: `Button`, `Field`, `Input`, `Select` (Task 5).
- Produces:
  - `PageHeader({ title: string, children? })`: the page `h1` with its actions on the same line.
  - `SearchField({ id, label, value, onChange: (value: string) => void, className? })`.
  - `QueryBoundary({ isLoading, isError, onRetry, isEmpty, empty: ReactNode, children })`: renders a loading status, an error with a Try again button, the `empty` node, or the children, in that order.
  - `TablePager({ page, pageCount, pageSize, total, onPageChange(n), onPageSizeChange(n), pageSizes? })`.

- [ ] **Step 1: Write the failing tests**

`apps/core/src/components/page-parts.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageHeader } from './page-header';
import { QueryBoundary } from './query-boundary';
import { SearchField } from './search-field';
import { TablePager } from './table-pager';

describe('PageHeader', () => {
  it('has one h1 and its actions beside it', () => {
    render(
      <PageHeader title="Categories">
        <button type="button">Add</button>
      </PageHeader>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('SearchField', () => {
  it('reports what is typed', async () => {
    const onChange = vi.fn();
    render(<SearchField id="s" label="Search items" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Search items'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

describe('QueryBoundary', () => {
  const base = { isLoading: false, isError: false, onRetry: vi.fn(), isEmpty: false, empty: <p>Nothing here</p> };

  it('shows a loading status first', () => {
    render(
      <QueryBoundary {...base} isLoading isError>
        <p>Rows</p>
      </QueryBoundary>,
    );
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Rows')).not.toBeInTheDocument();
  });

  it('shows an error with a retry, never a blank panel', async () => {
    const onRetry = vi.fn();
    render(
      <QueryBoundary {...base} isError onRetry={onRetry}>
        <p>Rows</p>
      </QueryBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load this data');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state', () => {
    render(
      <QueryBoundary {...base} isEmpty>
        <p>Rows</p>
      </QueryBoundary>,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByText('Rows')).not.toBeInTheDocument();
  });

  it('shows the children otherwise', () => {
    render(
      <QueryBoundary {...base}>
        <p>Rows</p>
      </QueryBoundary>,
    );
    expect(screen.getByText('Rows')).toBeInTheDocument();
  });
});

describe('TablePager', () => {
  const props = { page: 0, pageCount: 3, pageSize: 5, total: 12, onPageChange: vi.fn(), onPageSizeChange: vi.fn() };

  it('reports the visible range', () => {
    render(<TablePager {...props} />);
    expect(screen.getByText('1–5 of 12')).toBeInTheDocument();
  });

  it('cannot go before the first page', () => {
    render(<TablePager {...props} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('cannot go past the last page and reports a short last range', () => {
    render(<TablePager {...props} page={2} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
  });

  it('reports 0–0 for an empty table', () => {
    render(<TablePager {...props} page={0} pageCount={1} total={0} />);
    expect(screen.getByText('0–0 of 0')).toBeInTheDocument();
  });

  it('changes page and page size', async () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(<TablePager {...props} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '10');
    expect(onPageSizeChange).toHaveBeenCalledWith(10);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: `page-parts.test.tsx` FAILS with "Failed to resolve import './page-header'".

- [ ] **Step 3: Write the components**

`apps/core/src/components/page-header.tsx`:

```tsx
import type { ReactNode } from 'react';

/** The page's h1 and its actions on one line, the actions wrapping beneath on narrow screens. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <h1 className="text-headline font-semibold text-foreground">{title}</h1>
      {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
    </header>
  );
}
```

`apps/core/src/components/search-field.tsx`:

```tsx
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SearchField({ id, label, value, onChange, className }: SearchFieldProps) {
  return (
    <Field label={label} htmlFor={id} className={cn('w-full sm:max-w-xs', className)}>
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search…"
        autoComplete="off"
      />
    </Field>
  );
}
```

`apps/core/src/components/query-boundary.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface QueryBoundaryProps {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isEmpty: boolean;
  empty: ReactNode;
  children: ReactNode;
}

function LoadingRows() {
  return (
    <div role="status" aria-label="Loading" className="grid gap-px p-4">
      <span className="sr-only">Loading</span>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-11 bg-secondary" />
      ))}
    </div>
  );
}

/** Every data view passes through here, so a failed or empty request is never a blank panel. */
export function QueryBoundary({ isLoading, isError, onRetry, isEmpty, empty, children }: QueryBoundaryProps) {
  if (isLoading) return <LoadingRows />;
  if (isError) {
    return (
      <div role="alert" className="grid justify-items-start gap-2 p-6">
        <p className="text-body">We could not load this data. Check that the API is running, then try again.</p>
        <Button variant="quiet" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (isEmpty) return <div className="p-6">{empty}</div>;
  return <>{children}</>;
}
```

`apps/core/src/components/table-pager.tsx`:

```tsx
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface TablePagerProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizes?: number[];
}

export function TablePager({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [5, 10, 20],
}: TablePagerProps) {
  const id = useId();
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-rule px-4 py-2 text-small">
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="font-semibold">
          Rows per page
        </label>
        <div className="w-20">
          <Select
            id={id}
            className="min-h-11"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p aria-live="polite" className="tabular">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center">
        <Button variant="quiet" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="quiet" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm nx run-many -t test lint typecheck -p core`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src
git commit -m "feat(core): add page header, search, query boundary and pager" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 9: App shell and navigation

**Files:**
- Create: `apps/core/src/assets/brand/{logo,logo-mark}.svg` (copied), `apps/core/src/components/logo.tsx`, `apps/core/src/app/{nav.ts,sidebar-nav.tsx,app-shell.tsx,not-found-page.tsx,page-stub.tsx,app.test.tsx}`
- Replace: `apps/core/src/app/app.tsx`, `apps/core/src/main.tsx`

**Interfaces:**
- Consumes: `Sheet`, `SheetContent` (Task 6), `PageHeader` (Task 8), `LinkArrow`, `Arm` (Tasks 4 and 5), `queryClient` (Task 7).
- Produces:
  - `NAV_GROUPS: NavGroup[]` from `@/app/nav` (`{ label, items: { label, to, end? }[] }`).
  - `Logo({ height?, className? })` and `LogoMark({ height?, className? })` from `@/components/logo`.
  - The route table in `App`. Pages are temporary `PageStub` elements here; Tasks 10 to 15 replace them one by one, and Task 15 deletes `page-stub.tsx`.

- [ ] **Step 1: Copy the supplied logo, unmodified**

```bash
mkdir -p apps/core/src/assets/brand
cp ../octa-website/src/assets/brand/logo.svg apps/core/src/assets/brand/logo.svg
cp ../octa-website/src/assets/brand/logo-mark.svg apps/core/src/assets/brand/logo-mark.svg
```

- [ ] **Step 2: Write the failing tests**

`apps/core/src/app/app.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './app';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

function renderAt(route: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App shell', () => {
  it('lists every page in three groups', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const label of ['Overview', 'Projects', 'Receipts and bills', 'Categories', 'Technologies']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    for (const group of ['Work', 'Finance', 'Reference data']) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
  });

  it('marks only the current page', () => {
    renderAt('/projects');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it.each([
    ['/', 'Overview'],
    ['/projects', 'Projects'],
    ['/finance/receipts-bills', 'Receipts and bills'],
    ['/categories', 'Categories'],
    ['/technologies', 'Technologies'],
  ])('shows the page title for %s', (route, title) => {
    renderAt(route);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('shows a not-found page inside the shell', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Overview' })).toHaveAttribute('href', '/');
  });

  it('offers a skip link to the main content', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('links the logo to the overview', () => {
    renderAt('/categories');
    for (const link of screen.getAllByRole('link', { name: 'Octalogic Tech home' })) {
      expect(link).toHaveAttribute('href', '/');
    }
  });

  it('opens the menu sheet and closes it after navigating', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Menu' });
    await user.click(within(sheet).getByRole('link', { name: 'Categories' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Categories' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: `app.test.tsx` FAILS (the temporary `App` has no navigation).

- [ ] **Step 4: Write the shell**

`apps/core/src/app/nav.ts`:

```ts
export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { label: 'Overview', to: '/', end: true },
      { label: 'Projects', to: '/projects' },
    ],
  },
  {
    label: 'Finance',
    items: [{ label: 'Receipts and bills', to: '/finance/receipts-bills' }],
  },
  {
    label: 'Reference data',
    items: [
      { label: 'Categories', to: '/categories' },
      { label: 'Technologies', to: '/technologies' },
    ],
  },
];
```

`apps/core/src/components/logo.tsx`:

```tsx
import logoSvg from '@/assets/brand/logo.svg?raw';
import markSvg from '@/assets/brand/logo-mark.svg?raw';
import { cn } from '@/lib/utils';

// The supplied SVGs, inlined. Never redraw or recolour: on navy the stylesheet applies the approved
// reversal (white wordmark and mark, the offset arm keeps its teal). The artwork is a trusted repo asset.
const clean = (svg: string) => svg.replace(/<\?xml[^>]*>\s*/, '').replace(/\s(id|data-name)="[^"]*"/g, '');

interface LogoProps {
  /** Rendered height in px of the artwork. */
  height?: number;
  className?: string;
}

const LOCKUP_ASPECT = 2711.13 / 563.93;
const MARK_ASPECT = 569.93 / 566.6;

export function Logo({ height = 32, className }: LogoProps) {
  const svg = clean(logoSvg).replace(
    '<svg ',
    `<svg aria-hidden="true" focusable="false" height="${height}" width="${Math.round(height * LOCKUP_ASPECT)}" `,
  );
  return <span className={cn('logo inline-flex leading-[0]', className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function LogoMark({ height = 32, className }: LogoProps) {
  const svg = clean(markSvg).replace(
    '<svg ',
    `<svg aria-hidden="true" focusable="false" height="${height}" width="${Math.round(height * MARK_ASPECT)}" `,
  );
  return <span className={cn('logo inline-flex leading-[0]', className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

`apps/core/src/app/sidebar-nav.tsx`:

```tsx
import { Link, NavLink } from 'react-router-dom';
import { NAV_GROUPS } from '@/app/nav';
import { Logo } from '@/components/logo';
import { Arm } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

/** The one navigation: the logo, then three groups of text links. The current page carries a teal arm. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-8 px-6 py-8">
      <Link to="/" onClick={onNavigate} aria-label="Octalogic Tech home" className="inline-flex min-h-11 items-center">
        <Logo height={30} />
      </Link>
      {NAV_GROUPS.map((group, index) => {
        const headingId = `nav-group-${index}`;
        return (
          <div key={group.label}>
            <p id={headingId} className="mb-1 text-small font-semibold uppercase tracking-[0.08em] text-on-navy-muted">
              {group.label}
            </p>
            <ul aria-labelledby={headingId}>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group/nav flex min-h-11 items-center gap-3 px-1 text-body font-medium transition-colors',
                        isActive ? 'text-on-navy' : 'text-on-navy-muted hover:text-on-navy',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Arm
                          className={
                            isActive
                              ? 'w-4 text-teal'
                              : 'w-3 text-rule-on-navy group-hover/nav:w-4 group-hover/nav:text-teal'
                          }
                        />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
```

`apps/core/src/app/app-shell.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { SidebarNav } from '@/app/sidebar-nav';
import { Logo, LogoMark } from '@/components/logo';
import { Sheet, SheetContent } from '@/components/ui/sheet';

/** A navy sidebar from 1024px; below that a header with a menu button that opens the same navigation in a sheet. */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="on-navy hidden bg-navy text-on-navy lg:block">
        <div className="sticky top-0 h-dvh overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-rule px-5 md:px-8 lg:hidden">
          <Link to="/" aria-label="Octalogic Tech home" className="inline-flex min-h-11 items-center">
            <Logo height={30} className="hidden sm:inline-flex" />
            <LogoMark height={34} className="sm:hidden" />
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="grid size-11 place-content-center gap-1.5 bg-navy"
          >
            <span aria-hidden="true" className="block h-0.5 w-5 bg-on-navy" />
            <span aria-hidden="true" className="block h-0.5 w-5 bg-on-navy" />
          </button>
        </header>
        <main id="main" className="mx-auto w-full max-w-[75rem] flex-1 px-5 py-8 md:px-8 lg:py-12 xl:px-10">
          <Outlet />
        </main>
      </div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent title="Menu">
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

`apps/core/src/app/not-found-page.tsx`:

```tsx
import { PageHeader } from '@/components/page-header';
import { LinkArrow } from '@/components/ui/link-arrow';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <p className="mb-4 max-w-[66ch] text-body text-navy-80">That address does not match a page in this app.</p>
      <LinkArrow to="/">Go to Overview</LinkArrow>
    </>
  );
}
```

`apps/core/src/app/page-stub.tsx` (temporary: it is deleted in Task 15):

```tsx
import { PageHeader } from '@/components/page-header';

export function PageStub({ title }: { title: string }) {
  return <PageHeader title={title} />;
}
```

`apps/core/src/app/app.tsx`:

```tsx
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/app-shell';
import { NotFoundPage } from '@/app/not-found-page';
import { PageStub } from '@/app/page-stub';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PageStub title="Overview" />} />
        <Route path="projects" element={<PageStub title="Projects" />} />
        <Route path="finance/receipts-bills" element={<PageStub title="Receipts and bills" />} />
        <Route path="categories" element={<PageStub title="Categories" />} />
        <Route path="technologies" element={<PageStub title="Technologies" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
```

`apps/core/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/schibsted-grotesk';
import './styles.css';
import App from './app/app';
import { queryClient } from './lib/query-client';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 5: Run the tests and the checks**

```bash
pnpm nx run-many -t test lint typecheck build -p core
```
Expected: all PASS and the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src
git commit -m "feat(core): add the app shell, navigation and routes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Categories

**Files:**
- Create: `apps/core/src/features/categories/{types,schema,api}.ts`, `category-form-dialog.tsx`, `categories-page.tsx`, `categories-page.test.tsx`
- Modify: `apps/core/src/app/app.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4 to 9 (`PageHeader`, `SearchField`, `QueryBoundary`, `TablePager`, `Panel`, `Table*`, `Button`, `Dialog*`, `Field`, `Input`, `Textarea`, `ConfirmDialog`, `usePagedRows`, `filterBy`, `formatDate`, `today`, `api`, `renderWithProviders`).
- Produces: `CategoriesPage` (named export), the hooks `useCategories()`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()`, the type `Category`, the schema `categorySchema` and type `CategoryInput`. Tasks 11 to 14 repeat this pattern with their own files.

- [ ] **Step 1: Write the failing tests**

`apps/core/src/features/categories/categories-page.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { CategoriesPage } from './categories-page';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const rows = [
  { id: 1, name: 'Web', description: 'Websites and portals', created: '2023-07-25', updated: '2023-07-26' },
  { id: 2, name: 'Mobile', description: 'Phone apps', created: '2023-08-01', updated: '2023-08-01' },
];

const numbered = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Category ${index + 1}`,
    description: 'anything',
    created: '2023-07-25',
    updated: '2023-07-25',
  }));

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: rows });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('CategoriesPage', () => {
  it('lists categories with readable dates', async () => {
    renderWithProviders(<CategoriesPage />);
    expect(await screen.findByText('Web')).toBeInTheDocument();
    expect(screen.getByText('25 Jul 2023')).toBeInTheDocument();
    expect(screen.getByText('26 Jul 2023')).toBeInTheDocument();
    expect(screen.getByText('1–2 of 2')).toBeInTheDocument();
  });

  it('filters by search text and says when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await screen.findByText('Web');
    await user.type(screen.getByLabelText('Search categories'), 'mob');
    expect(screen.queryByText('Web')).not.toBeInTheDocument();
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search categories'));
    await user.type(screen.getByLabelText('Search categories'), 'zzz');
    expect(screen.getByText('No categories match “zzz”.')).toBeInTheDocument();
  });

  it('goes back to the first page when searching from a later page', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: numbered(7) });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByText('6–7 of 7')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search categories'), 'Category 1');
    expect(screen.getByText('1–1 of 1')).toBeInTheDocument();
    expect(screen.getByText('Category 1')).toBeInTheDocument();
  });

  it('creates a category from the dialog', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 3 } });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add category' }));
    await user.type(screen.getByLabelText('Name'), 'Data');
    await user.type(screen.getByLabelText('Description'), 'Data work');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/categories',
        expect.objectContaining({ name: 'Data', description: 'Data work', created: expect.any(String), updated: expect.any(String) }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('blocks an empty form and sends nothing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add category' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('edits a category, starting from its current values', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Web' }));
    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('Web');
    await user.clear(name);
    await user.type(name, 'Web 2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/categories/1',
        expect.objectContaining({ name: 'Web 2', description: 'Websites and portals' }),
      ),
    );
  });

  it('opens the add dialog empty after an edit was cancelled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Web' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('deletes only after the confirmation', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Web' }));
    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Delete category “Web”?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete category' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/categories/1'));
  });

  it('lands on the last page that still exists after deleting the only row on the last page', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: numbered(6) });
    vi.mocked(api.delete).mockImplementation(async () => {
      vi.mocked(api.get).mockResolvedValue({ data: numbered(5) });
      return { data: {} };
    });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Delete Category 6' }));
    await user.click(screen.getByRole('button', { name: 'Delete category' }));
    expect(await screen.findByText('1–5 of 5')).toBeInTheDocument();
    expect(screen.getByText('Category 1')).toBeInTheDocument();
  });

  it('shows an error with a retry when the API is down, then recovers', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('down')).mockResolvedValue({ data: rows });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Web')).toBeInTheDocument();
  });

  it('offers to add the first category when there are none', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    expect(await screen.findByText('No categories yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add the first category' }));
    expect(screen.getByRole('dialog', { name: 'New category' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: `categories-page.test.tsx` FAILS with "Failed to resolve import './categories-page'".

- [ ] **Step 3: Write the feature**

`apps/core/src/features/categories/types.ts`:

```ts
export interface Category {
  id: number;
  name: string;
  description: string;
  created: string;
  updated: string;
}
```

`apps/core/src/features/categories/schema.ts`:

```ts
import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().min(1, 'Description is required'),
});

export type CategoryInput = z.infer<typeof categorySchema>;
```

`apps/core/src/features/categories/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import type { CategoryInput } from './schema';
import type { Category } from './types';

const KEY = ['categories'] as const;

export function useCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Category[]>('/categories')).data,
  });
}

export function useCreateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CategoryInput) =>
      (await api.post<Category>('/categories', { ...input, created: today(), updated: today() })).data,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CategoryInput & { id: number }) =>
      (await api.patch<Category>(`/categories/${id}`, { ...input, updated: today() })).data,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
```

`apps/core/src/features/categories/category-form-dialog.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCategory, useUpdateCategory } from './api';
import { categorySchema, type CategoryInput } from './schema';
import type { Category } from './types';

const emptyValues: CategoryInput = { name: '', description: '' };

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. */
  category?: Category;
}

export function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const [saveFailed, setSaveFailed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryInput>({ resolver: zodResolver(categorySchema), defaultValues: emptyValues });

  useEffect(() => {
    if (open) {
      reset(category ? { name: category.name, description: category.description } : emptyValues);
      setSaveFailed(false);
    }
  }, [open, category, reset]);

  const submit = handleSubmit(async (values) => {
    setSaveFailed(false);
    try {
      if (category) await update.mutateAsync({ id: category.id, ...values });
      else await create.mutateAsync(values);
      onOpenChange(false);
    } catch {
      setSaveFailed(true);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
        <DialogDescription>Give the category a name and a short description.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="category-name" error={errors.name?.message}>
            <Input {...fieldA11y('category-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field label="Description" htmlFor="category-description" error={errors.description?.message}>
            <Textarea {...fieldA11y('category-description', errors.description?.message)} {...register('description')} />
          </Field>
          {saveFailed ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              That did not save. Try again.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
            <Button variant="quiet" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

`apps/core/src/features/categories/categories-page.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { filterBy } from '@/lib/filter';
import { formatDate } from '@/lib/format';
import { useCategories, useDeleteCategory } from './api';
import { CategoryFormDialog } from './category-form-dialog';
import type { Category } from './types';

export function CategoriesPage() {
  const { data, isLoading, isError, refetch } = useCategories();
  const remove = useDeleteCategory();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; category?: Category }>({ open: false });
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const filtered = useMemo(() => filterBy(data ?? [], search, ['name', 'description']), [data, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Categories">
        <Button onClick={() => setForm({ open: true })}>Add category</Button>
      </PageHeader>

      <div className="mb-6">
        <SearchField
          id="category-search"
          label="Search categories"
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.setPage(0);
          }}
        />
      </div>

      <Panel>
        <QueryBoundary
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          isEmpty={!data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No categories yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first category
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No categories match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-semibold">{category.name}</TableCell>
                      <TableCell className="tabular">{formatDate(category.created)}</TableCell>
                      <TableCell className="tabular">{formatDate(category.updated)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          variant="quiet"
                          aria-label={`Edit ${category.name}`}
                          onClick={() => setForm({ open: true, category })}
                        >
                          Edit
                        </Button>
                        <Button variant="quiet" aria-label={`Delete ${category.name}`} onClick={() => setToDelete(category)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                page={paging.page}
                pageCount={paging.pageCount}
                pageSize={paging.pageSize}
                total={paging.total}
                onPageChange={paging.setPage}
                onPageSizeChange={paging.setPageSize}
              />
            </>
          )}
        </QueryBoundary>
      </Panel>

      <CategoryFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        category={form.category}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete category “${toDelete?.name ?? ''}”?`}
        description="This cannot be undone."
        confirmLabel="Delete category"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
```

- [ ] **Step 4: Route the page**

In `apps/core/src/app/app.tsx`, add the import and replace the categories route:

```tsx
import { CategoriesPage } from '@/features/categories/categories-page';
```

```tsx
        <Route path="categories" element={<CategoriesPage />} />
```

- [ ] **Step 5: Run the tests and the checks**

Run: `pnpm nx run-many -t test lint typecheck -p core`
Expected: all PASS, including `app.test.tsx` (its API mock returns empty lists).

- [ ] **Step 6: Commit**

```bash
git add apps/core/src
git commit -m "feat(core): add the categories page with working add, edit and delete" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 11: Technologies

**Files:**
- Create: `apps/core/src/features/technologies/{types,schema,api}.ts`, `technology-form-dialog.tsx`, `technologies-page.tsx`, `technologies-page.test.tsx`
- Modify: `apps/core/src/app/app.tsx`

**Interfaces:**
- Consumes: the same parts as Task 10.
- Produces: `TechnologiesPage`, `useTechnologies()`, `useCreateTechnology()`, `useUpdateTechnology()`, `useDeleteTechnology()`, `Technology`, `technologySchema`, `TechnologyInput`.
- The table shows Name, Category and Description. The `iconType` and `iconName` fields (MUI icon names that were printed as text) stay in the data but are no longer shown; updates use PATCH so they are left untouched.

- [ ] **Step 1: Write the failing tests**

`apps/core/src/features/technologies/technologies-page.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { TechnologiesPage } from './technologies-page';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const rows = [
  { id: 1, name: 'React', description: 'A library for user interfaces.', category: 'Frontend', iconType: 'Material', iconName: 'Code' },
  { id: 2, name: 'Nest', description: 'A Node framework.' },
];

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: rows });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('TechnologiesPage', () => {
  it('lists name, category and description, with a dash for a missing category', async () => {
    renderWithProviders(<TechnologiesPage />);
    expect(await screen.findByText('React')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('Material')).not.toBeInTheDocument();
    expect(screen.queryByText('Code')).not.toBeInTheDocument();
  });

  it('searches name, category and description', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await screen.findByText('React');
    await user.type(screen.getByLabelText('Search technologies'), 'frontend');
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.queryByText('Nest')).not.toBeInTheDocument();
  });

  it('creates a technology with an optional category', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 3 } });
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add technology' }));
    await user.type(screen.getByLabelText('Name'), 'Vite');
    await user.type(screen.getByLabelText('Description'), 'A build tool.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/technologies', { name: 'Vite', category: '', description: 'A build tool.' }),
    );
  });

  it('blocks a technology without a name or description', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add technology' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('edits with PATCH so the icon fields are left alone', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit React' }));
    expect(screen.getByLabelText('Category')).toHaveValue('Frontend');
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'UI library.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/technologies/1', {
        name: 'React',
        category: 'Frontend',
        description: 'UI library.',
      }),
    );
  });

  it('deletes only after the confirmation', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete React' }));
    expect(api.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete technology' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/technologies/1'));
  });

  it('shows an error with a retry when the API is down', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<TechnologiesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('offers to add the first technology when there are none', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    renderWithProviders(<TechnologiesPage />);
    expect(await screen.findByText('No technologies yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: `technologies-page.test.tsx` FAILS with "Failed to resolve import './technologies-page'".

- [ ] **Step 3: Write the feature**

`apps/core/src/features/technologies/types.ts`:

```ts
export interface Technology {
  id: number;
  name: string;
  description: string;
  category?: string;
  /** Legacy MUI icon names. Kept in the data, no longer shown. */
  iconType?: string;
  iconName?: string;
}
```

`apps/core/src/features/technologies/schema.ts`:

```ts
import { z } from 'zod';

export const technologySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  category: z.string().trim(),
  description: z.string().trim().min(1, 'Description is required'),
});

export type TechnologyInput = z.infer<typeof technologySchema>;
```

`apps/core/src/features/technologies/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TechnologyInput } from './schema';
import type { Technology } from './types';

const KEY = ['technologies'] as const;

export function useTechnologies() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Technology[]>('/technologies')).data,
  });
}

export function useCreateTechnology() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: TechnologyInput) => (await api.post<Technology>('/technologies', input)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTechnology() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: TechnologyInput & { id: number }) =>
      (await api.patch<Technology>(`/technologies/${id}`, input)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTechnology() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/technologies/${id}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
```

`apps/core/src/features/technologies/technology-form-dialog.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTechnology, useUpdateTechnology } from './api';
import { technologySchema, type TechnologyInput } from './schema';
import type { Technology } from './types';

const emptyValues: TechnologyInput = { name: '', category: '', description: '' };

interface TechnologyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. */
  technology?: Technology;
}

export function TechnologyFormDialog({ open, onOpenChange, technology }: TechnologyFormDialogProps) {
  const create = useCreateTechnology();
  const update = useUpdateTechnology();
  const [saveFailed, setSaveFailed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TechnologyInput>({ resolver: zodResolver(technologySchema), defaultValues: emptyValues });

  useEffect(() => {
    if (open) {
      reset(
        technology
          ? { name: technology.name, category: technology.category ?? '', description: technology.description }
          : emptyValues,
      );
      setSaveFailed(false);
    }
  }, [open, technology, reset]);

  const submit = handleSubmit(async (values) => {
    setSaveFailed(false);
    try {
      if (technology) await update.mutateAsync({ id: technology.id, ...values });
      else await create.mutateAsync(values);
      onOpenChange(false);
    } catch {
      setSaveFailed(true);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{technology ? 'Edit technology' : 'New technology'}</DialogTitle>
        <DialogDescription>Name the technology and say what it is used for.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="technology-name" error={errors.name?.message}>
            <Input {...fieldA11y('technology-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field
            label="Category"
            htmlFor="technology-category"
            hint="Optional, for example Frontend or Backend."
            error={errors.category?.message}
          >
            <Input
              {...fieldA11y('technology-category', errors.category?.message)}
              {...register('category')}
              autoComplete="off"
            />
          </Field>
          <Field label="Description" htmlFor="technology-description" error={errors.description?.message}>
            <Textarea
              {...fieldA11y('technology-description', errors.description?.message)}
              {...register('description')}
            />
          </Field>
          {saveFailed ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              That did not save. Try again.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
            <Button variant="quiet" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

`apps/core/src/features/technologies/technologies-page.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { filterBy } from '@/lib/filter';
import { useDeleteTechnology, useTechnologies } from './api';
import { TechnologyFormDialog } from './technology-form-dialog';
import type { Technology } from './types';

export function TechnologiesPage() {
  const { data, isLoading, isError, refetch } = useTechnologies();
  const remove = useDeleteTechnology();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; technology?: Technology }>({ open: false });
  const [toDelete, setToDelete] = useState<Technology | null>(null);

  const filtered = useMemo(() => filterBy(data ?? [], search, ['name', 'category', 'description']), [data, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Technologies">
        <Button onClick={() => setForm({ open: true })}>Add technology</Button>
      </PageHeader>

      <div className="mb-6">
        <SearchField
          id="technology-search"
          label="Search technologies"
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.setPage(0);
          }}
        />
      </div>

      <Panel>
        <QueryBoundary
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          isEmpty={!data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No technologies yet.</p>
              <Button variant="quiet" onClick={() => setForm({ open: true })}>
                Add the first technology
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No technologies match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((technology) => (
                    <TableRow key={technology.id}>
                      <TableCell className="font-semibold">{technology.name}</TableCell>
                      <TableCell>{technology.category || '—'}</TableCell>
                      <TableCell className="min-w-[16rem]">{technology.description}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          variant="quiet"
                          aria-label={`Edit ${technology.name}`}
                          onClick={() => setForm({ open: true, technology })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="quiet"
                          aria-label={`Delete ${technology.name}`}
                          onClick={() => setToDelete(technology)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                page={paging.page}
                pageCount={paging.pageCount}
                pageSize={paging.pageSize}
                total={paging.total}
                onPageChange={paging.setPage}
                onPageSizeChange={paging.setPageSize}
              />
            </>
          )}
        </QueryBoundary>
      </Panel>

      <TechnologyFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        technology={form.technology}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete technology “${toDelete?.name ?? ''}”?`}
        description="This cannot be undone."
        confirmLabel="Delete technology"
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </>
  );
}
```

- [ ] **Step 4: Route the page**

In `apps/core/src/app/app.tsx`, add the import and replace the technologies route:

```tsx
import { TechnologiesPage } from '@/features/technologies/technologies-page';
```

```tsx
        <Route path="technologies" element={<TechnologiesPage />} />
```

- [ ] **Step 5: Run the tests and the checks**

Run: `pnpm nx run-many -t test lint typecheck -p core`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src
git commit -m "feat(core): add the technologies page with working add, edit and delete" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 12: Projects

**Files:**
- Create: `apps/core/src/features/projects/{types,api}.ts`, `projects-page.tsx`, `projects-page.test.tsx`
- Modify: `apps/core/src/app/app.tsx`

**Interfaces:**
- Consumes: the same parts as Task 10, plus `formatCurrency`.
- Produces: `ProjectsPage`, `useProjects()`, the type `Project` (`{ id, name, description, client, totalValue, totalOutstanding }`, the shape of the Nest `Project` entity with the client flattened to its name). Task 15 uses `useProjects()` and `Project`.

- [ ] **Step 1: Write the failing tests**

`apps/core/src/features/projects/projects-page.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { ProjectsPage } from './projects-page';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const rows = [
  { id: 1, name: 'Project 1', description: 'anything project-1', client: 'Client A', totalValue: 48000, totalOutstanding: 12000 },
  { id: 2, name: 'Project 2', description: 'anything project-2', client: 'Client B', totalValue: 32000, totalOutstanding: 0 },
];

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: rows });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ProjectsPage', () => {
  it('lists projects with client, value and outstanding amount as currency', async () => {
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Client A')).toBeInTheDocument();
    expect(screen.getByText('$48,000')).toBeInTheDocument();
    expect(screen.getByText('$12,000')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('searches by name and by client', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Project 1');
    await user.type(screen.getByLabelText('Search projects'), 'client b');
    expect(screen.getByText('Project 2')).toBeInTheDocument();
    expect(screen.queryByText('Project 1')).not.toBeInTheDocument();
  });

  it('says when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Project 1');
    await user.type(screen.getByLabelText('Search projects'), 'zzz');
    expect(screen.getByText('No projects match “zzz”.')).toBeInTheDocument();
  });

  it('shows an error with a retry when the API is down', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });

  it('says so when there are no projects', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: `projects-page.test.tsx` FAILS with "Failed to resolve import './projects-page'".

- [ ] **Step 3: Write the feature**

`apps/core/src/features/projects/types.ts`:

```ts
export interface Project {
  id: number;
  name: string;
  description: string;
  client: string;
  totalValue: number;
  totalOutstanding: number;
}
```

`apps/core/src/features/projects/api.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Project } from './types';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'] as const,
    queryFn: async () => (await api.get<Project[]>('/projects')).data,
  });
}
```

`apps/core/src/features/projects/projects-page.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { SearchField } from '@/components/search-field';
import { TablePager } from '@/components/table-pager';
import { Panel } from '@/components/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { filterBy } from '@/lib/filter';
import { formatCurrency } from '@/lib/format';
import { useProjects } from './api';

export function ProjectsPage() {
  const { data, isLoading, isError, refetch } = useProjects();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => filterBy(data ?? [], search, ['name', 'client', 'description']), [data, search]);
  const paging = usePagedRows(filtered);

  return (
    <>
      <PageHeader title="Projects" />

      <div className="mb-6">
        <SearchField
          id="project-search"
          label="Search projects"
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.setPage(0);
          }}
        />
      </div>

      <Panel>
        <QueryBoundary
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          isEmpty={!data?.length}
          empty={<p className="text-body">No projects yet.</p>}
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No projects match “{search.trim()}”.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Total value</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-semibold">{project.name}</TableCell>
                      <TableCell>{project.client}</TableCell>
                      <TableCell className="tabular text-right">{formatCurrency(project.totalValue)}</TableCell>
                      <TableCell className="tabular text-right">{formatCurrency(project.totalOutstanding)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                page={paging.page}
                pageCount={paging.pageCount}
                pageSize={paging.pageSize}
                total={paging.total}
                onPageChange={paging.setPage}
                onPageSizeChange={paging.setPageSize}
              />
            </>
          )}
        </QueryBoundary>
      </Panel>
    </>
  );
}
```

- [ ] **Step 4: Route the page**

In `apps/core/src/app/app.tsx`, add the import and replace the projects route:

```tsx
import { ProjectsPage } from '@/features/projects/projects-page';
```

```tsx
        <Route path="projects" element={<ProjectsPage />} />
```

- [ ] **Step 5: Run the tests and the checks**

Run: `pnpm nx run-many -t test lint typecheck -p core`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src
git commit -m "feat(core): add the projects page" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 13: Bills logic (filters and CSV)

**Files:**
- Create: `apps/core/src/features/bills/{types,filters,csv}.ts`, `filters.test.ts`, `csv.test.ts`

**Interfaces:**
- Produces:
  - Types: `BILL_TYPES` (`['Regular', 'Incentive', 'Bonus']`), `BillType`, `Bill` (`{ id, billDate, amount, billType, actualExpense, billPath, uploadedBy, submittedBy, approved, approvedBy }`; dates are `YYYY-MM-DD`; `actualExpense` is the bill's "Reimbursement"), `ApprovalFilter` (`'all' | 'pending' | 'approved'`), `BillFilters` (`{ from, to, approval }`).
  - `emptyFilters: BillFilters`, `filterBills(bills, filters): Bill[]` (both date bounds inclusive, either may be empty), `isRangeInverted(filters): boolean`.
  - `billsToCsv(bills): string` (RFC 4180: CRLF rows, quoted where needed), `neutraliseFormula(value: string): string`, `downloadCsv(filename, csv): void`.

- [ ] **Step 1: Write the failing tests**

`apps/core/src/features/bills/filters.test.ts`:

```ts
import { emptyFilters, filterBills, isRangeInverted } from './filters';
import type { Bill } from './types';

const bill = (id: number, billDate: string, approved: boolean): Bill => ({
  id,
  billDate,
  amount: 100,
  billType: 'Regular',
  actualExpense: false,
  billPath: `/path/${id}`,
  uploadedBy: 'Asha',
  submittedBy: 'Asha',
  approved,
  approvedBy: approved ? 'Manager' : '',
});

const bills = [bill(1, '2023-08-08', true), bill(2, '2023-08-09', false), bill(3, '2023-08-10', true)];
const ids = (list: Bill[]) => list.map((item) => item.id);

describe('filterBills', () => {
  it('keeps everything when no filter is set', () => {
    expect(ids(filterBills(bills, emptyFilters))).toEqual([1, 2, 3]);
  });

  it('includes both date bounds', () => {
    expect(ids(filterBills(bills, { ...emptyFilters, from: '2023-08-09', to: '2023-08-10' }))).toEqual([2, 3]);
    expect(ids(filterBills(bills, { ...emptyFilters, from: '2023-08-09', to: '2023-08-09' }))).toEqual([2]);
  });

  it('works with only a from date', () => {
    expect(ids(filterBills(bills, { ...emptyFilters, from: '2023-08-09' }))).toEqual([2, 3]);
  });

  it('works with only a to date', () => {
    expect(ids(filterBills(bills, { ...emptyFilters, to: '2023-08-09' }))).toEqual([1, 2]);
  });

  it('filters by approval', () => {
    expect(ids(filterBills(bills, { ...emptyFilters, approval: 'approved' }))).toEqual([1, 3]);
    expect(ids(filterBills(bills, { ...emptyFilters, approval: 'pending' }))).toEqual([2]);
  });

  it('combines the filters', () => {
    expect(ids(filterBills(bills, { from: '2023-08-09', to: '', approval: 'approved' }))).toEqual([3]);
  });

  it('returns nothing, not everything, for an inverted range', () => {
    expect(filterBills(bills, { ...emptyFilters, from: '2023-08-10', to: '2023-08-08' })).toEqual([]);
  });
});

describe('isRangeInverted', () => {
  it('is true only when from is after to', () => {
    expect(isRangeInverted({ from: '2023-08-10', to: '2023-08-08' })).toBe(true);
    expect(isRangeInverted({ from: '2023-08-08', to: '2023-08-08' })).toBe(false);
    expect(isRangeInverted({ from: '2023-08-08', to: '2023-08-10' })).toBe(false);
  });

  it('is false while either bound is empty', () => {
    expect(isRangeInverted({ from: '', to: '2023-08-08' })).toBe(false);
    expect(isRangeInverted({ from: '2023-08-08', to: '' })).toBe(false);
  });
});
```

`apps/core/src/features/bills/csv.test.ts`:

```ts
import { billsToCsv, downloadCsv, neutraliseFormula } from './csv';
import type { Bill } from './types';

const make = (overrides: Partial<Bill> = {}): Bill => ({
  id: 1,
  billDate: '2023-08-10',
  amount: 100,
  billType: 'Bonus',
  actualExpense: false,
  billPath: '/path/to/bill/1',
  uploadedBy: 'John Doe',
  submittedBy: 'John Doe',
  approved: true,
  approvedBy: 'Manager',
  ...overrides,
});

const HEADER = 'Bill date,Amount,Bill type,Reimbursement,Uploaded by,Submitted by,Approved,Approved by,Bill file';

describe('billsToCsv', () => {
  it('writes a header and one CRLF-separated row per bill', () => {
    expect(billsToCsv([make(), make({ id: 2, amount: 200, actualExpense: true, approved: false, approvedBy: '' })])).toBe(
      [
        HEADER,
        '2023-08-10,100,Bonus,No,John Doe,John Doe,Yes,Manager,/path/to/bill/1',
        '2023-08-10,200,Bonus,Yes,John Doe,John Doe,No,,/path/to/bill/1',
      ].join('\r\n'),
    );
  });

  it('writes only the header when there are no bills', () => {
    expect(billsToCsv([])).toBe(HEADER);
  });

  it('quotes values containing commas, quotes and newlines', () => {
    const csv = billsToCsv([make({ uploadedBy: 'Doe, John', submittedBy: 'He said "hi"', approvedBy: 'Line1\nLine2' })]);
    expect(csv).toContain('"Doe, John"');
    expect(csv).toContain('"He said ""hi"""');
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('stops a spreadsheet running a typed value as a formula', () => {
    const csv = billsToCsv([
      make({ uploadedBy: '=HYPERLINK("http://evil","x")', submittedBy: '+1', approvedBy: '-2', billPath: '@SUM(A1)' }),
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv).toContain(",'+1,");
    expect(csv).toContain(",'-2,");
    expect(csv).toContain(",'@SUM(A1)");
  });

  it('keeps a negative amount a number', () => {
    expect(billsToCsv([make({ amount: -5 })])).toContain(',-5,');
  });
});

describe('neutraliseFormula', () => {
  it('prefixes values a spreadsheet would run, and leaves the rest alone', () => {
    expect(neutraliseFormula('=1+1')).toBe("'=1+1");
    expect(neutraliseFormula('+1')).toBe("'+1");
    expect(neutraliseFormula('-1')).toBe("'-1");
    expect(neutraliseFormula('@x')).toBe("'@x");
    expect(neutraliseFormula('\tx')).toBe("'\tx");
    expect(neutraliseFormula('John Doe')).toBe('John Doe');
    expect(neutraliseFormula('')).toBe('');
  });
});

describe('downloadCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads under the given name and releases the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:csv');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });

    downloadCsv('receipts.csv', 'a,b');

    expect(names).toEqual(['receipts.csv']);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: both new test files FAIL with "Failed to resolve import".

- [ ] **Step 3: Write the logic**

`apps/core/src/features/bills/types.ts`:

```ts
export const BILL_TYPES = ['Regular', 'Incentive', 'Bonus'] as const;
export type BillType = (typeof BILL_TYPES)[number];

export interface Bill {
  id: number;
  /** `YYYY-MM-DD`. */
  billDate: string;
  amount: number;
  billType: BillType;
  /** Shown to staff as "Reimbursement". */
  actualExpense: boolean;
  /** json-server cannot store files, so this holds the attachment's file name. */
  billPath: string;
  uploadedBy: string;
  submittedBy: string;
  approved: boolean;
  approvedBy: string;
}

export type ApprovalFilter = 'all' | 'pending' | 'approved';

export interface BillFilters {
  from: string;
  to: string;
  approval: ApprovalFilter;
}
```

`apps/core/src/features/bills/filters.ts`:

```ts
import type { Bill, BillFilters } from './types';

export const emptyFilters: BillFilters = { from: '', to: '', approval: 'all' };

/** Dates are `YYYY-MM-DD`, so string comparison is date comparison and no time zone gets involved. */
export function filterBills(bills: Bill[], { from, to, approval }: BillFilters): Bill[] {
  return bills.filter((bill) => {
    if (from && bill.billDate < from) return false;
    if (to && bill.billDate > to) return false;
    if (approval === 'approved' && !bill.approved) return false;
    if (approval === 'pending' && bill.approved) return false;
    return true;
  });
}

export function isRangeInverted({ from, to }: Pick<BillFilters, 'from' | 'to'>): boolean {
  return Boolean(from && to && from > to);
}
```

`apps/core/src/features/bills/csv.ts`:

```ts
import type { Bill } from './types';

const HEADERS = [
  'Bill date',
  'Amount',
  'Bill type',
  'Reimbursement',
  'Uploaded by',
  'Submitted by',
  'Approved',
  'Approved by',
  'Bill file',
];

/** A leading = + - @ (or a tab or return) makes a spreadsheet run the cell as a formula; an apostrophe stops it. */
export function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** RFC 4180: CRLF between rows, and quotes around any value with a comma, quote or line break. */
export function billsToCsv(bills: Bill[]): string {
  const rows = bills.map((bill) => [
    bill.billDate,
    String(bill.amount),
    bill.billType,
    bill.actualExpense ? 'Yes' : 'No',
    neutraliseFormula(bill.uploadedBy),
    neutraliseFormula(bill.submittedBy),
    bill.approved ? 'Yes' : 'No',
    neutraliseFormula(bill.approvedBy),
    neutraliseFormula(bill.billPath),
  ]);
  return [HEADERS, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

/** Saves the text as a UTF-8 file (with a byte-order mark so Excel reads accents correctly). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm nx run-many -t test lint typecheck -p core`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src
git commit -m "feat(core): add bill filters and a safe CSV export" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 14: Receipts and bills page

**Files:**
- Create: `apps/core/src/features/bills/{schema,api}.ts`, `schema.test.ts`, `add-bill-dialog.tsx`, `add-bill-dialog.test.tsx`, `bills-page.tsx`, `bills-page.test.tsx`
- Modify: `apps/core/src/app/app.tsx`

**Interfaces:**
- Consumes: Task 13's `Bill`, `BILL_TYPES`, `BillFilters`, `emptyFilters`, `filterBills`, `isRangeInverted`, `billsToCsv`, `downloadCsv`; the UI parts from Tasks 4 to 8; `Badge`.
- Produces: `BillsPage`, `AddBillDialog({ open, onOpenChange })`, `useBills()`, `useCreateBill()`, `billFormSchema`, `BillFormValues`, `toNewBill(values): Omit<Bill, 'id'>`. Task 15 uses `useBills()`.
- Reimbursement is stored as `actualExpense`. The attachment is required and validated, but only its file name is saved (`billPath`).

- [ ] **Step 1: Write the failing tests**

`apps/core/src/features/bills/schema.test.ts`:

```ts
import { toNewBill, type BillFormValues } from './schema';

const file = new File(['x'], 'receipt.png', { type: 'image/png' });
const values = {
  billDate: '2023-09-01',
  amount: '25.5',
  billType: 'Regular',
  reimbursement: 'Yes',
  addedBy: '  Asha ',
  attachment: [file] as unknown as FileList,
} as BillFormValues;

describe('toNewBill', () => {
  it('maps the form to a bill that starts pending', () => {
    expect(toNewBill(values)).toEqual({
      billDate: '2023-09-01',
      amount: 25.5,
      billType: 'Regular',
      actualExpense: true,
      billPath: 'receipt.png',
      uploadedBy: 'Asha',
      submittedBy: 'Asha',
      approved: false,
      approvedBy: '',
    });
  });

  it('stores reimbursement No as actualExpense false', () => {
    expect(toNewBill({ ...values, reimbursement: 'No' }).actualExpense).toBe(false);
  });
});
```

`apps/core/src/features/bills/add-bill-dialog.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { AddBillDialog } from './add-bill-dialog';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const image = () => new File(['x'], 'receipt.png', { type: 'image/png' });

function setup() {
  const onOpenChange = vi.fn();
  renderWithProviders(<AddBillDialog open onOpenChange={onOpenChange} />);
  return onOpenChange;
}

async function fillValid(user: ReturnType<typeof userEvent.setup>, amount = '25.5') {
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2023-09-01' } });
  await user.type(screen.getByLabelText('Amount'), amount);
  await user.selectOptions(screen.getByLabelText('Bill type'), 'Regular');
  await user.type(screen.getByLabelText('Added by'), 'Asha');
  await user.upload(screen.getByLabelText('Bill image'), image());
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('AddBillDialog', () => {
  it('blocks an empty form and sends nothing', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Date is required')).toBeInTheDocument();
    expect(screen.getByText('Amount is required')).toBeInTheDocument();
    expect(screen.getByText('Bill type is required')).toBeInTheDocument();
    expect(screen.getByText('Added by is required')).toBeInTheDocument();
    expect(screen.getByText('Attach an image of the bill')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it.each(['0', '-5'])('rejects an amount of %s next to the field', async (amount) => {
    const user = userEvent.setup();
    setup();
    await fillValid(user, amount);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Amount must be greater than 0')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects an attachment that is not an image', async () => {
    const user = userEvent.setup({ applyAccept: false });
    setup();
    await fillValid(user);
    await user.upload(screen.getByLabelText('Bill image'), new File(['x'], 'notes.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Attach an image of the bill')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('saves a valid bill as pending and closes', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 10 } });
    const user = userEvent.setup();
    const onOpenChange = setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/bills', {
        billDate: '2023-09-01',
        amount: 25.5,
        billType: 'Regular',
        actualExpense: true,
        billPath: 'receipt.png',
        uploadedBy: 'Asha',
        submittedBy: 'Asha',
        approved: false,
        approvedBy: '',
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('stores reimbursement No as actualExpense false', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 10 } });
    const user = userEvent.setup();
    setup();
    await fillValid(user);
    await user.click(screen.getByLabelText('No'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/bills', expect.objectContaining({ actualExpense: false })),
    );
  });

  it('stays open and says so when saving fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    const onOpenChange = setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That did not save. Try again.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
```

`apps/core/src/features/bills/bills-page.test.tsx`:

```tsx
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { BillsPage } from './bills-page';
import { downloadCsv } from './csv';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('./csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./csv')>()),
  downloadCsv: vi.fn(),
}));

const bills = [
  { id: 1, billDate: '2023-08-08', amount: 50, billType: 'Bonus', actualExpense: false, billPath: '/p/1', uploadedBy: 'Asha', submittedBy: 'Asha', approved: true, approvedBy: 'Manager' },
  { id: 2, billDate: '2023-08-09', amount: 200, billType: 'Regular', actualExpense: true, billPath: '/p/2', uploadedBy: 'Ben', submittedBy: 'Ben', approved: false, approvedBy: '' },
  { id: 3, billDate: '2023-08-10', amount: 100.5, billType: 'Incentive', actualExpense: false, billPath: '/p/3', uploadedBy: 'Chen', submittedBy: 'Chen', approved: true, approvedBy: 'Manager' },
];

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: bills });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('BillsPage', () => {
  it('lists the newest bill first with formatted amounts and a status for each', async () => {
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows).toHaveLength(3);
    expect(within(dataRows[0]).getByText('Chen')).toBeInTheDocument();
    expect(within(dataRows[0]).getByText('$100.50')).toBeInTheDocument();
    expect(within(dataRows[0]).getByText('10 Aug 2023')).toBeInTheDocument();
    expect(within(dataRows[1]).getByText('Pending')).toBeInTheDocument();
    expect(within(dataRows[1]).getByText('Yes')).toBeInTheDocument();
    expect(within(dataRows[2]).getByText('Approved')).toBeInTheDocument();
  });

  it('filters by approval', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    await user.selectOptions(screen.getByLabelText('Approval'), 'pending');
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.queryByText('Chen')).not.toBeInTheDocument();
    expect(screen.queryByText('Asha')).not.toBeInTheDocument();
  });

  it('filters by date range with both bounds included', async () => {
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2023-08-09' } });
    expect(screen.queryByText('Asha')).not.toBeInTheDocument();
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.getByText('Chen')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2023-08-09' } });
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.queryByText('Chen')).not.toBeInTheDocument();
  });

  it('says when the range is inverted, shows no rows and disables the export', async () => {
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2023-08-10' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2023-08-08' } });
    expect(screen.getByRole('alert')).toHaveTextContent('From date is after To date.');
    expect(screen.getByText('No bills match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });

  it('exports exactly the rows that are shown', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    await user.selectOptions(screen.getByLabelText('Approval'), 'approved');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename, csv] = vi.mocked(downloadCsv).mock.calls[0];
    expect(filename).toBe('receipts-and-bills.csv');
    expect(csv).toContain('Asha');
    expect(csv).toContain('Chen');
    expect(csv).not.toContain('Ben');
  });

  it('clears the filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillsPage />);
    await screen.findByText('Chen');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Approval'), 'pending');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(3);
  });

  it('opens the add dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillsPage />);
    await user.click(await screen.findByRole('button', { name: 'Add bill' }));
    expect(screen.getByRole('dialog', { name: 'Add bill' })).toBeInTheDocument();
  });

  it('shows an error with a retry when the API is down', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<BillsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says so when there are no bills', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    renderWithProviders(<BillsPage />);
    expect(await screen.findByText('No bills yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: the three new test files FAIL with "Failed to resolve import".

- [ ] **Step 3: Write the schema and the API**

`apps/core/src/features/bills/schema.ts`:

```ts
import { z } from 'zod';
import { BILL_TYPES, type Bill, type BillType } from './types';

export const billFormSchema = z.object({
  billDate: z.string().min(1, 'Date is required'),
  // Kept as text so a blank field and a typed 0 give different messages.
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'Amount must be greater than 0'),
  billType: z.string().refine((value) => (BILL_TYPES as readonly string[]).includes(value), 'Bill type is required'),
  reimbursement: z.enum(['Yes', 'No']),
  addedBy: z.string().trim().min(1, 'Added by is required'),
  attachment: z.custom<FileList>(
    (value) => value instanceof FileList && value.length > 0 && value[0].type.startsWith('image/'),
    'Attach an image of the bill',
  ),
});

export type BillFormValues = z.infer<typeof billFormSchema>;

/** A new bill starts pending. Only the attachment's name is kept: json-server cannot store the file. */
export function toNewBill(values: BillFormValues): Omit<Bill, 'id'> {
  const addedBy = values.addedBy.trim();
  return {
    billDate: values.billDate,
    amount: Number(values.amount),
    billType: values.billType as BillType,
    actualExpense: values.reimbursement === 'Yes',
    billPath: values.attachment[0].name,
    uploadedBy: addedBy,
    submittedBy: addedBy,
    approved: false,
    approvedBy: '',
  };
}
```

`apps/core/src/features/bills/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Bill } from './types';

const KEY = ['bills'] as const;

export function useBills() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Bill[]>('/bills')).data,
  });
}

export function useCreateBill() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (bill: Omit<Bill, 'id'>) => (await api.post<Bill>('/bills', bill)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
```

- [ ] **Step 4: Write the add-bill dialog**

`apps/core/src/features/bills/add-bill-dialog.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Arm } from '@/components/ui/marks';
import { Select } from '@/components/ui/select';
import { useCreateBill } from './api';
import { billFormSchema, toNewBill, type BillFormValues } from './schema';
import { BILL_TYPES } from './types';

const emptyValues = { billDate: '', amount: '', billType: '', reimbursement: 'Yes' as const, addedBy: '' };

export function AddBillDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateBill();
  const [saveFailed, setSaveFailed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BillFormValues>({ resolver: zodResolver(billFormSchema), defaultValues: emptyValues });

  useEffect(() => {
    if (open) {
      reset(emptyValues);
      setSaveFailed(false);
    }
  }, [open, reset]);

  const submit = handleSubmit(async (values) => {
    setSaveFailed(false);
    try {
      await create.mutateAsync(toNewBill(values));
      onOpenChange(false);
    } catch {
      setSaveFailed(true);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Add bill</DialogTitle>
        <DialogDescription>Record a bill and attach a picture of it. It starts as pending.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Date" htmlFor="bill-date" error={errors.billDate?.message}>
            <Input type="date" {...fieldA11y('bill-date', errors.billDate?.message)} {...register('billDate')} />
          </Field>
          <Field label="Amount" htmlFor="bill-amount" error={errors.amount?.message}>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              {...fieldA11y('bill-amount', errors.amount?.message)}
              {...register('amount')}
            />
          </Field>
          <Field label="Bill type" htmlFor="bill-type" error={errors.billType?.message}>
            <Select {...fieldA11y('bill-type', errors.billType?.message)} {...register('billType')}>
              <option value="">Select a type</option>
              {BILL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset className="grid gap-1">
            <legend className="mb-1 flex min-h-6 items-center gap-2 text-small font-semibold text-foreground">
              <Arm className="w-3 text-rule" />
              Reimbursement
            </legend>
            <div className="flex gap-3">
              {['Yes', 'No'].map((choice) => (
                <label
                  key={choice}
                  className="flex min-h-11 cursor-pointer items-center border border-rule px-5 font-semibold has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-on-navy has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy"
                >
                  <input type="radio" value={choice} className="sr-only" {...register('reimbursement')} />
                  {choice}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Added by" htmlFor="bill-added-by" error={errors.addedBy?.message}>
            <Input
              {...fieldA11y('bill-added-by', errors.addedBy?.message)}
              {...register('addedBy')}
              autoComplete="name"
            />
          </Field>
          <Field label="Bill image" htmlFor="bill-attachment" error={errors.attachment?.message}>
            <Input
              type="file"
              accept="image/*"
              className="file:mr-4 file:min-h-11 file:border-0 file:bg-primary file:px-5 file:font-semibold file:text-primary-foreground"
              {...fieldA11y('bill-attachment', errors.attachment?.message)}
              {...register('attachment')}
            />
          </Field>
          {saveFailed ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              That did not save. Try again.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
            <Button variant="quiet" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Write the page**

`apps/core/src/features/bills/bills-page.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { TablePager } from '@/components/table-pager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagedRows } from '@/hooks/use-paged-rows';
import { formatCurrency, formatDate } from '@/lib/format';
import { AddBillDialog } from './add-bill-dialog';
import { useBills } from './api';
import { billsToCsv, downloadCsv } from './csv';
import { emptyFilters, filterBills, isRangeInverted } from './filters';
import type { ApprovalFilter, BillFilters } from './types';

export function BillsPage() {
  const { data, isLoading, isError, refetch } = useBills();
  const [filters, setFilters] = useState<BillFilters>(emptyFilters);
  const [adding, setAdding] = useState(false);

  const newestFirst = useMemo(
    () => [...(data ?? [])].sort((a, b) => b.billDate.localeCompare(a.billDate)),
    [data],
  );
  const filtered = useMemo(() => filterBills(newestFirst, filters), [newestFirst, filters]);
  const paging = usePagedRows(filtered);
  const inverted = isRangeInverted(filters);
  const filtersActive = filters.from !== '' || filters.to !== '' || filters.approval !== 'all';

  function update(patch: Partial<BillFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    paging.setPage(0);
  }

  return (
    <>
      <PageHeader title="Receipts and bills">
        <Button onClick={() => setAdding(true)}>Add bill</Button>
      </PageHeader>

      <div className="mb-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="From" htmlFor="bills-from">
          <Input id="bills-from" type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
        </Field>
        <Field label="To" htmlFor="bills-to">
          <Input id="bills-to" type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} />
        </Field>
        <Field label="Approval" htmlFor="bills-approval">
          <Select
            id="bills-approval"
            value={filters.approval}
            onChange={(event) => update({ approval: event.target.value as ApprovalFilter })}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </Select>
        </Field>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-2">
        {filtersActive ? (
          <Button
            variant="quiet"
            onClick={() => {
              setFilters(emptyFilters);
              paging.setPage(0);
            }}
          >
            Clear filters
          </Button>
        ) : null}
        <Button
          variant="quiet"
          disabled={filtered.length === 0}
          onClick={() => downloadCsv('receipts-and-bills.csv', billsToCsv(filtered))}
        >
          Export CSV
        </Button>
      </div>

      {inverted ? (
        <p role="alert" className="mb-4 text-small font-semibold text-foreground">
          From date is after To date.
        </p>
      ) : null}

      <Panel>
        <QueryBoundary
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          isEmpty={!data?.length}
          empty={
            <div className="grid justify-items-start gap-1">
              <p className="text-body">No bills yet.</p>
              <Button variant="quiet" onClick={() => setAdding(true)}>
                Add the first bill
              </Button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <p className="p-6 text-body">No bills match these filters.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Bill type</TableHead>
                    <TableHead>Reimbursement</TableHead>
                    <TableHead>Uploaded by</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paging.pageRows.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="tabular whitespace-nowrap">{formatDate(bill.billDate)}</TableCell>
                      <TableCell className="tabular text-right">{formatCurrency(bill.amount)}</TableCell>
                      <TableCell>{bill.billType}</TableCell>
                      <TableCell>{bill.actualExpense ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{bill.uploadedBy}</TableCell>
                      <TableCell>
                        <Badge variant={bill.approved ? 'solid' : 'outline'}>
                          {bill.approved ? 'Approved' : 'Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                page={paging.page}
                pageCount={paging.pageCount}
                pageSize={paging.pageSize}
                total={paging.total}
                onPageChange={paging.setPage}
                onPageSizeChange={paging.setPageSize}
              />
            </>
          )}
        </QueryBoundary>
      </Panel>

      <AddBillDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}
```

- [ ] **Step 6: Route the page**

In `apps/core/src/app/app.tsx`, add the import and replace the bills route:

```tsx
import { BillsPage } from '@/features/bills/bills-page';
```

```tsx
        <Route path="finance/receipts-bills" element={<BillsPage />} />
```

- [ ] **Step 7: Run the tests and the checks**

Run: `pnpm nx run-many -t test lint typecheck -p core`
Expected: all PASS. If `add-bill-dialog.test.tsx` fails on `user.upload` because the file input receives no `FileList` instance, check that `value instanceof FileList` is true in jsdom for the value react-hook-form reads; do not loosen the schema, fix the test setup.

- [ ] **Step 8: Commit**

```bash
git add apps/core/src
git commit -m "feat(core): add the receipts and bills page with filters, add dialog and CSV export" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 15: Overview

**Files:**
- Create: `apps/core/src/features/overview/{summary.ts,summary.test.ts,overview-page.tsx,overview-page.test.tsx}`
- Modify: `apps/core/src/app/app.tsx`
- Delete: `apps/core/src/app/page-stub.tsx`

**Interfaces:**
- Consumes: `useProjects`, `Project` (Task 12); `useBills`, `Bill` (Tasks 13, 14); `formatCurrency`, `formatDate`, `pluralize`; `QueryBoundary`, `LinkArrow`.
- Produces: `summarize(projects, bills): OverviewSummary` where `OverviewSummary` is `{ projectCount, totalValue, totalOutstanding, topOutstanding: Project[] (up to 5, largest first, settled projects left out), pendingCount, pendingBills: Bill[] (up to 5, newest first) }`, and `OverviewPage`.

- [ ] **Step 1: Write the failing tests**

`apps/core/src/features/overview/summary.test.ts`:

```ts
import type { Bill } from '@/features/bills/types';
import type { Project } from '@/features/projects/types';
import { summarize } from './summary';

const project = (id: number, totalValue: number, totalOutstanding: number): Project => ({
  id,
  name: `Project ${id}`,
  description: '',
  client: 'Client A',
  totalValue,
  totalOutstanding,
});

const bill = (id: number, billDate: string, approved: boolean): Bill => ({
  id,
  billDate,
  amount: 10,
  billType: 'Regular',
  actualExpense: false,
  billPath: '',
  uploadedBy: 'Asha',
  submittedBy: 'Asha',
  approved,
  approvedBy: '',
});

describe('summarize', () => {
  it('totals value and outstanding across projects', () => {
    const summary = summarize([project(1, 1000, 200), project(2, 500, 0), project(3, 2500, 900)], []);
    expect(summary.projectCount).toBe(3);
    expect(summary.totalValue).toBe(4000);
    expect(summary.totalOutstanding).toBe(1100);
  });

  it('ranks the five largest outstanding amounts and leaves settled projects out', () => {
    const outstanding = [0, 10, 70, 30, 60, 50, 20];
    const summary = summarize(outstanding.map((amount, index) => project(index + 1, 100, amount)), []);
    expect(summary.topOutstanding.map((item) => item.id)).toEqual([3, 5, 6, 4, 7]);
  });

  it('counts every pending bill but lists only the five newest', () => {
    const pending = Array.from({ length: 7 }, (_, index) => bill(index + 1, `2023-08-0${index + 1}`, false));
    const summary = summarize([], [...pending, bill(8, '2023-09-01', true), bill(9, '2023-09-02', true)]);
    expect(summary.pendingCount).toBe(7);
    expect(summary.pendingBills.map((item) => item.id)).toEqual([7, 6, 5, 4, 3]);
  });

  it('copes with no data at all', () => {
    expect(summarize([], [])).toEqual({
      projectCount: 0,
      totalValue: 0,
      totalOutstanding: 0,
      topOutstanding: [],
      pendingCount: 0,
      pendingBills: [],
    });
  });
});
```

`apps/core/src/features/overview/overview-page.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { OverviewPage } from './overview-page';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const projects = [
  { id: 1, name: 'Project 1', description: '', client: 'Client A', totalValue: 48000, totalOutstanding: 12000 },
  { id: 2, name: 'Project 2', description: '', client: 'Client B', totalValue: 32000, totalOutstanding: 0 },
  { id: 3, name: 'Project 3', description: '', client: 'Client C', totalValue: 20000, totalOutstanding: 25000 },
];

const bill = (id: number, billDate: string, approved: boolean, uploadedBy: string) => ({
  id,
  billDate,
  amount: 100,
  billType: 'Regular',
  actualExpense: false,
  billPath: '',
  uploadedBy,
  submittedBy: uploadedBy,
  approved,
  approvedBy: approved ? 'Manager' : '',
});

const bills = [bill(1, '2023-08-08', true, 'Asha'), bill(2, '2023-08-09', false, 'Ben'), bill(3, '2023-08-10', false, 'Chen')];

function serve(data: { projects?: unknown[]; bills?: unknown[] }) {
  vi.mocked(api.get).mockImplementation((async (url: string) => ({
    data: url === '/projects' ? (data.projects ?? projects) : (data.bills ?? bills),
  })) as never);
}

const sentence = (expected: string) => (_: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent === expected;

afterEach(() => {
  vi.resetAllMocks();
});

describe('OverviewPage', () => {
  it('says what is outstanding and what waits for approval, from the data', async () => {
    serve({});
    renderWithProviders(<OverviewPage />);
    expect(
      await screen.findByText(sentence('$37,000 outstanding across 3 projects, of $100,000 in total.')),
    ).toBeInTheDocument();
    expect(screen.getByText(sentence('2 bills are waiting for approval.'))).toBeInTheDocument();
  });

  it('uses the singular for one project and one bill', async () => {
    serve({
      projects: [projects[0]],
      bills: [bill(1, '2023-08-08', false, 'Asha')],
    });
    renderWithProviders(<OverviewPage />);
    expect(
      await screen.findByText(sentence('$12,000 outstanding across 1 project, of $48,000 in total.')),
    ).toBeInTheDocument();
    expect(screen.getByText(sentence('1 bill is waiting for approval.'))).toBeInTheDocument();
  });

  it('says so when nothing waits for approval', async () => {
    serve({ bills: [bill(1, '2023-08-08', true, 'Asha')] });
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByText('No bills are waiting for approval.')).toBeInTheDocument();
  });

  it('lists the largest outstanding projects and the pending bills, newest first', async () => {
    serve({});
    renderWithProviders(<OverviewPage />);
    const largest = (await screen.findByRole('heading', { name: 'Largest outstanding' })).closest('section') as HTMLElement;
    const items = within(largest).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Project 3')).toBeInTheDocument();
    expect(within(items[0]).getByText('$25,000')).toBeInTheDocument();
    expect(within(items[1]).getByText('Project 1')).toBeInTheDocument();

    const waiting = screen.getByRole('heading', { name: 'Awaiting approval' }).closest('section') as HTMLElement;
    const pending = within(waiting).getAllByRole('listitem');
    expect(within(pending[0]).getByText(/Chen/)).toBeInTheDocument();
    expect(within(pending[1]).getByText(/Ben/)).toBeInTheDocument();
  });

  it('links on to the pages that hold the detail', async () => {
    serve({});
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByRole('link', { name: 'All projects' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: 'Review bills' })).toHaveAttribute('href', '/finance/receipts-bills');
  });

  it('shows an error with a retry when either request fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve({});
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(sentence('2 bills are waiting for approval.'))).toBeInTheDocument();
  });

  it('copes with no projects and no bills', async () => {
    serve({ projects: [], bills: [] });
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByText(sentence('$0 outstanding across 0 projects, of $0 in total.'))).toBeInTheDocument();
    expect(screen.getByText('Nothing is outstanding.')).toBeInTheDocument();
    expect(screen.getByText('No bills are waiting for approval.', { selector: 'p.text-statement' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm nx test core`
Expected: the two new test files FAIL with "Failed to resolve import".

- [ ] **Step 3: Write the summary**

`apps/core/src/features/overview/summary.ts`:

```ts
import type { Bill } from '@/features/bills/types';
import type { Project } from '@/features/projects/types';

const LIST_LENGTH = 5;

export interface OverviewSummary {
  projectCount: number;
  totalValue: number;
  totalOutstanding: number;
  /** Up to five projects, largest outstanding amount first. Settled projects are left out. */
  topOutstanding: Project[];
  pendingCount: number;
  /** Up to five pending bills, newest first. */
  pendingBills: Bill[];
}

const sum = (numbers: number[]) => numbers.reduce((total, value) => total + value, 0);

export function summarize(projects: Project[], bills: Bill[]): OverviewSummary {
  const pending = bills.filter((bill) => !bill.approved);
  return {
    projectCount: projects.length,
    totalValue: sum(projects.map((project) => project.totalValue)),
    totalOutstanding: sum(projects.map((project) => project.totalOutstanding)),
    topOutstanding: projects
      .filter((project) => project.totalOutstanding > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, LIST_LENGTH),
    pendingCount: pending.length,
    pendingBills: [...pending].sort((a, b) => b.billDate.localeCompare(a.billDate)).slice(0, LIST_LENGTH),
  };
}
```
Note `projects.filter(...)` returns a new array, so the `sort` does not reorder the caller's data.

- [ ] **Step 4: Write the page**

`apps/core/src/features/overview/overview-page.tsx`:

```tsx
import { useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { LinkArrow } from '@/components/ui/link-arrow';
import { useBills } from '@/features/bills/api';
import { useProjects } from '@/features/projects/api';
import { formatCurrency, formatDate, pluralize } from '@/lib/format';
import { summarize } from './summary';

export function OverviewPage() {
  const projects = useProjects();
  const bills = useBills();
  const summary = useMemo(() => summarize(projects.data ?? [], bills.data ?? []), [projects.data, bills.data]);

  return (
    <>
      <PageHeader title="Overview" />
      <QueryBoundary
        isLoading={projects.isLoading || bills.isLoading}
        isError={projects.isError || bills.isError}
        onRetry={() => {
          void projects.refetch();
          void bills.refetch();
        }}
        isEmpty={false}
        empty={null}
      >
        <div className="border-t border-navy">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-rule py-5">
            <p className="max-w-[40ch] text-statement">
              <span className="tabular font-semibold">{formatCurrency(summary.totalOutstanding)}</span> outstanding
              across {pluralize(summary.projectCount, 'project')}, of{' '}
              <span className="tabular font-semibold">{formatCurrency(summary.totalValue)}</span> in total.
            </p>
            <LinkArrow to="/projects">All projects</LinkArrow>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-rule py-5">
            <p className="max-w-[40ch] text-statement">
              {summary.pendingCount === 0
                ? 'No bills are waiting for approval.'
                : `${pluralize(summary.pendingCount, 'bill')} ${summary.pendingCount === 1 ? 'is' : 'are'} waiting for approval.`}
            </p>
            <LinkArrow to="/finance/receipts-bills">Review bills</LinkArrow>
          </div>
        </div>

        <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-2">
          <section aria-labelledby="largest-outstanding">
            <h2 id="largest-outstanding" className="text-title font-semibold">
              Largest outstanding
            </h2>
            {summary.topOutstanding.length === 0 ? (
              <p className="mt-3 border-t border-navy pt-3 text-body text-navy-80">Nothing is outstanding.</p>
            ) : (
              <ul className="mt-3 border-t border-navy">
                {summary.topOutstanding.map((project) => (
                  <li key={project.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                    <span>
                      <span className="block font-semibold">{project.name}</span>
                      <span className="block text-small text-navy-80">{project.client}</span>
                    </span>
                    <span className="tabular">{formatCurrency(project.totalOutstanding)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="awaiting-approval">
            <h2 id="awaiting-approval" className="text-title font-semibold">
              Awaiting approval
            </h2>
            {summary.pendingBills.length === 0 ? (
              <p className="mt-3 border-t border-navy pt-3 text-body text-navy-80">Nothing is waiting.</p>
            ) : (
              <ul className="mt-3 border-t border-navy">
                {summary.pendingBills.map((bill) => (
                  <li key={bill.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                    <span>
                      <span className="tabular block font-semibold">{formatDate(bill.billDate)}</span>
                      <span className="block text-small text-navy-80">
                        {bill.billType}, {bill.uploadedBy}
                      </span>
                    </span>
                    <span className="tabular">{formatCurrency(bill.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </QueryBoundary>
    </>
  );
}
```

- [ ] **Step 5: Route the page and delete the stub**

In `apps/core/src/app/app.tsx` replace the whole file with:

```tsx
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/app-shell';
import { NotFoundPage } from '@/app/not-found-page';
import { BillsPage } from '@/features/bills/bills-page';
import { CategoriesPage } from '@/features/categories/categories-page';
import { OverviewPage } from '@/features/overview/overview-page';
import { ProjectsPage } from '@/features/projects/projects-page';
import { TechnologiesPage } from '@/features/technologies/technologies-page';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="finance/receipts-bills" element={<BillsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="technologies" element={<TechnologiesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
```

```bash
git rm -q apps/core/src/app/page-stub.tsx
grep -rn "PageStub\|page-stub" apps/core/src && echo "STUB LEFT" || echo "no stubs left"
```
Expected: `no stubs left`.

- [ ] **Step 6: Run the tests and the checks**

Run: `pnpm nx run-many -t test lint typecheck build -p core`
Expected: all PASS, including `app.test.tsx` (its API mock returns empty lists, which the Overview now shows as zeros).

- [ ] **Step 7: Commit**

```bash
git add -A apps/core/src
git commit -m "feat(core): add the overview computed from projects and bills" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 16: End-to-end smoke tests and visual captures

**Files:**
- Create: `apps/core-e2e/src/support/api.ts`, `apps/core-e2e/src/e2e/visual.cy.ts`
- Replace: `apps/core-e2e/src/e2e/app.cy.ts`, `apps/core-e2e/src/support/commands.ts`
- Delete: `apps/core-e2e/src/support/app.po.ts`

**Interfaces:**
- Consumes: the whole app. The tests stub the API with `cy.intercept`, so they need no second process and are deterministic.
- Produces: `stubApi()` from `support/api.ts` (stubs every collection, with a stateful `/categories`), a smoke spec, and ten screenshots (five pages at 1440px and 390px) used by Task 17.

- [ ] **Step 1: Remove the generated spec's leftovers**

```bash
git rm -q apps/core-e2e/src/support/app.po.ts
```

Replace `apps/core-e2e/src/support/commands.ts` with:

```ts
// Custom commands go here. The generated `login` command was removed: the app has no authentication.
export {};
```

- [ ] **Step 2: Write the API stub**

`apps/core-e2e/src/support/api.ts`:

```ts
export const API = 'http://localhost:3001';

type Row = Record<string, unknown>;

const categories = (): Row[] =>
  Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    name: index === 0 ? 'Web' : `Category ${index + 1}`,
    description: `anything category-${index + 1}`,
    created: '2023-07-25',
    updated: '2023-07-25',
  }));

const bill = (id: number, billDate: string, approved: boolean, uploadedBy: string, amount: number): Row => ({
  id,
  billDate,
  amount,
  billType: id % 2 ? 'Regular' : 'Bonus',
  actualExpense: id % 2 === 0,
  billPath: `/path/to/bill/${id}`,
  uploadedBy,
  submittedBy: uploadedBy,
  approved,
  approvedBy: approved ? 'Manager' : '',
});

/** Stubs every collection. `/categories` keeps state so an add or a delete shows up on the next read. */
export function stubApi() {
  let rows = categories();

  cy.intercept('GET', `${API}/categories`, (req) => req.reply(rows));
  cy.intercept('POST', `${API}/categories`, (req) => {
    const created = { id: 100, ...req.body };
    rows = [...rows, created];
    req.reply(201, created);
  });
  cy.intercept('DELETE', `${API}/categories/*`, (req) => {
    const id = Number(req.url.split('/').pop());
    rows = rows.filter((row) => row.id !== id);
    req.reply({});
  });

  cy.intercept('GET', `${API}/technologies`, [
    { id: 1, name: 'React', description: 'A library for user interfaces.', category: 'Frontend' },
    { id: 2, name: 'Nest', description: 'A Node framework.', category: 'Backend' },
    { id: 3, name: 'Express', description: 'A web framework for Node.' },
  ]);

  cy.intercept(
    'GET',
    `${API}/projects`,
    Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      name: `Project ${index + 1}`,
      description: `anything project-${index + 1}`,
      client: `Client ${String.fromCharCode(65 + (index % 5))}`,
      totalValue: 20000 + index * 7000,
      totalOutstanding: index % 3 === 1 ? 0 : 3000 + index * 2500,
    })),
  );

  cy.intercept('GET', `${API}/bills`, [
    bill(1, '2023-08-10', true, 'John Doe', 100),
    bill(2, '2023-08-09', false, 'Jane Smith', 200),
    bill(3, '2023-08-08', true, 'Michael Johnson', 50),
    bill(4, '2023-08-07', false, 'Priya Nair', 75.5),
    bill(5, '2023-08-06', true, 'John Doe', 300),
    bill(6, '2023-08-05', false, 'Jane Smith', 120),
  ]);
}
```

- [ ] **Step 3: Write the smoke spec**

`apps/core-e2e/src/e2e/app.cy.ts`:

```ts
import { stubApi } from '../support/api';

const nav = 'nav[aria-label="Main"]';

describe('core', () => {
  beforeEach(() => {
    stubApi();
    cy.viewport(1280, 800);
    cy.visit('/');
  });

  it('moves through every page from the sidebar', () => {
    cy.contains('h1', 'Overview');
    for (const page of ['Projects', 'Receipts and bills', 'Categories', 'Technologies', 'Overview']) {
      cy.get(nav).contains('a', page).click();
      cy.contains('h1', page);
    }
  });

  it('marks only the current page', () => {
    cy.get(nav).contains('a', 'Categories').click();
    cy.get(`${nav} a[aria-current="page"]`).should('have.length', 1).and('contain', 'Categories');
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

    cy.contains('button', 'Delete Data').click();
    cy.get('[role="alertdialog"]').should('contain', 'This cannot be undone.');
    cy.get('[role="alertdialog"]').contains('button', 'Delete category').click();
    cy.contains('td', 'Data').should('not.exist');
  });

  it('exports the filtered bills as a CSV file', () => {
    cy.get(nav).contains('a', 'Receipts and bills').click();
    cy.get('#bills-approval').select('approved');
    cy.contains('button', 'Export CSV').click();
    cy.readFile(`${Cypress.config('downloadsFolder')}/receipts-and-bills.csv`)
      .should('contain', 'Bill date,Amount,Bill type')
      .and('contain', 'John Doe')
      .and('not.contain', 'Jane Smith');
  });
});
```

`apps/core-e2e/src/e2e/visual.cy.ts`:

```ts
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
```

- [ ] **Step 4: Run them**

```bash
pnpm exec cypress verify || pnpm exec cypress install
pnpm nx e2e core-e2e --headless
find dist/cypress -name '*.png' | sort
```
Expected: both specs PASS (4 smoke tests and 10 captures) and ten PNG files are listed.

- [ ] **Step 5: Commit**

```bash
git add -A apps/core-e2e
git commit -m "test(core): replace the generated e2e spec with a stubbed smoke test and visual captures" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 17: DESIGN.md and one batched design review

Impeccable asks for bounded passes: build fully, inspect once with a batched round (desktop and mobile together), fix everything in one batch, confirm with at most one more round, then stop.

**Files:**
- Create: `DESIGN.md` (repo root)
- Modify: whatever the review findings require under `apps/core/src`

**Interfaces:**
- Consumes: Task 3's PRODUCT.md, Task 16's ten screenshots, the built design system.
- Produces: `DESIGN.md`, the record of the app's design system and its deliberate differences from the website.

- [ ] **Step 1: Load the skill context**

```bash
IMPECCABLE="$HOME/.claude/plugins/marketplaces/impeccable/plugin/skills/impeccable"
"$IMPECCABLE/scripts/impeccable" context --target apps/core/src/styles.css
```
Run from the repo root. If the launcher fails, send the fallback message from Task 3 first.

- [ ] **Step 2: Write DESIGN.md with `document`**

Read `$IMPECCABLE/reference/document.md` fully and follow it, documenting the built system from `apps/core/src/styles.css` and `apps/core/src/components/ui`. The website's `../octa-website/DESIGN.md` is the lineage; do not copy its marketing sections. DESIGN.md must record these deliberate differences, so a later reader does not "fix" them back:
- The sidebar is a navy field with no top-left cut (the website cuts fields top-left; a full-height sidebar would only reveal a grey wedge at the window corner).
- Dialogs use a `clip-path` cut on a grey fill over the scrim; framed panels use the website's corner svg on the grey ground.
- shadcn's `accent` is the Soft Hairline hover fill, not teal; teal is `signal`. `destructive` is navy, because the website has no red.
- App text never goes below 14px (the website's 13px Label is not used); sidebar group names use Small, uppercase, tracked.
- Select and radio groups are native elements styled as underline fields and chips, not Radix components.
- No icon set: every mark is drawn (`marks.tsx`).

- [ ] **Step 3: Check and commit DESIGN.md**

Run: `grep -nE "^(name|description|colors|typography|rounded|components):" DESIGN.md`
Expected: the frontmatter has all five blocks, `rounded` is `none: "0"`, and every colour in `colors` appears in `apps/core/src/styles.css`.

```bash
git add DESIGN.md
git commit -m "docs(core): add DESIGN.md for the core app" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Review the captures once**

Read `$IMPECCABLE/reference/critique.md` and `$IMPECCABLE/reference/audit.md`. Open the ten screenshots from `dist/cypress/apps/core-e2e/screenshots/` (use the image viewer) and review them together with the code, once, against PRODUCT.md, DESIGN.md and the Global Constraints. Check at least:
- The sidebar is navy with white and Mist text, the current page has a teal arm, and the logo is reversed (white wordmark, teal arm).
- Panels have a 1px navy frame with one 45 degree cut at the bottom right; nothing else is rounded or shadowed.
- Underline fields, 44px rows and targets, tabular amounts and dates.
- At 390px: the header with the menu button, no horizontal page scroll (tables scroll inside their panel), the page title and its action wrapping cleanly.
- Contrast pairs: Muted Navy `#4d6e85` text on Paper Grey, Slate Navy on Soft Hairline, teal arms never used as text on grey. Compute the ratios; do not eyeball them.
- Keyboard: tab through the sidebar, a form dialog and the confirm dialog; focus is always visible and returns to the trigger on close.

- [ ] **Step 5: Fix everything in one batch, then confirm once**

Write the findings as one list in `.impeccable/critique/core-redesign.md` (create the folder if needed), fix every finding that is a defect in one batch, and commit. Then run `pnpm nx e2e core-e2e --headless` once more, re-open only the screenshots affected, and stop. Findings that are preferences rather than defects go in that file under "Not done" with a reason, not into code.

```bash
pnpm nx run-many -t lint test typecheck build -p core
git add -A apps/core .impeccable
git commit -m "fix(core): address design review findings" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 18: Final verification, README and branch handoff

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-14-core-redesign-design.md`

**Interfaces:**
- Consumes: everything.
- Produces: a verified branch ready for review.

- [ ] **Step 1: Run every gate from a clean state**

```bash
pnpm install --frozen-lockfile
pnpm nx run-many -t lint test typecheck build -p core
pnpm nx build external--portfolio
pnpm nx e2e core-e2e --headless
```
Expected: all succeed.

- [ ] **Step 2: Check the standing rules**

```bash
grep -rn "PageStub\|page-stub" apps/core/src && echo "STUB LEFT" || echo "no stubs left"
grep -nE "lucide|@mui|@emotion|styled-components|formik|\"yup\"|vuetify|\"vue\"" package.json && echo "OLD DEPENDENCY LEFT" || echo "no old dependencies"
grep -rnE "getBills" apps json-server --include='*.ts' --include='*.tsx' --include='*.json' | grep -v node_modules && echo "OLD ROUTE LEFT" || echo "no old bills route"
git status --short
```
Expected: `no stubs left`, `no old dependencies`, `no old bills route`, and `git status` showing only `.agents/` and `skills-lock.json` as untracked.

- [ ] **Step 3: Run the real thing against a copy of the mock database**

Use a copy so the committed `db.json` stays clean:

```bash
cp json-server/db.json "$TMPDIR/octacore-db.json"
pnpm exec json-server --watch "$TMPDIR/octacore-db.json" --port 3001 &
pnpm nx serve core
```
In the browser at `http://localhost:4200`, check by hand: the Overview figures match the projects and bills; add, edit and delete a category and watch the table update; add a bill with an image, see it pending at the top, filter and export it; stop the API and reload to see the error state and the Try again button. Then stop both processes.

Run: `git status --short json-server/db.json`
Expected: no output (the committed file is untouched).

- [ ] **Step 4: Update the README**

Replace the "Start the app" section of `README.md` with:

````markdown
## Start the app

Two processes: the mock API and the app.

```bash
pnpm start:api       # json-server on http://localhost:3001 (json-server/db.json)
pnpm nx serve core   # the app on http://localhost:4200
```

Set `VITE_API_URL` (see `apps/core/.env.example`) to point the app at another API.
````

- [ ] **Step 5: Mark the spec implemented**

In `docs/superpowers/specs/2026-10-14-core-redesign-design.md`, change `Status: draft for review` to `Status: implemented on branch feature/core-redesign`.

- [ ] **Step 6: Commit and hand off**

```bash
git add README.md docs/superpowers/specs/2026-10-14-core-redesign-design.md
git commit -m "docs(core): document how to run the core app" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Then use superpowers:finishing-a-development-branch to present the options for integrating `feature/core-redesign`. Do not push or open a pull request without the human partner's say-so.
