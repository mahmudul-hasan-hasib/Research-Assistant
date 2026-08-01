export interface AgentTraceStep {
  id: string;
  step: number;
  tool: 'vision' | 'nlp_classify' | 'nlp_sentiment' | 'nlp_summarize' | 'nlp_translate' | 'rag' | 'llm_synthesis';
  label: string;
  reasoning: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  agentTrace?: AgentTraceStep[];
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'video' | 'text';
  url: string;
  size: number;
  textContent?: string;
  imageBase64?: string;
  imageMimeType?: string;
}


