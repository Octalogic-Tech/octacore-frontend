---
name: Octacore
description: Octalogic's internal operations app, in the octa-website's system: navy, teal and grey, square corners, hairlines, the arm.
colors:
  grey: "#f2f2f0"
  navy: "#0d3a5c"
  navy-deep: "#0a2f4b"
  navy-80: "#3f627d"
  navy-72: "#4d6e85"
  rule: "#c4cdd2"
  rule-soft: "#e0e3e4"
  teal: "#60e4cf"
  on-navy: "#ffffff"
  on-navy-muted: "#c2ced6"
  rule-on-navy: "#2f5672"
typography:
  headline:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Fallback, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 1.6rem + 1.2vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.022em"
  statement:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Fallback, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1.25rem + 0.55vw, 1.625rem)"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Fallback, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 1.15rem + 0.45vw, 1.5rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  lead:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Fallback, system-ui, sans-serif"
    fontSize: "clamp(1.1875rem, 1.139rem + 0.217vw, 1.3125rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Fallback, system-ui, sans-serif"
    fontSize: "clamp(1rem, 0.976rem + 0.109vw, 1.0625rem)"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Fallback, system-ui, sans-serif"
    fontSize: "clamp(0.875rem, 0.851rem + 0.109vw, 0.9375rem)"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0"
spacing:
  target: "44px"
  gutter-sm: "20px"
  gutter-md: "32px"
  gutter-lg: "40px"
  content: "1200px"
  sidebar: "256px"
  header-sm: "64px"
  panel-cut: "28px"
components:
  sidebar:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-navy-muted}"
    rounded: "{rounded.none}"
    width: "256px"
  nav-link:
    textColor: "{colors.on-navy-muted}"
    typography: "{typography.body}"
    height: "44px"
  nav-link-current:
    textColor: "{colors.on-navy}"
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-navy}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    height: "52px"
  button-primary-cell:
    backgroundColor: "{colors.navy-deep}"
    textColor: "{colors.teal}"
    size: "52px"
  button-primary-cell-hover:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.navy}"
  button-quiet:
    textColor: "{colors.navy}"
    typography: "{typography.body}"
    height: "44px"
  input-underline:
    textColor: "{colors.navy}"
    typography: "{typography.lead}"
    rounded: "{rounded.none}"
    height: "48px"
  panel:
    backgroundColor: "{colors.grey}"
    textColor: "{colors.navy}"
    rounded: "{rounded.none}"
  dialog:
    backgroundColor: "{colors.grey}"
    textColor: "{colors.navy}"
    rounded: "{rounded.none}"
  popover:
    backgroundColor: "{colors.grey}"
    textColor: "{colors.navy}"
    rounded: "{rounded.none}"
  avatar:
    backgroundColor: "{colors.navy-deep}"
    textColor: "{colors.on-navy}"
    rounded: "{rounded.none}"
    size: "36px"
  badge-solid:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-navy}"
    rounded: "{rounded.none}"
    height: "28px"
  badge-outline:
    textColor: "{colors.navy}"
    rounded: "{rounded.none}"
    height: "28px"
  table-row:
    textColor: "{colors.navy}"
    typography: "{typography.small}"
    height: "44px"
---

# Design System: Octacore

## Overview

**Creative North Star: "The Asterisk, at Work"**

Octacore is the octa-website's system doing a different job. The website persuades; this app is operated by the four partners to see what is owed, follow invoices and keep reference data straight. So the identity is the same and the volume is lower. The page is Paper Grey with navy ink, rules are hairlines, every corner is square, and the logo's offset arm is the one recurring device: it marks the current page, leads every field label and sits in every primary button. Nothing floats, glows or rounds.

The app speaks in numbers inside sentences ("$55,000 outstanding across 8 projects"), not in tiles, and gets out of the way: no onboarding, no marketing language, no motion beyond hover and focus.

The visual world was set by the brief ("based off the octa-website") and is taken from `../../../octa-website/DESIGN.md`; this file records what was built from it and where it differs.

**Key Characteristics:**
- Grey ground, navy ink, a navy sidebar; teal is a signal, never decoration or text on grey.
- Hairline rules at 0 degrees; framed panels with one 45 degree cut at the bottom right.
- Square corners everywhere. No shadows (one 1px seam inside the primary button), no gradients, no red.
- Underline fields; a drawn arm leads each label and turns teal while the field has focus.
- One icon set, for table row actions only: Lucide through `react-icons/lu`. Every other mark (the arm, the arm-arrow, the tick, chevron, close) is drawn.

## Colors

Exactly the website's palette; no other colour enters the app.

- **Octalogic Navy** (navy): ink on grey, the sidebar, primary buttons, solid badges, the frame of panels.
- **Night Navy** (navy-deep): the resting arm cell of a primary button.
- **Arm Teal** (teal): action and current state only: the current nav arm, the button cell on hover and focus, the label arm while a field has focus, the underline under a hovered quiet button or icon button. It never carries text on grey (1.39:1).
- **Paper Grey** (grey): the page, panels and dialogs. There is no white surface; white is only text on navy.
- **Slate Navy** (navy-80): secondary text, table headings, descriptions. **Muted Navy** (navy-72): placeholders, hints and the resting rule of a field.
- **Hairline** (rule) and **Soft Hairline** (rule-soft): row dividers and the hover fill of a row.
- **Mist** (on-navy-muted): text and resting arms on navy. **Navy Rule** (rule-on-navy): reserved for dividers on navy.

Measured contrast: navy on grey 10.54:1; Slate Navy on grey 5.76:1; Muted Navy on grey 4.82:1; Slate Navy on Soft Hairline 5.00:1; white on navy 11.82:1; Mist on navy 7.37:1; teal on navy 7.60:1; white on Night Navy 13.81:1. Muted Navy on Soft Hairline is 4.19:1, so Muted Navy text is never placed on a hover fill.

### Named Rules
**The Teal Is a Signal Rule.** Teal means action, current state or the brand's own arm. A resting arm is Hairline on grey and Mist on navy, and turns teal on hover, focus or current.
**The Three Colours Rule.** Nothing is added that is not navy, teal, grey or a tint of them. `src/design-contract.test.ts` fails the build on any other colour.

## Typography

**Font:** Schibsted Grotesk Variable (self-hosted through `@fontsource-variable/schibsted-grotesk`), with the website's metric-matched Arial fallback and `system-ui`. One family; weight and size carry the hierarchy.

- **Headline** (600, 30 to 44px): the page title, one per page.
- **Statement** (400, 22 to 26px): the Overview's sentences, with the figures at 600.
- **Title** (600, 20 to 24px): dialog titles and Overview section headings.
- **Lead** (400, 19 to 21px): the text inside a field.
- **Body** (400, 16 to 17px): running text, buttons (600) and navigation (500).
- **Small** (400, 14 to 15px): table text, labels (600), hints and metadata.

Nothing in the app is smaller than 14px. Amounts and dates use tabular figures (`tabular`). Headings wrap balanced and paragraphs wrap pretty.

## Layout

A navy sidebar of 256px from 1024px; below that a 64px header with the logo and a menu button that opens the same navigation in a sheet. The content column is at most 1200px with fluid gutters (20px on phones, 32px from 768px, 40px from 1280px). Pages are one column: the page title with its action on one line, the filters or search, then a framed panel holding the table and its pager. Tables scroll sideways inside their panel below 768px; the page itself never scrolls sideways. Every interactive target is at least 44px.

## Elevation & Depth

Flat. Depth is ground and tone: the grey page, the navy sidebar, the framed panel. A scrim (`rgb(3 17 29 / 0.45)`) sits behind dialogs and the menu sheet. The only box-shadow in the app is the 1px inset seam between a primary button's label and its arm cell.

## Shapes

Every corner is square (radius 0). The one non-rectangular silhouette is the 45 degree cut at the bottom right of an object: framed panels draw it with a small svg over a real 1px navy frame, so all four sides weigh the same; dialogs on the scrim use a clip-path cut on a grey fill. The sidebar is a navy field with no cut.

**The arm** is a 2px bar at 45 degrees, rotated around its left end. It leads nav links and field labels, and swings into an arrow inside buttons and arrow links.

## Components

### Buttons
A label and a square arm cell, 52px tall; one primary per screen. Hover and keyboard focus fill the cell teal and swing the arm into an arrow (220ms and 320ms). The quiet variant is plain text, 44px tall, with a teal underline on hover and focus; it is used for Cancel, Previous and Next. A table row's actions (Edit, Delete, Preview and the like) are icon buttons instead: one Lucide mark in a 44px square with no text, named by its `aria-label` and tooltip ("Edit Acme"), and a teal bar under the mark on hover and focus.

### Navigation
Logo, then three groups of text links (Work, Finance, Reference data). Group names are Small, uppercase and tracked, in Mist. The current page is white with a teal arm and `aria-current="page"`; other links are Mist with a Mist arm that lengthens and turns teal on hover.

### Account
At the foot of the sidebar and the menu sheet, a single 44px button: the person's initials in a square Night Navy tile (first letter of the first and last word of the name), the name, and a drawn chevron. It opens a popover upward, as wide as the button, with the email and then Change password and Sign out as quiet buttons. The popover is a grey object with a 1px navy frame: flat, no scrim, and it closes on Escape, an outside click or a choice. Change password closes it and opens its dialog, and focus comes back to the name button.

### Inputs
Underline fields: no box, no fill. A 1px Muted Navy rule that turns navy on hover and firms to 3px navy on focus, with padding compensating so nothing moves. A drawn arm leads the label. Errors are a 2px navy rule and a navy arm before the message, announced with `role="alert"`; there is no red. Select is a native select with a drawn chevron; the Yes and No choice is a pair of native radio buttons styled as 44px chips, the chosen one a navy block.

### Tabs
A page with more than one subject splits into tabs: text only (the icon set is for row actions), 44px tall, on a navy rule the width of the content. Labels are Slate Navy; hover, keyboard focus and the selected tab turn them Octalogic Navy, and the selected tab also carries a 3px teal bar on the rule. A count follows the name in regular weight ("Invoices 4") once it is known. The selected tab lives in the address (`?tab=`, bare for the first tab), replacing the history entry so Back leaves the page; an unknown value opens the first tab. Only the open tab is on the page.

### Panels and tables
A framed panel (grey, 1px navy frame, one cut corner) holds a table: a navy rule under the heads, Hairline between rows, rows at least 44px, amounts right-aligned in tabular figures, a pager at the foot (rows per page, range, Previous and Next).

### Dialogs
A grey object on the scrim with the cut corner, the title at Title size, a description, a 44px close button and the form below. A destructive action asks in an alert dialog with explicit wording ("Delete category “Web”? This cannot be undone.") and a navy button, never red.

### Badges
Status is a word, not a colour: navy filled while money is still owed (Unpaid, Overdue), outlined for Paid.

### States
Loading is five grey rows. A failed request is an inline message with a Try again button. An empty table says what is missing and offers the add action. A search with no match says so.

## Do's and Don'ts

### Do:
- **Do** keep teal a signal and every corner square.
- **Do** draw marks (arm, tick, chevron, close) rather than importing an icon set, and give a row action an icon button with a label that names the row.
- **Do** put amounts and dates in tabular figures and keep every target at least 44px.
- **Do** say what is true in loading, empty and error states.
- **Do** keep motion to hover and focus, and respect `prefers-reduced-motion`.

### Don't:
- **Don't** use red, gradients, glows or shadows; delete is a confirmation, not a colour.
- **Don't** round a corner.
- **Don't** add an icon set other than Lucide (the design-contract test fails on one), or use icons outside table row actions.
- **Don't** put teal text on grey, or Muted Navy text on a hover fill.
- **Don't** build metric tiles; put numbers inside a sentence on a ruled line.
- **Don't** show a control until the thing behind it exists. Sign-in exists, so the login page and the account popover (Change password, Sign out) are shown; a settings control still waits for something real behind it.

## Differences from octa-website

Deliberate, so a later reader does not "fix" them back:
- The sidebar is a navy field with no top-left cut: a full-height sidebar would only reveal a grey wedge at the window corner.
- Dialogs use a clip-path cut; framed panels use the corner svg. The website uses the svg technique for panels only.
- shadcn's `accent` token is the Soft Hairline hover fill, not teal; teal is the separate `signal` token. `destructive` is navy.
- Text is never below 14px, so the website's 13px Label is not used; sidebar group names use Small.
- Select and the Yes and No choice are native elements, not Radix components. Dialogs, the menu sheet and the account popover are Radix.
- The avatar is a square initials tile, not a circle: every corner is square, and there is no photo to show.
- The resting colour of an arm on navy is Mist, as on the website. An earlier build used Navy Rule (1.52:1) and was corrected in review.
- No scroll reveals or play-once motion: this is an operating tool.
