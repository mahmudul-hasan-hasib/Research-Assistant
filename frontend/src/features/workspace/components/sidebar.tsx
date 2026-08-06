"use client";

import { MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatStore } from "@/stores/chat-store";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/utils/cn";
import { formatRelativeTime } from "@/utils/format";

export function Sidebar({ className }: { className?: string }) {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        "hidden h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      <SidebarContent collapsed={collapsed} />
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className="w-full justify-start"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}

export function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const sessions = useChatStore((state) => state.sessions);
  const createChat = useChatStore((state) => state.createChat);
  const deleteChat = useChatStore((state) => state.deleteChat);

  const handleNewChat = () => {
    const chatId = createChat();
    router.push(`/chat/${chatId}`);
  };

  return (
    <div className="flex h-full flex-col gap-4 py-4">
      <div className={cn("flex items-center px-4", collapsed && "justify-center px-0")}>
        <Brand collapsed={collapsed} />
      </div>

      <div className={cn("px-2", collapsed && "flex justify-center px-0")}>
        <Button
          size={collapsed ? "icon" : "default"}
          className={cn("w-full", collapsed && "w-9")}
          onClick={handleNewChat}
        >
          <MessageSquarePlus className="h-4 w-4" />
          {!collapsed && <span>New chat</span>}
        </Button>
      </div>

      <SidebarNav collapsed={collapsed} />

      {sessions.length > 0 && (
        <>
          <Separator className={cn("mx-4", collapsed && "mx-3")} />
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-2">
            {!collapsed && (
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recent chats
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="group relative flex items-center rounded-md hover:bg-sidebar-accent/60"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-sidebar-foreground"
                    onClick={() => router.push(`/chat/${session.id}`)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {!collapsed && (
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{session.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatRelativeTime(session.updatedAt)}
                        </span>
                      </span>
                    )}
                  </button>
                  {!collapsed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`Delete chat ${session.title}`}
                      onClick={() => deleteChat(session.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
