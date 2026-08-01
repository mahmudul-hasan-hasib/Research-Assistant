'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, FileText } from 'lucide-react';
import { SkeletonButton } from '@/components/ui/skeleton-button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { FileUpload } from './FileUpload';
import { useInsightStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage, AgentTraceStep } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { branding, getPrimaryClasses, getDocClasses } from '@/config/branding';
import { AppIcon } from './AppIcon';

const SUGGESTIONS = [
  'What are the latest trends in artificial intelligence?',
  'Explain quantum computing in simple terms',
  'Summarize the key findings about climate change',
  'Help me write a professional email',
  'What are the best practices for software design?',
  'Explain how large language models work',
];

export function ChatPanel() {
  const {
    messages, addMessage, updateLastAssistantMessage,
    isProcessing, setProcessing,
    uploadedFiles, clearUploadedFiles,
    activeDocumentContent, activeDocumentName, setActiveDocument,
  } = useInsightStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const primary = getPrimaryClasses();
  const doc = getDocClasses();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea when processing finishes
  useEffect(() => {
    if (!isProcessing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isProcessing]);

  const handleSubmit = useCallback(async () => {
    const query = input.trim();
    if (!query && uploadedFiles.length === 0) return;
    if (isProcessing) return;

    // Capture current values before state changes
    const capturedQuery = query || 'Analyze the uploaded file(s)';
    const capturedFiles = [...uploadedFiles];
    const capturedDocContent = activeDocumentContent;
    const capturedDocName = activeDocumentName;

    // Collect document text and image data from newly uploaded files
    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;
    let newDocText: string | undefined;

    for (const file of capturedFiles) {
      if (file.type === 'image' && file.imageBase64) {
        imageBase64 = file.imageBase64;
        imageMimeType = file.imageMimeType;
      }
      if (file.textContent && file.textContent.trim()) {
        newDocText = file.textContent;
      }
    }

    // Persist document content in store (so follow-up messages still have it)
    if (newDocText) {
      setActiveDocument(newDocText, capturedFiles.find(f => f.textContent)?.name || 'document');
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: capturedQuery,
      timestamp: Date.now(),
      attachments: capturedFiles.length > 0 ? capturedFiles : undefined,
    };

    addMessage(userMsg);
    setInput('');
    setProcessing(true);

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: 'thinking...',
      timestamp: Date.now(),
    };
    addMessage(assistantMsg);

    try {
      // Build conversation history (skip 'thinking...' placeholders and system)
      const history = messages
        .filter(m => m.role !== 'system' && m.content !== 'thinking...')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: capturedQuery,
          conversationHistory: history,
          imageBase64,
          imageMimeType,
          documentContent: newDocText || capturedDocContent || undefined,
          documentName: capturedFiles.find(f => f.textContent)?.name || capturedDocName || undefined,
        }),
      });

      const data = await response.json();

      if (data.error) {
        updateLastAssistantMessage(`Error: ${data.error}`);
      } else {
        updateLastAssistantMessage(
          data.answer,
          data.trace as AgentTraceStep[]
        );
      }
    } catch (err: any) {
      updateLastAssistantMessage(`Connection error: ${err.message}. Please try again.`);
    } finally {
      setProcessing(false);
      clearUploadedFiles();
    }
  }, [input, uploadedFiles, messages, isProcessing, activeDocumentContent, activeDocumentName, addMessage, updateLastAssistantMessage, setProcessing, clearUploadedFiles, setActiveDocument]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Active document indicator */}
      {activeDocumentContent && (
        <div className={`mx-4 mt-2 flex items-center gap-2 rounded-lg border ${doc.border} ${doc.bg} px-3 py-1.5`}>
          <FileText className={`h-3.5 w-3.5 ${doc.text}`} />
          <span className={`text-xs ${doc.text} font-medium truncate`}>{activeDocumentName}</span>
          <Badge variant="secondary" className={`h-4 px-1.5 text-[10px] ${doc.badge} shrink-0`}>Active</Badge>
          <span className={`text-[10px] ${doc.textLight} ml-auto shrink-0`}>Context available</span>
        </div>
      )}

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${primary.bg} shadow-xl ${primary.shadow}`}>
                <AppIcon size={32} className="text-white" />
              </div>
              <motion.div
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            </motion.div>

            <div className="text-center space-y-2 max-w-md">
              <h2 className="text-xl font-bold tracking-tight">{branding.appName}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {branding.appDescription}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((suggestion, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  onClick={() => setInput(suggestion)}
                  className={`flex items-start gap-2 rounded-xl border border-border/60 bg-white/80 backdrop-blur-sm p-3 text-left text-xs text-muted-foreground ${primary.bgHover} ${primary.borderHover} hover:text-foreground transition-all duration-200 shadow-sm hover:shadow-md`}
                >
                  <span className={`${primary.textLight} mt-0.5 shrink-0 font-bold`}>→</span>
                  <span className="leading-relaxed">{suggestion}</span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            <AnimatePresence>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border/40 bg-white/60 backdrop-blur-md p-4">
        <div className="max-w-3xl mx-auto space-y-2">
          <FileUpload />
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeDocumentContent ? 'Ask a follow-up question about the document...' : 'Ask anything — upload images, documents, or videos above...'}
              className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border/60 bg-white/80 text-sm shadow-sm focus:shadow-md transition-shadow"
              rows={1}
              disabled={isProcessing}
            />
            <SkeletonButton
              onClick={handleSubmit}
              loading={isProcessing}
              disabled={(!input.trim() && uploadedFiles.length === 0) || isProcessing}
              className="h-11 w-11 shrink-0 rounded-xl"
              size="icon"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </SkeletonButton>
          </div>
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] text-muted-foreground">
              Powered by AI agent orchestration
            </p>
            <p className="text-[10px] text-muted-foreground">Shift+Enter for new line</p>
          </div>
        </div>
      </div>
    </div>
  );
}
