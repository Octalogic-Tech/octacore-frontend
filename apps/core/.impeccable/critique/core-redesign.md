# Core redesign: one batched design review

Method: one pass over ten page captures (five pages at 1440px and 390px), four overlay captures (mobile menu, add bill, add bill with errors, delete confirmation) and the code, against PRODUCT.md, DESIGN.md and the plan's Global Constraints. The mechanical detector (`impeccable detect --json src`) returned `[]`. Fixes were made in one batch; the captures were regenerated once to confirm.

## Fixed

1. **Reversed logo was not reversed** (defect). The wordmark stayed dark navy on the navy sidebar and only the teal arm showed. Cause: the SVG carries its own unlayered `<style>`, and an unlayered rule beats any layered one whatever its specificity, so the reversal rule inside `@layer components` never applied. The rule now lives outside the layer.
2. **Resting nav arms were too dim** (defect against the system). They were Navy Rule on navy (1.52:1); the website's Arm at Rest rule says Mist on navy. Now Mist.
3. **Add bill dialog was about 1,000px tall**, so Save was below the fold on a 900px screen. Fields now sit in two columns from 640px and the dialog is wider; Save is visible at 900px.
4. **Overview sentence wrapped early** and left "in total." alone on a line; the 40ch cap is now 64ch.
5. **1440px captures were cropped to 1280px** by Electron's default window (a tooling defect, not an app overflow). The Cypress config now opens a larger window.

## Contrast (measured)

navy on grey 10.54; Slate Navy on grey 5.76; Muted Navy on grey 4.82; Slate Navy on Soft Hairline 5.00; Muted Navy on Soft Hairline 4.19 (not used for text); white on navy 11.82; Mist on navy 7.37; teal on navy 7.60; white on Night Navy 13.81.

## Not done

- **A user menu or sign-in control.** Sign-in is planned, not built; the spec says no controls that do nothing.
- **Restacking tables on phones.** Tables scroll sideways inside their panel, as decided in the spec.
- **A newly added row can land on a later page** and not be visible until the user searches or pages. A preference-level UX improvement outside the spec.
- **Hover-row Muted Navy contrast (4.19).** No text uses that pair, so nothing to change; recorded in DESIGN.md as a rule.
