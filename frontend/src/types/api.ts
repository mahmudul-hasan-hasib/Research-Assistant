/**
 * Types mirroring the backend OpenAPI schemas (docs/ARCHITECTURE.md Part 3.10).
 * These must track `backend/app/modules/{auth,uploads,rag,agent}/schemas.py`.
 */

export type Role = "user" | "admin";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  plan: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
}

export type UploadStatus = "pending" | "processing" | "ready" | "failed";

export interface Upload {
  id: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  status: UploadStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface UploadList {
  items: Upload[];
  total: number;
  skip: number;
  limit: number;
}

export interface PresignUploadResponse {
  upload_id: string;
  upload_url: string;
  storage_key: string;
  expires_in: number;
  max_size_bytes: number;
  magic_sniff_bytes: number;
  allowed_content_types: string[];
}

export type DocumentStatus = "processing" | "ready" | "failed";

export interface Document {
  id: string;
  name: string;
  mime: string;
  size_bytes: number;
  status: DocumentStatus;
  parser: string;
  source_type: string;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  chunk_count: number;
}

export interface DocumentList {
  items: Document[];
  total: number;
  skip: number;
  limit: number;
}

export interface IngestDocumentResponse {
  document: Document;
  chunk_count: number;
}

export interface Citation {
  index: number;
  chunk_id: string;
  document_id: string;
  document_name: string;
  page: number | null;
  heading: string | null;
  snippet: string;
  score: number;
}

export interface RetrievalHit {
  chunk_id: string;
  document_id: string;
  document_name: string;
  content: string;
  score: number;
  page: number | null;
  heading: string | null;
}

export interface RetrieveResponse {
  query: string;
  rewritten_query: string | null;
  hits: RetrievalHit[];
  citations: Citation[];
}

export type StepStatus = "ok" | "error";
export type PlanSource = "llm" | "fallback";

export interface AgentStep {
  step_id: string;
  tool: string;
  status: StepStatus;
  args: Record<string, unknown>;
  output: string;
  error: string | null;
}

export interface AgentRunResponse {
  query: string;
  rationale: string | null;
  source: PlanSource;
  steps: AgentStep[];
  final_answer: string;
  citations: Array<Record<string, unknown>>;
  trace: Array<Record<string, unknown>>;
}

/** RFC 7807 problem+json error body (Part 4.5). */
export interface ApiProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  trace_id?: string;
  errors?: Record<string, unknown>;
}
