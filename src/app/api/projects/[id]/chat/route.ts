import { z } from 'zod';
import {
  getProject,
  getMessagesByProject,
  getCollectedContextByProject,
  createMessage,
  createCollectedContext,
  updateProject,
} from '@/db/queries';
import { extractContext } from '@/ai/collect';
import { safeStringifyOptions } from '@/lib/json-safety';

// ── Request schema ──────────────────────────────────────────────────────────

const chatBodySchema = z.object({
  message: z.string().min(1),
  optionIndex: z.number().int().min(0).optional(),
  skip: z.boolean().optional(),
});

// ── Question plan item type ─────────────────────────────────────────────────

interface QuestionPlanItem {
  question: string;
  inputType: 'choice' | 'text' | 'yesno' | 'file';
  options: string[] | null;
  contextKey: string;
}

// ── SSE helpers ─────────────────────────────────────────────────────────────

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── POST /api/projects/[id]/chat ────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'message is required and must be a non-empty string' },
      { status: 400 },
    );
  }

  const { message, skip: isSkip } = parsed.data;

  // Load project
  const project = getProject(id);
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.phase !== 'collect') {
    return Response.json(
      { error: 'Project is not in collect phase' },
      { status: 400 },
    );
  }

  if (!project.personaPrompt) {
    return Response.json(
      { error: 'Project persona not initialized' },
      { status: 400 },
    );
  }

  const personaPrompt = project.personaPrompt;

  // Parse question plan
  let questionPlan: QuestionPlanItem[] = [];
  if (project.questionPlan) {
    try {
      questionPlan = JSON.parse(project.questionPlan) as QuestionPlanItem[];
    } catch {
      questionPlan = [];
    }
  }

  // Stream response via SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      }

      try {
        // 1. Get existing messages and context
        const existingMessages = getMessagesByProject(id);
        const existingContext = getCollectedContextByProject(id);

        // Find last agent question for context extraction
        const lastAgentMessage = [...existingMessages]
          .reverse()
          .find((m) => m.role === 'agent');
        const lastAgentQuestion = lastAgentMessage?.content ?? '';

        // 2. Save user message
        createMessage({
          projectId: id,
          role: 'user',
          content: message,
        });

        // 3. Update question count and send next question IMMEDIATELY
        const newQuestionCount = project.questionCount + 1;
        updateProject(id, { questionCount: newQuestionCount });

        const nextIndex = newQuestionCount; // plan[0] was already shown as first question
        const maxReached = nextIndex >= questionPlan.length;

        if (maxReached) {
          // All questions asked — move to simulate
          updateProject(id, { phase: 'simulate' });
        } else {
          const nextQ = questionPlan[nextIndex];

          // Save agent message and send question event FIRST (no AI wait)
          const agentMessage = createMessage({
            projectId: id,
            role: 'agent',
            content: nextQ.question,
            inputType: nextQ.inputType,
            options: safeStringifyOptions(nextQ.options),
          });

          send('question', {
            question: nextQ.question,
            inputType: nextQ.inputType,
            options: nextQ.options,
            questionCount: newQuestionCount,
            messageId: agentMessage.id,
          });
        }

        // 4. Extract context AFTER sending the question (non-blocking UX)
        let extracted = { contexts: [] as { key: string; value: string }[] };
        if (!isSkip && lastAgentMessage) {
          extracted = await extractContext(
            personaPrompt,
            message,
            lastAgentQuestion,
            existingContext.map((c) => c.key),
          );
        }

        // Save extracted contexts to DB
        if (extracted.contexts.length > 0 && lastAgentMessage) {
          for (const ctx of extracted.contexts) {
            createCollectedContext({
              projectId: id,
              key: ctx.key,
              value: ctx.value,
              questionId: lastAgentMessage.id,
            });
          }
        }

        // Send context event after extraction
        send('context', { contexts: extracted.contexts });

        if (maxReached) {
          send('done', { done: true, phase: 'simulate' });
        }

        controller.close();
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Internal server error';
        send('error', { error: errorMessage });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
