import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { categoriesEnvelope, categoryRows } from '@/test/fixtures/categories';
import { renderWithProviders } from '@/test/utils';
import { CategoriesPage } from './categories-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const numbered = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    ...categoryRows[0],
    id: index + 1,
    name: `Category ${index + 1}`,
    description: 'anything',
  }));

/** The next GET answers with these rows, in the service's envelope. */
const serve = (rows: unknown) => vi.mocked(coreApi.get).mockResolvedValue({ data: categoriesEnvelope(rows) });

/** What the service answers a save with; the page does not read it. */
const saved = { data: { statusCode: 200, message: 'saved', data: categoryRows[0], meta: null } };

beforeEach(() => {
  serve(categoryRows);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('CategoriesPage', () => {
  it('asks the core service for the categories, not the mock API', async () => {
    renderWithProviders(<CategoriesPage />);
    await screen.findByText('Web');
    expect(coreApi.get).toHaveBeenCalledWith('/categories');
  });

  it('lists categories with readable dates from the service timestamps', async () => {
    renderWithProviders(<CategoriesPage />);
    expect(await screen.findByText('Web')).toBeInTheDocument();
    expect(screen.getByText('25 Jul 2023')).toBeInTheDocument();
    expect(screen.getByText('26 Jul 2023')).toBeInTheDocument();
    expect(screen.getByText('1–2 of 2')).toBeInTheDocument();
  });

  it('lists a category the service holds without a description, and edits it from an empty field', async () => {
    serve([{ ...categoryRows[1], description: null }]);
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Mobile' }));
    expect(screen.getByLabelText('Description')).toHaveValue('');
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
    serve(numbered(12));
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search categories'), 'Category 12');
    expect(screen.getByText('1–1 of 1')).toBeInTheDocument();
    expect(screen.getByText('Category 12')).toBeInTheDocument();
  });

  it('creates a category from the dialog, sending only what the service does not stamp itself', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add category' }));
    await user.type(screen.getByLabelText('Name'), 'Data');
    await user.type(screen.getByLabelText('Description'), 'Data work');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/categories', { name: 'Data', description: 'Data work' }),
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
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('edits a category with PATCH, starting from its current values', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Web' }));
    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('Web');
    await user.clear(name);
    await user.type(name, 'Web 2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/categories/1', {
        name: 'Web 2',
        description: 'Websites and portals',
      }),
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
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Web' }));
    expect(coreApi.delete).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Delete category “Web”?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete category' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/categories/1'));
  });

  it('marks the technologies stale after a delete, because they carry category names', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<CategoriesPage />);
    client.setQueryData(['technologies'], []);
    await user.click(await screen.findByRole('button', { name: 'Delete Web' }));
    await user.click(screen.getByRole('button', { name: 'Delete category' }));
    await waitFor(() => expect(client.getQueryState(['technologies'])?.isInvalidated).toBe(true));
  });

  it('marks the technologies stale after a rename, because they carry category names', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<CategoriesPage />);
    client.setQueryData(['technologies'], []);
    await user.click(await screen.findByRole('button', { name: 'Edit Web' }));
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Web 2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(client.getQueryState(['technologies'])?.isInvalidated).toBe(true));
  });

  it('lands on the last page that still exists after deleting the only row on the last page', async () => {
    serve(numbered(11));
    vi.mocked(coreApi.delete).mockImplementation(async () => {
      serve(numbered(10));
      return saved;
    });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Delete Category 11' }));
    await user.click(screen.getByRole('button', { name: 'Delete category' }));
    expect(await screen.findByText('1–10 of 10')).toBeInTheDocument();
    expect(screen.getByText('Category 1')).toBeInTheDocument();
  });

  it('shows an error with a retry when the service is down, then recovers', async () => {
    vi.mocked(coreApi.get)
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ data: categoriesEnvelope() });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Web')).toBeInTheDocument();
  });

  it.each([
    ['a bare array, which is what the json-server mock sends', categoryRows],
    ['an envelope whose row has lost its name', categoriesEnvelope([{ ...categoryRows[0], name: undefined }])],
  ])('shows the error state, not a broken table, when the service answers with %s', async (_label, body) => {
    vi.mocked(coreApi.get).mockResolvedValue({ data: body });
    renderWithProviders(<CategoriesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });

  it('offers to add the first category when there are none', async () => {
    serve([]);
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    expect(await screen.findByText('No categories yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add the first category' }));
    expect(screen.getByRole('dialog', { name: 'New category' })).toBeInTheDocument();
  });
});

describe('CategoriesPage dialogs', () => {
  it('keeps the dialog open while saving, so a failed save is not lost', async () => {
    let fail!: (error: Error) => void;
    vi.mocked(coreApi.post).mockImplementation(
      (() =>
        new Promise((_, reject) => {
          fail = reject;
        })) as never,
    );
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add category' }));
    await user.type(screen.getByLabelText('Name'), 'Data');
    await user.type(screen.getByLabelText('Description'), 'Data work');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'New category' })).toBeInTheDocument();
    fail(new Error('down'));
    expect(await screen.findByText('That did not save. Try again.')).toBeInTheDocument();
  });

  it('moves focus to the search field after a delete removes the row that held it', async () => {
    vi.mocked(coreApi.delete).mockImplementation((async () => {
      serve(categoryRows.slice(1));
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Web' }));
    await user.click(screen.getByRole('button', { name: 'Delete category' }));
    await waitFor(() => expect(screen.getByLabelText('Search categories')).toHaveFocus());
  });

  it('returns focus to the Delete button when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Web' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Web' })).toHaveFocus());
  });
});

describe('CategoriesPage focus', () => {
  it('returns focus to the Add category button when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add category' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add category' })).toHaveFocus());
  });

  it('moves focus to the search field when saving removes the button that opened the dialog', async () => {
    serve([]);
    vi.mocked(coreApi.post).mockImplementation((async () => {
      serve(categoryRows);
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add the first category' }));
    await user.type(screen.getByLabelText('Name'), 'Data');
    await user.type(screen.getByLabelText('Description'), 'Data work');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('Search categories')).toHaveFocus());
  });
});
