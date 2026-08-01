import { create } from 'zustand';
import type { ChatMessage, Attachment } from './types';

interface InsightState {
  messages: ChatMessage[];
  isProcessing: boolean;
  sidebarOpen: boolean;
  uploadedFiles: Attachment[];
  // Persisted document context — stays across messages until cleared
  activeDocumentContent: string | null;
  activeDocumentName: string | null;
  addMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (content: string, trace?: ChatMessage['agentTrace']) => void;
  setProcessing: (v: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
  addUploadedFile: (f: Attachment) => void;
  removeUploadedFile: (id: string) => void;
  clearUploadedFiles: () => void;
  setActiveDocument: (content: string | null, name: string | null) => void;
  clearMessages: () => void;
}

export const useInsightStore = create<InsightState>((set) => ({
  messages: [],
  isProcessing: false,
  sidebarOpen: true,
  uploadedFiles: [],
  activeDocumentContent: null,
  activeDocumentName: null,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastAssistantMessage: (content, trace) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content, agentTrace: trace ?? msgs[i].agentTrace };
          break;
        }
      }
      return { messages: msgs };
    }),
  setProcessing: (v) => set({ isProcessing: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  addUploadedFile: (f) => set((s) => ({ uploadedFiles: [...s.uploadedFiles, f] })),
  removeUploadedFile: (id) => set((s) => ({ uploadedFiles: s.uploadedFiles.filter((f) => f.id !== id) })),
  clearUploadedFiles: () => set({ uploadedFiles: [] }),
  setActiveDocument: (content, name) => set({ activeDocumentContent: content, activeDocumentName: name }),
  clearMessages: () => set({ messages: [], activeDocumentContent: null, activeDocumentName: null }),
}));
