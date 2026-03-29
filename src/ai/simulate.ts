import { streamText, generateText, Output, tool, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { simulationModel, evaluationModel } from '@/ai/providers';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const evaluationSchema = z.object({
  criteria: z.array(
    z.object({
      name: z.string().describe('평가 기준 이름'),
      weight: z.number().describe('가중치 (0~1, 합계 1)'),
    }),
  ),
  scores: z.array(
    z.object({
      candidateIndex: z.number().describe('후보 인덱스 (0, 1, 2)'),
      criteriaScores: z
        .array(z.number())
        .describe('각 기준별 점수 (0~100)'),
      totalScore: z.number().describe('가중 합산 총점 (0~100)'),
    }),
  ),
  selectedIndex: z.number().describe('최고점 후보 인덱스'),
  rationale: z.array(z.string()).describe('각 후보에 대한 한 줄 평가'),
});

export type EvaluationResult = z.infer<typeof evaluationSchema>;

// ---------------------------------------------------------------------------
// Candidate approach angles
// ---------------------------------------------------------------------------

export interface ApproachAngle {
  label: string;
  instruction: string;
}

// TODO: customize angles by domain when domain-specific approaches are needed
export function getApproachAngles(_domain: string | null): ApproachAngle[] {
  return [
    {
      label: '감성적 접근',
      instruction:
        '감성적이고 공감을 이끌어내는 방향으로 작성하세요. ' +
        '독자의 감정에 호소하고, 진정성 있는 톤으로 작성합니다.',
    },
    {
      label: '실용적 접근',
      instruction:
        '실용적이고 구체적인 방향으로 작성하세요. ' +
        '명확한 구조, 구체적 수치/데이터, 실행 가능한 내용 중심으로 작성합니다.',
    },
    {
      label: '창의적 접근',
      instruction:
        '창의적이고 차별화된 방향으로 작성하세요. ' +
        '독특한 구성, 예상치 못한 관점, 참신한 아이디어로 작성합니다.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const addCommentTool = tool({
  description: '생성 중 떠오른 생각을 한 문장으로 코멘트',
  parameters: z.object({
    comment: z.string().describe('한 문장 코멘트'),
  }),
  execute: async ({ comment }) => comment,
});

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

export interface CollectedContextItem {
  key: string;
  value: string;
}

export function buildCandidateSystemPrompt(
  personaPrompt: string,
  angle: ApproachAngle,
): string {
  return `${personaPrompt}

[결과물 생성 규칙]
- 당신은 "${angle.label}" 방향으로 결과물을 작성합니다.
- ${angle.instruction}
- 수집된 정보를 모두 반영하여 완성도 높은 결과물을 작성하세요.
- 결과물은 한국어로, 마크다운 형식으로 작성하세요.
- 웹 검색 참고 자료가 제공되면, 근거 있는 데이터와 출처를 결과물에 포함하세요.
- 작성 중 떠오르는 생각이 있으면 add_comment 도구를 사용해서 한 문장으로 코멘트하세요.
- 코멘트는 혼잣말 톤으로 ("이 방향이 타겟층에 잘 맞는데...", "예산 고려하면 이게 더 낫겠다" 등)`;
}

export function buildCandidateUserPrompt(
  contexts: CollectedContextItem[],
  webSearchContext?: string,
): string {
  const contextText = contexts
    .map((c) => `- ${c.key}: ${c.value}`)
    .join('\n');

  const webSection = webSearchContext ?? '';

  return `수집된 정보:\n${contextText}${webSection}\n\n위 정보를 바탕으로 최선의 결과물을 작성해주세요.`;
}

export interface RevisionContext {
  previousContent: string;
  revisionFeedback: string;
}

export function buildRevisionCandidateUserPrompt(
  contexts: CollectedContextItem[],
  revision: RevisionContext,
): string {
  const contextText = contexts
    .map((c) => `- ${c.key}: ${c.value}`)
    .join('\n');

  return `수집된 정보:\n${contextText}

이전 라운드 결과물:
${revision.previousContent}

수정 요청: ${revision.revisionFeedback}

위 수집 정보와 이전 결과물을 참고하되, 수정 요청 사항을 반영하여 개선된 결과물을 작성해주세요.
이전 결과물의 좋은 부분은 유지하면서 수정 요청 방향으로 보완하세요.`;
}

function buildEvaluationPrompt(
  domain: string | null,
  contexts: CollectedContextItem[],
  candidates: { label: string; content: string }[],
): { system: string; prompt: string } {
  const contextText = contexts
    .map((c) => `- ${c.key}: ${c.value}`)
    .join('\n');

  const candidateText = candidates
    .map(
      (c, i) =>
        `=== 후보 ${i} (${c.label}) ===\n${c.content}\n`,
    )
    .join('\n');

  return {
    system: `당신은 전문 평가자입니다. 주어진 도메인과 맥락에 맞는 평가 기준을 스스로 도출하고, 각 후보를 공정하게 평가합니다.

[평가 규칙]
- 도메인(${domain ?? '일반'})에 적합한 평가 기준 3~5개를 동적으로 생성하세요.
- 각 기준에 가중치를 부여하세요 (합계 1.0).
- 각 후보에 대해 기준별 0~100점을 매기세요.
- 가중 합산으로 총점을 계산하세요.
- 최고점 후보를 selectedIndex로 선택하세요.
- 각 후보에 대해 한 줄 평가(rationale)를 작성하세요.`,
    prompt: `수집된 맥락:\n${contextText}\n\n${candidateText}\n\n위 3개 후보를 평가해주세요.`,
  };
}

// ---------------------------------------------------------------------------
// generateCandidate
// ---------------------------------------------------------------------------

export function generateCandidate(
  index: number,
  personaPrompt: string,
  contexts: CollectedContextItem[],
  angle: ApproachAngle,
  revision?: RevisionContext,
  webSearchContext?: string,
) {
  // Revision rounds focus on feedback, not new web data — webSearchContext is intentionally omitted
  const prompt = revision
    ? buildRevisionCandidateUserPrompt(contexts, revision)
    : buildCandidateUserPrompt(contexts, webSearchContext);

  const result = streamText({
    model: simulationModel(),
    system: buildCandidateSystemPrompt(personaPrompt, angle),
    prompt,
    tools: { add_comment: addCommentTool },
    maxSteps: 2,
  });

  return { index, angle, result };
}

// ---------------------------------------------------------------------------
// evaluateCandidates
// ---------------------------------------------------------------------------

export async function evaluateCandidates(
  domain: string | null,
  contexts: CollectedContextItem[],
  candidates: { label: string; content: string }[],
): Promise<EvaluationResult> {
  const { system, prompt } = buildEvaluationPrompt(
    domain,
    contexts,
    candidates,
  );

  try {
    const { experimental_output: output } = await generateText({
      model: evaluationModel(),
      experimental_output: Output.object({ schema: evaluationSchema }),
      system,
      prompt,
    });

    if (!output) {
      return buildFallbackEvaluation(candidates.length);
    }

    return output;
  } catch (error: unknown) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return buildFallbackEvaluation(candidates.length);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function calculateNextRound(
  existingSimulations: { round: number }[],
): number {
  if (existingSimulations.length === 0) return 1;
  const maxRound = Math.max(...existingSimulations.map((s) => s.round));
  return maxRound + 1;
}

function buildFallbackEvaluation(candidateCount: number): EvaluationResult {
  return {
    criteria: [{ name: '종합', weight: 1 }],
    scores: Array.from({ length: candidateCount }, (_, i) => ({
      candidateIndex: i,
      criteriaScores: [i === 0 ? 80 : 70],
      totalScore: i === 0 ? 80 : 70,
    })),
    selectedIndex: 0,
    rationale: Array.from(
      { length: candidateCount },
      (_, i) =>
        i === 0
          ? '평가 실패로 첫 번째 후보를 기본 선택합니다.'
          : '평가를 수행하지 못했습니다.',
    ),
  };
}

/** Build a one-line summary from the first ~100 chars of content */
export function buildSummary(content: string): string {
  const firstLine = content.split('\n').find((l) => l.trim().length > 0) ?? '';
  const clean = firstLine.replace(/^#+\s*/, '').trim();
  if (clean.length <= 100) return clean;
  return clean.slice(0, 97) + '...';
}
