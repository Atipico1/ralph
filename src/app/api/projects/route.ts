import { z } from 'zod';
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { mainAgentModel } from '@/ai/providers';
import { classifyDomain, getPersonaPrompt } from '@/ai/personas';
import {
  createProject,
  listProjects,
  createMessage,
  updateProject,
} from '@/db/queries';

// ── POST /api/projects ──────────────────────────────────────────────────────

const createProjectBodySchema = z.object({
  input: z.string().min(1),
});

const firstQuestionSchema = z.object({
  question: z.string().describe('첫 번째 질문 텍스트'),
  inputType: z
    .enum(['choice', 'text', 'yesno'])
    .describe('사용자 입력 타입'),
  options: z
    .array(z.string())
    .nullable()
    .describe('선택지 (choice일 때만, 마지막은 항상 "기타 (직접 입력)")'),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createProjectBodySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'input is required' },
      { status: 400 },
    );
  }

  const { input } = parsed.data;

  try {
    // 1. Create project
    const project = createProject({
      title: input.slice(0, 100),
      phase: 'collect',
    });

    // 2. Classify domain
    const { domain } = await classifyDomain(input);

    // 3. Get persona prompt (preset or dynamic)
    const personaPrompt = await getPersonaPrompt(domain, input);

    // 4. Update project with domain + persona
    updateProject(project.id, { domain, personaPrompt });

    // 5. Generate first question
    const firstQuestion = await generateFirstQuestion(personaPrompt, input);

    // 6. Save as agent message
    const message = createMessage({
      projectId: project.id,
      role: 'agent',
      content: firstQuestion.question,
      inputType: firstQuestion.inputType,
      options: firstQuestion.options
        ? JSON.stringify(firstQuestion.options)
        : null,
    });

    return Response.json({
      projectId: project.id,
      firstMessage: {
        id: message.id,
        content: message.content,
        inputType: message.inputType,
        options: firstQuestion.options,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}

async function generateFirstQuestion(
  personaPrompt: string,
  userInput: string,
): Promise<z.infer<typeof firstQuestionSchema>> {
  try {
    const { experimental_output: output } = await generateText({
      model: mainAgentModel(),
      experimental_output: Output.object({ schema: firstQuestionSchema }),
      system: `${personaPrompt}

[질문 생성 규칙]
- 사용자의 입력을 바탕으로 가장 중요한 추가 정보를 물어보는 질문 하나를 생성하세요.
- inputType이 "choice"이면 options 배열을 제공하세요. 마지막 옵션은 반드시 "기타 (직접 입력)"이어야 합니다.
- inputType이 "text" 또는 "yesno"이면 options는 null이어야 합니다.
- 질문은 한국어로, 친근하고 전문적인 톤으로 작성하세요.`,
      prompt: `사용자의 첫 입력: ${userInput}`,
    });

    if (!output) {
      return buildFallbackQuestion();
    }

    return output;
  } catch (error: unknown) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return buildFallbackQuestion();
    }
    throw error;
  }
}

function buildFallbackQuestion(): z.infer<typeof firstQuestionSchema> {
  return {
    question: '어떤 도움이 필요하신지 좀 더 자세히 알려주시겠어요?',
    inputType: 'text',
    options: null,
  };
}

// ── GET /api/projects ───────────────────────────────────────────────────────

export async function GET() {
  const projects = listProjects(10);
  return Response.json(projects);
}
