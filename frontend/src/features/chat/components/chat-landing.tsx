"use client";

import { MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat-store";

export function ChatLanding() {
  const router = useRouter();
  const createChat = useChatStore((state) => state.createChat);

  const handleNewChat = () => {
    const chatId = createChat();
    router.push(`/chat/${chatId}`);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <MessageSquarePlus className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Your chats</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Start a new conversation to query your knowledge base, or pick a recent chat from the
          sidebar.
        </p>
      </div>
      <Button onClick={handleNewChat}>
        <MessageSquarePlus className="h-4 w-4" />
        Start a new chat
      </Button>
    </div>
  );
}
