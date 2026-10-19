import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { usePeople, usePerson } from '@/features/people/api';
import { coreApi } from '@/lib/core-api';
import { queryDefaults } from '@/lib/query-client';
import { envelope, fakeAdapter, type FakeAdapter, type FakeReply } from '@/test/fake-adapter';
import { peopleEnvelope, personRows } from '@/test/fixtures/people';
import { technologiesEnvelope } from '@/test/fixtures/technologies';
import { useCreateTechnology, useDeleteTechnology, useTechnologies, useUpdateTechnology } from './api';

const originalAdapter = coreApi.defaults.adapter;

/** Answers the reads with the fixtures and every write with `write`; `adapter.calls` holds what was sent. */
function serve(write: FakeReply = { status: 200, data: envelope(null) }): FakeAdapter {
  const adapter = fakeAdapter((config) => {
    if (config.method !== 'get') return write;
    if (config.url === '/technologies') return { status: 200, data: technologiesEnvelope() };
    if (config.url === '/people') return { status: 200, data: peopleEnvelope() };
    if (config.url === '/people/1') return { status: 200, data: peopleEnvelope(personRows[0]) };
    return { status: 404, data: envelope(null, 404) };
  });
  coreApi.defaults.adapter = adapter;
  return adapter;
}

const reads = (adapter: FakeAdapter, url: string) =>
  adapter.calls.filter((call) => call.method === 'get' && call.url === url).length;

/** The people list, a person's own page and the technologies, all on screen (staleTime is 30 s: only an invalidation refetches). */
function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: queryDefaults.queries.staleTime,
        networkMode: queryDefaults.queries.networkMode,
      },
      mutations: { retry: false, networkMode: queryDefaults.mutations.networkMode },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(
      () => ({
        technologies: useTechnologies(),
        people: usePeople(),
        person: usePerson(1),
        create: useCreateTechnology(),
        update: useUpdateTechnology(),
        remove: useDeleteTechnology(),
      }),
      { wrapper }
    ),
  };
}

afterEach(() => {
  coreApi.defaults.adapter = originalAdapter;
});

describe('technology changes and the people who know them', () => {
  // A person's technologies are held by name on the person, and the person form ticks them by id: a renamed technology
  // reads wrongly, and a deleted one is still ticked (and refused on save), until the people are read again.
  async function loaded() {
    const adapter = serve();
    const view = setup();
    await waitFor(() =>
      expect(
        view.result.current.technologies.isSuccess &&
          view.result.current.people.isSuccess &&
          view.result.current.person.isSuccess
      ).toBe(true)
    );
    return { adapter, ...view };
  }

  it('reads the people, and a person’s page, again after a technology is renamed', async () => {
    const { adapter, result } = await loaded();
    expect(reads(adapter, '/people')).toBe(1);
    await act(() => result.current.update.mutateAsync({ id: 2, name: 'NestJS', description: 'A Node framework.' }));
    expect(adapter.calls.find((call) => call.method === 'patch')).toMatchObject({ url: '/technologies/2' });
    await waitFor(() => expect(reads(adapter, '/people')).toBe(2));
    await waitFor(() => expect(reads(adapter, '/people/1')).toBe(2));
    await waitFor(() => expect(reads(adapter, '/technologies')).toBe(2));
  });

  it('reads the people, and a person’s page, again after a technology is deleted', async () => {
    const { adapter, result } = await loaded();
    await act(() => result.current.remove.mutateAsync(2));
    expect(adapter.calls.find((call) => call.method === 'delete')).toMatchObject({ url: '/technologies/2' });
    await waitFor(() => expect(reads(adapter, '/people')).toBe(2));
    await waitFor(() => expect(reads(adapter, '/people/1')).toBe(2));
    await waitFor(() => expect(reads(adapter, '/technologies')).toBe(2));
  });

  it('does not read the people again after a technology is added: nobody knows it yet', async () => {
    const { adapter, result } = await loaded();
    await act(() => result.current.create.mutateAsync({ name: 'Vue', description: 'A framework.' }));
    await waitFor(() => expect(reads(adapter, '/technologies')).toBe(2));
    expect(reads(adapter, '/people')).toBe(1);
    expect(reads(adapter, '/people/1')).toBe(1);
  });

  it('reads nothing again when the change is refused', async () => {
    const adapter = serve({ status: 409, data: envelope(null, 409) });
    const view = setup();
    await waitFor(() => expect(view.result.current.people.isSuccess).toBe(true));
    await act(async () => {
      await expect(view.result.current.remove.mutateAsync(2)).rejects.toBeDefined();
      await expect(
        view.result.current.update.mutateAsync({ id: 2, name: 'x', description: 'y' })
      ).rejects.toBeDefined();
    });
    expect(reads(adapter, '/people')).toBe(1);
    expect(reads(adapter, '/technologies')).toBe(1);
  });
});
