import { z } from 'zod';
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { collectModel } from '@/ai/providers';
import { classifyDomain, getPersonaPrompt } from '@/ai/personas';
import {
  createProject,
  listProjects,
  createMessage,
  updateProject,
} from '@/db/queries';
import { safeStringifyOptions } from '@/lib/json-safety';

// ── POST /api/projects ──────────────────────────────────────────────────────

const createProjectBodySchema = z.object({
  input: z.string().min(1),
});

const questionItemSchema = z.object({
  question: z.string().describe('질문 텍스트'),
  inputType: z
    .enum(['choice', 'text', 'yesno', 'file'])
    .describe('사용자 입력 타입 (기존 자료 업로드가 필요하면 file)'),
  options: z
    .array(z.string())
    .nullable()
    .describe('선택지 (choice일 때만, 마지막은 항상 "기타 (직접 입력)")'),
  contextKey: z.string().describe('이 질문으로 수집할 컨텍스트 키 (영어 snake_case)'),
});

const questionListSchema = z.object({
  questions: z.array(questionItemSchema).describe('질문 리스트 (5~8개)'),
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

    // 2. Classify domain + get persona in parallel
    const { domain } = await classifyDomain(input);
    const personaPrompt = await getPersonaPrompt(domain, input);

    // 3. Update project with domain + persona
    updateProject(project.id, { domain, personaPrompt });

    // 4. Generate all questions at once
    const questions = await generateQuestionList(personaPrompt, input);

    // 5. Store question plan as JSON in project
    updateProject(project.id, {
      questionPlan: JSON.stringify(questions),
      maxQuestions: questions.length,
    });

    // 6. Save first question as agent message
    const first = questions[0];
    const message = createMessage({
      projectId: project.id,
      role: 'agent',
      content: first.question,
      inputType: first.inputType,
      options: safeStringifyOptions(first.options),
    });

    return Response.json({
      projectId: project.id,
      firstMessage: {
        id: message.id,
        content: message.content,
        inputType: message.inputType,
        options: first.options,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}

async function generateQuestionList(
  personaPrompt: string,
  userInput: string,
): Promise<z.infer<typeof questionItemSchema>[]> {
  try {
    const { experimental_output: output } = await generateText({
      model: collectModel(),
      experimental_output: Output.object({ schema: questionListSchema }),
      system: `${personaPrompt}

[질문 리스트 생성 규칙]
- 사용자의 입력을 바탕으로, 좋은 결과물을 만들기 위해 필요한 핵심 질문 5~8개를 한번에 생성하세요.
- 위의 "필수 수집 항목"에 나열된 정보를 반드시 포함하세요. 사용자 입력에서 이미 알 수 있는 항목은 스킵하세요.
- 가장 중요한 질문부터 순서대로 배치하세요.
- 각 질문의 contextKey는 영어 snake_case로 (예: target_audience, budget_range).
- inputType이 "choice"이면 options 배열을 제공하세요. 마지막 옵션은 반드시 "기타 (직접 입력)"이어야 합니다.
- inputType이 "text" 또는 "yesno"이면 options는 null이어야 합니다.
- 기존 자료(이력서, 사업계획서 등)를 업로드받아야 할 때는 inputType을 "file"로 하세요. options는 null.
- 질문은 한국어로, 친근하고 전문적인 톤으로 작성하세요.
- 서로 겹치지 않는 독립적인 질문으로 구성하세요.`,
      prompt: `사용자의 요청: ${userInput}`,
    });

    if (!output || output.questions.length === 0) {
      return [buildFallbackQuestion()];
    }

    return output.questions;
  } catch (error: unknown) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return [buildFallbackQuestion()];
    }
    throw error;
  }
}

function buildFallbackQuestion(): z.infer<typeof questionItemSchema> {
  return {
    question: '어떤 도움이 필요하신지 좀 더 자세히 알려주시겠어요?',
    inputType: 'text',
    options: null,
    contextKey: 'general_info',
  };
}

// ── GET /api/projects ───────────────────────────────────────────────────────

export async function GET() {
  const projects = listProjects(10);
  return Response.json(projects);
}
