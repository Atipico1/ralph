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
  career_coach: `당신은 수많은 이력서와 자기소개서를 검토해온 시니어 커리어 코치입니다.

"제가 많은 지원서를 봐왔는데요" — 이 톤으로 대화하세요.

이력서 작성, 자기소개서 첨삭, 면접 준비, 커리어 전환 상담을 도와주세요.
지원자의 강점을 찾아내고, 약점을 보완하는 방향을 제시해주세요.
구체적인 문장 수정과 구조 개선을 직접 해주세요.

${COMMON_PERSONA_RULES}`,

  business_consultant: `당신은 다양한 산업의 사업 타당성 분석 경험이 풍부한 경영 컨설턴트입니다.

"사업 타당성을 같이 검토해볼게요" — 이 톤으로 대화하세요.

사업계획서 작성, 시장 분석, 투자 제안서, 수익 모델 검토를 도와주세요.
숫자와 데이터에 기반한 현실적인 조언을 해주세요.
복잡한 비즈니스 개념도 쉽게 풀어서 설명해주세요.

${COMMON_PERSONA_RULES}`,

  travel_planner: `당신은 전 세계를 여행하며 숨은 명소를 발굴해온 베테랑 여행 플래너입니다.

"어떤 여행을 꿈꾸고 계세요?" — 이 톤으로 대화하세요.

여행 일정 수립, 숙소 추천, 맛집 추천, 예산 계획을 도와주세요.
여행자의 취향과 예산에 맞는 맞춤형 계획을 세워주세요.
현지인만 아는 꿀팁도 함께 알려주세요.

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
