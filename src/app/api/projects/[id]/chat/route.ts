import { z } from 'zod';
import {
  getProject,
  getMessagesByProject,
  getCollectedContextByProject,
  createMessage,
  createCollectedContext,
  updateProject,
} from '@/db/queries';
import {
  extractContext,
  shouldEndCollectionEarly,
  generateNextQuestion,
} from '@/ai/collect';

// ── Request schema ──────────────────────────────────────────────────────────

const chatBodySchema = z.object({
  message: z.string().min(1),
  optionIndex: z.number().int().min(0).optional(),
  skip: z.boolean().optional(),
});

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

        // 3. Extract context from user's response (skip if flagged)
        if (isSkip) {
          // Skip context extraction — send empty contexts
          send('context', { contexts: [] });
        } else {
          const existingContextKeys = existingContext.map((c) => c.key);
          const extracted = await extractContext(
            personaPrompt,
            message,
            lastAgentQuestion,
            existingContextKeys,
          );

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

          // Send context event
          send('context', { contexts: extracted.contexts });
        }

        // 4. Increment question_count
        const newQuestionCount = project.questionCount + 1;
        updateProject(id, { questionCount: newQuestionCount });

        // 5. Check if done (max reached or AI early termination)
        const maxReached = newQuestionCount >= project.maxQuestions;

        // Refresh collected context after new additions (reused below)
        const allContext = getCollectedContextByProject(id);
        const contextItems = allContext.map((c) => ({ key: c.key, value: c.value }));

        let earlyEnd = false;
        if (!maxReached) {
          earlyEnd = await shouldEndCollectionEarly(
            personaPrompt,
            contextItems,
            newQuestionCount,
            project.maxQuestions,
          );
        }

        if (maxReached || earlyEnd) {
          // 6. Done: update phase to simulate
          updateProject(id, { phase: 'simulate' });
          send('done', { done: true, phase: 'simulate' });
          controller.close();
          return;
        }

        // 7. Generate next question
        const conversationHistory = [
          ...existingMessages.map((m) => ({
            role: m.role as 'agent' | 'user',
            content: m.content,
          })),
          { role: 'user' as const, content: message },
        ];

        const nextQuestion = await generateNextQuestion(
          personaPrompt,
          conversationHistory,
          contextItems,
          newQuestionCount,
          project.maxQuestions,
        );

        // 8. Save agent message
        const agentMessage = createMessage({
          projectId: id,
          role: 'agent',
          content: nextQuestion.question,
          inputType: nextQuestion.inputType,
          options: nextQuestion.options
            ? JSON.stringify(nextQuestion.options)
            : null,
        });

        // Send final structured question event
        send('question', {
          question: nextQuestion.question,
          inputType: nextQuestion.inputType,
          options: nextQuestion.options,
          questionCount: newQuestionCount,
          messageId: agentMessage.id,
        });

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
