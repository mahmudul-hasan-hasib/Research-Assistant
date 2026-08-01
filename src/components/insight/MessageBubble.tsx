'use client';

import { motion } from 'framer-motion';
import { User, Image as ImageIcon } from 'lucide-react';
import { AgentTrace } from './AgentTrace';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import { getPrimaryClasses } from '@/config/branding';
import { AppIcon } from './AppIcon';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('flex gap-3 w-full', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5',
          isUser
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <AppIcon size={16} className="text-emerald-600" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0 space-y-2 max-w-[85%]', isUser ? 'flex flex-col items-end' : '')}>
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={cn('flex flex-wrap gap-2', isUser && 'justify-end')}>
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 rounded-md bg-muted/60 border border-border/40 px-2.5 py-1.5"
              >
                {att.type === 'image' && <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />}
                <span className="text-xs text-muted-foreground max-w-[200px] truncate">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-tr-sm shadow-md shadow-emerald-500/15'
              : 'bg-white border border-border/60 rounded-tl-sm shadow-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : message.content === 'thinking...' ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                />
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                />
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                />
              </div>
              <span className="text-xs text-muted-foreground">Agent is reasoning...</span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-foreground [&>p]:mb-2 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-xs [&>h4]:text-xs [&_strong]:font-semibold [&_code]:text-emerald-700 [&_code]:bg-emerald-50 [&_code]:px-1.5 [&_code]:rounded-md [&_code]:text-[11px] [&_code]:font-medium [&_li]:mb-0.5">
              <FormattedContent content={message.content} />
            </div>
          )}
        </div>

        {/* Agent Trace */}
        {message.agentTrace && message.agentTrace.length > 0 && (
          <AgentTrace
            trace={message.agentTrace}
            compact={true}
          />
        )}
      </div>
    </motion.div>
  );
}

function FormattedContent({ content }: { content: string }) {
  // Simple markdown-like rendering for the AI response
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="font-semibold text-xs mt-3 mb-1">{line.slice(4)}</h4>);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(3)}</h3>);
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="font-bold text-base mt-3 mb-1.5">{line.slice(2)}</h2>);
    } else if (line.startsWith('- ')) {
      elements.push(
        <li key={i} className="ml-4 text-[13px] list-disc">{formatInlineMarkdown(line.slice(2))}</li>
      );
    } else if (line.startsWith('* ')) {
      elements.push(
        <li key={i} className="ml-4 text-[13px] list-disc">{formatInlineMarkdown(line.slice(2))}</li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 text-[13px] list-decimal">{formatInlineMarkdown(line.replace(/^\d+\.\s/, ''))}</li>
      );
    } else if (line.trim() === '') {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} className="text-[13px]">{formatInlineMarkdown(line)}</p>);
    }
  }

  return <>{elements}</>;
}

function formatInlineMarkdown(text: string): React.ReactNode {
  // Process bold, code, and links in text
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`([^`]+)`)|\[(.+?)\]\((.+?)\)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[4]) {
      parts.push(<code key={key++}>{match[4]}</code>);
    } else if (match[5] && match[6]) {
      parts.push(<a key={key++} href={match[6]} className="text-emerald-600 underline hover:text-emerald-700" target="_blank" rel="noreferrer">{match[5]}</a>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
