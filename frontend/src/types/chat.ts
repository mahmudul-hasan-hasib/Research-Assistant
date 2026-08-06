import type { AgentStep, Citation } from "./api";

export type ChatMessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  chatId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  status: "sent" | "pending" | "streaming" | "error";
  error?: string;
  citations?: Citation[];
  steps?: AgentStep[];
  source?: "llm" | "fallback" | null;
  rationale?: string | null;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
