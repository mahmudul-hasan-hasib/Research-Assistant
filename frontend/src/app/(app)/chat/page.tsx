import type { Metadata } from "next";

import { ChatLanding } from "@/features/chat/components/chat-landing";

export const metadata: Metadata = {
  title: "Chat",
};

export default function ChatIndexPage() {
  return <ChatLanding />;
}
