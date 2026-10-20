import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { coreApi, statusOf, unwrap } from '@/lib/core-api';
import { quoteRowSchema, quoteRowsSchema, type QuoteBody } from './schema';

// The list and a quote's own page sit under one prefix, so a save or a delete refetches both.
export const QUOTES = ['quotes'] as const;
const QUOTE_LIST = [...QUOTES, 'list'] as const;
const quoteDetail = (id: number) => [...QUOTES, 'detail', id] as const;

// All a create answer is read for: where the new quote lives. Lax on purpose, see `useSaveQuote`.
const createdSchema = z.object({ id: z.number().int() });

export function useQuotes() {
  return useQuery({
    queryKey: QUOTE_LIST,
    queryFn: async () => unwrap((await coreApi.get('/quotations')).data, quoteRowsSchema),
  });
}

export function useQuote(id: number) {
  return useQuery({
    queryKey: quoteDetail(id),
    queryFn: async () => unwrap((await coreApi.get(`/quotations/${id}`)).data, quoteRowSchema),
  });
}

/**
 * Adds the quote (no id) or edits it, and resolves to the saved quote's id, so the editor can move a new quote to its own
 * address. The answer to a create is read for its `id` alone, against a lax schema, and never makes the save fail: once the
 * service has answered the quote is saved, and a schema mismatch must not look like a failed save (a retry would add it
 * twice). If the id cannot be read this resolves to undefined and the editor stays where it is.
 */
export function useSaveQuote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | undefined; body: QuoteBody }): Promise<number | undefined> => {
      if (id !== undefined) {
        await coreApi.patch(`/quotations/${id}`, body);
        return id;
      }
      const answer = await coreApi.post('/quotations', body);
      try {
        return unwrap(answer.data, createdSchema).id;
      } catch {
        return undefined;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: QUOTES }),
  });
}

/** A delete that finds the record already gone has reached the state the person asked for, so it is not a failure. */
async function deleteRecord(path: string) {
  try {
    await coreApi.delete(path);
  } catch (error) {
    if (statusOf(error) !== 404) throw error;
  }
}

export function useDeleteQuote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRecord(`/quotations/${id}`),
    onSuccess: (_data, id) => {
      // The quote's own page must ask again, not show the deleted quote from the cache.
      client.removeQueries({ queryKey: quoteDetail(id) });
      return client.invalidateQueries({ queryKey: QUOTES });
    },
  });
}
