import { QueryClient } from "@tanstack/react-query";

/** Server-state cache (Part 3.4 — TanStack Query owns all server state). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
