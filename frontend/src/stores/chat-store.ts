import { create } from "zustand";

import type { ChatMessage, ChatSession } from "@/types/chat";
import type { AgentRunResponse } from "@/types/api";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface ChatState {
  sessions: ChatSession[];
  messages: Record<string, ChatMessage[]>;
  activeChatId: string | null;
  /** Placeholder for the SSE streaming buffer (Part 3.4) — unused until streaming lands. */
  streamBuffer: Record<string, string>;
  queryCount: number;
  createChat: () => string;
  ensureChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  setActiveChat: (chatId: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, patch: Partial<ChatMessage>) => void;
  resetStreamBuffer: (chatId: string) => void;
  appendToStreamBuffer: (chatId: string, chunk: string) => void;
  touchChat: (chatId: string) => void;
  recordAgentRun: (chatId: string, result: AgentRunResponse) => void;
  recordAgentError: (chatId: string, error: string) => void;
}

function deriveTitle(content: string): string {
  const compact = content.trim().replace(/\s+/g, " ");
  return compact.length > 60 ? `${compact.slice(0, 60)}…` : compact || "New chat";
}

export const useChatStore = create<ChatState>()((set) => ({
  sessions: [],
  messages: {},
  activeChatId: null,
  streamBuffer: {},
  queryCount: 0,

  createChat: () => {
    const chatId = createId("chat");
    const session: ChatSession = {
      id: chatId,
      title: "New chat",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    set((state) => ({
      sessions: [session, ...state.sessions],
      messages: { ...state.messages, [chatId]: [] },
      activeChatId: chatId,
    }));
    return chatId;
  },

  deleteChat: (chatId) => {
    set((state) => {
      const messages = { ...state.messages };
      delete messages[chatId];
      return {
        sessions: state.sessions.filter((session) => session.id !== chatId),
        messages,
        activeChatId: state.activeChatId === chatId ? null : state.activeChatId,
      };
    });
  },

  ensureChat: (chatId) => {
    set((state) => {
      if (state.sessions.some((session) => session.id === chatId)) {
        return { activeChatId: chatId };
      }
      const session: ChatSession = {
        id: chatId,
        title: "New chat",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      return {
        sessions: [session, ...state.sessions],
        messages: { ...state.messages, [chatId]: [] },
        activeChatId: chatId,
      };
    });
  },

  setActiveChat: (chatId) => set({ activeChatId: chatId }),

  addMessage: (message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [message.chatId]: [...(state.messages[message.chatId] ?? []), message],
      },
      sessions: state.sessions.map((session) =>
        session.id === message.chatId
          ? { ...session, updatedAt: nowIso(), title: session.title !== "New chat" ? session.title : deriveTitle(message.content) }
          : session,
      ),
    }));
  },

  updateMessage: (messageId, patch) => {
    set((state) => {
      const messages = Object.fromEntries(
        Object.entries(state.messages).map(([chatId, list]) => [
          chatId,
          list.map((message) => (message.id === messageId ? { ...message, ...patch } : message)),
        ]),
      );
      return { messages };
    });
  },

  resetStreamBuffer: (chatId) =>
    set((state) => ({ streamBuffer: { ...state.streamBuffer, [chatId]: "" } })),

  appendToStreamBuffer: (chatId, chunk) =>
    set((state) => ({
      streamBuffer: { ...state.streamBuffer, [chatId]: (state.streamBuffer[chatId] ?? "") + chunk },
    })),

  touchChat: (chatId) => {
    set((state) => ({
      queryCount: state.queryCount + 1,
      sessions: state.sessions.map((session) =>
        session.id === chatId ? { ...session, updatedAt: nowIso() } : session,
      ),
    }));
  },

  recordAgentRun: (chatId, result) => {
    set((state) => ({
      queryCount: state.queryCount + 1,
      sessions: state.sessions.map((session) =>
        session.id === chatId ? { ...session, updatedAt: nowIso() } : session,
      ),
    }));    const assistant: ChatMessage = {
      id: createId("msg"),
      chatId,
      role: "assistant",
      content: result.final_answer,
      createdAt: nowIso(),
      status: "sent",
      citations: result.citations as ChatMessage["citations"],
      steps: result.steps,
      source: result.source,
      rationale: result.rationale,
    };
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] ?? []), assistant],
      },
    }));
  },

  recordAgentError: (chatId, error) => {
    const message: ChatMessage = {
      id: createId("msg"),
      chatId,
      role: "assistant",
      content: "",
      createdAt: nowIso(),
      status: "error",
      error,
    };
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] ?? []), message],
      },
    }));
  },
}));
