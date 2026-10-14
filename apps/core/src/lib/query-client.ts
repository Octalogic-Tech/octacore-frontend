import { QueryClient } from '@tanstack/react-query';

// networkMode 'always': navigator.onLine is not trustworthy and the API is on the local network. A paused
// request would show an empty table instead of an error, and a paused save would trap its dialog; a
// failed one shows an error and a Retry.
export const queryDefaults = {
  queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1, networkMode: 'always' as const },
  mutations: { networkMode: 'always' as const },
};

export const queryClient = new QueryClient({ defaultOptions: queryDefaults });
