/** Centralized TanStack Query key factory (avoids key drift across features). */
export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: ["auth", "me"] as const,
  },
  uploads: {
    all: ["uploads"] as const,
    list: (params?: { skip?: number; limit?: number }) =>
      ["uploads", "list", params ?? {}] as const,
    detail: (uploadId: string) => ["uploads", "detail", uploadId] as const,
  },
  documents: {
    all: ["documents"] as const,
    list: (params?: { skip?: number; limit?: number }) =>
      ["documents", "list", params ?? {}] as const,
    detail: (documentId: string) => ["documents", "detail", documentId] as const,
  },
  agent: {
    all: ["agent"] as const,
    run: ["agent", "run"] as const,
  },
};
