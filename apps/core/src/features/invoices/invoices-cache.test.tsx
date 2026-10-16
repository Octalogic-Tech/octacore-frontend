import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAllInvoices, useDeleteProject, useSetInvoicePaid } from '@/features/projects/api';
import { coreApi } from '@/lib/core-api';
import { queryDefaults } from '@/lib/query-client';
import { invoicesEnvelope } from '@/test/fixtures/projects';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/** The app's own cache settings, where a fresh query is trusted for 30 seconds: that is how stale lists linger. */
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { ...queryDefaults.queries, retry: false }, mutations: queryDefaults.mutations },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

const asked = () => vi.mocked(coreApi.get).mock.calls.filter(([path]) => path === '/invoices').length;

beforeEach(() => {
  vi.mocked(coreApi.get).mockResolvedValue({ data: invoicesEnvelope() });
  vi.mocked(coreApi.delete).mockResolvedValue({ data: {} });
  vi.mocked(coreApi.patch).mockResolvedValue({ data: {} });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('the all-invoices list and the cache', () => {
  it('is asked for again, not shown from the cache, after a project is deleted: its invoices went with it', async () => {
    const { wrapper } = setup();
    const visit = renderHook(() => useAllInvoices(), { wrapper });
    await waitFor(() => expect(visit.result.current.isSuccess).toBe(true));
    expect(asked()).toBe(1);
    // The person leaves the page, so nothing refetches the list in the background.
    visit.unmount();

    const remove = renderHook(() => useDeleteProject(), { wrapper });
    await act(() => remove.result.current.mutateAsync(1));

    renderHook(() => useAllInvoices(), { wrapper });
    await waitFor(() => expect(asked()).toBe(2));
  });

  it('is refetched when an invoice is marked paid from a project page', async () => {
    const { wrapper } = setup();
    const list = renderHook(() => useAllInvoices(), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    expect(asked()).toBe(1);

    const markPaid = renderHook(() => useSetInvoicePaid(), { wrapper });
    await act(() => markPaid.result.current.mutateAsync({ id: 2, paidDate: '2026-11-20' }));

    await waitFor(() => expect(asked()).toBe(2));
  });
});
