import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { coreApi } from '@/lib/core-api';
import { AuthTestProvider } from '@/test/auth';
import { envelope, fakeAdapter } from '@/test/fake-adapter';
import App from './app';

// Pages check what the service sends and show a load error for a bad answer, so no data can make them throw. These two
// throw while rendering, which is what the boundary is for: a bug in a page, however it got there.
vi.mock('@/features/invoices/invoices-page', () => ({
  InvoicesPage: () => {
    throw new Error('the invoices page broke');
  },
}));
vi.mock('@/features/overview/overview-page', () => ({
  OverviewPage: () => {
    throw new Error('the overview page broke');
  },
}));

const originalAdapter = coreApi.defaults.adapter;

function renderAt(route: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthTestProvider>
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      </AuthTestProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // The pages that still render use coreApi: answer it here so no request leaves the test.
  coreApi.defaults.adapter = fakeAdapter(() => ({ status: 200, data: envelope([]) }));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  coreApi.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe('a page that throws while rendering', () => {
  it('shows a message inside the shell instead of a blank page, and the menu still works', async () => {
    const user = userEvent.setup();
    renderAt('/finance/invoices');
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
    renderAt('/finance/invoices');
    expect(await screen.findByRole('link', { name: 'Reload this page' })).toHaveAttribute('href');
  });
});
