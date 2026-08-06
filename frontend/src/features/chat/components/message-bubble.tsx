"use client";

import { Bot, CircleAlert, User } from "lucide-react";

import { Markdown } from "./markdown";
import { CitationsPanel } from "./citations-panel";
import { AgentDecisionPanel } from "@/features/agent/components/agent-decision-panel";
import { cn } from "@/utils/cn";
import type { ChatMessage } from "@/types/chat";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (message.status === "error") {
    return (
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <CircleAlert className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">Request failed</p>
          {message.error && <p className="mt-0.5 text-sm text-muted-foreground">{message.error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground",
          isUser ? "bg-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("min-w-0 max-w-[85%] space-y-2 sm:max-w-[75%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            isUser
              ? "border-primary/20 bg-primary text-primary-foreground"
              : "border-border bg-card",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : message.status === "pending" ? (
            <TypingIndicator />
          ) : (
            <Markdown content={message.content} />
          )}
        </div>

        {!isUser && message.status !== "pending" && (
          <>
            {message.citations && message.citations.length > 0 && (
              <CitationsPanel citations={message.citations} />
            )}
            {(message.steps?.length ?? 0) > 0 && (
              <AgentDecisionPanel
                rationale={message.rationale}
                source={message.source}
                steps={message.steps}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:300ms]" />
    </div>
  );
}
