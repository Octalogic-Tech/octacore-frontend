import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { Route, Routes, useLocation } from 'react-router-dom';
import { coreApi } from '@/lib/core-api';
import { quoteEnvelope, quoteRows } from '@/test/fixtures/quotes';
import { renderWithProviders } from '@/test/utils';
import { QuoteEditorPage } from './quote-editor-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// Quote 2 of the fixture (dollars, three lines, every setting off its default), as quote 7.
const saved = { ...quoteRows[1], id: 7 };

/** GETs answer with these bodies, in the service's envelope. */
const serve = (quote: unknown = quoteEnvelope(saved)) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/quotations/7') return { data: quote };
    if (path === '/quotations/12') return { data: quoteEnvelope({ ...quoteRows[0], id: 12, title: 'Website build' }) };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

const failure = (status: number, data: unknown = {}) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data,
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

function Where() {
  const location = useLocation();
  return (
    <>
      <p data-testid="where">{location.pathname}</p>
      <p data-testid="state">{JSON.stringify(location.state)}</p>
    </>
  );
}

function renderEditor(route: string) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/quotes" element={<p>Quotes list</p>} />
        <Route path="/quotes/new" element={<QuoteEditorPage />} />
        <Route path="/quotes/:id" element={<QuoteEditorPage />} />
      </Routes>
      <Where />
    </>,
    { route },
  );
}

/** Every value printed beside a label in one section of the totals panel. */
const valuesOf = (section: string, label: string) => {
  const term = within(screen.getByRole('region', { name: section })).getByText(label, { selector: 'dt' });
  return Array.from((term.parentElement as HTMLElement).querySelectorAll('dd')).map((value) => value.textContent);
};

const lineTotal = (number: number) => screen.getByText(`Line ${number} total hours`).parentElement;
const lineBuffered = (number: number) => screen.getByText(`Line ${number} hours with buffer`).parentElement;
const settingsButton = () => screen.getByRole('button', { name: /^Settings/ });
const drawer = () => screen.getByRole('dialog', { name: 'Quote settings' });

/** Replaces a field's text: a new line's units start at 1, so typing alone would append. */
async function retype(user: UserEvent, input: HTMLElement, text: string) {
  await user.clear(input);
  if (text !== '') await user.type(input, text);
}

/** Line one as `units` of `hours`, with a title and a description, so the quote can be saved. */
async function fillQuote(user: UserEvent, units = '2', hours = '7.5') {
  await user.type(screen.getByLabelText('Title'), 'Website build');
  await user.type(screen.getByLabelText('Line 1 title'), 'Sign-in screens');
  await user.type(screen.getByLabelText('Line 1 description'), 'Email and password, with a reset link');
  await retype(user, screen.getByLabelText('Line 1 units'), units);
  await retype(user, screen.getByLabelText('Line 1 hours per unit'), hours);
}

/** Opens the drawer, types into one of its fields and closes it again with Done. */
async function setSetting(user: UserEvent, group: string, label: string, text: string) {
  await user.click(settingsButton());
  await retype(user, within(within(drawer()).getByRole('group', { name: group })).getByLabelText(label), text);
  await user.click(within(drawer()).getByRole('button', { name: 'Done' }));
}

const fullNewBody = {
  title: 'Website build',
  currencyCode: 'INR',
  developerCount: 3,
  developerRateCents: 310_000,
  managerCount: 1,
  managerRateCents: 300_000,
  testerCount: 1,
  testerRateCents: 0,
  negotiationBufferPercent: 25,
  managementPercent: 25,
  testingPercent: 0,
  bugFixPercent: 0,
  hoursPerDay: 6,
  hoursPerMonth: 160,
  lines: [{ title: 'Sign-in screens', description: 'Email and password, with a reset link', units: 2, hoursPerUnit: 7.5 }],
};

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('QuoteEditorPage, a new quote', () => {
  it('starts from the defaults with one line', async () => {
    renderEditor('/quotes/new');
    expect(screen.getByRole('heading', { level: 1, name: 'New quote' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to quotes' })).toHaveAttribute('href', '/quotes');
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Currency')).toHaveValue('INR');
    expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(1);
    expect(screen.getByLabelText('Line 1 title')).toHaveValue('');
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('');
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
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    await retype(user, screen.getByLabelText('Line 2 units'), 'x');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '5');
    await user.click(screen.getByRole('button', { name: 'Add line' }));
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
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(2);
    expect(screen.getByLabelText('Line 2 units')).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeEnabled();

    await user.type(screen.getByLabelText('Line 2 title'), 'Second');
    await user.type(screen.getByLabelText('Line 2 description'), 'The second item');
    await user.click(screen.getByRole('button', { name: 'Remove line 1' }));
    expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(1);
    expect(screen.getByLabelText('Line 1 title')).toHaveValue('Second');
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('The second item');
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
  });

  it('names each line field and its total on a narrow screen, where the column headings are hidden', async () => {
    renderEditor('/quotes/new');
    const line = within(screen.getByRole('group', { name: 'Line 1' }));
    const cells = [
      ['Title', screen.getByLabelText('Line 1 title')],
      ['Units', screen.getByLabelText('Line 1 units')],
      ['Hours per unit', screen.getByLabelText('Line 1 hours per unit')],
      ['Total hours', lineTotal(1)],
      ['Hours with buffer', lineBuffered(1)],
    ] as const;
    for (const [text, cell] of cells) {
      const label = line.getByText(text);
      // Shown below `sm` and hidden from it up, where the column headings say the same; the inputs keep their own names.
      expect(label).toHaveClass('sm:hidden', 'text-small', 'font-semibold', 'text-navy-80');
      expect(label).not.toHaveClass('hidden');
      expect(label).toHaveAttribute('aria-hidden', 'true');
      expect(label.parentElement).toContainElement(cell);
    }
    // The description has its row to itself at every width, so its small label shows at every width too.
    const description = line.getByText('Description');
    expect(description).toHaveClass('text-small', 'font-semibold', 'text-navy-80');
    expect(description).not.toHaveClass('sm:hidden');
    expect(description).toHaveAttribute('aria-hidden', 'true');
    expect(description.parentElement).toContainElement(screen.getByLabelText('Line 1 description'));
    // The column headings, from `sm` up, are as they were: one row above the lines, not repeated in them.
    const [heading, rowLabel] = screen.getAllByText('Hours per unit');
    expect(heading.parentElement).toHaveClass('hidden', 'sm:grid');
    expect(rowLabel).toBe(line.getByText('Hours per unit'));
    expect(Array.from(heading.parentElement?.children ?? []).map((cell) => cell.textContent)).toEqual([
      'Title',
      'Units',
      'Hours per unit',
      'Total hours',
      'Hours with buffer',
      '',
    ]);
  });

  it('lays each line out as two rows: the title and the figures, then the description across the whole width', () => {
    renderEditor('/quotes/new');
    const line = screen.getByRole('group', { name: 'Line 1' });
    const title = within(line).getByRole('textbox', { name: 'Line 1 title' });
    const description = within(line).getByRole('textbox', { name: 'Line 1 description' });
    expect(title.tagName).toBe('INPUT');
    expect(title).toHaveAttribute('id', 'line-1-title');
    expect(title).toHaveAttribute('placeholder', 'Title');
    expect(description.tagName).toBe('TEXTAREA');
    expect(description).toHaveAttribute('id', 'line-1-description');
    expect(description).toHaveAttribute('rows', '2');
    expect(description).toHaveAttribute('placeholder', 'Description');

    // Row one holds the title with the figures and Remove, in the column template of the headings.
    const rowOne = title.parentElement?.parentElement as HTMLElement;
    expect(rowOne).toHaveClass('sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_6rem_7rem_5.5rem]');
    expect(rowOne).toContainElement(screen.getByLabelText('Line 1 units'));
    expect(rowOne).toContainElement(within(line).getByRole('button', { name: 'Remove line 1' }));
    expect(rowOne).not.toContainElement(description);
    // Lines are told apart by a hairline, never a shadow or a box.
    expect(line).toHaveClass('border-b', 'border-rule');
  });

  it('works out each line with the negotiation buffer, and the panel adds the column up', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    // The plan's example: 24, 2 x 28 and 16.5 hours, 96.5 in all, at the default 25 % buffer.
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '24');
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    await retype(user, screen.getByLabelText('Line 2 units'), '2');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '28');
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    await user.type(screen.getByLabelText('Line 3 hours per unit'), '16.5');

    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer 30');
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer 70');
    // 16.5 x 1.25 is 20.625: the half goes up.
    expect(lineBuffered(3)).toHaveTextContent('Line 3 hours with buffer 20.63');
    expect(valuesOf('Hours', 'From the lines')).toEqual(['96.5 hours']);
    expect(valuesOf('Hours', 'With negotiation buffer (25%)')).toEqual(['120.63 hours']);

    await setSetting(user, 'Percentages', 'Negotiation buffer (%)', '10');
    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer 26.4');
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer 61.6');
    expect(lineBuffered(3)).toHaveTextContent('Line 3 hours with buffer 18.15');
    expect(valuesOf('Hours', 'With negotiation buffer (10%)')).toEqual(['106.15 hours']);
  });

  it('shows no buffered hours for a wrong line, and none at all while a setting is wrong', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    // Only a wrong line: the column has nothing to add up, so the panel says nothing about it.
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '1,5');
    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer —');
    expect(within(screen.getByRole('region', { name: 'Hours' })).queryByText(/With negotiation buffer/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add line' }));
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '8');
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer 10');
    expect(valuesOf('Hours', 'With negotiation buffer (25%)')).toEqual(['10 hours']);

    await setSetting(user, 'Percentages', 'Negotiation buffer (%)', 'abc');
    expect(lineBuffered(1)).toHaveTextContent('Line 1 hours with buffer —');
    expect(lineBuffered(2)).toHaveTextContent('Line 2 hours with buffer —');
    expect(lineTotal(2)).toHaveTextContent('Line 2 total hours 8');
    expect(within(screen.getByRole('region', { name: 'Hours' })).queryByText(/With negotiation buffer/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN/);
  });

  it('puts the totals under the lines, beside them only from `xl`, and keeps them in sight there', async () => {
    renderEditor('/quotes/new');
    const totals = screen.getByRole('complementary', { name: 'Quote totals' });
    expect(within(totals).getByRole('region', { name: 'Hours' })).toBeInTheDocument();
    expect(within(totals).getByRole('region', { name: 'Cost' })).toBeInTheDocument();
    // jsdom cannot apply a breakpoint: the classes are the contract. One column, then a 22rem column from `xl`.
    expect(totals.parentElement).toHaveClass('grid', 'xl:grid-cols-[minmax(0,1fr)_22rem]');
    expect(totals.parentElement?.className).not.toMatch(/(^|\s)lg:grid-cols/);
    expect(totals).toHaveClass('xl:sticky', 'xl:top-6', 'xl:self-start');
    // Under the lines the three sections sit side by side from `md`, and stack again in the narrow `xl` column.
    const sections = within(totals).getByRole('region', { name: 'Time' }).parentElement;
    expect(sections).toHaveClass('md:grid-cols-3', 'xl:grid-cols-1');
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

  it('refuses a save without a title or a description', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await user.type(screen.getByLabelText('Line 1 hours per unit'), '4');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByLabelText('Title')).toHaveAccessibleDescription('Title is required');
    const line = within(screen.getByRole('group', { name: 'Line 1' }));
    expect(line.getByText('Description is required')).toBeInTheDocument();
    expect(line.getByLabelText('Line 1 title')).toHaveAccessibleDescription('Title is required');
    expect(line.getByLabelText('Line 1 description')).toHaveAccessibleDescription('Description is required');
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('refuses a save with a blank line title, telling that line, and sends nothing', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/new');
    await fillQuote(user);
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    // Spaces are not a title.
    await user.type(screen.getByLabelText('Line 2 title'), '   ');
    await user.type(screen.getByLabelText('Line 2 description'), 'Pages for the shop');
    await user.type(screen.getByLabelText('Line 2 hours per unit'), '3');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const line = within(screen.getByRole('group', { name: 'Line 2' }));
    expect(await line.findByText('Title is required')).toHaveAttribute('id', 'line-2-title-error');
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
    expect(vi.mocked(coreApi.post).mock.calls[0][1]).toMatchObject({ lines: [{ hoursPerUnit: sent }] });
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
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Website build' })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/quotes/12');
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    // The cue is for this arrival only: it is not left in the history entry for a reload or a Back to find.
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^null$/));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');

    await user.type(screen.getByLabelText('Title'), '!');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('Email and password, with a reset link');
    expect(screen.getByLabelText('Line 1 units')).toHaveValue('2');
    expect(screen.getByLabelText('Line 1 hours per unit')).toHaveValue('7.5');
    await user.click(settingsButton());
    expect(within(within(drawer()).getByRole('group', { name: 'Developer' })).getByLabelText('Rate per hour')).toHaveValue(
      '1000.00',
    );
  });
});

describe('QuoteEditorPage, a saved quote', () => {
  it('loads the quote and fills the title, the lines and the settings', async () => {
    const user = userEvent.setup();
    renderEditor('/quotes/7');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard refresh' })).toBeInTheDocument();
    expect(coreApi.get).toHaveBeenCalledWith('/quotations/7');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Dashboard refresh');
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
    expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(3);
    expect(screen.getByLabelText('Line 1 title')).toHaveValue('Sign-in screens');
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('Email and password, with a reset link');
    expect(screen.getByLabelText('Line 3 title')).toHaveValue('Export to CSV');
    expect(screen.getByLabelText('Line 3 description')).toHaveValue('Every table, as shown');
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

  it('patches the whole quote and says Saved until the next edit', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.patch).mockResolvedValue({ data: quoteEnvelope(saved) });
    renderEditor('/quotes/7');
    const title = await screen.findByLabelText('Title');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect(coreApi.patch).toHaveBeenCalledWith('/quotations/7', {
      title: 'Dashboard refresh',
      currencyCode: 'USD',
      developerCount: 2,
      developerRateCents: 123_456,
      managerCount: 1,
      managerRateCents: 200_000,
      testerCount: 2,
      testerRateCents: 99_999,
      negotiationBufferPercent: 7.5,
      managementPercent: 12.5,
      testingPercent: 10,
      bugFixPercent: 5,
      hoursPerDay: 7,
      hoursPerMonth: 150,
      lines: [
        { title: 'Sign-in screens', description: 'Email and password, with a reset link', units: 2, hoursPerUnit: 7.5 },
        { title: 'Chart tiles', description: 'Revenue, hours and margin', units: 3, hoursPerUnit: 0.25 },
        { title: 'Export to CSV', description: 'Every table, as shown', units: 1, hoursPerUnit: 12.34 },
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
      await user.click(screen.getByRole('button', { name: 'Add line' }));
      await user.click(screen.getByRole('button', { name: 'Remove line 1' }));
      await save.answered();

      expect(screen.getByLabelText('Title')).toHaveValue('Dashboard refresh!');
      expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(3);
      expect(screen.getByLabelText('Line 1 title')).toHaveValue('Chart tiles');
      expect(screen.getByLabelText('Line 2 hours per unit')).toHaveValue('20');
      expect(screen.getByLabelText('Line 3 units')).toHaveValue('1');
      // Those edits are not saved, so the page must not say they are.
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('goes on to save what was typed meanwhile with the next Save, then says Saved', async () => {
      const user = userEvent.setup();
      const save = await saveAndWait(user);
      await user.type(screen.getByLabelText('Title'), '!');
      await save.answered();

      vi.mocked(coreApi.patch).mockResolvedValue({ data: quoteEnvelope(saved) });
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Saved');
      expect(coreApi.patch).toHaveBeenCalledTimes(2);
      expect(vi.mocked(coreApi.patch).mock.calls[1][1]).toMatchObject({ title: 'Dashboard refresh!' });
      expect(screen.getByLabelText('Title')).toHaveValue('Dashboard refresh!');

      await user.type(screen.getByLabelText('Title'), '?');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('says Saved when nothing was changed meanwhile, and clears it at the next edit', async () => {
      const user = userEvent.setup();
      const save = await saveAndWait(user);
      await save.answered();
      expect(screen.getByRole('status')).toHaveTextContent('Saved');
      await user.type(screen.getByLabelText('Line 2 description'), '!');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('leaves a currency typed meanwhile as it was typed', async () => {
      const user = userEvent.setup();
      const save = await saveAndWait(user);
      await retype(user, screen.getByLabelText('Currency'), 'gbp');
      await save.answered();
      expect(screen.getByLabelText('Currency')).toHaveValue('gbp');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('shows the currency in capitals once a code typed in lower case is saved', async () => {
    const user = userEvent.setup();
    vi.mocked(coreApi.patch).mockResolvedValue({ data: quoteEnvelope(saved) });
    renderEditor('/quotes/7');
    await retype(user, await screen.findByLabelText('Currency'), ' eur ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect(vi.mocked(coreApi.patch).mock.calls[0][1]).toMatchObject({ currencyCode: 'EUR' });
    expect(screen.getByLabelText('Currency')).toHaveValue('EUR');
    // Showing the capitals is not an edit: the page goes on saying it is saved.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
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
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
