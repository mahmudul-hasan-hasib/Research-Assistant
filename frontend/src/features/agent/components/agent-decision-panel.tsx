"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Brain, ChevronDown, CircleCheck, CircleX, Cpu, Loader2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import type { AgentStep } from "@/types/api";

interface AgentDecisionPanelProps {
  rationale?: string | null;
  source?: "llm" | "fallback" | null;
  steps?: AgentStep[];
  pending?: boolean;
}

/**
 * Step-by-step agent trace inspector (Part 7.1 — decision trace viewer).
 * Renders the plan rationale, plan source, and per-tool results. Streaming
 * `tool_start` / `tool_result` events will feed this panel in a later phase.
 */
export function AgentDecisionPanel({ rationale, source, steps, pending }: AgentDecisionPanelProps) {
  const [open, setOpen] = useState(false);
  const hasTrace = Boolean(rationale) || (steps?.length ?? 0) > 0;

  if (!hasTrace && !pending) return null;

  return (
    <div className="overflow-hidden rounded-lg border bg-muted/30">
      <Button
        variant="ghost"
        size="sm"
        className="flex w-full items-center justify-between rounded-none px-3 py-2 text-xs font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5" />
          Agent decision
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
        </span>
        <span className="flex items-center gap-2">
          {source && (
            <Badge variant={source === "llm" ? "info" : "neutral"} className="px-1.5 py-0 text-[10px]">
              {source}
            </Badge>
          )}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          />
        </span>
      </Button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t p-3">
              {pending ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Cpu className="h-3.5 w-3.5 animate-pulse" />
                  Agent is planning and executing tools…
                </div>
              ) : (
                <>
                  {rationale && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Rationale
                      </p>
                      <p className="text-xs leading-relaxed">{rationale}</p>
                    </div>
                  )}

                  {steps && steps.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Tool calls
                      </p>
                      <ol className="space-y-1.5">
                        {steps.map((step) => (
                          <li key={step.step_id} className="flex items-start gap-2 text-xs">
                            {step.status === "ok" ? (
                              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            ) : (
                              <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 font-medium">
                                  <Brain className="h-3 w-3 text-muted-foreground" />
                                  {step.tool}
                                </span>
                                <span className="text-muted-foreground">{step.status}</span>
                              </div>
                              {step.error && (
                                <p className="text-destructive">{step.error}</p>
                              )}
                              {step.status === "ok" && (
                                <p className="mt-0.5 line-clamp-3 text-muted-foreground">{step.output}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
