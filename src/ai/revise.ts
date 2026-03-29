import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { mainAgentModel } from '@/ai/providers';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const revisionOptionsSchema = z.object({
  options: z
    .array(z.string())
    .describe('수정 선택지 4~5개 (마지막은 항상 "기타 (직접 입력)")'),
});

export type RevisionOptionsResult = z.infer<typeof revisionOptionsSchema>;

// ---------------------------------------------------------------------------
// generateRevisionOptions
// ---------------------------------------------------------------------------

export async function generateRevisionOptions(
  content: string,
  domain: string | null,
): Promise<string[]> {
  const system = `당신은 전문 콘텐츠 수정 어드바이저입니다.
사용자가 생성한 결과물을 읽고, 수정할 수 있는 방향을 4~5개 제안합니다.

[규칙]
- 도메인(${domain ?? '일반'})에 맞는 구체적인 수정 방향을 제시하세요.
- 각 선택지는 짧고 명확하게 (예: "톤 변경", "분량 조절", "구조 변경", "핵심 내용 수정")
- 마지막 선택지는 반드시 "기타 (직접 입력)"이어야 합니다.
- 결과물의 내용과 도메인을 고려하여 가장 유용한 수정 방향을 제안하세요.`;

  const prompt = `다음 결과물을 읽고 수정 선택지를 제안해주세요:\n\n${content}`;

  try {
    const { experimental_output: output } = await generateText({
      model: mainAgentModel(),
      experimental_output: Output.object({ schema: revisionOptionsSchema }),
      system,
      prompt,
    });

    if (!output) {
      return buildFallbackOptions();
    }

    // Ensure "기타 (직접 입력)" is always the last option
    const options = output.options.filter((o) => o !== '기타 (직접 입력)');
    return [...options, '기타 (직접 입력)'];
  } catch (error: unknown) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return buildFallbackOptions();
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFallbackOptions(): string[] {
  return [
    '톤 변경',
    '분량 조절',
    '구조 변경',
    '핵심 내용 수정',
    '기타 (직접 입력)',
  ];
}
