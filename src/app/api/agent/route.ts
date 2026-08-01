import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { llmConfig, buildDocumentSystemPrompt, buildChatSystemPrompt } from '@/config/llm';
import { branding } from '@/config/branding';

/** Build a demo answer when the Z AI SDK is not configured, so the UI still works. */
function buildFallbackAnswer(
  message: string,
  hasImage: boolean,
  hasDocument: boolean,
  documentName?: string,
): string {
  const setupBlock = [
    '**Live AI is not configured yet.**',
    '',
    'The app is running, but the backend needs an API key to call the AI model.',
    'Create a `.z-ai-config` file in the project root:',
    '',
    '```json',
    '{ "baseUrl": "https://open.bigmodel.cn/api/paas/v4", "apiKey": "YOUR_API_KEY" }',
    '```',
    '',
  ].join('\n');

  const contextParts: string[] = [];
  if (hasImage) contextParts.push('an uploaded image');
  if (hasDocument) contextParts.push(`the uploaded document${documentName ? ` "${documentName}"` : ''}`);
  const context = contextParts.length > 0 ? `I would analyze ${contextParts.join(' and ')}. ` : '';

  return [
    setupBlock,
    `Meanwhile, here is a simulated response for your query: **"${message}"**`,
    '',
    context,
    'Set up the config file and restart the server to enable real AI responses.',
  ].join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      imageBase64,
      imageMimeType,
      documentContent,
      documentName,
      conversationHistory = [],
    } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 });
    }

    let zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
    try {
      zai = await ZAI.create();
    } catch (err: any) {
      console.warn('[agent] Z AI SDK not configured, using demo fallback:', err?.message);
    }
    const startTime = Date.now();
    const traceSteps: any[] = [];
    let currentStep = 1;

    const hasDocument = documentContent && documentContent.trim().length > 0;
    const hasImage = !!imageBase64;

    // --- Step 1: Query Analysis ---
    traceSteps.push({
      id: `step-${currentStep}`,
      step: currentStep,
      tool: 'llm_synthesis' as const,
      label: llmConfig.traceLabels.queryAnalysis,
      reasoning: 'Analyzing user query...',
      status: 'running' as const,
    });

    const toolsNeeded: string[] = [];
    if (hasDocument) toolsNeeded.push('document analysis');
    if (hasImage) toolsNeeded.push('vision analysis');
    if (toolsNeeded.length === 0) toolsNeeded.push('knowledge retrieval');

    traceSteps[0] = {
      ...traceSteps[0],
      status: 'completed' as const,
      reasoning: `Query understood. Approach: ${toolsNeeded.join(', ')}.`,
      duration: Date.now() - startTime,
    };
    currentStep++;

    // --- Step: Document Processing ---
    if (hasDocument) {
      traceSteps.push({
        id: `step-${currentStep}`,
        step: currentStep,
        tool: 'rag' as const,
        label: llmConfig.traceLabels.documentAnalysis,
        reasoning: `Processing document${documentName ? `: ${documentName}` : ''}...`,
        status: 'running' as const,
      });
      const docStart = Date.now();
      traceSteps[currentStep - 1] = {
        ...traceSteps[currentStep - 1],
        status: 'completed' as const,
        reasoning: `Document loaded. ${documentContent.length} characters available for context.`,
        duration: Date.now() - docStart,
        result: `Document ready (${Math.round(documentContent.length / 1024)}KB)`,
      };
      currentStep++;
    }

    // --- Step: Image Analysis ---
    let visionContent = '';
    if (hasImage) {
      traceSteps.push({
        id: `step-${currentStep}`,
        step: currentStep,
        tool: 'vision' as const,
        label: llmConfig.traceLabels.imageAnalysis,
        reasoning: 'Analyzing uploaded image...',
        status: 'running' as const,
      });
      const visionStart = Date.now();
      try {
        if (!zai) {
          throw new Error('AI not configured (missing .z-ai-config)');
        }
        const visionResponse = await zai.chat.completions.createVision({
          model: llmConfig.vision.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${imageMimeType || 'image/png'};base64,${imageBase64}` } },
                { type: 'text', text: llmConfig.vision.systemPrompt },
              ],
            },
          ],
        });
        visionContent = visionResponse?.choices?.[0]?.message?.content || 'Image analyzed.';
        traceSteps[currentStep - 1] = {
          ...traceSteps[currentStep - 1],
          status: 'completed' as const,
          reasoning: `Image analysis complete in ${Date.now() - visionStart}ms.`,
          duration: Date.now() - visionStart,
          result: visionContent.substring(0, 80) + '...',
        };
      } catch (err: any) {
        traceSteps[currentStep - 1] = {
          ...traceSteps[currentStep - 1],
          status: 'error' as const,
          reasoning: `Image analysis failed: ${err.message}`,
        };
      }
      currentStep++;
    }

    // --- Step: Response Generation ---
    traceSteps.push({
      id: `step-${currentStep}`,
      step: currentStep,
      tool: 'llm_synthesis' as const,
      label: llmConfig.traceLabels.responseGeneration,
      reasoning: 'Generating response...',
      status: 'running' as const,
    });

    const genStart = Date.now();
    try {
      let finalAnswer: string;

      if (!zai) {
        finalAnswer = buildFallbackAnswer(message, hasImage, hasDocument, documentName);
      } else if (hasImage && !hasDocument) {
        finalAnswer = visionContent || 'Image analyzed successfully.';
      } else {
        const systemPrompt = hasDocument
          ? buildDocumentSystemPrompt(branding.appName, documentContent, documentName)
          : buildChatSystemPrompt(branding.appName);

        const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt },
        ];

        const maxHistory = llmConfig.conversation.maxHistoryMessages;
        const historySlice = conversationHistory
          .filter((m: any) => m.content !== 'thinking...')
          .slice(-maxHistory);
        for (const m of historySlice) {
          apiMessages.push({
            role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          });
        }
        apiMessages.push({ role: 'user', content: message });

        const response = await zai.chat.completions.create({ messages: apiMessages });
        finalAnswer = response?.choices?.[0]?.message?.content || 'Response generated.';
      }

      traceSteps[currentStep - 1] = {
        ...traceSteps[currentStep - 1],
        status: 'completed' as const,
        reasoning: `Response generated. Total: ${Date.now() - startTime}ms across ${traceSteps.length} steps.`,
        duration: Date.now() - genStart,
        result: 'Response ready',
      };

      return NextResponse.json({
        answer: finalAnswer,
        trace: traceSteps,
        totalLatency: Date.now() - startTime,
      });
    } catch (err: any) {
      traceSteps[currentStep - 1] = {
        ...traceSteps[currentStep - 1],
        status: 'error' as const,
        reasoning: `Failed: ${err.message}`,
      };

      return NextResponse.json({
        answer: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        trace: traceSteps,
        totalLatency: Date.now() - startTime,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
