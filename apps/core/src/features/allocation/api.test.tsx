import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { coreApi } from '@/lib/core-api';
import { queryDefaults } from '@/lib/query-client';
import { allocationEnvelope, allocationRows, allocationsEnvelope } from '@/test/fixtures/allocations';
import { envelope, fakeAdapter, type FakeAdapter, type FakeReply } from '@/test/fake-adapter';
import { useAllocations, useDeleteAllocation, useMoveAllocation, useSaveAllocation } from './api';

const originalAdapter = coreApi.defaults.adapter;

/** Answers every call with `reply`; `adapter.calls` holds what was sent. */
function serve(reply: FakeReply | ((method: string, url: string) => FakeReply)): FakeAdapter {
  const adapter = fakeAdapter((config) => (typeof reply === 'function' ? reply(config.method ?? '', config.url ?? '') : reply));
  coreApi.defaults.adapter = adapter;
  return adapter;
}

const sentBody = (adapter: FakeAdapter, index = 0) => JSON.parse(adapter.calls[index].data as string);

function setup<T>(useHook: () => T) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: queryDefaults.queries.networkMode },
      mutations: { retry: false, networkMode: queryDefaults.mutations.networkMode },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(useHook, { wrapper }) };
}

afterEach(() => {
  coreApi.defaults.adapter = originalAdapter;
});

describe('useAllocations', () => {
  it('lists the entries, as the service sends them: newest first', async () => {
    const adapter = serve({ status: 200, data: allocationsEnvelope() });
    const { result } = setup(() => useAllocations());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((row) => row.id)).toEqual([4, 3, 2, 1]);
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({ method: 'get', url: '/allocations' });
    expect(adapter.calls[0].params).toBeUndefined();
  });

  it('asks for only one person’s entries, or only one project’s, when told to', async () => {
    const adapter = serve({ status: 200, data: allocationsEnvelope([]) });
    const person = setup(() => useAllocations({ personId: 1 }));
    await waitFor(() => expect(person.result.current.isSuccess).toBe(true));
    expect(adapter.calls[0].params).toEqual({ personId: 1 });

    const project = setup(() => useAllocations({ projectId: 2 }));
    await waitFor(() => expect(project.result.current.isSuccess).toBe(true));
    expect(adapter.calls[1].params).toEqual({ projectId: 2 });
  });

  it('keeps each filter under its own key, below the one prefix every write refreshes', async () => {
    serve({ status: 200, data: allocationsEnvelope() });
    const { client, result } = setup(() => ({ everyone: useAllocations(), one: useAllocations({ personId: 1 }) }));
    await waitFor(() => expect(result.current.everyone.isSuccess && result.current.one.isSuccess).toBe(true));
    const keys = client.getQueryCache().getAll().map((query) => query.queryKey);
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key[0] === 'allocations')).toBe(true);
    expect(keys[0]).not.toEqual(keys[1]);
  });

  it.each([
    ['a bare array, which is not the service’s envelope', allocationRows],
    ['an entry that has lost its person', allocationsEnvelope([{ ...allocationRows[0], person: undefined }])],
    ['an entry with a date that is not a day', allocationsEnvelope([{ ...allocationRows[0], effectiveDate: 'soon' }])],
  ])('is an error, not a broken list, when the service answers with %s', async (_label, body) => {
    serve({ status: 200, data: body });
    const { result } = setup(() => useAllocations());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('is an error when the request fails', async () => {
    serve({ status: 500, data: envelope(null, 500) });
    const { result } = setup(() => useAllocations());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSaveAllocation', () => {
  const body = { personId: 1, projectId: 2, effectiveDate: '2026-10-20', note: null };

  it('adds an entry with POST, whole', async () => {
    const adapter = serve({ status: 201, data: allocationEnvelope(allocationRows[1], 201) });
    const { result } = setup(() => useSaveAllocation());
    await act(() => result.current.mutateAsync({ id: undefined, body }));
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({ method: 'post', url: '/allocations' });
    expect(sentBody(adapter)).toEqual(body);
  });

  it('adds an entry for the bench with a null project', async () => {
    const adapter = serve({ status: 201, data: allocationEnvelope() });
    const { result } = setup(() => useSaveAllocation());
    await act(() => result.current.mutateAsync({ id: undefined, body: { ...body, projectId: null, note: 'Rolled off' } }));
    expect(sentBody(adapter)).toEqual({ personId: 1, projectId: null, effectiveDate: '2026-10-20', note: 'Rolled off' });
  });

  it('changes an entry with PATCH under its id, and never sends the person, which cannot change', async () => {
    const adapter = serve({ status: 200, data: allocationEnvelope() });
    const { result } = setup(() => useSaveAllocation());
    await act(() => result.current.mutateAsync({ id: 3, body: { ...body, projectId: null, note: 'Rolled off' } }));
    expect(adapter.calls[0]).toMatchObject({ method: 'patch', url: '/allocations/3' });
    // The service refuses a write with a key it does not know, and the person is not one it takes on a change.
    expect(sentBody(adapter)).toEqual({ projectId: null, effectiveDate: '2026-10-20', note: 'Rolled off' });
  });

  it('sends a null note on a PATCH, so an emptied note is cleared', async () => {
    const adapter = serve({ status: 200, data: allocationEnvelope() });
    const { result } = setup(() => useSaveAllocation());
    await act(() => result.current.mutateAsync({ id: 3, body }));
    expect(sentBody(adapter)).toHaveProperty('note', null);
  });

  it('does not read the answer, so one it does not know cannot look like a failed save', async () => {
    serve({ status: 201, data: { surprise: true } });
    const { result } = setup(() => useSaveAllocation());
    await act(() => result.current.mutateAsync({ id: undefined, body }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('marks every allocation list stale, and refetches the ones on screen', async () => {
    serve({ status: 200, data: allocationsEnvelope() });
    const { client, result } = setup(() => ({
      list: useAllocations(),
      person: useAllocations({ personId: 1 }),
      save: useSaveAllocation(),
    }));
    await waitFor(() => expect(result.current.list.isSuccess && result.current.person.isSuccess).toBe(true));
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const adapter = serve((method) =>
      method === 'get' ? { status: 200, data: allocationsEnvelope() } : { status: 201, data: allocationEnvelope() },
    );
    await act(() => result.current.save.mutateAsync({ id: undefined, body }));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['allocations'] }));
    // The post, then both lists asked for again.
    await waitFor(() => expect(adapter.calls.filter((call) => call.method === 'get')).toHaveLength(2));
  });

  it('fails, and refreshes nothing, when the service refuses the entry', async () => {
    serve({ status: 409, data: { statusCode: 409, message: 'This person already has an entry on that date; edit it instead', data: null } });
    const { client, result } = setup(() => useSaveAllocation());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await expect(result.current.mutateAsync({ id: undefined, body })).rejects.toMatchObject({ response: { status: 409 } });
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useDeleteAllocation', () => {
  it('deletes the entry by id and refreshes the lists', async () => {
    const adapter = serve({ status: 200, data: envelope(null) });
    const { client, result } = setup(() => useDeleteAllocation());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(() => result.current.mutateAsync(3));
    expect(adapter.calls[0]).toMatchObject({ method: 'delete', url: '/allocations/3' });
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['allocations'] }));
  });

  it('counts an entry that is already gone as deleted, and refreshes the lists all the same', async () => {
    serve({ status: 404, data: envelope(null, 404) });
    const { client, result } = setup(() => useDeleteAllocation());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(() => result.current.mutateAsync(3));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['allocations'] }));
  });

  it('fails on any other error, and refreshes nothing', async () => {
    serve({ status: 500, data: envelope(null, 500) });
    const { client, result } = setup(() => useDeleteAllocation());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await expect(result.current.mutateAsync(3)).rejects.toBeDefined();
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useMoveAllocation', () => {
  it('sets where a person is from a day, with POST /allocations/move', async () => {
    const adapter = serve({ status: 200, data: allocationEnvelope() });
    const { result } = setup(() => useMoveAllocation());
    await act(() => result.current.mutateAsync({ personId: 1, projectId: 2, effectiveDate: '2026-10-20' }));
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({ method: 'post', url: '/allocations/move' });
    expect(sentBody(adapter)).toEqual({ personId: 1, projectId: 2, effectiveDate: '2026-10-20' });
  });

  it('moves a person to the bench with a null project, which is not left out', async () => {
    const adapter = serve({ status: 200, data: allocationEnvelope() });
    const { result } = setup(() => useMoveAllocation());
    await act(() => result.current.mutateAsync({ personId: 1, projectId: null, effectiveDate: '2026-10-20' }));
    expect(sentBody(adapter)).toEqual({ personId: 1, projectId: null, effectiveDate: '2026-10-20' });
  });

  it('does not read the answer, and refreshes the lists', async () => {
    serve({ status: 200, data: { surprise: true } });
    const { client, result } = setup(() => useMoveAllocation());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(() => result.current.mutateAsync({ personId: 1, projectId: 2, effectiveDate: '2026-10-20' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['allocations'] }));
  });

  it('fails, so the board can put the card back, when the service refuses', async () => {
    serve({ status: 409, data: { statusCode: 409, message: 'Referenced record does not exist', data: null } });
    const { client, result } = setup(() => useMoveAllocation());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await expect(
        result.current.mutateAsync({ personId: 1, projectId: 2, effectiveDate: '2026-10-20' }),
      ).rejects.toMatchObject({ response: { status: 409 } });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
