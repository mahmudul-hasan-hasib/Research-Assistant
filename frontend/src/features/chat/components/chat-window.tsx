"use client";

import { useEffect } from "react";

import { useChat } from "../hooks/use-chat";
import { ChatInput } from "./chat-input";
import { MessageList } from "./message-list";
import { useChatStore } from "@/stores/chat-store";

const SUGGESTIONS = [
  "Summarize the key findings in my documents",
  "What documents do I have in my knowledge base?",
  "Find passages related to my latest upload",
];

interface ChatWindowProps {
  chatId: string;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
  const ensureChat = useChatStore((state) => state.ensureChat);
  const session = useChatStore((state) => state.sessions.find((item) => item.id === chatId));
  const { messages, isSending, sendMessage } = useChat(chatId);

  useEffect(() => {
    ensureChat(chatId);
  }, [chatId, ensureChat]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-3">
        <p className="truncate text-sm font-medium">{session?.title ?? "New chat"}</p>
      </div>

      <div className="min-h-0 flex-1">
        <MessageList
          messages={messages}
          empty={
            <>
              <h2 className="text-lg font-semibold">Ask Insight anything</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Query your research workspace. The agent retrieves from your knowledge base and
                explains its steps.
              </p>
              <div className="mt-4 flex max-w-md flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={isSending}
                    onClick={() => sendMessage(suggestion)}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </>
          }
        />
      </div>

      <ChatInput onSend={sendMessage} disabled={isSending} />
    </div>
  );
}
