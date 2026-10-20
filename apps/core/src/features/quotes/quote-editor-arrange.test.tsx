import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { quoteEnvelope } from '@/test/fixtures/quotes';
import {
  addLine,
  addSection,
  describeLine,
  descriptionButton,
  descriptionDialog,
  descriptionOf,
  lineGroup,
  markerOf,
  renderEditor,
  retype,
  saved,
  sectionGroup,
  serve,
  serveSections,
} from '@/test/quote-editor';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  serve();
});

// dnd-kit listens on the document, which outlives a test (see the kanban's tests): each test ends with every drag let go.
afterEach(async () => {
  fireEvent.keyDown(document, { code: 'Escape' });
  fireEvent.mouseUp(document);
  await new Promise((resolve) => setTimeout(resolve, 10));
  vi.resetAllMocks();
});

const sectionCount = () => screen.getAllByRole('group', { name: /^Section \d+$/ }).length;
/** The titles of the lines in one section, in order. */
const linesOf = (section: number) =>
  within(sectionGroup(section))
    .queryAllByRole('textbox', { name: /^Line \d+ title$/ })
    .map((input) => (input as HTMLInputElement).value);
const follows = (first: Element, second: Element) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
const handle = (name: string) => screen.getByRole('button', { name });
/** The text the screen reader is told during a drag: dnd-kit's live region. */
const announced = () =>
  Array.from(document.querySelectorAll('[role="status"][aria-live="assertive"]'))
    .map((region) => region.textContent)
    .join(' ');

/** Focuses a drag handle and picks it up with Space, as a keyboard user does. */
async function pickUp(user: UserEvent, name: string) {
  handle(name).focus();
  await user.keyboard(' ');
}

const lineOf = (title: string, hours = 1) => ({ title, description: '', units: 1, hoursPerUnit: hours });
const patched = () => vi.mocked(coreApi.patch).mock.calls[0][1] as { sections: { title: string; lines: { title: string }[] }[] };
const shapeOf = (body: ReturnType<typeof patched>) =>
  body.sections.map((section) => [section.title, section.lines.map((line) => line.title)]);

describe('QuoteEditorPage, the footer row of a section', () => {
  it('puts Add line at the left and Add section at the right, under the section’s lines, and none in the header', () => {
    renderEditor('/quotes/new');
    const line = addLine(1);
    const section = addSection(1);
    expect(line).toHaveTextContent('Add line');
    expect(section).toHaveTextContent('Add section');
    // One row, the two ends of it.
    const footer = line.parentElement as HTMLElement;
    expect(footer).toBe(section.parentElement);
    expect(footer).toHaveClass('flex', 'justify-between');
    expect(follows(line, section)).toBe(true);
    // Under the lines, inside the section; the header holds the title, the hours and the remove button only.
    expect(sectionGroup(1)).toContainElement(footer);
    expect(follows(lineGroup(1), footer)).toBe(true);
    expect(follows(screen.getByLabelText('Section 1 title'), line)).toBe(true);
    expect(within(sectionGroup(1)).getAllByRole('button', { name: /^Add (line|section)/ })).toEqual([line, section]);
  });

  it('gives every section its own footer, named for it', async () => {
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    expect(within(sectionGroup(1)).getAllByRole('button', { name: /^Add (line|section)/ }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add line to section 1',
      'Add section after section 1',
    ]);
    expect(within(sectionGroup(2)).getAllByRole('button', { name: /^Add (line|section)/ }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add line to section 2',
      'Add section after section 2',
    ]);
    // No Add section is left standing after the last section.
    expect(screen.getAllByRole('button', { name: /^Add section/ })).toHaveLength(2);
  });

  it('inserts a section right after the one whose footer was used, with one blank line, and focuses its title', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    await user.click(addSection(1));

    expect(sectionCount()).toBe(3);
    expect(screen.getByLabelText('Section 1 title')).toHaveValue('Screens');
    const title = screen.getByLabelText('Section 2 title');
    expect(title).toHaveValue('');
    expect(title).toHaveFocus();
    expect(screen.getByLabelText('Section 3 title')).toHaveValue('Reports');
    expect(linesOf(1)).toEqual(['Sign-in screens', 'Chart tiles']);
    expect(linesOf(2)).toEqual(['']);
    expect(within(sectionGroup(2)).getByLabelText('Line 3 units')).toHaveValue('1');
    expect(linesOf(3)).toEqual(['Export to CSV']);
  });

  it('adds a line to its own section and focuses its title', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    await user.click(addLine(1));
    expect(linesOf(1)).toEqual(['Sign-in screens', 'Chart tiles', '']);
    expect(screen.getByLabelText('Line 3 title')).toHaveFocus();
    expect(linesOf(2)).toEqual(['Export to CSV']);
  });

  it('disables Add line at 200 lines, and lets Add section make a section with no line then', async () => {
    const user = userEvent.setup();
    serveSections(40, [
      { id: 1, title: 'Many', lines: Array.from({ length: 200 }, (_unused, index) => ({ id: index + 1, ...lineOf(`Item ${index + 1}`) })) },
    ]);
    renderEditor('/quotes/40');
    // By id: role and label queries over 200 rows are slow in jsdom.
    const byId = (id: string) => document.getElementById(id) as HTMLElement;
    await waitFor(() => expect(byId('line-200-title')).not.toBeNull());
    expect(byId('section-1-add-line')).toHaveAccessibleName('Add line to section 1');
    expect(byId('section-1-add-line')).toBeDisabled();
    expect(byId('section-1-add-section')).toBeEnabled();
    await user.click(byId('section-1-add-section'));
    expect(byId('section-2-title')).toHaveFocus();
    expect(byId('section-2-title').closest('[role="group"]')).toHaveTextContent('No lines in this section yet.');
    expect(document.getElementById('line-201-title')).toBeNull();
    expect(byId('section-2-add-line')).toBeDisabled();
  }, 15_000);

  it('disables every Add section at 50 sections', async () => {
    serveSections(
      41,
      Array.from({ length: 50 }, (_unused, index) => ({ id: index + 1, title: `Part ${index + 1}`, lines: [{ id: index + 1, ...lineOf(`Item ${index + 1}`) }] })),
    );
    renderEditor('/quotes/41');
    await screen.findByLabelText('Section 50 title');
    const buttons = screen.getAllByRole('button', { name: /^Add section after section \d+$/ });
    expect(buttons).toHaveLength(50);
    for (const button of buttons) expect(button).toBeDisabled();
    expect(addLine(50)).toBeEnabled();
  }, 15_000);

  it('moves focus to the Add section before a removed section, or to the first one’s when the first goes', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.click(addSection(1));
    await user.click(screen.getByRole('button', { name: 'Remove section 2' }));
    expect(sectionCount()).toBe(1);
    expect(addSection(1)).toHaveFocus();

    await user.click(addSection(1));
    await user.type(screen.getByLabelText('Section 2 title'), 'Second');
    await user.click(screen.getByRole('button', { name: 'Remove section 1' }));
    expect(sectionCount()).toBe(1);
    expect(screen.getByLabelText('Section 1 title')).toHaveValue('Second');
    await waitFor(() => expect(addSection(1)).toHaveFocus());
  });

  it('moves focus the same way after a removal it asked about', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    await user.click(screen.getByRole('button', { name: 'Remove section 2' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Remove section 2?' })).getByRole('button', { name: 'Remove section' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(addSection(1)).toHaveFocus());
  });

  it('refuses a save once every line is gone, saying a line is needed', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Title'), 'Empty');
    await user.click(addSection(1));
    // Two lines now, so the first can go; then the second section, blank, goes at once.
    await user.click(screen.getByRole('button', { name: 'Remove line 1' }));
    await user.click(screen.getByRole('button', { name: 'Remove section 2' }));
    expect(sectionCount()).toBe(1);
    expect(screen.queryByRole('group', { name: /^Line \d+$/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Add at least one line')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
    // A line can still be added from the footer.
    await user.click(addLine(1));
    expect(screen.getByLabelText('Line 1 title')).toHaveFocus();
  });
});

describe('QuoteEditorPage, titles without helper text', () => {
  it('shows no message for a blank line or section title, but marks the field and tells assistive technology', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Title'), 'Website build');
    await retype(user, screen.getByLabelText('Section 1 title'), '');
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '4');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    for (const [id, message] of [
      ['section-1-title', 'Section title is required'],
      ['line-1-title', 'Title is required'],
    ]) {
      const input = await waitFor(() => {
        const field = document.getElementById(id) as HTMLElement;
        expect(field).toHaveAttribute('aria-invalid', 'true');
        return field;
      });
      expect(input).toHaveAttribute('aria-describedby', `${id}-error`);
      expect(input).toHaveAccessibleDescription(message);
      const text = document.getElementById(`${id}-error`) as HTMLElement;
      expect(text).toHaveAttribute('role', 'alert');
      expect(text).toHaveClass('sr-only');
      // The input's own invalid state draws the heavier navy rule; no red.
      expect(input).toHaveClass('aria-invalid:border-b-2', 'aria-invalid:border-foreground');
    }
    // Nothing is shown in the line or the header: every copy of a title message is for screen readers only.
    for (const text of screen.queryAllByText(/^(Section title|Title) is required$/)) {
      if (text.id !== 'quote-title-error') expect(text).toHaveClass('sr-only');
    }
    expect(within(lineGroup(1)).queryAllByRole('alert').filter((alert) => !alert.classList.contains('sr-only'))).toEqual([]);
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('keeps the visible messages of the other line fields', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Title'), 'Website build');
    await user.type(screen.getByLabelText('Line 1 title'), 'Home');
    await retype(user, screen.getByLabelText('Line 1 units'), '');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await within(lineGroup(1)).findByText('Units are required')).not.toHaveClass('sr-only');
    expect(within(lineGroup(1)).getByText('Hours are required')).not.toHaveClass('sr-only');
  });

  it('moves focus to the first wrong field in the order shown, across sections, and opens nothing', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Title'), 'Website build');
    await user.type(screen.getByLabelText('Line 1 title'), 'Home');
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '4');
    // A second section with a blank title, then a blank line added to the first section after it: in the order shown,
    // that line comes first, though its fields were made last.
    await user.click(addSection(1));
    await user.type(screen.getByLabelText('Line 2 title'), 'Cart');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '2');
    await user.click(addLine(1));
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '1');
    expect(within(sectionGroup(1)).getByLabelText('Line 2 title')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('Line 2 title')).toHaveFocus());
    // Let any later pass at focusing go by: the first wrong field keeps it.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.getByLabelText('Line 2 title')).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(coreApi.post).not.toHaveBeenCalled();

    // With that line fixed, the next is the second section's title.
    await user.type(screen.getByLabelText('Line 2 title'), 'Contact');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('Section 2 title')).toHaveFocus());
    expect(coreApi.post).not.toHaveBeenCalled();
  });
});

describe('QuoteEditorPage, the description dialog', () => {
  it('opens with the caret after the text, so typing adds to it', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/7');
    await user.click(await screen.findByRole('button', { name: 'Edit description of line 1' }));
    const text = within(descriptionDialog()).getByLabelText('Description') as HTMLTextAreaElement;
    expect(text).toHaveFocus();
    const length = 'Email and password, with a reset link'.length;
    expect([text.selectionStart, text.selectionEnd]).toEqual([length, length]);
    await user.keyboard(' and a code');
    expect(text).toHaveValue('Email and password, with a reset link and a code');
  });
});

describe('QuoteEditorPage, dragging sections and lines', () => {
  it('gives each section and line a named drag handle, 44px on a phone and compact in the line table from `md`', async () => {
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    for (const name of ['Drag section 1', 'Drag section 2']) {
      expect(handle(name)).toHaveClass('size-11', 'touch-none');
      expect(handle(name)).not.toHaveClass('md:size-8');
    }
    for (const number of [1, 2, 3]) {
      const grip = handle(`Drag line ${number}`);
      expect(lineGroup(number)).toContainElement(grip);
      expect(grip).toHaveClass('size-11', 'md:size-8', 'touch-none');
      // At the start of the row, before the title.
      expect(follows(grip, screen.getByLabelText(`Line ${number} title`))).toBe(true);
    }
    expect(within(sectionGroup(2)).getByRole('button', { name: 'Drag section 2' })).toBeInTheDocument();
    expect(follows(handle('Drag section 1'), screen.getByLabelText('Section 1 title'))).toBe(true);
  });

  it('reorders the sections with the keyboard, says so, numbers the lines again and saves the new order', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.patch).mockResolvedValue({ data: quoteEnvelope(saved) });
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    await pickUp(user, 'Drag section 2');
    await waitFor(() => expect(announced()).toContain('Picked up section 2'));
    // The section in the air shows its header: title and hours.
    const preview = await waitFor(() => {
      const element = document.querySelector('[data-slot="quote-drag-preview"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    expect(preview).toHaveTextContent('Reports');
    expect(preview).toHaveTextContent('12.34 hours');
    expect(preview.className).not.toMatch(/shadow|rounded/);
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(announced()).toContain('Moved section 2 to position 1'));
    await user.keyboard(' ');
    await waitFor(() => expect(announced()).toContain('Dropped section 2 at position 1'));

    expect(screen.getByLabelText('Section 1 title')).toHaveValue('Reports');
    expect(screen.getByLabelText('Section 2 title')).toHaveValue('Screens');
    expect(linesOf(1)).toEqual(['Export to CSV']);
    expect(linesOf(2)).toEqual(['Sign-in screens', 'Chart tiles']);
    expect(screen.getByLabelText('Line 1 title')).toHaveAttribute('id', 'line-1-title');
    expect(screen.getByLabelText('Line 1 hours per unit')).toHaveValue('12.34');
    expect(screen.getByRole('button', { name: 'Edit description of line 1' })).toBeInTheDocument();
    await waitFor(() => expect(handle('Drag section 1')).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalledTimes(1));
    expect(shapeOf(patched())).toEqual([
      ['Reports', ['Export to CSV']],
      ['Screens', ['Sign-in screens', 'Chart tiles']],
    ]);
  });

  it('reorders the lines of a section with the keyboard', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.patch).mockResolvedValue({ data: quoteEnvelope(saved) });
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    await pickUp(user, 'Drag line 1');
    await waitFor(() => expect(announced()).toContain('Picked up line 1'));
    const preview = document.querySelector('[data-slot="quote-drag-preview"]') as HTMLElement;
    expect(preview).toHaveTextContent('Sign-in screens');
    expect(preview).toHaveTextContent('15 hours');
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(announced()).toContain('Moved line 1 to section 1, position 2'));
    await user.keyboard(' ');
    await waitFor(() => expect(announced()).toContain('Dropped line 1 in section 1, position 2'));
    expect(linesOf(1)).toEqual(['Chart tiles', 'Sign-in screens']);
    expect(screen.getByLabelText('Line 2 units')).toHaveValue('2');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalledTimes(1));
    expect(shapeOf(patched())).toEqual([
      ['Screens', ['Chart tiles', 'Sign-in screens']],
      ['Reports', ['Export to CSV']],
    ]);
  });

  it('moves a line into another section, shown there while it is held, with what was typed in it', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.patch).mockResolvedValue({ data: quoteEnvelope(saved) });
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    await user.type(screen.getByLabelText('Line 1 title'), ' (edited)');
    await retype(user, screen.getByLabelText('Line 1 units'), '4');
    await describeLine(user, 1, 'A new description');
    // The line that stays in the first section is the same input before and after: nothing remounts.
    const staying = screen.getByLabelText('Line 2 title');

    await pickUp(user, 'Drag line 1');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(announced()).toContain('Moved line 1 to section 2, position 1'));
    // Already in the second section while it is held.
    await waitFor(() => expect(linesOf(2)).toEqual(['Sign-in screens (edited)', 'Export to CSV']));
    await user.keyboard(' ');
    await waitFor(() => expect(announced()).toContain('Dropped line 1 in section 2, position 1'));

    expect(linesOf(1)).toEqual(['Chart tiles']);
    expect(linesOf(2)).toEqual(['Sign-in screens (edited)', 'Export to CSV']);
    expect(screen.getByLabelText('Line 1 title')).toBe(staying);
    // Numbered again by position: the moved line is line 2 now, the first of section 2.
    expect(within(sectionGroup(2)).getByLabelText('Line 2 title')).toHaveValue('Sign-in screens (edited)');
    expect(screen.getByLabelText('Line 2 title')).toHaveAttribute('id', 'line-2-title');
    expect(screen.getByLabelText('Line 2 units')).toHaveValue('4');
    expect(markerOf(2)).not.toBeNull();
    expect(await descriptionOf(user, 2)).toBe('A new description');
    await waitFor(() => expect(handle('Drag line 2')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalledTimes(1));
    expect(patched().sections).toMatchObject([
      { title: 'Screens', lines: [{ title: 'Chart tiles' }] },
      {
        title: 'Reports',
        lines: [{ title: 'Sign-in screens (edited)', units: 4, description: 'A new description' }, { title: 'Export to CSV' }],
      },
    ]);
  });

  it('keeps the input, what is typed in it and its description, of a line that another line moves past', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    const input = screen.getByLabelText('Line 2 title');
    await user.type(input, ' and more');
    await pickUp(user, 'Drag line 1');
    await user.keyboard('{ArrowDown} ');
    await waitFor(() => expect(linesOf(1)).toEqual(['Chart tiles and more', 'Sign-in screens']));
    // The same input, now line 1: React kept it, and what was typed in it.
    expect(screen.getByLabelText('Line 1 title')).toBe(input);
    await user.click(descriptionButton(1));
    expect(within(descriptionDialog()).getByLabelText('Description')).toHaveValue('Revenue, hours and margin');
  });

  it('moves a line into an empty section, and to the end of a section', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Line 1 title'), 'Only');
    await user.click(addSection(1));
    await user.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(within(sectionGroup(2)).getByText('No lines in this section yet.')).toBeInTheDocument();

    await pickUp(user, 'Drag line 1');
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(announced()).toContain('Moved line 1 to section 2, position 1'));
    await user.keyboard(' ');
    await waitFor(() => expect(linesOf(2)).toEqual(['Only']));
    expect(within(sectionGroup(1)).getByText('No lines in this section yet.')).toBeInTheDocument();

    // And inside a section, down to its end.
    await user.click(addLine(2));
    await user.type(screen.getByLabelText('Line 2 title'), 'Last');
    await pickUp(user, 'Drag line 1');
    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');
    await waitFor(() => expect(linesOf(2)).toEqual(['Last', 'Only']));
  });

  it('puts a line back where it was on Escape, and saves the order it had', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.patch).mockResolvedValue({ data: quoteEnvelope(saved) });
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    await pickUp(user, 'Drag line 2');
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(linesOf(2)).toEqual(['Chart tiles', 'Export to CSV']));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(linesOf(1)).toEqual(['Sign-in screens', 'Chart tiles']));
    expect(linesOf(2)).toEqual(['Export to CSV']);
    await waitFor(() => expect(announced()).toMatch(/line 2 is back in section 1, position 2/i));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.patch).toHaveBeenCalledTimes(1));
    expect(shapeOf(patched())).toEqual([
      ['Screens', ['Sign-in screens', 'Chart tiles']],
      ['Reports', ['Export to CSV']],
    ]);
  });

  it('keeps a wrong field marked on its own line after the line moves', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    await retype(user, screen.getByLabelText('Line 1 hours per unit'), '1,5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await within(lineGroup(1)).findByText(/Enter hours like 7.5/)).toBeInTheDocument();

    await pickUp(user, 'Drag line 1');
    await user.keyboard('{ArrowDown} ');
    await waitFor(() => expect(linesOf(1)).toEqual(['Chart tiles', 'Sign-in screens']));
    await waitFor(() => expect(within(lineGroup(2)).getByText(/Enter hours like 7.5/)).toBeInTheDocument());
    expect(screen.getByLabelText('Line 2 hours per unit')).toHaveAttribute('aria-invalid', 'true');
    expect(within(lineGroup(1)).queryByText(/Enter hours like 7.5/)).toBeNull();
    expect(screen.getByLabelText('Line 1 hours per unit')).not.toHaveAttribute('aria-invalid');
  });

  it('keeps Remove, the description and the footer buttons working beside the handles', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/7');
    await screen.findByLabelText('Section 2 title');
    await user.click(handle('Drag line 1'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Remove line 1' }));
    expect(linesOf(1)).toEqual(['Chart tiles']);
    await user.click(descriptionButton(1));
    expect(descriptionDialog()).toBeInTheDocument();
    await user.click(within(descriptionDialog()).getByRole('button', { name: 'Done' }));
    await user.click(addLine(2));
    expect(linesOf(2)).toEqual(['Export to CSV', '']);
  });
});
