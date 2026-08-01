'use client';

import { motion } from 'framer-motion';
import { Eye, FileText, Search, Clock, Target, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ModuleResults } from '@/lib/types';

interface ModuleResultsPanelProps {
  results: ModuleResults;
}

export function ModuleResultsPanel({ results }: ModuleResultsPanelProps) {
  const panels: { key: keyof ModuleResults; title: string; icon: React.ReactNode; color: string }[] = [];

  if (results.vision) panels.push({ key: 'vision', title: 'Vision Module', icon: <Eye className="h-4 w-4" />, color: 'emerald' });
  if (results.nlp) panels.push({ key: 'nlp', title: 'NLP Module', icon: <FileText className="h-4 w-4" />, color: 'violet' });
  if (results.rag) panels.push({ key: 'rag', title: 'RAG Module', icon: <Search className="h-4 w-4" />, color: 'amber' });

  if (panels.length === 0) return null;

  return (
    <div className="space-y-3">
      {panels.map((panel) => (
        <motion.div
          key={panel.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {panel.key === 'vision' && results.vision && <VisionCard result={results.vision} />}
          {panel.key === 'nlp' && results.nlp && <NLPCard result={results.nlp} />}
          {panel.key === 'rag' && results.rag && <RAGCard result={results.rag} />}
        </motion.div>
      ))}
    </div>
  );
}

function VisionCard({ result }: { result: NonNullable<ModuleResults['vision']> }) {
  return (
    <Card className="border-emerald-200 bg-emerald-50/30">
      <CardHeader className="py-2.5 px-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100">
              <Eye className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <CardTitle className="text-xs">Vision Analysis</CardTitle>
          </div>
          <Badge variant="outline" className="h-5 text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">
            YOLOv8
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3.5 pb-3 pt-0 space-y-2">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{result.inferenceTime}ms</span>
          <span className="flex items-center gap-1"><Target className="h-3 w-3" />{result.detections?.length || 0} objects</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" />PyTorch</span>
        </div>
        {result.detections && result.detections.length > 0 && (
          <div className="space-y-1">
            {result.detections.slice(0, 5).map((det, i) => (
              <div key={i} className="flex items-center gap-2 rounded bg-background/40 px-2 py-1">
                <Badge variant="secondary" className="h-4 px-1.5 text-[9px] shrink-0">{det.label}</Badge>
                <Progress value={det.confidence * 100} className="h-1.5 flex-1" />
                <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">
                  {(det.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
        {result.sceneDescription && (
          <p className="text-[11px] text-muted-foreground italic">{result.sceneDescription}</p>
        )}
        <div className="rounded bg-background/40 p-2">
          <p className="text-[9px] font-mono text-muted-foreground">Preprocessing: {result.preprocessing.join(' → ')}</p>
          <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Model: {result.model}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NLPCard({ result }: { result: NonNullable<ModuleResults['nlp']> }) {
  return (
    <Card className="border-violet-200 bg-violet-50/30">
      <CardHeader className="py-2.5 px-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100">
              <FileText className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <CardTitle className="text-xs">NLP: {result.task.charAt(0).toUpperCase() + result.task.slice(1)}</CardTitle>
          </div>
          <Badge variant="outline" className="h-5 text-[10px] border-violet-200 text-violet-700 bg-violet-50">
            {result.model.split('(')[0].trim()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3.5 pb-3 pt-0 space-y-2">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{result.latency}ms</span>
          {result.confidence && (
            <span className="flex items-center gap-1"><Target className="h-3 w-3" />{(result.confidence * 100).toFixed(1)}%</span>
          )}
        </div>
        <div className="rounded bg-background/40 p-2">
          <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{result.output}</p>
        </div>
        {result.comparison && (
          <div className="rounded border border-border/40 p-2">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              PyTorch vs TensorFlow Benchmark
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-emerald-50 p-1.5">
                <p className="text-[9px] font-semibold text-emerald-700">PyTorch</p>
                <p className="text-[9px] text-muted-foreground">{result.comparison.pytorch.model}</p>
                <p className="text-[10px] font-mono mt-0.5">Acc: {result.comparison.pytorch.accuracy}% | {result.comparison.pytorch.latency}ms</p>
              </div>
              <div className="rounded bg-orange-50 p-1.5">
                <p className="text-[9px] font-semibold text-orange-700">TensorFlow</p>
                <p className="text-[9px] text-muted-foreground">{result.comparison.tensorflow.model}</p>
                <p className="text-[10px] font-mono mt-0.5">Acc: {result.comparison.tensorflow.accuracy}% | {result.comparison.tensorflow.latency}ms</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RAGCard({ result }: { result: NonNullable<ModuleResults['rag']> }) {
  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="py-2.5 px-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100">
              <Search className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <CardTitle className="text-xs">RAG Retrieval</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="h-5 text-[10px] border-amber-200 text-amber-700 bg-amber-50">
              {result.vectorBackend.split('|')[0].trim()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3.5 pb-3 pt-0 space-y-2">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Target className="h-3 w-3" />{result.retrievalAccuracy}% accuracy</span>
          <span className="flex items-center gap-1"><Search className="h-3 w-3" />{result.sources.length} chunks</span>
        </div>
        {result.sources.map((source, i) => (
          <div key={i} className="rounded bg-background/40 p-2">
            <div className="flex items-center justify-between mb-1">
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">{source.document}</Badge>
              <span className="text-[10px] font-mono text-amber-700">{(source.relevanceScore * 100).toFixed(0)}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{source.chunk}</p>
          </div>
        ))}
        <div className="rounded bg-background/40 p-2">
          <p className="text-[9px] font-mono text-muted-foreground">
            Indexing: LlamaIndex · Retrieval: LangChain RetrievalQA · Embeddings: sentence-transformers/all-MiniLM-L6-v2
          </p>
        </div>
      </CardContent>
    </Card>
  );
}