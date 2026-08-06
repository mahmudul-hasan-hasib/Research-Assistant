import type { Metadata } from "next";

import { ChatWindow } from "@/features/chat/components/chat-window";

export const metadata: Metadata = {
  title: "Chat",
};

export default async function ChatDetailPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  return <ChatWindow chatId={chatId} />;
}
