"use client";

import { Loader2, Paperclip, SendHorizonal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/utils/format";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  const send = useCallback(() => {
    const content = value.trim();
    if (!content || disabled) return;
    if (attachment) {
      toast.info("Attachments will be supported once streaming lands", {
        description: `${attachment.name} (${formatBytes(attachment.size)}) will not be sent yet.`,
      });
    }
    onSend(content);
    setValue("");
  }, [value, disabled, attachment, onSend]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="border-t bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3">
        {attachment && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatBytes(attachment.size)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Remove attachment"
              onClick={() => {
                setAttachment(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div
          className={cn(
            "flex items-end gap-2 rounded-xl border bg-card p-2 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-ring",
            disabled && "opacity-70",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Attach file"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Attach a file</TooltipContent>
          </Tooltip>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setAttachment(file);
              event.target.value = "";
            }}
          />

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={placeholder ?? "Ask Insight anything…"}
            disabled={disabled}
            aria-label="Message"
            className="max-h-[200px] min-h-[38px] flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />

          <Button
            size="icon"
            className="shrink-0"
            onClick={send}
            disabled={disabled || !value.trim()}
            aria-label="Send message"
          >
            {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Insight may make mistakes — verify important answers.
        </p>
      </div>
    </div>
  );
}
