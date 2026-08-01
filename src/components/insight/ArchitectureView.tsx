'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Eye, FileText, Search, Brain, Cpu, Database, Network,
  ArrowRight, ArrowDown, Server, Cloud, Container, GitBranch,
  Shield, Activity, Boxes, Upload, MessageSquare, Layers
} from 'lucide-react';
import { motion } from 'framer-motion';

export function ArchitectureView() {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Architecture</h2>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-end pipeline from user query to synthesized response, with MLOps tracking and cloud deployment.
          </p>
        </div>

        {/* Architecture Flow Diagram */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-emerald-400" />
              Data Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3">
              {/* User Input */}
              <FlowNode icon={<Upload className="h-4 w-4" />} label="User Input" sub="Text, Images, Documents, Video" color="sky" />
              <FlowArrow direction="down" />

              {/* Agent Orchestrator */}
              <FlowNode icon={<Brain className="h-4 w-4" />} label="Agent Orchestrator" sub="LangChain Agent + Mistral-7B-Instruct" color="rose" wide />
              <FlowArrow direction="down" />

              {/* Tool Selection Row */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">
                <FlowNode icon={<Eye className="h-3.5 w-3.5" />} label="Vision Tool" sub="YOLOv8 + OpenCV" color="emerald" />
                <FlowNode icon={<FileText className="h-3.5 w-3.5" />} label="NLP Tool" sub="4 Task Pipelines" color="violet" />
                <FlowNode icon={<Search className="h-3.5 w-3.5" />} label="RAG Tool" sub="LlamaIndex + FAISS" color="amber" />
              </div>
              <FlowArrow direction="down" />

              {/* Synthesis */}
              <FlowNode icon={<MessageSquare className="h-4 w-4" />} label="Response Synthesis" sub="Mistral-7B generates grounded answer with citations" color="emerald" wide />
              <FlowArrow direction="down" />

              {/* Output */}
              <FlowNode icon={<Activity className="h-4 w-4" />} label="Output" sub="Natural language answer + Agent trace + Module results" color="sky" />
            </div>
          </CardContent>
        </Card>

        {/* Tech Stack Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TechCard
            title="ML / Deep Learning"
            icon={<Cpu className="h-4 w-4 text-emerald-400" />}
            items={[
              'PyTorch 2.x — CV module, HuggingFace models',
              'TensorFlow 2.x — Sentiment LSTM benchmark',
              'Scikit-learn — TF-IDF + Logistic Regression',
              'HuggingFace Transformers — All NLP pipelines',
              'PEFT/LoRA — Lightweight fine-tuning',
              'Ultralytics YOLOv8 — Object detection',
            ]}
          />
          <TechCard
            title="Frameworks & Libraries"
            icon={<Boxes className="h-4 w-4 text-violet-400" />}
            items={[
              'LangChain — Agent + RetrievalQA chains',
              'LlamaIndex — Document ingestion & indexing',
              'FAISS — Local vector store (default)',
              'Pinecone — Cloud vector store (alternate)',
              'OpenCV — Image preprocessing',
              'Mistral-7B-Instruct — LLM backbone',
            ]}
          />
          <TechCard
            title="Backend & API"
            icon={<Server className="h-4 w-4 text-sky-400" />}
            items={[
              'FastAPI — REST API framework',
              'Pydantic — Request/response models',
              'Uvicorn — ASGI server',
              'API key auth middleware',
              'Postman collection exported',
              '7 API endpoints (/vision, /nlp/*, /rag, /agent)',
            ]}
          />
          <TechCard
            title="MLOps & Deployment"
            icon={<Cloud className="h-4 w-4 text-amber-400" />}
            items={[
              'MLflow — Experiment tracking (params, metrics, artifacts)',
              'Docker + docker-compose — Containerization',
              'GitHub Actions — CI pipeline (Pytest)',
              'AWS EC2 (t3.medium) — Cloud deployment',
              'Nginx reverse proxy — HTTPS termination',
              'Amazon ECR — Container registry',
            ]}
          />
        </div>

        {/* Folder Structure */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-emerald-400" />
              Project Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono text-muted-foreground bg-muted/30 rounded-lg p-4 overflow-x-auto leading-relaxed">
{`insight/
├── app/
│   ├── vision/         # OpenCV + YOLOv8 pipeline
│   ├── nlp/            # Classification, sentiment, summarization, translation
│   ├── rag/            # LlamaIndex ingestion + LangChain retrieval
│   ├── agent/          # LangChain agent orchestrator
│   ├── main.py         # FastAPI application
│   └── config.py       # Configuration (vector backend toggle, etc.)
├── notebooks/          # Benchmarking & exploration
├── data/               # Datasets & test files
├── models/             # Saved weights, FAISS index
├── mlruns/             # MLflow tracking data
├── tests/              # Pytest test suite
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .github/workflows/ci.yml
└── README.md`}
            </pre>
          </CardContent>
        </Card>

        {/* Agent Decision Trace Example */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-rose-400" />
              Agent Decision Trace Example
            </CardTitle>
            <CardDescription className="text-xs">Real JSON log from a multi-tool query</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] font-mono text-muted-foreground bg-muted/30 rounded-lg p-4 overflow-x-auto leading-relaxed">
{`{
  "query": "Summarize this document and tell me the sentiment",
  "agent_trace": [
    {
      "step": 1, "tool": "llm_synthesis", "status": "completed",
      "reasoning": "Query requires summarization + sentiment. Routing to NLP module.",
      "duration_ms": 23
    },
    {
      "step": 2, "tool": "nlp_summarize", "status": "completed",
      "reasoning": "BART-large-CNN pipeline applied. Reduced 2,340 tokens to 180 tokens.",
      "duration_ms": 156
    },
    {
      "step": 3, "tool": "nlp_sentiment", "status": "completed",
      "reasoning": "DistilBERT-SST2 (PyTorch): POSITIVE, 94.2% confidence.",
      "duration_ms": 12
    },
    {
      "step": 4, "tool": "llm_synthesis", "status": "completed",
      "reasoning": "Mistral-7B synthesized summary + sentiment into final response.",
      "duration_ms": 340
    }
  ],
  "total_latency_ms": 531
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

function FlowNode({ icon, label, sub, color, wide }: { icon: React.ReactNode; label: string; sub: string; color: string; wide?: boolean }) {
  const colorMap: Record<string, string> = {
    sky: 'border-sky-500/30 bg-sky-500/5 text-sky-400',
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    violet: 'border-violet-500/30 bg-violet-500/5 text-violet-400',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
    rose: 'border-rose-500/30 bg-rose-500/5 text-rose-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-3 rounded-xl border p-3 ${colorMap[color]} ${wide ? 'w-full max-w-md' : ''}`}
    >
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[10px] opacity-70">{sub}</p>
      </div>
    </motion.div>
  );
}

function FlowArrow({ direction }: { direction: 'down' | 'right' }) {
  return (
    <div className="flex items-center justify-center text-muted-foreground/40">
      {direction === 'down' ? <ArrowDown className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
    </div>
  );
}

function TechCard({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-2">
              <span className="text-emerald-400 mt-1 shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}