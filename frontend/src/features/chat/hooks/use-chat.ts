"use client";

import { useCallback, useMemo } from "react";

import { useChatStore } from "@/stores/chat-store";
import { agentService } from "@/services/agent-service";
import { getErrorMessage } from "@/utils/errors";
import type { ChatMessage } from "@/types/chat";

function createMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `msg-${crypto.randomUUID()}`;
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Non-streaming chat orchestration (Part 3.9). Streaming replaces this later. */
export function useChat(chatId: string) {
  const messages = useChatStore((state) => state.messages[chatId] ?? []);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const touchChat = useChatStore((state) => state.touchChat);

  const isSending = useMemo(
    () => messages.some((message) => message.status === "pending"),
    [messages],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) return;

      const userMessage: ChatMessage = {
        id: createMessageId(),
        chatId,
        role: "user",
        content: content.trim(),
        createdAt: new Date().toISOString(),
        status: "sent",
      };
      addMessage(userMessage);

      const assistantId = createMessageId();
      addMessage({
        id: assistantId,
        chatId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        status: "pending",
      });

      try {
        const result = await agentService.run(content.trim());
        updateMessage(assistantId, {
          status: "sent",
          content: result.final_answer,
          citations: result.citations as ChatMessage["citations"],
          steps: result.steps,
          source: result.source,
          rationale: result.rationale,
        });
        touchChat(chatId);
      } catch (error) {
        updateMessage(assistantId, {
          status: "error",
          content: "",
          error: getErrorMessage(error),
        });
      }
    },
    [chatId, isSending, addMessage, updateMessage, touchChat],
  );

  return { messages, isSending, sendMessage };
}
