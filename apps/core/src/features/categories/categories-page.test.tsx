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
    vi.mocked(api.get).mockResolvedValue({ data: numbered(12) });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search categories'), 'Category 12');
    expect(screen.getByText('1–1 of 1')).toBeInTheDocument();
    expect(screen.getByText('Category 12')).toBeInTheDocument();
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
    vi.mocked(api.get).mockResolvedValue({ data: numbered(11) });
    vi.mocked(api.delete).mockImplementation(async () => {
      vi.mocked(api.get).mockResolvedValue({ data: numbered(10) });
      return { data: {} };
    });
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Delete Category 11' }));
    await user.click(screen.getByRole('button', { name: 'Delete category' }));
    expect(await screen.findByText('1–10 of 10')).toBeInTheDocument();
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

describe('CategoriesPage dialogs', () => {
  it('keeps the dialog open while saving, so a failed save is not lost', async () => {
    let fail!: (error: Error) => void;
    vi.mocked(api.post).mockImplementation(
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
    vi.mocked(api.delete).mockImplementation((async () => {
      vi.mocked(api.get).mockResolvedValue({ data: rows.slice(1) });
      return { data: {} };
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
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    vi.mocked(api.post).mockImplementation((async () => {
      vi.mocked(api.get).mockResolvedValue({ data: rows });
      return { data: { id: 3 } };
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
