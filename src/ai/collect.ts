import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { mainAgentModel, collectModel } from '@/ai/providers';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const extractedContextSchema = z.object({
  contexts: z.array(
    z.object({
      key: z.string().describe('컨텍스트 키 (예: target_audience, budget, tone)'),
      value: z.string().describe('유저 응답에서 추출한 값'),
    }),
  ),
});

export type ExtractedContext = z.infer<typeof extractedContextSchema>;

export const shouldEndSchema = z.object({
  shouldEnd: z.boolean().describe('수집을 종료할지 여부'),
  reason: z.string().describe('판단 이유'),
});

export type ShouldEndResult = z.infer<typeof shouldEndSchema>;

export const nextQuestionSchema = z.object({
  question: z.string().describe('다음 질문 텍스트'),
  inputType: z
    .enum(['choice', 'text', 'yesno'])
    .describe('사용자 입력 타입'),
  options: z
    .array(z.string())
    .nullable()
    .describe('선택지 (choice일 때만, 마지막은 항상 "기타 (직접 입력)")'),
});

export type NextQuestion = z.infer<typeof nextQuestionSchema>;

// ---------------------------------------------------------------------------
// extractContext
// ---------------------------------------------------------------------------

export async function extractContext(
  personaPrompt: string,
  userMessage: string,
  lastAgentQuestion: string,
  existingContextKeys: string[],
): Promise<ExtractedContext> {
  const existingKeysNote =
    existingContextKeys.length > 0
      ? `\n이미 수집된 컨텍스트 키: ${existingContextKeys.join(', ')}\n위 키와 중복되지 않는 새로운 정보만 추출하세요.`
      : '';

  try {
    const { experimental_output: output } = await generateText({
      model: mainAgentModel(),
      experimental_output: Output.object({ schema: extractedContextSchema }),
      system: `${personaPrompt}

[컨텍스트 추출 규칙]
- 에이전트의 질문에 대한 유저의 응답에서 핵심 정보를 key-value 쌍으로 추출하세요.
- key는 영어 snake_case로 (예: target_audience, budget_range, preferred_tone)
- value는 유저가 말한 내용을 정리해서 한국어로 작성
- 응답에서 추출할 정보가 없으면 빈 배열을 반환하세요.${existingKeysNote}`,
      prompt: `에이전트 질문: ${lastAgentQuestion}\n유저 응답: ${userMessage}`,
    });

    if (!output) {
      return { contexts: [] };
    }

    return output;
  } catch (error: unknown) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { contexts: [] };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// shouldEndCollectionEarly
// ---------------------------------------------------------------------------

interface CollectedContextItem {
  key: string;
  value: string;
}

export async function shouldEndCollectionEarly(
  personaPrompt: string,
  collectedContexts: CollectedContextItem[],
  questionCount: number,
  maxQuestions: number,
): Promise<boolean> {
  // Don't even consider early termination if fewer than 3 questions asked
  if (questionCount < 3) {
    return false;
  }

  const contextSummary = collectedContexts
    .map((c) => `- ${c.key}: ${c.value}`)
    .join('\n');

  try {
    const { experimental_output: output } = await generateText({
      model: mainAgentModel(),
      experimental_output: Output.object({ schema: shouldEndSchema }),
      system: `${personaPrompt}

[조기 종료 판단 규칙]
- 현재까지 수집된 정보를 바탕으로, 사용자에게 좋은 결과물을 만들기에 충분한 정보가 모였는지 판단하세요.
- 핵심 정보(목적, 대상, 톤, 주요 내용 등)가 대부분 수집되었으면 true를 반환하세요.
- 아직 중요한 정보가 빠져있다면 false를 반환하세요.
- 단순히 질문을 몇 개 했다는 이유만으로 종료하지 마세요. 정보의 충분성으로 판단하세요.
- 현재 ${questionCount}/${maxQuestions} 질문 완료.`,
      prompt: `수집된 컨텍스트:\n${contextSummary}`,
    });

    if (!output) {
      return false;
    }

    return output.shouldEnd;
  } catch (error: unknown) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return false;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationMessage {
  role: 'agent' | 'user';
  content: string;
}

// ---------------------------------------------------------------------------
// Shared prompt builder
// ---------------------------------------------------------------------------

function buildQuestionPrompt(
  personaPrompt: string,
  conversationHistory: ConversationMessage[],
  collectedContexts: CollectedContextItem[],
  questionCount: number,
  maxQuestions: number,
): { system: string; prompt: string } {
  const historyText = conversationHistory
    .map((m) => `${m.role === 'agent' ? '에이전트' : '유저'}: ${m.content}`)
    .join('\n');

  const contextSummary =
    collectedContexts.length > 0
      ? collectedContexts.map((c) => `- ${c.key}: ${c.value}`).join('\n')
      : '(아직 수집된 정보 없음)';

  return {
    system: `${personaPrompt}

[질문 생성 규칙]
- 이전 대화와 수집된 컨텍스트를 바탕으로, 아직 부족한 정보를 물어보는 질문 하나를 생성하세요.
- inputType이 "choice"이면 options 배열을 제공하세요. 마지막 옵션은 반드시 "기타 (직접 입력)"이어야 합니다.
- inputType이 "text" 또는 "yesno"이면 options는 null이어야 합니다.
- 질문은 한국어로, 친근하고 전문적인 톤으로 작성하세요.
- 이전에 물어본 내용과 중복되지 않게 하세요.
- 현재 ${questionCount}/${maxQuestions} 질문 완료. 남은 질문 수를 고려해서 가장 중요한 것부터 물어보세요.`,
    prompt: `대화 히스토리:\n${historyText}\n\n수집된 컨텍스트:\n${contextSummary}`,
  };
}

// ---------------------------------------------------------------------------
// streamNextQuestion
// ---------------------------------------------------------------------------

export async function generateNextQuestion(
  personaPrompt: string,
  conversationHistory: ConversationMessage[],
  collectedContexts: CollectedContextItem[],
  questionCount: number,
  maxQuestions: number,
): Promise<NextQuestion> {
  const { system, prompt } = buildQuestionPrompt(
    personaPrompt,
    conversationHistory,
    collectedContexts,
    questionCount,
    maxQuestions,
  );

  try {
    const { experimental_output: output } = await generateText({
      model: collectModel(),
      experimental_output: Output.object({ schema: nextQuestionSchema }),
      system,
      prompt,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFallbackQuestion(): NextQuestion {
  return {
    question: '혹시 더 알려주실 내용이 있으신가요?',
    inputType: 'text',
    options: null,
  };
}
