import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { coreApi } from '@/lib/core-api';
import { queryDefaults } from '@/lib/query-client';
import { allocationEnvelope, allocationRows, allocationsEnvelope } from '@/test/fixtures/allocations';
import { envelope, fakeAdapter, type FakeAdapter, type FakeReply } from '@/test/fake-adapter';
import {
  useAddCard,
  useAllocations,
  useDeleteAllocation,
  useMoveAllocation,
  useRemoveCard,
  useSaveAllocation,
} from './api';

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
  const body = { personId: 1, card: 1, projectId: 2, removed: false, effectiveDate: '2026-10-20', note: null };
  /** The entry being edited: on project 2 and not removed. */
  const current = { projectId: 2, removed: false };

  it('adds an entry with POST, whole: the person, the card, the project, whether it is removed, the date and the note', async () => {
    const adapter = serve({ status: 201, data: allocationEnvelope(allocationRows[1], 201) });
    const { result } = setup(() => useSaveAllocation());
    await act(() => result.current.mutateAsync({ id: undefined, body }));
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({ method: 'post', url: '/allocations' });
    expect(sentBody(adapter)).toEqual(body);
  });

  it('adds an entry for the bench with a null project, and for another card with its number', async () => {
    const adapter = serve({ status: 201, data: allocationEnvelope() });
    const { result } = setup(() => useSaveAllocation());
    await act(() =>
      result.current.mutateAsync({ id: undefined, body: { ...body, card: 3, projectId: null, note: 'Rolled off' } }),
    );
    expect(sentBody(adapter)).toEqual({
      personId: 1,
      card: 3,
      projectId: null,
      removed: false,
      effectiveDate: '2026-10-20',
      note: 'Rolled off',
    });
  });

  it('adds an entry that says a card is removed, with no project', async () => {
    const adapter = serve({ status: 201, data: allocationEnvelope() });
    const { result } = setup(() => useSaveAllocation());
    await act(() =>
      result.current.mutateAsync({ id: undefined, body: { ...body, card: 2, projectId: null, removed: true } }),
    );
    expect(sentBody(adapter)).toMatchObject({ card: 2, projectId: null, removed: true });
  });

  it('changes an entry with PATCH under its id, and never sends the person or the card, which cannot change', async () => {
    const adapter = serve({ status: 200, data: allocationEnvelope() });
    const { result } = setup(() => useSaveAllocation());
    await act(() =>
      result.current.mutateAsync({ id: 3, body: { ...body, projectId: null, note: 'Rolled off' }, current }),
    );
    expect(adapter.calls[0]).toMatchObject({ method: 'patch', url: '/allocations/3' });
    // The service refuses a write with a key it does not know, and the person and the card are not ones it takes on a change.
    expect(sentBody(adapter)).toEqual({ projectId: null, effectiveDate: '2026-10-20', note: 'Rolled off' });
    expect(sentBody(adapter)).not.toHaveProperty('personId');
    expect(sentBody(adapter)).not.toHaveProperty('card');
  });

  describe('on a PATCH, the project', () => {
    // The service checks every key of a PATCH body against the live records, so a project that was deleted since the
    // entry was written is refused (409) as soon as it is named, even by an edit that only changes the note.
    it('is left out when it is the entry’s own, so an entry of a deleted project can still change its note and date', async () => {
      const adapter = serve({ status: 200, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() =>
        result.current.mutateAsync({
          id: 3,
          body: { ...body, projectId: 99, note: 'Corrected' },
          current: { projectId: 99, removed: false },
        }),
      );
      expect(sentBody(adapter)).toEqual({ effectiveDate: '2026-10-20', note: 'Corrected' });
    });

    it('is left out when it is the bench and the entry is on the bench already', async () => {
      const adapter = serve({ status: 200, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() =>
        result.current.mutateAsync({
          id: 3,
          body: { ...body, projectId: null },
          current: { projectId: null, removed: false },
        }),
      );
      expect(sentBody(adapter)).not.toHaveProperty('projectId');
    });

    it('is sent when it is another project', async () => {
      const adapter = serve({ status: 200, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() =>
        result.current.mutateAsync({ id: 3, body: { ...body, projectId: 2 }, current: { projectId: 99, removed: false } }),
      );
      expect(sentBody(adapter)).toEqual({ projectId: 2, effectiveDate: '2026-10-20', note: null });
    });

    it('is sent as null when the entry moves to the bench', async () => {
      const adapter = serve({ status: 200, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() => result.current.mutateAsync({ id: 3, body: { ...body, projectId: null }, current }));
      expect(sentBody(adapter)).toEqual({ projectId: null, effectiveDate: '2026-10-20', note: null });
    });

    it('is sent when the entry is on the bench and moves to a project', async () => {
      const adapter = serve({ status: 200, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() =>
        result.current.mutateAsync({ id: 3, body, current: { projectId: null, removed: false } }),
      );
      expect(sentBody(adapter)).toHaveProperty('projectId', 2);
    });

    it('is always sent on an add', async () => {
      const adapter = serve({ status: 201, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() => result.current.mutateAsync({ id: undefined, body: { ...body, projectId: null } }));
      expect(sentBody(adapter)).toHaveProperty('projectId', null);
    });
  });

  describe('on a PATCH, removed', () => {
    it('is left out when the entry is not removed and is not being removed', async () => {
      const adapter = serve({ status: 200, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() => result.current.mutateAsync({ id: 3, body, current }));
      expect(sentBody(adapter)).not.toHaveProperty('removed');
    });

    it('is left out when the entry is removed already and stays so, with its project left out too', async () => {
      const adapter = serve({ status: 200, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() =>
        result.current.mutateAsync({
          id: 3,
          body: { ...body, projectId: null, removed: true, note: 'Gone' },
          current: { projectId: null, removed: true },
        }),
      );
      expect(sentBody(adapter)).toEqual({ effectiveDate: '2026-10-20', note: 'Gone' });
    });

    it('is sent, with no project, when an entry on a project becomes the removal of the card', async () => {
      const adapter = serve({ status: 200, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() =>
        result.current.mutateAsync({ id: 3, body: { ...body, projectId: null, removed: true }, current }),
      );
      expect(sentBody(adapter)).toEqual({ projectId: null, removed: true, effectiveDate: '2026-10-20', note: null });
    });

    it('is sent as false, with the project, when the removal of a card is made a placement again', async () => {
      const adapter = serve({ status: 200, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() =>
        result.current.mutateAsync({ id: 3, body, current: { projectId: null, removed: true } }),
      );
      expect(sentBody(adapter)).toEqual({ projectId: 2, removed: false, effectiveDate: '2026-10-20', note: null });
    });

    it('is sent as false alone when the removal of a card becomes the bench', async () => {
      const adapter = serve({ status: 200, data: allocationEnvelope() });
      const { result } = setup(() => useSaveAllocation());
      await act(() =>
        result.current.mutateAsync({
          id: 3,
          body: { ...body, projectId: null },
          current: { projectId: null, removed: true },
        }),
      );
      expect(sentBody(adapter)).toEqual({ removed: false, effectiveDate: '2026-10-20', note: null });
    });
  });

  it('sends a null note on a PATCH, so an emptied note is cleared', async () => {
    const adapter = serve({ status: 200, data: allocationEnvelope() });
    const { result } = setup(() => useSaveAllocation());
    await act(() => result.current.mutateAsync({ id: 3, body, current }));
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
    serve({
      status: 409,
      data: {
        statusCode: 409,
        message: 'This person already has an entry for that card on that date; edit it instead',
        data: null,
      },
    });
    const { client, result } = setup(() => useSaveAllocation());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await expect(result.current.mutateAsync({ id: undefined, body })).rejects.toMatchObject({
        response: { status: 409 },
      });
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
  const move = { personId: 1, card: 1, projectId: 2, effectiveDate: '2026-10-20' };

  it('sets where a card is from a day, with POST /allocations/move, naming the card', async () => {
    const adapter = serve({ status: 200, data: allocationEnvelope() });
    const { result } = setup(() => useMoveAllocation());
    await act(() => result.current.mutateAsync(move));
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({ method: 'post', url: '/allocations/move' });
    expect(sentBody(adapter)).toEqual({ personId: 1, card: 1, projectId: 2, effectiveDate: '2026-10-20' });
  });

  it('moves another card of the person by its number', async () => {
    const adapter = serve({ status: 200, data: allocationEnvelope() });
    const { result } = setup(() => useMoveAllocation());
    await act(() => result.current.mutateAsync({ ...move, card: 3 }));
    expect(sentBody(adapter)).toMatchObject({ card: 3 });
  });

  it('moves a card to the bench with a null project, which is not left out', async () => {
    const adapter = serve({ status: 200, data: allocationEnvelope() });
    const { result } = setup(() => useMoveAllocation());
    await act(() => result.current.mutateAsync({ ...move, projectId: null }));
    expect(sentBody(adapter)).toEqual({ personId: 1, card: 1, projectId: null, effectiveDate: '2026-10-20' });
  });

  it('does not read the answer, and refreshes the lists', async () => {
    serve({ status: 200, data: { surprise: true } });
    const { client, result } = setup(() => useMoveAllocation());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(() => result.current.mutateAsync(move));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['allocations'] }));
  });

  it('fails, so the board can put the card back, when the service refuses', async () => {
    serve({ status: 409, data: { statusCode: 409, message: 'That card does not exist', data: null } });
    const { client, result } = setup(() => useMoveAllocation());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await expect(result.current.mutateAsync({ ...move, card: 4 })).rejects.toMatchObject({
        response: { status: 409 },
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useAddCard', () => {
  const add = { personId: 1, projectId: 2, effectiveDate: '2026-10-20' };

  it('adds a card with POST /allocations/cards: the person, the project it starts on and the day', async () => {
    const adapter = serve({ status: 201, data: allocationEnvelope(allocationRows[1], 201) });
    const { result } = setup(() => useAddCard());
    await act(() => result.current.mutateAsync(add));
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({ method: 'post', url: '/allocations/cards' });
    expect(sentBody(adapter)).toEqual({ personId: 1, projectId: 2, effectiveDate: '2026-10-20' });
  });

  it('starts a card on the bench with a null project, which is not left out', async () => {
    const adapter = serve({ status: 201, data: allocationEnvelope() });
    const { result } = setup(() => useAddCard());
    await act(() => result.current.mutateAsync({ ...add, projectId: null }));
    expect(sentBody(adapter)).toEqual({ personId: 1, projectId: null, effectiveDate: '2026-10-20' });
  });

  it('sends a note when it is given, and none when it is not', async () => {
    const adapter = serve({ status: 201, data: allocationEnvelope() });
    const { result } = setup(() => useAddCard());
    await act(() => result.current.mutateAsync({ ...add, note: 'Also on the platform team' }));
    await act(() => result.current.mutateAsync({ ...add, note: null }));
    expect(sentBody(adapter, 0)).toHaveProperty('note', 'Also on the platform team');
    expect(sentBody(adapter, 1)).toHaveProperty('note', null);
  });

  it('does not read the answer, and refreshes the lists', async () => {
    serve({ status: 201, data: { surprise: true } });
    const { client, result } = setup(() => useAddCard());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(() => result.current.mutateAsync(add));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['allocations'] }));
  });

  it('fails, and refreshes nothing, when the service refuses', async () => {
    serve({ status: 409, data: { statusCode: 409, message: 'Referenced record does not exist', data: null } });
    const { client, result } = setup(() => useAddCard());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await expect(result.current.mutateAsync(add)).rejects.toMatchObject({ response: { status: 409 } });
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useRemoveCard', () => {
  const remove = { personId: 1, card: 2, effectiveDate: '2026-10-20' };

  it('removes a card with POST /allocations/remove: the person, the card and the day', async () => {
    const adapter = serve({ status: 200, data: allocationEnvelope() });
    const { result } = setup(() => useRemoveCard());
    await act(() => result.current.mutateAsync(remove));
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({ method: 'post', url: '/allocations/remove' });
    expect(sentBody(adapter)).toEqual({ personId: 1, card: 2, effectiveDate: '2026-10-20' });
  });

  it('does not read the answer, and refreshes the lists', async () => {
    serve({ status: 200, data: { surprise: true } });
    const { client, result } = setup(() => useRemoveCard());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(() => result.current.mutateAsync(remove));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['allocations'] }));
  });

  it('fails with the service’s refusal when a person has only one card, and refreshes nothing', async () => {
    serve({ status: 409, data: { statusCode: 409, message: 'A person keeps at least one card', data: null } });
    const { client, result } = setup(() => useRemoveCard());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await expect(result.current.mutateAsync({ ...remove, card: 1 })).rejects.toMatchObject({
        response: { status: 409 },
      });
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
