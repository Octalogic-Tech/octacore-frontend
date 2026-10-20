import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { coreApi } from '@/lib/core-api';
import { queryDefaults } from '@/lib/query-client';
import { envelope, fakeAdapter, type FakeAdapter, type FakeReply } from '@/test/fake-adapter';
import { leaveEnvelope, leaveRows, leavesEnvelope } from '@/test/fixtures/leaves';
import { useDeleteLeave, useLeaves, useSaveLeave } from './api';

const originalAdapter = coreApi.defaults.adapter;

/** Answers every call with `reply`; `adapter.calls` holds what was sent. */
function serve(reply: FakeReply | ((method: string, url: string) => FakeReply)): FakeAdapter {
  const adapter = fakeAdapter((config) =>
    typeof reply === 'function' ? reply(config.method ?? '', config.url ?? '') : reply
  );
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
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(useHook, { wrapper }) };
}

afterEach(() => {
  coreApi.defaults.adapter = originalAdapter;
});

describe('useLeaves', () => {
  it('lists the leaves, as the service sends them: newest first', async () => {
    const adapter = serve({ status: 200, data: leavesEnvelope() });
    const { result } = setup(() => useLeaves());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((row) => row.id)).toEqual([4, 3, 2, 1]);
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({ method: 'get', url: '/leaves' });
    expect(adapter.calls[0].params).toBeUndefined();
  });

  it('asks for only one person’s leaves when told to', async () => {
    const adapter = serve({ status: 200, data: leavesEnvelope([]) });
    const { result } = setup(() => useLeaves({ personId: 1 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adapter.calls[0].params).toEqual({ personId: 1 });
  });

  it('keeps each filter under its own key, below the one prefix every write refreshes', async () => {
    serve({ status: 200, data: leavesEnvelope() });
    const { client, result } = setup(() => ({ everyone: useLeaves(), one: useLeaves({ personId: 1 }) }));
    await waitFor(() => expect(result.current.everyone.isSuccess && result.current.one.isSuccess).toBe(true));
    const keys = client
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key[0] === 'leaves')).toBe(true);
    expect(keys[0]).not.toEqual(keys[1]);
  });

  it.each([
    ['a bare array, which is not the service’s envelope', leaveRows],
    ['a leave that has lost its person', leavesEnvelope([{ ...leaveRows[0], person: undefined }])],
    ['a leave with a type it does not know', leavesEnvelope([{ ...leaveRows[0], leaveType: 'holiday' }])],
    ['a leave with a day that is not a day', leavesEnvelope([{ ...leaveRows[0], endDate: 'soon' }])],
  ])('is an error, not a broken list, when the service answers with %s', async (_label, body) => {
    serve({ status: 200, data: body });
    const { result } = setup(() => useLeaves());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('is an error when the request fails', async () => {
    serve({ status: 500, data: envelope(null, 500) });
    const { result } = setup(() => useLeaves());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSaveLeave', () => {
  const body = {
    personId: 1,
    startDate: '2026-03-12',
    endDate: '2026-03-14',
    leaveType: 'casual' as const,
    reason: null,
  };

  it('adds a leave with POST, whole', async () => {
    const adapter = serve({ status: 201, data: leaveEnvelope(leaveRows[1], 201) });
    const { result } = setup(() => useSaveLeave());
    await act(() => result.current.mutateAsync({ id: undefined, body }));
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({ method: 'post', url: '/leaves' });
    expect(sentBody(adapter)).toEqual(body);
  });

  it('changes a leave with PATCH under its id, and never sends the person, which cannot change', async () => {
    const adapter = serve({ status: 200, data: leaveEnvelope() });
    const { result } = setup(() => useSaveLeave());
    await act(() => result.current.mutateAsync({ id: 3, body: { ...body, leaveType: 'sick', reason: 'Flu' } }));
    expect(adapter.calls[0]).toMatchObject({ method: 'patch', url: '/leaves/3' });
    // The service refuses a write with a key it does not know, and the person is not one it takes on a change.
    expect(sentBody(adapter)).toEqual({
      startDate: '2026-03-12',
      endDate: '2026-03-14',
      leaveType: 'sick',
      reason: 'Flu',
    });
  });

  it('sends a null reason on a PATCH, so an emptied reason is cleared', async () => {
    const adapter = serve({ status: 200, data: leaveEnvelope() });
    const { result } = setup(() => useSaveLeave());
    await act(() => result.current.mutateAsync({ id: 3, body }));
    expect(sentBody(adapter)).toHaveProperty('reason', null);
  });

  it('does not read the answer, so one it does not know cannot look like a failed save', async () => {
    serve({ status: 201, data: { surprise: true } });
    const { result } = setup(() => useSaveLeave());
    await act(() => result.current.mutateAsync({ id: undefined, body }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('marks every leave list stale, and refetches the ones on screen', async () => {
    serve({ status: 200, data: leavesEnvelope() });
    const { client, result } = setup(() => ({
      list: useLeaves(),
      person: useLeaves({ personId: 1 }),
      save: useSaveLeave(),
    }));
    await waitFor(() => expect(result.current.list.isSuccess && result.current.person.isSuccess).toBe(true));
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const adapter = serve((method) =>
      method === 'get' ? { status: 200, data: leavesEnvelope() } : { status: 201, data: leaveEnvelope() }
    );
    await act(() => result.current.save.mutateAsync({ id: undefined, body }));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['leaves'] }));
    await waitFor(() => expect(adapter.calls.filter((call) => call.method === 'get')).toHaveLength(2));
  });

  it('fails, and refreshes nothing, when the service refuses the leave', async () => {
    serve({
      status: 409,
      data: { statusCode: 409, message: 'This overlaps leave from 2026-03-10 to 2026-03-12', data: null },
    });
    const { client, result } = setup(() => useSaveLeave());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await expect(result.current.mutateAsync({ id: undefined, body })).rejects.toMatchObject({
        response: { status: 409 },
      });
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useDeleteLeave', () => {
  it('deletes the leave by id and refreshes the lists', async () => {
    const adapter = serve({ status: 200, data: envelope(null) });
    const { client, result } = setup(() => useDeleteLeave());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(() => result.current.mutateAsync(3));
    expect(adapter.calls[0]).toMatchObject({ method: 'delete', url: '/leaves/3' });
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['leaves'] }));
  });

  it('counts a leave that is already gone as deleted, and refreshes the lists all the same', async () => {
    serve({ status: 404, data: envelope(null, 404) });
    const { client, result } = setup(() => useDeleteLeave());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(() => result.current.mutateAsync(3));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['leaves'] }));
  });

  it('fails on any other error, and refreshes nothing', async () => {
    serve({ status: 500, data: envelope(null, 500) });
    const { client, result } = setup(() => useDeleteLeave());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await expect(result.current.mutateAsync(3)).rejects.toBeDefined();
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
