'use client';

import { motion } from 'framer-motion';
import {
  Eye, FileText, Search, Brain, Loader2, Check, AlertTriangle,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentTraceStep } from '@/lib/types';

const toolIcons: Record<string, React.ReactNode> = {
  vision: <Eye className="h-3.5 w-3.5" />,
  nlp_classify: <FileText className="h-3.5 w-3.5" />,
  nlp_sentiment: <FileText className="h-3.5 w-3.5" />,
  nlp_summarize: <FileText className="h-3.5 w-3.5" />,
  nlp_translate: <FileText className="h-3.5 w-3.5" />,
  rag: <Search className="h-3.5 w-3.5" />,
  llm_synthesis: <Brain className="h-3.5 w-3.5" />,
};

const toolColors: Record<string, string> = {
  vision: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  nlp_classify: 'text-violet-700 bg-violet-50 border-violet-200',
  nlp_sentiment: 'text-violet-700 bg-violet-50 border-violet-200',
  nlp_summarize: 'text-violet-700 bg-violet-50 border-violet-200',
  nlp_translate: 'text-violet-700 bg-violet-50 border-violet-200',
  rag: 'text-amber-700 bg-amber-50 border-amber-200',
  llm_synthesis: 'text-rose-700 bg-rose-50 border-rose-200',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <div className="h-3 w-3 rounded-full border border-muted-foreground/40" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />,
  completed: <Check className="h-3.5 w-3.5 text-emerald-600" />,
  error: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />,
};

interface AgentTraceProps {
  trace: AgentTraceStep[];
  totalLatency?: number;
  compact?: boolean;
}

export function AgentTrace({ trace, totalLatency, compact = false }: AgentTraceProps) {
  const [expanded, setExpanded] = useState(!compact);

  if (!trace || trace.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-rose-400" />
          <span className="text-xs font-semibold">Agent Decision Trace</span>
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {trace.length} steps
          </Badge>
          {totalLatency && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {totalLatency}ms
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-3 pb-3"
        >
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/60" />

            <div className="space-y-2">
              {trace.map((step, i) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="relative flex gap-3"
                >
                  {/* Step indicator */}
                  <div className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center">
                    <div className={cn('flex items-center justify-center rounded-full border', toolColors[step.tool])}>
                      {step.status === 'running' ? statusIcons.running : toolIcons[step.tool]}
                    </div>
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">Step {step.step}</span>
                      <span className="text-xs font-medium truncate">{step.label}</span>
                      {step.duration && (
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{step.duration}ms</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                      {step.reasoning}
                    </p>
                    {step.result && (
                      <div className="mt-1 rounded bg-background/60 px-2 py-0.5">
                        <span className="text-[10px] font-mono text-emerald-600">→ {step.result}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
