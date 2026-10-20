import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { quoteEnvelope } from '@/test/fixtures/quotes';
import {
  addLine,
  addSection,
  columnSum,
  descriptionButton,
  descriptionDialog,
  describeLine,
  descriptionOf,
  drawer,
  failure,
  fillQuote,
  fullNewBody,
  lineBuffered,
  lineGroup,
  lineTotal,
  markerOf,
  renderEditor,
  retype,
  saved,
  savedNotice,
  sectionGroup,
  serve,
  setSetting,
  settingsButton,
  valuesOf,
} from '@/test/quote-editor';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('QuoteEditorPage, a new quote', () => {
  it('starts from the defaults with one General section holding one blank line', async () => {
    renderEditor('/quotes/new');
    expect(screen.getByRole('heading', { level: 1, name: 'New quote' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to quotes' })).toHaveAttribute('href', '/quotes');
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Currency')).toHaveValue('INR');
    expect(screen.getAllByRole('group', { name: /^Section \d+$/ })).toHaveLength(1);
    expect(within(sectionGroup(1)).getByLabelText('Section 1 title')).toHaveValue('General');
    expect(screen.getByLabelText('Section 1 title')).toHaveAttribute('id', 'section-1-title');
    expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(1);
    expect(sectionGroup(1)).toContainElement(lineGroup(1));
    expect(screen.getByLabelText('Line 1 title')).toHaveValue('');
    // The description is behind a button, empty: no text area anywhere until it is opened.
    expect(screen.getByRole('button', { name: 'Add description to line 1' })).toBeInTheDocument();
    expect(markerOf(1)).toBeNull();
    expect(screen.queryByRole('textbox', { name: /description/i })).toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove section 1' })).toBeDisabled();
    expect(screen.getByLabelText('Line 1 units')).toHaveValue('1');
    expect(screen.getByLabelText('Line 1 hours per unit')).toHaveValue('');
    expect(lineTotal(1)).toHaveTextContent('Line 1 total hours —');
    expect(settingsButton()).toHaveAccessibleName('Settings');
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹0.00']);
    expect(valuesOf('Time', 'Elapsed')).toEqual(['0 months', 'with 3 developers']);
    expect(coreApi.get).not.toHaveBeenCalled();
  });

  it('works out the line and the totals as you type', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await retype(user, screen.getByLabelText('Line 1 units'), '2');
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '7.5');

    expect(lineTotal(1)).toHaveTextContent('Line 1 total hours 15');
    expect(valuesOf('Hours', 'From the lines')).toEqual(['15 hours']);
    expect(valuesOf('Hours', 'Management')).toEqual(['3.75 hours', '3.75 per person']);
    expect(valuesOf('Time', 'Total effort')).toEqual(['18.75 hours']);
    expect(valuesOf('Cost', 'Development')).toEqual(['₹46,500.00']);
    expect(valuesOf('Cost', 'Management')).toEqual(['₹11,250.00']);
    expect(valuesOf('Cost', 'Subtotal')).toEqual(['₹57,750.00']);
    expect(valuesOf('Cost', 'Negotiation buffer (25%)')).toEqual(['₹14,437.50']);
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹72,187.50']);
  });

  it('counts a line with invalid units or hours as zero', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await retype(user, screen.getByLabelText('Line 1 units'), '2');
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '7.5');
    await user.click(addLine(1));
    await retype(user, screen.getByLabelText('Line 2 units'), 'x');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '5');
    await user.click(addLine(1));
    await user.type(screen.getByLabelText('Line 3 hours per unit'), '1,5');

    expect(lineTotal(2)).toHaveTextContent('Line 2 total hours —');
    expect(lineTotal(3)).toHaveTextContent('Line 3 total hours —');
    expect(valuesOf('Hours', 'From the lines')).toEqual(['15 hours']);
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹72,187.50']);
  });

  it('adds and removes lines, keeping at least one', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
    await user.click(addLine(1));
    expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(2);
    expect(screen.getByLabelText('Line 2 units')).toHaveValue('1');
    expect(screen.getByLabelText('Line 2 title')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeEnabled();

    await user.type(screen.getByLabelText('Line 2 title'), 'Second');
    await describeLine(user, 2, 'The second item');
    await user.click(screen.getByRole('button', { name: 'Remove line 1' }));
    expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(1);
    expect(screen.getByLabelText('Line 1 title')).toHaveValue('Second');
    expect(await descriptionOf(user, 1)).toBe('The second item');
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
  });

  it('adds a section after the one whose footer was used, with an empty title and one blank line, and focuses its title', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.click(addSection(1));
    expect(screen.getAllByRole('group', { name: /^Section \d+$/ })).toHaveLength(2);
    const title = screen.getByLabelText('Section 2 title');
    expect(title).toHaveValue('');
    expect(title).toHaveAttribute('id', 'section-2-title');
    expect(title).toHaveFocus();
    expect(sectionGroup(2)).toContainElement(lineGroup(2));
    expect(screen.getByLabelText('Line 2 units')).toHaveValue('1');
    // With two sections either can go; each line can too, as there are two.
    expect(screen.getByRole('button', { name: 'Remove section 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove section 2' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeEnabled();
  });

  it('removes a section with nothing typed in its lines at once, without asking', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Line 1 title'), 'Kept');
    await user.click(addSection(1));
    await user.type(screen.getByLabelText('Section 2 title'), 'Spare');
    await user.click(screen.getByRole('button', { name: 'Remove section 2' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getAllByRole('group', { name: /^Section \d+$/ })).toHaveLength(1);
    expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(1);
    expect(screen.getByLabelText('Line 1 title')).toHaveValue('Kept');
    expect(screen.getByRole('button', { name: 'Remove section 1' })).toBeDisabled();
  });

  it('asks before removing a section whose lines have text or hours, and keeps it on Cancel', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Line 1 title'), 'Home page');
    await user.click(addSection(1));
    await user.type(screen.getByLabelText('Section 2 title'), 'Checkout');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '4');

    // The first section: a title typed in its line.
    await user.click(screen.getByRole('button', { name: 'Remove section 1' }));
    const ask = screen.getByRole('alertdialog', { name: 'Remove section 1?' });
    expect(ask).toHaveTextContent('Its lines are removed with it.');
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getAllByRole('group', { name: /^Section \d+$/ })).toHaveLength(2);

    // The second: only hours typed. Confirmed, it goes, and the lines after it are counted again.
    await user.click(screen.getByRole('button', { name: 'Remove section 2' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Remove section 2?' })).getByRole('button', { name: 'Remove section' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getAllByRole('group', { name: /^Section \d+$/ })).toHaveLength(1);
    expect(screen.getByLabelText('Section 1 title')).toHaveValue('General');
    expect(screen.getByLabelText('Line 1 title')).toHaveValue('Home page');
    expect(screen.queryByLabelText('Line 2 title')).toBeNull();
  });

  it('asks before removing a section whose only text is a line’s description', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.click(addSection(1));
    await describeLine(user, 2, 'Notes only');
    await user.click(screen.getByRole('button', { name: 'Remove section 2' }));
    expect(screen.getByRole('alertdialog', { name: 'Remove section 2?' })).toBeInTheDocument();
  });

  it('adds a line at the end of its own section and focuses its title', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Line 1 title'), 'First');
    await user.click(addSection(1));
    await user.type(screen.getByLabelText('Line 2 title'), 'In section two');

    await user.click(addLine(1));
    // The new line is the second of section 1; the line of section 2 is now line 3.
    expect(sectionGroup(1)).toContainElement(lineGroup(2));
    expect(screen.getByLabelText('Line 2 title')).toHaveValue('');
    expect(screen.getByLabelText('Line 2 title')).toHaveFocus();
    expect(sectionGroup(2)).toContainElement(lineGroup(3));
    expect(screen.getByLabelText('Line 3 title')).toHaveValue('In section two');

    await user.click(addLine(2));
    expect(sectionGroup(2)).toContainElement(lineGroup(4));
    expect(screen.getByLabelText('Line 4 title')).toHaveFocus();
  });

  it('never removes the last line of the whole quote, and lets a section be left without lines', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.post).mockResolvedValue({ data: quoteEnvelope({ id: 12 }) });
    renderEditor('/quotes/new');
    await fillQuote(user);
    await user.click(addSection(1));
    await user.type(screen.getByLabelText('Section 2 title'), 'Later');
    // Two lines in two sections: either can go, and the one left cannot.
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(within(sectionGroup(2)).queryByRole('group', { name: /^Line \d+$/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalledTimes(1));
    expect(vi.mocked(coreApi.post).mock.calls[0][1]).toMatchObject({
      sections: [{ title: 'General', lines: [{ title: 'Sign-in screens' }] }, { title: 'Later', lines: [] }],
    });
  });

  it('refuses a save with a blank section title, telling that section to assistive technology only, and sends nothing', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await fillQuote(user);
    // Spaces are not a title.
    await retype(user, screen.getByLabelText('Section 1 title'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const message = await within(sectionGroup(1)).findByText('Section title is required');
    expect(message).toHaveAttribute('id', 'section-1-title-error');
    expect(message).toHaveAttribute('role', 'alert');
    // No helper text on the page: the message is for screen readers, the field's heavier rule is for the eye.
    expect(message).toHaveClass('sr-only');
    const title = screen.getByLabelText('Section 1 title');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAttribute('aria-describedby', 'section-1-title-error');
    expect(title).toHaveAccessibleDescription('Section title is required');
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('posts the sections with their titles trimmed, and an empty description when none or only spaces', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.post).mockResolvedValue({ data: quoteEnvelope({ id: 12 }) });
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Title'), '  Website build ');
    await retype(user, screen.getByLabelText('Section 1 title'), '  Pages  ');
    await user.type(screen.getByLabelText('Line 1 title'), '  Home ');
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '8');
    await user.click(addSection(1));
    await user.type(screen.getByLabelText('Section 2 title'), 'Shop');
    await user.type(screen.getByLabelText('Line 2 title'), 'Cart');
    await describeLine(user, 2, '   ');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '4');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(coreApi.post).toHaveBeenCalledTimes(1));
    const body = vi.mocked(coreApi.post).mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('lines');
    expect(body).toMatchObject({
      title: 'Website build',
      sections: [
        { title: 'Pages', lines: [{ title: 'Home', description: '', units: 1, hoursPerUnit: 8 }] },
        { title: 'Shop', lines: [{ title: 'Cart', description: '', units: 1, hoursPerUnit: 4 }] },
      ],
    });
  });

  describe('the description dialog', () => {
    it('opens from the line, edits the same form, keeps the text on Escape and gives focus back', async () => {
      const user = userEvent.setup();
      vi.mocked(coreApi.post).mockResolvedValue({ data: quoteEnvelope({ id: 12 }) });
      renderEditor('/quotes/new');
      await user.type(screen.getByLabelText('Title'), 'Website build');
      await user.click(screen.getByRole('button', { name: 'Add description to line 1' }));

      const dialog = descriptionDialog();
      // Named for a line without a title yet.
      expect(dialog).toHaveAccessibleDescription('Line 1: untitled');
      const text = within(dialog).getByLabelText('Description');
      expect(text.tagName).toBe('TEXTAREA');
      expect(text).toHaveAttribute('id', 'line-1-description');
      expect(text).toHaveAttribute('rows', '6');
      expect(text).toHaveValue('');
      await user.type(text, 'The hero and the contact form');
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).toBeNull();
      const button = screen.getByRole('button', { name: 'Edit description of line 1' });
      expect(button).toHaveFocus();
      expect(markerOf(1)).not.toBeNull();
      // Only the dialog ever holds the text area.
      expect(document.querySelector('textarea')).toBeNull();

      await user.type(screen.getByLabelText('Line 1 title'), 'Home page');
      await user.type(screen.getByLabelText('Line 1 hours per unit'), '8');
      await user.click(button);
      expect(descriptionDialog()).toHaveAccessibleDescription('Line 1: Home page');
      expect(within(descriptionDialog()).getByLabelText('Description')).toHaveValue('The hero and the contact form');
      await user.click(within(descriptionDialog()).getByRole('button', { name: 'Close' }));
      expect(screen.getByRole('button', { name: 'Edit description of line 1' })).toHaveFocus();

      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(coreApi.post).toHaveBeenCalledTimes(1));
      expect(vi.mocked(coreApi.post).mock.calls[0][1]).toMatchObject({
        sections: [{ lines: [{ title: 'Home page', description: 'The hero and the contact form' }] }],
      });
    });

    it('drops the marker once the text is cleared, or is only spaces', async () => {
      const user = userEvent.setup();
      renderEditor('/quotes/new');
      await describeLine(user, 1, 'Something');
      expect(markerOf(1)).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Edit description of line 1' })).toHaveFocus();

      await describeLine(user, 1, '   ');
      expect(markerOf(1)).toBeNull();
      expect(screen.getByRole('button', { name: 'Add description to line 1' })).toBeInTheDocument();

      await describeLine(user, 1, 'Back');
      expect(markerOf(1)).not.toBeNull();
      await describeLine(user, 1, '');
      expect(markerOf(1)).toBeNull();
    });

    it('draws the marker in the brand’s teal, square, with no shadow', async () => {
      const user = userEvent.setup();
      renderEditor('/quotes/new');
      await describeLine(user, 1, 'Something');
      const marker = markerOf(1) as HTMLElement;
      expect(marker).toHaveAttribute('aria-hidden', 'true');
      expect(marker).toHaveClass('bg-teal');
      expect(marker.className).not.toMatch(/rounded|shadow/);
    });

    it('opens on the line it belongs to, in any section', async () => {
      const user = userEvent.setup();
      renderEditor('/quotes/7');
      await user.click(await screen.findByRole('button', { name: 'Edit description of line 3' }));
      expect(descriptionDialog()).toHaveAccessibleDescription('Line 3: Export to CSV');
      expect(within(descriptionDialog()).getByLabelText('Description')).toHaveValue('Every table, as shown');
    });
  });

  it('shows each section’s hours and hours with the buffer, the sums of its lines', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/3');
    await screen.findByLabelText('Line 4 hours per unit');
    // Section 1: 10.12 and 3 x 2.5 hours, 11.39 and 8.44 with the 12.5 % buffer. Section 2: 2 x 7.25 and 0.2, 16.31 and 0.23.
    const first = within(sectionGroup(1));
    const second = within(sectionGroup(2));
    expect(first.getByText('17.62 hours')).toBeInTheDocument();
    expect(first.getByText('19.83 with buffer')).toBeInTheDocument();
    expect(second.getByText('14.7 hours')).toBeInTheDocument();
    expect(second.getByText('16.54 with buffer')).toBeInTheDocument();
    // Together, the panel's figures.
    expect(valuesOf('Hours', 'From the lines')).toEqual(['32.32 hours']);
    expect(valuesOf('Hours', 'With time buffer')).toEqual(['36.37 hours']);

    // A wrong line is left out of its section's sums; a wrong setting leaves no buffered figure.
    await retype(user, screen.getByLabelText('Line 2 hours per unit'), '2,5');
    expect(first.getByText('10.12 hours')).toBeInTheDocument();
    expect(first.getByText('11.39 with buffer')).toBeInTheDocument();
    await setSetting(user, 'Percentages', 'Time buffer (%)', 'abc');
    expect(first.getByText('10.12 hours')).toBeInTheDocument();
    expect(first.getByText('— with buffer')).toBeInTheDocument();
    expect(second.getByText('— with buffer')).toBeInTheDocument();
  });

  it('comes to the same totals whether the lines are in one section or three', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    // The lines of the time buffer test below, 24, 2 x 28 and 16.5 hours, now one to a section.
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '24');
    await user.click(addSection(1));
    await retype(user, screen.getByLabelText('Line 2 units'), '2');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '28');
    await user.click(addSection(2));
    await user.type(screen.getByLabelText('Line 3 hours per unit'), '16.5');
    expect(valuesOf('Hours', 'From the lines')).toEqual(['96.5 hours']);
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹4,64,425.00']);
    expect(within(sectionGroup(2)).getByText('56 hours')).toBeInTheDocument();
  });

  it('names each line field and its total on a narrow screen, where the column headings are hidden', async () => {
    renderEditor('/quotes/new');
    const line = within(lineGroup(1));
    const cells = [
      ['Title', screen.getByLabelText('Line 1 title')],
      ['Units', screen.getByLabelText('Line 1 units')],
      ['Hours per unit', screen.getByLabelText('Line 1 hours per unit')],
      ['Total hours', lineTotal(1)],
      ['Hours with buffer', lineBuffered(1)],
    ] as const;
    for (const [text, cell] of cells) {
      const label = line.getByText(text);
      // Shown below `md` and hidden from it up, where the column headings say the same; the inputs keep their own names.
      expect(label).toHaveClass('md:hidden', 'text-small', 'font-semibold', 'text-navy-80');
      expect(label).not.toHaveClass('hidden');
      expect(label).toHaveAttribute('aria-hidden', 'true');
      expect(label.parentElement).toContainElement(cell);
    }
    // No description in the line: it is behind its button.
    expect(line.queryByText('Description')).toBeNull();
    // The column headings, from `md` up: one small row at the top of the section's table, not repeated in the lines.
    const [heading, rowLabel] = within(sectionGroup(1)).getAllByText('Hours per unit');
    expect(heading.parentElement).toHaveClass('hidden', 'md:grid', 'text-navy-80');
    expect(heading.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(rowLabel).toBe(line.getByText('Hours per unit'));
    expect(Array.from(heading.parentElement?.children ?? []).map((cell) => cell.textContent)).toEqual([
      '',
      'Title',
      'Units',
      'Hours per unit',
      'Total hours',
      'Hours with buffer',
      '',
      '',
    ]);
  });

  it('lays each line out as one compact row from `md`: the title, the figures and two icon buttons', () => {
    renderEditor('/quotes/new');
    const line = lineGroup(1);
    const title = within(line).getByRole('textbox', { name: 'Line 1 title' });
    expect(title.tagName).toBe('INPUT');
    expect(title).toHaveAttribute('id', 'line-1-title');
    expect(title).toHaveAttribute('placeholder', 'Title');
    // No description text area in the row.
    expect(within(line).queryAllByRole('textbox').map((box) => box.getAttribute('aria-label'))).toEqual([
      'Line 1 title',
      'Line 1 units',
      'Line 1 hours per unit',
    ]);

    // The row holds the title with the figures and both buttons, in the column template of the headings.
    const row = title.parentElement?.parentElement as HTMLElement;
    const columns = 'md:grid-cols-[2rem_minmax(0,1fr)_5rem_6.5rem_5.5rem_7rem_2rem_2rem]';
    expect(row).toHaveClass('grid', columns);
    const [heading] = within(sectionGroup(1)).getAllByText('Hours per unit');
    expect(heading.parentElement).toHaveClass(columns);
    expect(row).toContainElement(screen.getByLabelText('Line 1 units'));
    expect(row).toContainElement(within(line).getByRole('button', { name: 'Remove line 1' }));
    expect(row).toContainElement(within(line).getByRole('button', { name: 'Add description to line 1' }));

    // Compact from `md` only: 2rem fields in a smaller font; below it the fields keep the usual size.
    for (const name of ['title', 'units', 'hours per unit']) {
      const input = screen.getByLabelText(`Line 1 ${name}`);
      expect(input).toHaveClass('md:h-8', 'md:min-h-0', 'md:text-[0.8125rem]', 'min-h-12', 'text-lead');
    }
    expect(screen.getByLabelText('Line 1 units')).toHaveClass('tabular', 'md:text-right');
    expect(screen.getByLabelText('Line 1 hours per unit')).toHaveClass('tabular', 'md:text-right');
    expect(lineTotal(1)).toHaveClass('tabular', 'md:text-right', 'md:text-[0.8125rem]');
    expect(lineBuffered(1)).toHaveClass('tabular', 'md:text-right', 'md:text-[0.8125rem]');
    // The row's buttons shrink with it from `md`; the section's own controls keep the usual 44px.
    expect(within(line).getByRole('button', { name: 'Remove line 1' })).toHaveClass('size-11', 'md:size-8');
    expect(within(line).getByRole('button', { name: 'Add description to line 1' })).toHaveClass('size-11', 'md:size-8');
    expect(screen.getByRole('button', { name: 'Remove section 1' })).toHaveClass('size-11');
    expect(screen.getByRole('button', { name: 'Remove section 1' })).not.toHaveClass('md:size-8');
    expect(screen.getByLabelText('Section 1 title')).not.toHaveClass('md:h-8');
    // Lines are told apart by a hairline with little room around it, never a shadow or a box.
    expect(line).toHaveClass('border-b', 'border-rule', 'md:py-1');
    expect(line.className).not.toMatch(/shadow|rounded/);
  });

  it('works out each line with the time buffer, and the panel takes the column’s sum from the totals', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    // The plan's example: 24, 2 x 28 and 16.5 hours, 96.5 in all.
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '24');
    await user.click(addLine(1));
    await retype(user, screen.getByLabelText('Line 2 units'), '2');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '28');
    await user.click(addLine(1));
    await user.type(screen.getByLabelText('Line 3 hours per unit'), '16.5');

    // The new quote's time buffer is 0: each line's hours are its own, and the panel has no row for the buffer.
    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer 24');
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer 56');
    expect(lineBuffered(3)).toHaveTextContent('Line 3 hours with buffer 16.5');
    expect(valuesOf('Hours', 'From the lines')).toEqual(['96.5 hours']);
    expect(within(screen.getByRole('region', { name: 'Hours' })).queryByText(/time buffer/i)).toBeNull();
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹4,64,425.00']);

    await setSetting(user, 'Percentages', 'Time buffer (%)', '25');
    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer 30');
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer 70');
    // 16.5 x 1.25 is 20.625: the half goes up.
    expect(lineBuffered(3)).toHaveTextContent('Line 3 hours with buffer 20.63');
    expect(valuesOf('Hours', 'From the lines')).toEqual(['96.5 hours']);
    expect(valuesOf('Hours', 'Time buffer (25%)')).toEqual(['+24.13 hours']);
    expect(valuesOf('Hours', 'With time buffer')).toEqual(['120.63 hours']);

    await setSetting(user, 'Percentages', 'Time buffer (%)', '10');
    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer 26.4');
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer 61.6');
    expect(lineBuffered(3)).toHaveTextContent('Line 3 hours with buffer 18.15');
    expect(valuesOf('Hours', 'Time buffer (10%)')).toEqual(['+9.65 hours']);
    expect(valuesOf('Hours', 'With time buffer')).toEqual(['106.15 hours']);
  });

  it('adds up the column as shown to the panel’s hours with the time buffer, line by line and not on the sum', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/3');
    await screen.findByLabelText('Line 4 hours per unit');
    // The backend's third vector: 11.39 + 8.44 + 16.31 + 0.23 is 36.37 (padding the 32.32 base would give 36.36).
    expect([1, 2, 3, 4].map((number) => lineBuffered(number)?.textContent)).toEqual([
      'Line 1 hours with buffer 11.39',
      'Line 2 hours with buffer 8.44',
      'Line 3 hours with buffer 16.31',
      'Line 4 hours with buffer 0.23',
    ]);
    expect(valuesOf('Hours', 'From the lines')).toEqual(['32.32 hours']);
    expect(valuesOf('Hours', 'Time buffer (12.5%)')).toEqual(['+4.05 hours']);
    expect(valuesOf('Hours', 'With time buffer')).toEqual(['36.37 hours']);
    expect(columnSum(4)).toBe(3637);

    // Typing into a line moves the column and the panel together, and they still agree.
    await retype(user, screen.getByLabelText('Line 4 hours per unit'), '0.4');
    expect(lineBuffered(4)).toHaveTextContent('Line 4 hours with buffer 0.45');
    expect(valuesOf('Hours', 'With time buffer')).toEqual(['36.59 hours']);
    expect(columnSum(4)).toBe(3659);
    await retype(user, screen.getByLabelText('Line 2 units'), '5');
    // 5 x 2.5 is 12.5 hours, 14.0625 with the buffer: 14.06.
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer 14.06');
    expect(valuesOf('Hours', 'With time buffer')).toEqual(['42.21 hours']);
    expect(columnSum(4)).toBe(4221);
  });

  it('keeps the negotiation buffer out of the hours: it moves the amount only', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await retype(user, screen.getByLabelText('Line 1 units'), '2');
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '8');
    await setSetting(user, 'Percentages', 'Time buffer (%)', '10');
    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer 17.6');
    expect(valuesOf('Hours', 'With time buffer')).toEqual(['17.6 hours']);
    expect(valuesOf('Hours', 'Management')).toEqual(['4.4 hours', '4.4 per person']);
    expect(valuesOf('Time', 'Total effort')).toEqual(['22 hours']);
    // The service's own figures (`compute_totals`): 54,560.00 and 13,200.00, a 25 % buffer of 16,940.00.
    expect(valuesOf('Cost', 'Subtotal')).toEqual(['₹67,760.00']);
    expect(valuesOf('Cost', 'Negotiation buffer (25%)')).toEqual(['₹16,940.00']);
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹84,700.00']);

    await setSetting(user, 'Percentages', 'Negotiation buffer (%)', '50');
    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer 17.6');
    expect(valuesOf('Hours', 'With time buffer')).toEqual(['17.6 hours']);
    expect(valuesOf('Hours', 'Management')).toEqual(['4.4 hours', '4.4 per person']);
    expect(valuesOf('Time', 'Total effort')).toEqual(['22 hours']);
    expect(valuesOf('Cost', 'Subtotal')).toEqual(['₹67,760.00']);
    expect(valuesOf('Cost', 'Negotiation buffer (50%)')).toEqual(['₹33,880.00']);
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹1,01,640.00']);
  });

  it('takes the discount off after the negotiation buffer, and shows it as a deduction', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '24');
    await user.click(addLine(1));
    await retype(user, screen.getByLabelText('Line 2 units'), '2');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '28');
    await user.click(addLine(1));
    await user.type(screen.getByLabelText('Line 3 hours per unit'), '16.5');
    expect(screen.queryByText(/^Discount/)).toBeNull();

    // The figures of the backend's `compute_totals` on this quote with a 10 % time buffer and a 10 % discount.
    await setSetting(user, 'Percentages', 'Time buffer (%)', '10');
    await setSetting(user, 'Percentages', 'Discount (%)', '10');
    expect(valuesOf('Cost', 'Subtotal')).toEqual(['₹4,08,685.00']);
    expect(valuesOf('Cost', 'Negotiation buffer (25%)')).toEqual(['₹1,02,171.25']);
    expect(valuesOf('Cost', 'Discount (10%)')).toEqual(['−₹51,085.62']);
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹4,59,770.63']);
    expect(valuesOf('Time', 'Total effort')).toEqual(['132.69 hours']);

    await setSetting(user, 'Percentages', 'Discount (%)', '0');
    expect(screen.queryByText(/^Discount/)).toBeNull();
    // Without the discount the amount is the subtotal and the negotiation buffer: 4,08,685.00 and 1,02,171.25.
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹5,10,856.25']);
  });

  it('shows no buffered hours for a wrong line, and none at all while a setting is wrong', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    // 10 %, not the negotiation buffer's 25 %: the column follows the time buffer.
    await setSetting(user, 'Percentages', 'Time buffer (%)', '10');
    // Only a wrong line: the column has nothing, and the panel has no hours to add.
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '1,5');
    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer —');
    expect(valuesOf('Hours', 'Time buffer (10%)')).toEqual(['+0 hours']);

    await user.click(addLine(1));
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '8');
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer 8.8');
    expect(valuesOf('Hours', 'With time buffer')).toEqual(['8.8 hours']);

    // A wrong time buffer, or any other wrong setting, leaves the column with nothing to show and the panel with no totals.
    await setSetting(user, 'Percentages', 'Time buffer (%)', 'abc');
    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer —');
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer —');
    expect(lineTotal(2)).toHaveTextContent('Line 2 total hours 8');
    expect(within(screen.getByRole('region', { name: 'Hours' })).queryByText(/time buffer/i)).toBeNull();
    expect(screen.getByText('Check the settings to see the totals.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN/);

    await setSetting(user, 'Percentages', 'Time buffer (%)', '10');
    await setSetting(user, 'Percentages', 'Discount (%)', '51');
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer —');
    expect(screen.getByText('Check the settings to see the totals.')).toBeInTheDocument();
  });

  it('puts the totals under the sections, beside them only from `2xl`, and keeps them in sight there', async () => {
    renderEditor('/quotes/new');
    const totals = screen.getByRole('complementary', { name: 'Quote totals' });
    expect(within(totals).getByRole('region', { name: 'Hours' })).toBeInTheDocument();
    expect(within(totals).getByRole('region', { name: 'Cost' })).toBeInTheDocument();
    // jsdom cannot apply a breakpoint: the classes are the contract. One column, then a 22rem column from `2xl`.
    expect(totals.parentElement).toHaveClass('grid', '2xl:grid-cols-[minmax(0,1fr)_22rem]');
    expect(totals.parentElement?.className).not.toMatch(/(^|\s)(lg|xl):grid-cols/);
    expect(totals.parentElement).toContainElement(sectionGroup(1));
    expect(totals).toHaveClass('2xl:sticky', '2xl:top-6', '2xl:self-start');
    expect(totals.className).not.toMatch(/(^|\s)xl:/);
    // Under the sections the panel's three sections sit side by side from `md`, and stack again in the `2xl` column.
    const sections = within(totals).getByRole('region', { name: 'Time' }).parentElement;
    expect(sections).toHaveClass('md:grid-cols-3', '2xl:grid-cols-1');
    expect(sections?.className).not.toMatch(/(^|\s)xl:/);
  });

  it('saves the time buffer and the discount with the quote', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.post).mockResolvedValue({ data: quoteEnvelope({ id: 12 }) });
    renderEditor('/quotes/new');
    await fillQuote(user);
    await setSetting(user, 'Percentages', 'Time buffer (%)', '10');
    await setSetting(user, 'Percentages', 'Discount (%)', '7.5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalledTimes(1));
    expect(coreApi.post).toHaveBeenCalledWith('/quotations', {
      ...fullNewBody,
      timeBufferPercent: 10,
      discountPercent: 7.5,
    });
  });

  it('keeps a setting through the drawer closing and saves it', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.post).mockResolvedValue({ data: quoteEnvelope({ id: 12 }) });
    renderEditor('/quotes/new');
    await fillQuote(user);
    expect(valuesOf('Cost', 'Development')).toEqual(['₹46,500.00']);

    await setSetting(user, 'Developer', 'Rate per hour', '1000.00');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(valuesOf('Cost', 'Development')).toEqual(['₹15,000.00']);

    await user.click(settingsButton());
    expect(within(within(drawer()).getByRole('group', { name: 'Developer' })).getByLabelText('Rate per hour')).toHaveValue(
      '1000.00',
    );
    await user.click(within(drawer()).getByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalledTimes(1));
    expect(vi.mocked(coreApi.post).mock.calls[0][1]).toMatchObject({ developerRateCents: 100_000 });
  });

  it.each([
    ['a percentage', 'Percentages', 'Testing (%)', 'abc'],
    ['a rate', 'Developer', 'Rate per hour', '3,100'],
    ['a blank count', 'Tester', 'People', ''],
    ['a currency', 'Currency', 'Currency code', 'RUPEES'],
  ])('asks to check the settings, never NaN, while %s is invalid', async (_label, group, label, text) => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await retype(user, screen.getByLabelText('Line 1 units'), '2');
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '7.5');
    await setSetting(user, group, label, text);

    expect(screen.getByText('Check the settings to see the totals.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cost' })).not.toBeInTheDocument();
    expect(valuesOf('Hours', 'From the lines')).toEqual(['15 hours']);
    expect(lineTotal(1)).toHaveTextContent('Line 1 total hours 15');
    expect(settingsButton()).toHaveAccessibleName('Settings (check)');
    expect(document.body.textContent).not.toMatch(/NaN/);
  });

  it('opens the drawer on a save with a setting wrong, with its message, and sends nothing', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await fillQuote(user);
    await user.click(settingsButton());
    await retype(user, within(drawer()).getByLabelText('Testing (%)'), 'abc');
    // Closed with the X this time: either way the drawer is shut when Save is pressed.
    await user.click(within(drawer()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await within(drawer()).findByText('Enter a percentage like 7.5')).toBeInTheDocument();
    expect(within(drawer()).getByLabelText('Testing (%)')).toHaveValue('abc');
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('moves focus to the first wrong field of the drawer a save opens, and gives it back on Done', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await fillQuote(user);
    await user.click(settingsButton());
    // The currency is the first setting in the form's own order, Testing (%) the first one the drawer shows.
    await retype(user, within(within(drawer()).getByRole('group', { name: 'Currency' })).getByLabelText('Currency code'), 'RUPEES');
    await retype(user, within(within(drawer()).getByRole('group', { name: 'Percentages' })).getByLabelText('Testing (%)'), 'abc');
    await user.click(within(drawer()).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await within(drawer()).findByText('Enter a percentage like 7.5')).toBeInTheDocument();
    await waitFor(() => expect(within(drawer()).getByLabelText('Testing (%)')).toHaveFocus());
    // Let react-hook-form's own pass at focusing a wrong field go by: the first one in the drawer keeps it.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(within(drawer()).getByLabelText('Testing (%)')).toHaveFocus();
    expect(coreApi.post).not.toHaveBeenCalled();

    // It was Save that opened the drawer, so Done hands focus back there.
    await user.click(within(drawer()).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('gives focus back to the Settings button when the drawer it opened closes', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.click(settingsButton());
    expect(drawer()).toBeInTheDocument();
    await user.click(within(drawer()).getByRole('button', { name: 'Done' }));
    expect(settingsButton()).toHaveFocus();
  });

  it('refuses a save with a blank hours with that line’s message, sending nothing', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await fillQuote(user, '2', '');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const line = screen.getByRole('group', { name: 'Line 1' });
    expect(await within(line).findByText('Hours are required')).toBeInTheDocument();
    expect(within(line).getByLabelText('Line 1 hours per unit')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('refuses a save without a title, and never asks for a description', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '4');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByLabelText('Title')).toHaveAccessibleDescription('Title is required');
    const line = within(lineGroup(1));
    expect(line.getByLabelText('Line 1 title')).toHaveAccessibleDescription('Title is required');
    expect(screen.queryByText('Description is required')).toBeNull();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('refuses a save with a blank line title, telling that line, and sends nothing', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await fillQuote(user);
    await user.click(addLine(1));
    // Spaces are not a title.
    await user.type(screen.getByLabelText('Line 2 title'), '   ');
    await describeLine(user, 2, 'Pages for the shop');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '3');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const line = within(screen.getByRole('group', { name: 'Line 2' }));
    const message = await line.findByText('Title is required');
    expect(message).toHaveAttribute('id', 'line-2-title-error');
    expect(message).toHaveClass('sr-only');
    expect(line.getByLabelText('Line 2 title')).toHaveAttribute('aria-invalid', 'true');
    expect(line.getByLabelText('Line 2 title')).toHaveAttribute('aria-describedby', 'line-2-title-error');
    expect(within(screen.getByRole('group', { name: 'Line 1' })).queryByRole('alert')).toBeNull();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it.each(['.5', '1,5', '1e3', '7.555', '-2'])('tells hours of “%s” what is wrong', async (hours) => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await fillQuote(user, '1', hours);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Enter hours like 7.5, with up to two decimals and no commas or signs'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Line 1 hours per unit')).toHaveValue(hours);
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it.each([
    ['0.5', 0.5],
    ['16', 16],
  ])('accepts hours of “%s”', async (hours, sent) => {
    const user = userEvent.setup();
    vi.mocked(coreApi.post).mockResolvedValue({ data: quoteEnvelope({ id: 12 }) });
    renderEditor('/quotes/new');
    await fillQuote(user, '1', hours);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(coreApi.post).toHaveBeenCalledTimes(1));
    expect(vi.mocked(coreApi.post).mock.calls[0][1]).toMatchObject({ sections: [{ lines: [{ hoursPerUnit: sent }] }] });
  });

  it('refuses a quote above 100,000,000.00 and still shows finite totals', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await fillQuote(user, '100000', '10000');
    // 1,000,000,000 hours: far past the largest amount, and past 2^53 in cents.
    expect(valuesOf('Hours', 'From the lines')).toEqual(['1,000,000,000 hours']);
    expect(valuesOf('Cost', 'Final quote')[0]).toMatch(/^₹[\d,]+\.\d\d$/);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('The quote comes to more than 100,000,000.00. Reduce the hours or the rates.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('posts the whole quote, then moves to the new quote’s own address', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.post).mockResolvedValue({ data: quoteEnvelope({ id: 12 }) });
    renderEditor('/quotes/new');
    await fillQuote(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/quotes/12'));
    expect(coreApi.post).toHaveBeenCalledWith('/quotations', fullNewBody);
    expect(coreApi.patch).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { level: 1, name: 'Website build' })).toBeInTheDocument();
    expect(coreApi.get).toHaveBeenCalledWith('/quotations/12');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says Saved on the page it moves to after the first save, until the next edit', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.post).mockResolvedValue({ data: quoteEnvelope({ id: 12 }) });
    renderEditor('/quotes/new');
    await fillQuote(user);
    expect(savedNotice()).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Website build' })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/quotes/12');
    expect(savedNotice()).toBeInTheDocument();
    // The cue is for this arrival only: it is not left in the history entry for a reload or a Back to find.
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^null$/));
    expect(savedNotice()).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), '!');
    expect(savedNotice()).not.toBeInTheDocument();
  });

  it('goes to the quotes when the create answer cannot be read, never saying it failed', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.post).mockResolvedValue({ data: { surprise: true } });
    renderEditor('/quotes/new');
    await fillQuote(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/quotes$/));
    expect(screen.getByText('Quotes list')).toBeInTheDocument();
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Could not save. Try again.')).not.toBeInTheDocument();
    // Nothing is carried to the list.
    expect(screen.getByTestId('state')).toHaveTextContent(/^null$/);
  });

  it.each([
    ['a network failure', new Error('Network Error'), 'Could not save. Try again.'],
    ['a 500', failure(500), 'Could not save. Try again.'],
    ['a 422', failure(422, { message: 'A quotation needs at least one line' }), 'A quotation needs at least one line'],
  ])('keeps every typed value after %s', async (_label, error, message) => {
    const user = userEvent.setup();
    vi.mocked(coreApi.post).mockRejectedValue(error);
    renderEditor('/quotes/new');
    await fillQuote(user);
    await setSetting(user, 'Developer', 'Rate per hour', '1000.00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByTestId('where')).toHaveTextContent('/quotes/new');
    expect(screen.getByLabelText('Title')).toHaveValue('Website build');
    expect(screen.getByLabelText('Line 1 title')).toHaveValue('Sign-in screens');
    expect(await descriptionOf(user, 1)).toBe('Email and password, with a reset link');
    expect(screen.getByLabelText('Line 1 units')).toHaveValue('2');
    expect(screen.getByLabelText('Line 1 hours per unit')).toHaveValue('7.5');
    await user.click(settingsButton());
    expect(within(within(drawer()).getByRole('group', { name: 'Developer' })).getByLabelText('Rate per hour')).toHaveValue(
      '1000.00',
    );
  });
});

describe('QuoteEditorPage, a saved quote', () => {
  it('loads the quote and fills the title, the sections with their lines in written order, and the settings', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/7');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard refresh' })).toBeInTheDocument();
    expect(coreApi.get).toHaveBeenCalledWith('/quotations/7');
    expect(savedNotice()).not.toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Dashboard refresh');
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
    expect(screen.getAllByRole('group', { name: /^Section \d+$/ })).toHaveLength(2);
    expect(screen.getByLabelText('Section 1 title')).toHaveValue('Screens');
    expect(screen.getByLabelText('Section 2 title')).toHaveValue('Reports');
    expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(3);
    // Lines are counted across the whole quote: 1 and 2 in the first section, 3 in the second.
    expect(
      within(sectionGroup(1))
        .getAllByRole('group', { name: /^Line \d+$/ })
        .map((group) => group.getAttribute('aria-label')),
    ).toEqual(['Line 1', 'Line 2']);
    expect(within(sectionGroup(2)).getByRole('group', { name: 'Line 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Line 1 title')).toHaveValue('Sign-in screens');
    expect(screen.getByLabelText('Line 2 title')).toHaveValue('Chart tiles');
    expect(screen.getByLabelText('Line 3 title')).toHaveValue('Export to CSV');
    // Every saved line has a description: each button says Edit and carries the marker.
    for (const number of [1, 2, 3]) {
      expect(screen.getByRole('button', { name: `Edit description of line ${number}` })).toBeInTheDocument();
      expect(markerOf(number)).not.toBeNull();
    }
    expect(await descriptionOf(user, 1)).toBe('Email and password, with a reset link');
    expect(await descriptionOf(user, 3)).toBe('Every table, as shown');
    expect(screen.getByLabelText('Line 1 units')).toHaveValue('2');
    expect(screen.getByLabelText('Line 1 hours per unit')).toHaveValue('7.5');
    expect(screen.getByLabelText('Line 3 hours per unit')).toHaveValue('12.34');
    expect(lineTotal(2)).toHaveTextContent('Line 2 total hours 0.75');
    // The mirror on the loaded settings comes to what the service stored.
    expect(valuesOf('Cost', 'Final quote')).toEqual(['$50,844.43']);
    expect(valuesOf('Cost', 'Negotiation buffer (7.5%)')).toEqual(['$3,547.29']);

    await user.click(settingsButton());
    const developer = within(within(drawer()).getByRole('group', { name: 'Developer' }));
    expect(developer.getByLabelText('People')).toHaveValue('2');
    expect(developer.getByLabelText('Rate per hour')).toHaveValue('1234.56');
    expect(within(drawer()).getByLabelText('Negotiation buffer (%)')).toHaveValue('7.5');
    expect(within(drawer()).getByLabelText('Hours in a day')).toHaveValue('7');
    expect(within(drawer()).getByLabelText('Hours in a month')).toHaveValue('150');
  });

  it('loads a quote with a time buffer and a discount into the drawer, and shows both in the totals', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/3');
    expect(await screen.findByRole('heading', { level: 1, name: 'Retainer scoping' })).toBeInTheDocument();
    // The mirror on the loaded settings comes to what the service stored for the backend's third vector.
    expect(valuesOf('Hours', 'With time buffer')).toEqual(['36.37 hours']);
    expect(valuesOf('Cost', 'Subtotal')).toEqual(['₹75,627.00']);
    expect(valuesOf('Cost', 'Negotiation buffer (10%)')).toEqual(['₹7,562.70']);
    expect(valuesOf('Cost', 'Discount (7.5%)')).toEqual(['−₹6,239.22']);
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹76,950.48']);

    await user.click(settingsButton());
    expect(within(drawer()).getByLabelText('Time buffer (%)')).toHaveValue('12.5');
    expect(within(drawer()).getByLabelText('Discount (%)')).toHaveValue('7.5');
  });

  it('patches the whole quote and says Saved until the next edit', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.patch).mockResolvedValue({ data: quoteEnvelope(saved) });
    renderEditor('/quotes/7');
    const title = await screen.findByLabelText('Title');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved', { selector: '[role="status"]' })).toBeInTheDocument();
    expect(coreApi.patch).toHaveBeenCalledWith('/quotations/7', {
      title: 'Dashboard refresh',
      currencyCode: 'USD',
      developerCount: 2,
      developerRateCents: 123_456,
      managerCount: 1,
      managerRateCents: 200_000,
      testerCount: 2,
      testerRateCents: 99_999,
      timeBufferPercent: 0,
      negotiationBufferPercent: 7.5,
      discountPercent: 0,
      managementPercent: 12.5,
      testingPercent: 10,
      bugFixPercent: 5,
      hoursPerDay: 7,
      hoursPerMonth: 150,
      sections: [
        {
          title: 'Screens',
          lines: [
            { title: 'Sign-in screens', description: 'Email and password, with a reset link', units: 2, hoursPerUnit: 7.5 },
            { title: 'Chart tiles', description: 'Revenue, hours and margin', units: 3, hoursPerUnit: 0.25 },
          ],
        },
        {
          title: 'Reports',
          lines: [{ title: 'Export to CSV', description: 'Every table, as shown', units: 1, hoursPerUnit: 12.34 }],
        },
      ],
    });
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/quotes/7');

    await user.type(title, '!');
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  describe('while a save is on its way', () => {
    /** A PATCH that stays out until `answer` is called, with the editor open on quote 7 and Save pressed. */
    async function saveAndWait(user: UserEvent) {
      let answer: () => void = () => undefined;
      vi.mocked(coreApi.patch).mockReturnValue(
        new Promise((resolve) => {
          answer = () => resolve({ data: quoteEnvelope(saved) });
        }),
      );
      renderEditor('/quotes/7');
      await screen.findByLabelText('Title');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(coreApi.patch).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      return {
        /** The service answers, and the editor has finished with the answer. */
        answered: async () => {
          answer();
          await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
        },
      };
    }

    it('keeps what is typed, added or removed meanwhile, and does not say Saved', async () => {
      const user = userEvent.setup();
      const save = await saveAndWait(user);
      await user.type(screen.getByLabelText('Title'), '!');
      await retype(user, screen.getByLabelText('Line 3 hours per unit'), '20');
      await user.click(addLine(2));
      await user.click(screen.getByRole('button', { name: 'Remove line 1' }));
      await save.answered();

      expect(screen.getByLabelText('Title')).toHaveValue('Dashboard refresh!');
      expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(3);
      expect(screen.getByLabelText('Line 1 title')).toHaveValue('Chart tiles');
      expect(screen.getByLabelText('Line 2 hours per unit')).toHaveValue('20');
      expect(screen.getByLabelText('Line 3 units')).toHaveValue('1');
      // Those edits are not saved, so the page must not say they are.
      expect(savedNotice()).not.toBeInTheDocument();
    });

    it('goes on to save what was typed meanwhile with the next Save, then says Saved', async () => {
      const user = userEvent.setup();
      const save = await saveAndWait(user);
      await user.type(screen.getByLabelText('Title'), '!');
      await save.answered();

      vi.mocked(coreApi.patch).mockResolvedValue({ data: quoteEnvelope(saved) });
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText('Saved', { selector: '[role="status"]' })).toBeInTheDocument();
      expect(coreApi.patch).toHaveBeenCalledTimes(2);
      expect(vi.mocked(coreApi.patch).mock.calls[1][1]).toMatchObject({ title: 'Dashboard refresh!' });
      expect(screen.getByLabelText('Title')).toHaveValue('Dashboard refresh!');

      await user.type(screen.getByLabelText('Title'), '?');
      expect(savedNotice()).not.toBeInTheDocument();
    });

    it('says Saved when nothing was changed meanwhile, and clears it at the next edit', async () => {
      const user = userEvent.setup();
      const save = await saveAndWait(user);
      await save.answered();
      expect(savedNotice()).toBeInTheDocument();
      // An edit made in the description dialog is an edit like any other.
      await user.click(descriptionButton(2));
      await user.type(within(descriptionDialog()).getByLabelText('Description'), '!');
      expect(savedNotice()).not.toBeInTheDocument();
    });

    it('leaves a currency typed meanwhile as it was typed', async () => {
      const user = userEvent.setup();
      const save = await saveAndWait(user);
      await retype(user, screen.getByLabelText('Currency'), 'gbp');
      await save.answered();
      expect(screen.getByLabelText('Currency')).toHaveValue('gbp');
      expect(savedNotice()).not.toBeInTheDocument();
    });
  });

  it('shows the currency in capitals once a code typed in lower case is saved', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.patch).mockResolvedValue({ data: quoteEnvelope(saved) });
    renderEditor('/quotes/7');
    await retype(user, await screen.findByLabelText('Currency'), ' eur ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved', { selector: '[role="status"]' })).toBeInTheDocument();
    expect(vi.mocked(coreApi.patch).mock.calls[0][1]).toMatchObject({ currencyCode: 'EUR' });
    expect(screen.getByLabelText('Currency')).toHaveValue('EUR');
    // Showing the capitals is not an edit: the page goes on saying it is saved.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(savedNotice()).toBeInTheDocument();
    await user.click(settingsButton());
    expect(within(drawer()).getByLabelText('Currency code')).toHaveValue('EUR');
  });

  it.each([
    ['a 404', failure(404), 'This quote was deleted elsewhere, so it cannot be saved.'],
    ['a 422', failure(422, { message: 'Unknown field: colour' }), 'Unknown field: colour'],
    ['a network failure', new Error('Network Error'), 'Could not save. Try again.'],
  ])('keeps every typed value after %s on an edit', async (_label, error, message) => {
    const user = userEvent.setup();
    vi.mocked(coreApi.patch).mockRejectedValue(error);
    renderEditor('/quotes/7');
    const title = await screen.findByLabelText('Title');
    await retype(user, title, 'Dashboard, phase two');
    await retype(user, screen.getByLabelText('Line 3 hours per unit'), '20');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(savedNotice()).not.toBeInTheDocument();
    expect(title).toHaveValue('Dashboard, phase two');
    expect(screen.getByLabelText('Line 3 hours per unit')).toHaveValue('20');
    expect(screen.getByTestId('where')).toHaveTextContent('/quotes/7');
  });

  it('says a quote that is not there does not exist', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(404));
    renderEditor('/quotes/7');
    expect(await screen.findByText('This quote does not exist, or was deleted.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to quotes' })).toHaveAttribute('href', '/quotes');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it.each(['abc', '0', '7.5', '99999999999'])('does not ask for a quote at “/quotes/%s”', (id) => {
    renderEditor(`/quotes/${id}`);
    expect(screen.getByText('This quote does not exist, or was deleted.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to quotes' })).toHaveAttribute('href', '/quotes');
    expect(coreApi.get).not.toHaveBeenCalled();
  });

  it('shows an error with a retry when the quote cannot be loaded', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.get).mockRejectedValueOnce(failure(500));
    renderEditor('/quotes/7');
    expect(await screen.findByText(/We could not load this data/)).toBeInTheDocument();
    serve();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Title')).toHaveValue('Dashboard refresh');
  });
});
