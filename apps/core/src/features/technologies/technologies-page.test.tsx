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
