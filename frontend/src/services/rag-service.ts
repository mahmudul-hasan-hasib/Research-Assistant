import { apiClient } from "./api-client";
import { endpoints } from "./endpoints";
import type { Document, DocumentList, IngestDocumentResponse } from "@/types/api";

export const ragService = {
  async ingest(uploadId: string): Promise<IngestDocumentResponse> {
    const { data } = await apiClient.post<IngestDocumentResponse>(endpoints.rag.ingest, {
      upload_id: uploadId,
    });
    return data;
  },

  async getDocument(documentId: string): Promise<Document> {
    const { data } = await apiClient.get<Document>(endpoints.rag.document(documentId));
    return data;
  },

  async listDocuments(params?: { skip?: number; limit?: number }): Promise<DocumentList> {
    const { data } = await apiClient.get<DocumentList>(endpoints.rag.listDocuments, {
      params: { skip: params?.skip ?? 0, limit: params?.limit ?? 50 },
    });
    return data;
  },

  async deleteDocument(documentId: string): Promise<void> {
    await apiClient.delete(endpoints.rag.deleteDocument(documentId));
  },

  async retrieve(query: string, topK?: number) {
    const { data } = await apiClient.post(endpoints.rag.retrieve, {
      query,
      top_k: topK ?? null,
    });
    return data;
  },
};
