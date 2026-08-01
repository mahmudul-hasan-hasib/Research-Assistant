/**
 * LLM / AI Model Configuration
 * -------------------------------
 * Change models, prompts, and AI behavior here.
 * All API routes reference this single file.
 */

export const llmConfig = {
  // --- Vision Model (for image analysis) ---
  vision: {
    model: 'glm-4v-flash',
    systemPrompt: 'Analyze this image in detail. Describe what you see, identify objects, and provide context.',
  },

  // --- Chat Model (for text generation, document Q&A, general chat) ---
  chat: {
    systemPrompt: 'You are {appName}, a helpful and thorough research assistant. Provide clear, well-structured responses using markdown formatting (headers, bullet points, bold text). Be detailed and helpful.',
  },

  // --- Document Analysis ---
  document: {
    systemPrompt: `You are {appName}, a helpful research assistant. The user has uploaded a document{docNamePart}. Here is its full content:

--- DOCUMENT START ---
{documentContent}
--- DOCUMENT END ---

IMPORTANT: Use this document content to answer the user's questions. Reference specific details, sections, names, and information from the document. For follow-up questions, combine the conversation context with the document content. Be thorough and accurate. Format with markdown.`,
  },

  // --- Conversation Settings ---
  conversation: {
    maxHistoryMessages: 10,   // How many past messages to include in context
    maxDocumentChars: 15000,   // Max characters of document to include in prompt
  },

  // --- Trace Labels (shown in the agent decision trace UI) ---
  traceLabels: {
    queryAnalysis: 'Query Analysis',
    documentAnalysis: 'Document Analysis',
    imageAnalysis: 'Image Analysis',
    responseGeneration: 'Response Generation',
  },
} as const;

/** Build the document system prompt with actual values filled in */
export function buildDocumentSystemPrompt(
  appName: string,
  documentContent: string,
  documentName?: string,
): string {
  const maxChars = llmConfig.conversation.maxDocumentChars;
  const truncated = documentContent.substring(0, maxChars);
  const docNamePart = documentName ? ` named "${documentName}"` : '';

  return llmConfig.document.systemPrompt
    .replace(/{appName}/g, appName)
    .replace(/{docNamePart}/g, docNamePart)
    .replace(/{documentContent}/g, truncated);
}

/** Build the general chat system prompt */
export function buildChatSystemPrompt(appName: string): string {
  return llmConfig.chat.systemPrompt.replace(/{appName}/g, appName);
}
