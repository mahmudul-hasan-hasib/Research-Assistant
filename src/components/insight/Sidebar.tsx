'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Trash2, MessageSquare, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useInsightStore } from '@/lib/store';
import { branding, getPrimaryClasses, getDocClasses } from '@/config/branding';
import { AppIcon } from './AppIcon';

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, clearMessages, messages, isProcessing, activeDocumentName, setActiveDocument } = useInsightStore();
  const primary = getPrimaryClasses();
  const doc = getDocClasses();

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 240 : 64 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col border-r border-border bg-white/70 backdrop-blur-xl h-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5 min-w-0"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${primary.bg} ${primary.shadow}`}>
                <AppIcon size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight truncate">{branding.appName}</h1>
                <p className="text-[10px] text-muted-foreground leading-tight">{branding.appTagline}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 ml-auto"
          onClick={toggleSidebar}
        >
          {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <Separator />

      {/* Active chat indicator */}
      <div className="p-2">
        <button
          className={`flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm ${primary.bgLight} ${primary.text} font-medium shadow-sm`}
        >
          <MessageSquare className={`h-4 w-4 ${primary.text}`} />
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex flex-col min-w-0"
              >
                <span className="truncate">Chat</span>
                <span className={`text-[10px] ${primary.text} opacity-70 truncate`}>
                  {messages.length} message{messages.length !== 1 ? 's' : ''}{isProcessing ? ' · thinking...' : ''}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Active document */}
      <AnimatePresence>
        {activeDocumentName && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Active Document</p>
            <div className={`flex items-center gap-2 rounded-lg ${doc.bg} border ${doc.border} px-2.5 py-1.5`}>
              <FileText className={`h-3.5 w-3.5 ${doc.text}`} />
              <span className={`text-xs ${doc.text} truncate flex-1`}>{activeDocumentName}</span>
              <button
                onClick={() => setActiveDocument(null, null)}
                className={`${doc.text} opacity-60 hover:opacity-100 transition-opacity shrink-0`}
                title="Remove document context"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer — Clear chat */}
      <div className="p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          onClick={clearMessages}
          disabled={messages.length === 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="truncate text-xs"
              >
                Clear chat
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </motion.aside>
  );
}
