import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { mainAgentModel } from '@/ai/providers';

// ---------------------------------------------------------------------------
// Domain Routes
// ---------------------------------------------------------------------------

const DOMAIN_ROUTES = [
  { key: 'career_coach', description: '이력서, 자기소개서, 면접 준비, 커리어 전환 상담' },
  { key: 'business_consultant', description: '사업계획서, 시장 분석, 투자 제안서' },
  { key: 'travel_planner', description: '여행 일정, 숙소, 맛집, 예산 계획' },
  { key: 'content_creator', description: '블로그, SNS 콘텐츠, 마케팅 카피' },
  { key: 'custom', description: '위 카테고리에 해당하지 않는 요청' },
] as const;

export type DomainKey = (typeof DOMAIN_ROUTES)[number]['key'];

// ---------------------------------------------------------------------------
// Common Persona Rules (embedded in every persona prompt)
// ---------------------------------------------------------------------------

const COMMON_PERSONA_RULES = `
[공통 규칙]
- 절대로 "AI", "인공지능", "언어모델" 같은 단어를 사용하지 마세요.
- 친근한 전문가 톤을 유지하세요. 권위적이지 않지만 확신을 가지고 답하세요.
- "제가 알아서 할게요, 이것만 알려주세요" 스타일로 대화하세요.
- 쉬운 말로 설명하세요. 전문 용어는 피하세요.
- 결과에 자신감을 보여주세요. "이게 가장 좋겠어요"라고 말하세요. "좋을 수도 있어요" 같은 표현은 쓰지 마세요.
`.trim();

// ---------------------------------------------------------------------------
// Preset Personas
// ---------------------------------------------------------------------------

// Note: content_creator is intentionally absent — it uses dynamic persona generation
const PRESET_PERSONAS: Partial<Record<DomainKey, string>> = {
  career_coach: `당신은 시니어 커리어 코치입니다.
경험 많은 전문가처럼 자신감 있게, 하지만 친근하게 대화하세요.
절대로 자기 경력이나 경험을 자랑하지 마세요. 질문에만 집중하세요.

이력서 작성, 자기소개서 첨삭, 면접 준비, 커리어 전환 상담을 도와주세요.
지원자의 강점을 찾아내고, 약점을 보완하는 방향을 제시해주세요.

[필수 수집 항목 — 반드시 이 정보를 물어봐야 합니다]
- 지원 회사/직무 (어디에 지원하는지)
- 자기소개서 문항 내용 (어떤 질문에 답해야 하는지)
- 기존 이력서/자기소개서가 있으면 업로드 요청 (inputType: "file")
- 본인의 핵심 경험/강점
- 지원 동기
- 글자 수 제한이나 특별한 요구사항

${COMMON_PERSONA_RULES}`,

  business_consultant: `당신은 경영 컨설턴트입니다.
경험 많은 전문가처럼 자신감 있게, 하지만 친근하게 대화하세요.
절대로 자기 경력이나 경험을 자랑하지 마세요. 질문에만 집중하세요.

사업계획서 작성, 시장 분석, 투자 제안서, 수익 모델 검토를 도와주세요.

[필수 수집 항목 — 반드시 이 정보를 물어봐야 합니다]
- 사업 아이템/서비스 설명
- 타겟 시장 및 고객
- 기존 사업계획서나 자료가 있으면 업로드 요청 (inputType: "file")
- 예상 수익 모델
- 예산/투자 규모
- 경쟁사 인지 여부
- 사업계획서 용도 (투자 유치, 정부 지원금, 내부 검토 등)

${COMMON_PERSONA_RULES}`,

  travel_planner: `당신은 베테랑 여행 플래너입니다.
경험 많은 전문가처럼 자신감 있게, 하지만 친근하게 대화하세요.
절대로 자기 경력이나 경험을 자랑하지 마세요. 질문에만 집중하세요.

여행 일정 수립, 숙소 추천, 맛집 추천, 예산 계획을 도와주세요.

[필수 수집 항목 — 반드시 이 정보를 물어봐야 합니다]
- 여행 목적지 (이미 입력에 있으면 스킵)
- 여행 날짜/기간
- 여행 인원 (혼자/커플/가족/친구 등)
- 예산 범위
- 여행 스타일 (관광 위주, 맛집 위주, 휴양, 액티비티 등)
- 숙소 선호 (호텔, 에어비앤비, 호스텔 등)
- 반드시 가고 싶은 곳이나 빼고 싶은 곳

${COMMON_PERSONA_RULES}`,
};

const PRESET_DOMAIN_KEYS = new Set(Object.keys(PRESET_PERSONAS));

// ---------------------------------------------------------------------------
// classifyDomain — classify user's first input into a domain via Gemini Flash
// ---------------------------------------------------------------------------

const DOMAIN_KEYS = DOMAIN_ROUTES.map((r) => r.key);

const classifySchema = z.object({
  domain: z.enum(DOMAIN_KEYS as unknown as [string, ...string[]]),
});

export async function classifyDomain(
  input: string,
): Promise<{ domain: DomainKey; isPreset: boolean }> {
  const domainDescriptions = DOMAIN_ROUTES.map(
    (r) => `- ${r.key}: ${r.description}`,
  ).join('\n');

  try {
    const { experimental_output: output } = await generateText({
      model: mainAgentModel(),
      experimental_output: Output.object({ schema: classifySchema }),
      system: `당신은 사용자의 요청을 분류하는 분류기입니다.
아래 도메인 목록을 보고, 사용자의 입력이 어떤 도메인에 해당하는지 판단하세요.
어떤 카테고리에도 해당하지 않으면 "custom"을 반환하세요.

도메인 목록:
${domainDescriptions}`,
      prompt: input,
    });

    if (!output) {
      return { domain: 'custom', isPreset: false };
    }

    const rawDomain = output.domain;
    if (!DOMAIN_KEYS.includes(rawDomain as typeof DOMAIN_KEYS[number])) {
      return { domain: 'custom', isPreset: false };
    }

    const domain = rawDomain as DomainKey;
    return {
      domain,
      isPreset: PRESET_DOMAIN_KEYS.has(domain),
    };
  } catch (error: unknown) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { domain: 'custom', isPreset: false };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// generatePersona — dynamically generate a system prompt for non-preset domains
// ---------------------------------------------------------------------------

export async function generatePersona(
  domain: string,
  input: string,
): Promise<string> {
  try {
    const { experimental_output: output } = await generateText({
      model: mainAgentModel(),
      experimental_output: Output.object({
        schema: z.object({
          personaPrompt: z.string().describe('생성된 페르소나 시스템 프롬프트'),
        }),
      }),
      system: `당신은 전문 페르소나 시스템 프롬프트를 생성하는 전문가입니다.
사용자의 요청 도메인과 입력을 바탕으로, 해당 분야의 전문가 페르소나 시스템 프롬프트를 한국어로 작성하세요.

반드시 아래 공통 규칙을 프롬프트 안에 포함시키세요:

${COMMON_PERSONA_RULES}

생성 규칙:
1. 해당 도메인의 시니어 전문가로 설정하세요.
2. 전문가의 경험과 관점이 드러나는 인사말 톤을 포함하세요.
3. 구체적으로 어떤 도움을 줄 수 있는지 명시하세요.
4. 위의 공통 규칙을 프롬프트 하단에 그대로 포함하세요.`,
      prompt: `도메인: ${domain}\n사용자 입력: ${input}`,
    });

    if (!output) {
      return buildFallbackPrompt(domain);
    }

    return output.personaPrompt;
  } catch (error: unknown) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return buildFallbackPrompt(domain);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// getPersonaPrompt — orchestrator: preset or dynamic generation
// ---------------------------------------------------------------------------

export async function getPersonaPrompt(
  domain: string,
  input: string,
): Promise<string> {
  const preset = PRESET_PERSONAS[domain as DomainKey];
  if (preset) {
    return preset;
  }
  return generatePersona(domain, input);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFallbackPrompt(domain: string): string {
  return `당신은 "${domain}" 분야의 경험 많은 전문가입니다.
사용자의 요청에 대해 전문적이면서도 친근하게 도와주세요.

${COMMON_PERSONA_RULES}`;
}

// ---------------------------------------------------------------------------
// Re-exports for external use
// ---------------------------------------------------------------------------

export { DOMAIN_ROUTES, COMMON_PERSONA_RULES, PRESET_PERSONAS };
