import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { api } from '@/lib/api';
import App from './app';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

// Two bills with no date: the Receipts page and the Overview both sort by it, and would throw.
const malformed = [
  { id: 1, amount: 10, approved: false },
  { id: 2, amount: 20, approved: false },
];

function renderAt(route: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.get).mockImplementation((async (url: string) => ({ data: url === '/bills' ? malformed : [] })) as never);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a page that cannot render its data', () => {
  it('shows a message inside the shell instead of a blank page, and the menu still works', async () => {
    const user = userEvent.setup();
    renderAt('/finance/receipts-bills');
    expect(await screen.findByText(/Something went wrong showing this page/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'Categories' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Categories' })).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
  });

  it('protects the Overview too', async () => {
    renderAt('/');
    expect(await screen.findByText(/Something went wrong showing this page/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('offers a link that reloads the page', async () => {
    renderAt('/finance/receipts-bills');
    expect(await screen.findByRole('link', { name: 'Reload this page' })).toHaveAttribute('href');
  });
});
