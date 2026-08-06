"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageSquareText } from "lucide-react";
import { useEffect, useRef } from "react";

import { MessageBubble } from "./message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/types/chat";

interface MessageListProps {
  messages: ChatMessage[];
  empty?: React.ReactNode;
}

export function MessageList({ messages, empty }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  return (
    <ScrollArea className="h-full">
      <div ref={viewportRef} className="h-full min-h-full">
        <div ref={containerRef} className="mx-auto flex h-full max-w-3xl flex-col gap-4 px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquareText className="h-6 w-6" />
              </div>
              {empty}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <MessageBubble message={message} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
