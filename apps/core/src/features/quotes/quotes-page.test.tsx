import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { Route, Routes, useLocation } from 'react-router-dom';
import { coreApi } from '@/lib/core-api';
import { quoteRows, quotesEnvelope } from '@/test/fixtures/quotes';
import { renderWithProviders } from '@/test/utils';
import { QuotesPage } from './quotes-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/** The next GET answers with this body, in the service's envelope. */
const serve = (quotes: unknown = quotesEnvelope()) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/quotations') return { data: quotes };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

const gone = () =>
  new AxiosError('gone', 'ERR_BAD_REQUEST', undefined, null, {
    status: 404,
    data: {},
    statusText: '404',
    headers: {},
    config: {} as never,
  });

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/" element={<QuotesPage />} />
        <Route path="/quotes/new" element={<p>The editor, new</p>} />
        <Route path="/quotes/:id" element={<p>The editor, a quote</p>} />
      </Routes>
      <Where />
    </>,
  );
}

const rowOf = async (title: string) => within((await screen.findByRole('link', { name: title })).closest('tr') as HTMLElement);
const listCalls = () => vi.mocked(coreApi.get).mock.calls.filter(([path]) => path === '/quotations');

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('QuotesPage', () => {
  it('asks the core service for the quotations', async () => {
    renderPage();
    await screen.findByText('Acme storefront');
    expect(coreApi.get).toHaveBeenCalledWith('/quotations');
  });

  it('lists each quote with its lines, hours, final quote in its own currency, and last update', async () => {
    renderPage();
    const acme = await rowOf('Acme storefront');
    expect(acme.getAllByRole('cell').slice(0, 5).map((cell) => cell.textContent)).toEqual([
      'Acme storefront',
      '53',
      '1,485',
      '₹57,17,250.00',
      '15 Oct 2026',
    ]);
    const dashboard = await rowOf('Dashboard refresh');
    expect(dashboard.getAllByRole('cell').slice(0, 5).map((cell) => cell.textContent)).toEqual([
      'Dashboard refresh',
      '3',
      '36.34',
      '$50,844.43',
      '18 Oct 2026',
    ]);
    expect(screen.getByText('1–2 of 2')).toBeInTheDocument();
  });

  it('names the columns, the right-hand ones for figures', async () => {
    renderPage();
    await screen.findByText('Acme storefront');
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Title',
      'Lines',
      'Hours',
      'Final quote',
      'Updated',
      'Actions',
    ]);
  });

  it('links each title to its editor', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'Acme storefront' })).toHaveAttribute('href', '/quotes/1');
    expect(screen.getByRole('link', { name: 'Dashboard refresh' })).toHaveAttribute('href', '/quotes/2');
  });

  it('searches the title', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Acme storefront');
    await user.type(screen.getByLabelText('Search quotes'), 'dash');
    expect(screen.getByText('Dashboard refresh')).toBeInTheDocument();
    expect(screen.queryByText('Acme storefront')).not.toBeInTheDocument();
  });

  it('says so when nothing matches the search', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Acme storefront');
    await user.type(screen.getByLabelText('Search quotes'), 'zzz');
    expect(screen.getByText('No quotes match “zzz”.')).toBeInTheDocument();
  });

  it('says so when there are no quotes, and offers to create the first', async () => {
    serve(quotesEnvelope([]));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('No quotes yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create the first quote' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/quotes/new');
  });

  it('shows an error with a retry when the service is down', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Acme storefront')).toBeInTheDocument();
  });

  it('shows the error state for a bare array, which is not the envelope', async () => {
    serve(quoteRows);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });

  it('shows the error state for a row that lacks its totals', async () => {
    serve(quotesEnvelope([{ ...quoteRows[0], totals: undefined }]));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });
});

describe('QuotesPage: going to the editor', () => {
  it('opens a new quote from New quote', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'New quote' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/quotes/new');
    expect(screen.getByText('The editor, new')).toBeInTheDocument();
  });

  it('opens a quote from its Edit button', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Dashboard refresh' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/quotes/2');
    expect(screen.getByText('The editor, a quote')).toBeInTheDocument();
  });
});

describe('QuotesPage: deleting', () => {
  /** Lists both quotes until the returned function is called, then all but quote `id`: the service after the delete. */
  const withoutQuote = (id: number) => {
    let deleted = false;
    vi.mocked(coreApi.get).mockImplementation((async () => ({
      data: quotesEnvelope(deleted ? quoteRows.filter((row) => row.id !== id) : quoteRows),
    })) as never);
    return () => {
      deleted = true;
    };
  };

  it('asks first, then deletes the quote and the row goes', async () => {
    const remove = withoutQuote(1);
    vi.mocked(coreApi.delete).mockImplementation((async () => {
      remove();
      return { data: { statusCode: 200, message: 'deleted', data: null, meta: null } };
    }) as never);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Acme storefront' }));
    expect(screen.getByText('Delete quote “Acme storefront”?')).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete quote' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/quotations/1'));
    expect(coreApi.delete).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Acme storefront' })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Dashboard refresh' })).toBeInTheDocument();
    expect(screen.getByText('1–1 of 1')).toBeInTheDocument();
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Acme storefront' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(coreApi.delete).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Acme storefront' })).toBeInTheDocument();
  });

  it('treats a 404 on the delete as already deleted: the dialog closes without an error and the row goes', async () => {
    // Another session removed the quote first: the service answers the delete with a 404 and no longer lists it.
    const remove = withoutQuote(2);
    vi.mocked(coreApi.delete).mockImplementation((async () => {
      remove();
      throw gone();
    }) as never);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Dashboard refresh' }));
    await user.click(screen.getByRole('button', { name: 'Delete quote' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/quotations/2'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.queryByText('That did not work. Try again.')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Dashboard refresh' })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Acme storefront' })).toBeInTheDocument();
    expect(listCalls()).toHaveLength(2);
  });

  it('keeps the row and says so when the delete fails for another reason', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Acme storefront' }));
    await user.click(screen.getByRole('button', { name: 'Delete quote' }));
    expect(await screen.findByText('That did not work. Try again.')).toBeInTheDocument();
    // The dialog is still open, so the page behind it is hidden from the accessibility tree: the row is still there.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Acme storefront', hidden: true })).toBeInTheDocument();
  });
});
