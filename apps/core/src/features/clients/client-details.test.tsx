import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { coreApi } from '@/lib/core-api';
import { queryDefaults } from '@/lib/query-client';
import { clientsEnvelope, contactsEnvelope } from '@/test/fixtures/clients';
import { useClientDetails } from './api';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const serve = (failing: 'clients' | 'contacts' | null = null) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/clients') {
      if (failing === 'clients') throw new Error('down');
      return { data: clientsEnvelope() };
    }
    if (path === '/client-contacts') {
      if (failing === 'contacts') throw new Error('down');
      return { data: contactsEnvelope() };
    }
    throw new Error(`unexpected GET ${path}`);
  }) as never);

function setup(clientId: number | null) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: queryDefaults.queries.networkMode },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useClientDetails(clientId), { wrapper });
}

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('useClientDetails', () => {
  it('starts with both lists loading and nothing found', () => {
    const { result } = setup(1);
    expect(result.current).toMatchObject({ client: null, contact: null, clientsState: 'loading', contactsState: 'loading' });
  });

  it('finds the client and its contact by the client’s id', async () => {
    const { result } = setup(1);
    await waitFor(() => expect(result.current.contactsState).toBe('ready'));
    await waitFor(() => expect(result.current.clientsState).toBe('ready'));
    expect(result.current.client).toMatchObject({ name: 'Acme', city: 'Pune', countryName: 'India' });
    expect(result.current.contact).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' });
  });

  it('finds a client that has no contact', async () => {
    const { result } = setup(2);
    await waitFor(() => expect(result.current.contactsState).toBe('ready'));
    await waitFor(() => expect(result.current.clientsState).toBe('ready'));
    expect(result.current.client).toMatchObject({ name: 'Globex' });
    expect(result.current.contact).toBeNull();
  });

  it.each([
    ['no client id', null],
    ['an id neither list holds', 999],
  ])('finds nothing for %s, and says both lists are ready', async (_name, clientId) => {
    const { result } = setup(clientId);
    await waitFor(() => expect(result.current.contactsState).toBe('ready'));
    await waitFor(() => expect(result.current.clientsState).toBe('ready'));
    expect(result.current.client).toBeNull();
    expect(result.current.contact).toBeNull();
  });

  it('reports a failed contacts list on its own, and still finds the client', async () => {
    serve('contacts');
    const { result } = setup(1);
    await waitFor(() => expect(result.current.contactsState).toBe('failed'));
    await waitFor(() => expect(result.current.clientsState).toBe('ready'));
    expect(result.current.client).toMatchObject({ name: 'Acme' });
    expect(result.current.contact).toBeNull();
  });

  it('reports a failed clients list on its own, and still finds the contact', async () => {
    serve('clients');
    const { result } = setup(1);
    await waitFor(() => expect(result.current.clientsState).toBe('failed'));
    await waitFor(() => expect(result.current.contactsState).toBe('ready'));
    expect(result.current.client).toBeNull();
    expect(result.current.contact).toMatchObject({ name: 'Ada Lovelace' });
  });
});
