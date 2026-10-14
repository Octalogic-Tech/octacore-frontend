import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { ProjectsPage } from './projects-page';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const rows = [
  { id: 1, name: 'Project 1', description: 'anything project-1', client: 'Client A', totalValue: 48000, totalOutstanding: 12000 },
  { id: 2, name: 'Project 2', description: 'anything project-2', client: 'Client B', totalValue: 32000, totalOutstanding: 0 },
];

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: rows });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ProjectsPage', () => {
  it('lists projects with client, value and outstanding amount as currency', async () => {
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Client A')).toBeInTheDocument();
    expect(screen.getByText('$48,000')).toBeInTheDocument();
    expect(screen.getByText('$12,000')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('searches by name and by client', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Project 1');
    await user.type(screen.getByLabelText('Search projects'), 'client b');
    expect(screen.getByText('Project 2')).toBeInTheDocument();
    expect(screen.queryByText('Project 1')).not.toBeInTheDocument();
  });

  it('says when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Project 1');
    await user.type(screen.getByLabelText('Search projects'), 'zzz');
    expect(screen.getByText('No projects match “zzz”.')).toBeInTheDocument();
  });

  it('shows an error with a retry when the API is down', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });

  it('says so when there are no projects', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument();
  });
});
