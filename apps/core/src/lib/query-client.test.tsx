import { onlineManager } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { CategoriesPage } from '@/features/categories/categories-page';
import { coreApi } from '@/lib/core-api';
import { renderWithProviders } from '@/test/utils';
import { queryClient } from './query-client';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

afterEach(() => {
  onlineManager.setOnline(true);
  vi.resetAllMocks();
});

describe('offline behaviour', () => {
  it('shows an error, not an empty table, when the browser reports it is offline', async () => {
    onlineManager.setOnline(false);
    vi.mocked(coreApi.get).mockRejectedValue(new Error('offline'));
    renderWithProviders(<CategoriesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    expect(screen.queryByText('No categories yet.')).not.toBeInTheDocument();
  });

  it('never pauses a request or a save for the network state', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.networkMode).toBe('always');
    expect(defaults.mutations?.networkMode).toBe('always');
  });
});
