'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Eye, FileText, Search, Brain, Cpu, Database, Network,
  ArrowRight, Check, Zap, Clock, Target, BarChart3, Layers
} from 'lucide-react';
import { motion } from 'framer-motion';

const modules = [
  {
    id: 'vision',
    title: 'Computer Vision',
    icon: <Eye className="h-5 w-5" />,
    color: 'emerald',
    status: 'active',
    tech: ['OpenCV', 'YOLOv8 (PyTorch)', 'Ultralytics'],
    capabilities: ['Object detection', 'Image preprocessing', 'Bounding box visualization', 'Custom fine-tuning'],
    metrics: { latency: '45ms avg', model: 'YOLOv8n', dataset: 'COCO + Custom', accuracy: '87.3% mAP' },
  },
  {
    id: 'nlp',
    title: 'Natural Language Processing',
    icon: <FileText className="h-5 w-5" />,
    color: 'violet',
    status: 'active',
    tech: ['Hugging Face Transformers', 'Scikit-learn', 'TensorFlow/Keras'],
    capabilities: ['Text classification (TF-IDF + LR)', 'Sentiment analysis (DistilBERT)', 'Summarization (BART-large-CNN)', 'Translation (MarianMT)'],
    metrics: { latency: '12-18ms', models: '4 pipelines', datasets: 'AG News, SST-2, CNN/DM, OPUS-100' },
  },
  {
    id: 'rag',
    title: 'RAG Knowledge Retrieval',
    icon: <Search className="h-5 w-5" />,
    color: 'amber',
    status: 'active',
    tech: ['LlamaIndex', 'LangChain', 'FAISS / Pinecone'],
    capabilities: ['Document ingestion & chunking', 'Semantic search', 'Cited answer generation', 'Multi-backend vector store'],
    metrics: { latency: '120ms avg', embeddings: 'all-MiniLM-L6-v2', accuracy: '87.5% retrieval', backend: 'FAISS + Pinecone' },
  },
  {
    id: 'agent',
    title: 'Agentic Orchestrator',
    icon: <Brain className="h-5 w-5" />,
    color: 'rose',
    status: 'active',
    tech: ['LangChain Agent', 'Mistral-7B-Instruct', 'Tool chaining'],
    capabilities: ['Multi-tool planning', 'Sequential tool execution', 'Result synthesis', 'Decision trace logging'],
    metrics: { latency: '200-500ms pipeline', model: 'Mistral-7B-Instruct-v0.3', tools: '3 primary tools', trace: 'Full JSON logging' },
  },
];

const colorClasses: Record<string, { text: string; bg: string; border: string; badge: string; icon: string }> = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/30', icon: 'bg-emerald-500/10 text-emerald-400' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/5', border: 'border-violet-500/20', badge: 'bg-violet-400/10 text-violet-400 border-violet-500/30', icon: 'bg-violet-500/10 text-violet-400' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20', badge: 'bg-amber-400/10 text-amber-400 border-amber-500/30', icon: 'bg-amber-500/10 text-amber-400' },
  rose: { text: 'text-rose-400', bg: 'bg-rose-500/5', border: 'border-rose-500/20', badge: 'bg-rose-400/10 text-rose-400 border-rose-500/30', icon: 'bg-rose-400/10 text-rose-400' },
};

export function ModulesView() {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Modules</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Four specialized AI modules orchestrated by the agentic layer. Each module is independently callable and logged with MLflow.
          </p>
        </div>

        {modules.map((mod, i) => {
          const c = colorClasses[mod.color];
          return (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className={`border ${c.border} ${c.bg} overflow-hidden`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.icon}`}>
                        {mod.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base">{mod.title}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {mod.tech.join(' · ')}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${c.badge} h-5`}>Active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {/* Capabilities */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Capabilities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mod.capabilities.map((cap) => (
                        <Badge key={cap} variant="secondary" className="text-[11px] font-normal gap-1">
                          <Check className="h-2.5 w-2.5" />
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Performance</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(mod.metrics).map(([key, value]) => (
                        <div key={key} className="rounded-lg bg-background/40 p-2">
                          <p className="text-[9px] font-mono text-muted-foreground uppercase">{key}</p>
                          <p className="text-xs font-medium mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Benchmark comparison */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
                <CardTitle className="text-base">Benchmark: PyTorch vs TensorFlow</CardTitle>
              </div>
              <CardDescription className="text-xs">Sentiment analysis (SST-2) side-by-side comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-semibold">PyTorch</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Winner</Badge>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Accuracy</span>
                        <span className="font-mono font-semibold">92.3%</span>
                      </div>
                      <Progress value={92.3} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Inference Latency</span>
                        <span className="font-mono font-semibold">12ms</span>
                      </div>
                      <Progress value={12} className="h-2" />
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">Model: DistilBERT-SST2 (HuggingFace)</p>
                  </div>
                </div>
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-semibold">TensorFlow</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Accuracy</span>
                        <span className="font-mono font-semibold">89.7%</span>
                      </div>
                      <Progress value={89.7} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Inference Latency</span>
                        <span className="font-mono font-semibold">18ms</span>
                      </div>
                      <Progress value={18} className="h-2" />
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">Model: BERT-LSTM (TF/Keras)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </ScrollArea>
  );
}
