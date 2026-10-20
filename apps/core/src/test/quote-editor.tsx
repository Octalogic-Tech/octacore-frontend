import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { Route, Routes, useLocation } from 'react-router-dom';
import { QuoteEditorPage } from '@/features/quotes/quote-editor-page';
import { hundredthsOf } from '@/features/quotes/calc';
import { coreApi } from '@/lib/core-api';
import { bufferedQuoteRow, quoteEnvelope, quoteRows } from '@/test/fixtures/quotes';
import { renderWithProviders } from '@/test/utils';

/**
 * What the quote editor's tests share. Each test file mocks `@/lib/core-api` itself (`vi.mock` is per file), and that
 * mock is the `coreApi` used here.
 */

// Quote 2 of the fixture (dollars, three lines in two sections, every setting off its default), as quote 7.
export const saved = { ...quoteRows[1], id: 7 };

/** Extra quotes a test can serve by id, on top of 7, 12 and 3. */
const extra = new Map<string, unknown>();

/** GETs answer with these bodies, in the service's envelope. */
export const serve = (quote: unknown = quoteEnvelope(saved)) => {
  extra.clear();
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/quotations/7') return { data: quote };
    if (path === '/quotations/12') return { data: quoteEnvelope({ ...quoteRows[0], id: 12, title: 'Website build' }) };
    if (path === '/quotations/3') return { data: quoteEnvelope(bufferedQuoteRow) };
    if (extra.has(path)) return { data: extra.get(path) };
    throw new Error(`unexpected GET ${path}`);
  }) as never);
};

/** Serves one more quote, as quote `id`, built from quote 7 with these sections. */
export function serveSections(id: number, sections: unknown[]) {
  extra.set(`/quotations/${id}`, quoteEnvelope({ ...saved, id, sections }));
}

export const failure = (status: number, data: unknown = {}) =>
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

export function renderEditor(route: string) {
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
export const valuesOf = (section: string, label: string) => {
  const term = within(screen.getByRole('region', { name: section })).getByText(label, { selector: 'dt' });
  return Array.from((term.parentElement as HTMLElement).querySelectorAll('dd')).map((value) => value.textContent);
};

export const lineTotal = (number: number) => screen.getByText(`Line ${number} total hours`).parentElement;
export const lineBuffered = (number: number) => screen.getByText(`Line ${number} hours with buffer`).parentElement;
/** What the "Hours with buffer" column shows for the first `count` lines, added up, in hundredths of an hour. */
export const columnSum = (count: number) =>
  Array.from({ length: count }, (_unused, index) => lineBuffered(index + 1)?.textContent ?? '').reduce(
    (sum, text) => sum + hundredthsOf(text.replace(/^Line \d+ hours with buffer /, '')),
    0,
  );
export const settingsButton = () => screen.getByRole('button', { name: /^Settings/ });
export const sectionGroup = (number: number) => screen.getByRole('group', { name: `Section ${number}` });
export const lineGroup = (number: number) => screen.getByRole('group', { name: `Line ${number}` });
/** The description button of a line, whichever name it has. */
export const descriptionButton = (number: number) =>
  screen.getByRole('button', { name: new RegExp(`^(Add description to|Edit description of) line ${number}$`) });
/** The small mark on the description button that says the line has one. */
export const markerOf = (number: number) => lineGroup(number).querySelector('[data-slot="description-marker"]');
export const descriptionDialog = () => screen.getByRole('dialog', { name: 'Description' });
export const drawer = () => screen.getByRole('dialog', { name: 'Quote settings' });
/**
 * The page's "Saved" notice. It is a status, but not the only one: the drag and drop's live region is a status too, so
 * the notice is found by its text.
 */
export const savedNotice = () => screen.queryByText('Saved', { selector: '[role="status"]' });
/** The footer buttons of a section. */
export const addLine = (section: number) => screen.getByRole('button', { name: `Add line to section ${section}` });
export const addSection = (section: number) =>
  screen.getByRole('button', { name: `Add section after section ${section}` });

/** Replaces a field's text: a new line's units start at 1, so typing alone would append. */
export async function retype(user: UserEvent, input: HTMLElement, text: string) {
  await user.clear(input);
  if (text !== '') await user.type(input, text);
}

/** Opens a line's description, types it in place of what it had (if anything) and closes it with Done. */
export async function describeLine(user: UserEvent, number: number, text: string) {
  await user.click(descriptionButton(number));
  await retype(user, within(descriptionDialog()).getByLabelText('Description'), text);
  await user.click(within(descriptionDialog()).getByRole('button', { name: 'Done' }));
}

/** What a line's description holds, read from its dialog, which is closed again with Done. */
export async function descriptionOf(user: UserEvent, number: number) {
  await user.click(descriptionButton(number));
  const value = (within(descriptionDialog()).getByLabelText('Description') as HTMLTextAreaElement).value;
  await user.click(within(descriptionDialog()).getByRole('button', { name: 'Done' }));
  return value;
}

/** Line one as `units` of `hours`, with a title and a description, so the quote can be saved. */
export async function fillQuote(user: UserEvent, units = '2', hours = '7.5') {
  await user.type(screen.getByLabelText('Title'), 'Website build');
  await user.type(screen.getByLabelText('Line 1 title'), 'Sign-in screens');
  await describeLine(user, 1, 'Email and password, with a reset link');
  await retype(user, screen.getByLabelText('Line 1 units'), units);
  await retype(user, screen.getByLabelText('Line 1 hours per unit'), hours);
}

/** Opens the drawer, types into one of its fields and closes it again with Done. */
export async function setSetting(user: UserEvent, group: string, label: string, text: string) {
  await user.click(settingsButton());
  await retype(user, within(within(drawer()).getByRole('group', { name: group })).getByLabelText(label), text);
  await user.click(within(drawer()).getByRole('button', { name: 'Done' }));
}

export const fullNewBody = {
  title: 'Website build',
  currencyCode: 'INR',
  developerCount: 3,
  developerRateCents: 310_000,
  managerCount: 1,
  managerRateCents: 300_000,
  testerCount: 1,
  testerRateCents: 0,
  timeBufferPercent: 0,
  negotiationBufferPercent: 25,
  discountPercent: 0,
  managementPercent: 25,
  testingPercent: 0,
  bugFixPercent: 0,
  hoursPerDay: 6,
  hoursPerMonth: 160,
  sections: [
    {
      title: 'General',
      lines: [{ title: 'Sign-in screens', description: 'Email and password, with a reset link', units: 2, hoursPerUnit: 7.5 }],
    },
  ],
};
