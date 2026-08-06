/**
 * Single table of endpoint paths (Part 3.10). Base URLs are omitted — the
 * axios client prepends `{API_URL}/api/v1`. Kept in sync with the backend
 * routers under `backend/app/modules/*/router.py`.
 */
export const endpoints = {
  auth: {
    register: "/auth/register",
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
    logoutAll: "/auth/logout-all",
    me: "/auth/me",
  },
  uploads: {
    presign: "/uploads/presign",
    complete: (uploadId: string) => `/uploads/${uploadId}/complete`,
    get: (uploadId: string) => `/uploads/${uploadId}`,
    list: "/uploads",
    remove: (uploadId: string) => `/uploads/${uploadId}`,
  },
  rag: {
    ingest: "/rag/documents",
    document: (documentId: string) => `/rag/documents/${documentId}`,
    listDocuments: "/rag/documents",
    deleteDocument: (documentId: string) => `/rag/documents/${documentId}`,
    retrieve: "/rag/retrieve",
  },
  agent: {
    run: "/agent/run",
  },
  system: {
    health: "/healthz",
  },
} as const;
