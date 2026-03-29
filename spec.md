# Ralph SPEC

## Overview

에이전트 주도 인터랙션 플랫폼. 유저는 에이전트가 시키는 대로 응답만 하면 최선의 결과물을 받는다.
핵심 루프: Collect(상담) → Simulate(검토) → Deliver(결과).
범용 도메인 — 자기소개서, 사업계획서, 여행계획 등 어떤 요청이든 대응.

## Tech Stack

| Layer | Choice | Package |
|-------|--------|---------|
| Framework | Next.js App Router | `next` |
| Language | TypeScript (strict) | |
| DB | SQLite | `better-sqlite3` |
| ORM | Drizzle ORM | `drizzle-orm`, `drizzle-kit` |
| AI SDK | Vercel AI SDK v4 | `ai`, `@ai-sdk/react` |
| AI Provider (메인) | OpenRouter | `@openrouter/ai-sdk-provider` |
| AI Provider (시뮬레이션) | Cerebras | OpenAI-compatible API |
| UI 컴포넌트 | 21st.dev Magic MCP | |
| 스타일 | Tailwind CSS | |

## AI 모델 배치

| 단계 | 모델 | Provider | 이유 |
|------|------|----------|------|
| 도메인 분류 | `google/gemini-3-flash-preview` | OpenRouter | 빠른 분류 |
| 페르소나 동적 생성 | `google/gemini-3-flash-preview` | OpenRouter | |
| Collect 질문 생성 | `google/gemini-3-flash-preview` | OpenRouter | 메인 에이전트 |
| Simulate 후보 3개 생성 | Cerebras GLM 4.7 | Cerebras | 초고속 병렬 생성 |
| Simulate 혼잣말 코멘트 | Cerebras GLM 4.7 | Cerebras | 후보 생성 중 tool call로 코멘트 생성 (별도 호출 아님) |
| Simulate 평가/선택 | `google/gemini-3.1-pro-preview` | OpenRouter | 도메인별 동적 평가 기준 생성 + 고품질 판단 |
| Revision 선택지 생성 | `google/gemini-3-flash-preview` | OpenRouter | |

## 환경 변수 (.env.local)

```
OPENROUTER_API_KEY=...
CEREBRAS_API_KEY=...
DATABASE_PATH=./local.db
```

## Core Loop

```
[1] Collect — 에이전트가 질문, 유저가 응답 (Typeform 스타일, 한 번에 하나)
    - 질문/선택지는 Claude가 매번 동적 생성
    - 모든 선택지에 "기타 (직접 입력)" 옵션 포함
    - 최대 질문 수 상한선 있음 (그 안에서 충분하면 조기 종료)
    - 도메인별 전문가 페르소나 적용 (프리셋 없으면 동적 생성)

[2] Simulate — 에이전트가 여러 방향을 탐색/평가
    - Cerebras로 후보 3개 완성본을 병렬 생성 (초고속)
    - SSE 스트리밍으로 생성 과정 + 혼잣말 코멘트 실시간 표시
    - 유저 개입 없음 (구경만)
    - 완료 후 Gemini Pro로 평가 → 최선 1개 선택

[3] Deliver — 최선의 결과물 + 근거 제시
    - 선택된 결과물 중앙에 크게 표시
    - 대안 후보는 접기/펼치기로 확인 가능
    - 수정 요청: 선택형 ("어떤 부분을 수정할까요?") → 재시뮬레이션
    - 저장: DB 저장 확정 + 마크다운/텍스트 파일 다운로드
    - 처음부터 다시: context 초기화 → Collect로
```

## Data Model

### projects

| Column | Type | Note |
|--------|------|------|
| id | text (nanoid) | PK |
| title | text | 유저 첫 입력에서 자동 생성 |
| domain | text | nullable. 분류된 도메인 ("career_coach", "travel_planner" 등) |
| persona_prompt | text | nullable. 해당 도메인의 시스템 프롬프트 |
| phase | text | `collect` / `simulate` / `deliver` |
| max_questions | integer | default 10. Collect 최대 질문 수 |
| question_count | integer | default 0. 현재까지 질문 수 |
| created_at | integer | unix timestamp |
| updated_at | integer | unix timestamp |

### messages

에이전트-유저 간 전체 대화 히스토리.

| Column | Type | Note |
|--------|------|------|
| id | text (nanoid) | PK |
| project_id | text | FK → projects |
| role | text | `agent` / `user` |
| content | text | 메시지 본문 |
| input_type | text | nullable. `choice` / `text` / `yesno` |
| options | text | nullable. JSON string. 선택지 배열 (마지막은 항상 "기타") |
| created_at | integer | unix timestamp |

### collected_context

Collect에서 수집된 핵심 정보. 구조화된 key-value.

| Column | Type | Note |
|--------|------|------|
| id | text (nanoid) | PK |
| project_id | text | FK → projects |
| key | text | e.g. "target_audience", "budget", "tone" |
| value | text | 유저 응답 값 |
| question_id | text | FK → messages. 어떤 질문에 대한 답인지 |
| created_at | integer | unix timestamp |

### simulations

Simulate의 후보 방향들. 완성본 전문 포함.

| Column | Type | Note |
|--------|------|------|
| id | text (nanoid) | PK |
| project_id | text | FK → projects |
| round | integer | 시뮬레이션 라운드 (수정 시 round 증가) |
| label | text | "진솔한 톤", "성과 중심" 등 |
| summary | text | 요약 (카드에 표시) |
| content | text | 완성본 전문 |
| rationale | text | 이 방향의 장단점 |
| score | real | nullable. 평가 점수 (0~100) |
| is_selected | integer | 0 or 1 |
| created_at | integer | unix timestamp |

### revision_options

Deliver에서 수정 요청 시 제시되는 선택지.

| Column | Type | Note |
|--------|------|------|
| id | text (nanoid) | PK |
| project_id | text | FK → projects |
| simulation_id | text | FK → simulations. 어떤 결과물에 대한 수정인지 |
| selected_option | text | 유저가 선택한 수정 방향 |
| custom_input | text | nullable. "기타"로 직접 입력한 경우 |
| created_at | integer | unix timestamp |

## Pages & Routes

### `/` — Screen 0: Landing

- 풀스크린, 채팅창 없음
- 중앙에 인사 메시지 + 텍스트 입력 + 시작 버튼
- 최근 프로젝트를 칩으로 표시 (최신순 최대 5개)
- 입력 시 project 생성 → `/project/[id]`로 redirect
- 톤: "안녕하세요! 무엇을 도와드릴까요?"

### `/project/[id]` — Screen 1~3

project.phase에 따라 화면 전환 (fade/slide 애니메이션):

**phase: collect (Screen 1)**
- Typeform 스타일. 전체 화면, 한 번에 질문 하나
- 왼쪽 영역:
  - 에이전트 질문 텍스트
  - 입력 UI (input_type에 따라):
    - `choice`: 큰 카드 버튼 (세로 나열) + 마지막에 "기타 (직접 입력)" 카드
    - `text`: 큰 텍스트에어리어
    - `yesno`: 토글 버튼 2개
  - 하단: [← 이전] / [건너뛰기 →]
- 오른쪽 패널 (클립보드):
  - "지금까지 파악한 것" 제목
  - collected_context를 읽기 좋게 나열 (✓ 목적: 랜딩페이지 제작)
  - "나머지는 제가 알아볼게요"
- 상단: 진행 바 "상담 3/10" (question_count / max_questions)

**phase: simulate (Screen 2)**
- 상단: 진행 바 "검토 중"
- 후보 카드 3개 가로 나열:
  - 라벨 (e.g. "방향 A: 진솔한 톤")
  - 개별 프로그레스 바 (생성 진행률)
  - 상태: "생성 중..." → "완료"
- 에이전트 코멘트 영역:
  - SSE 스트리밍으로 실시간 표시
  - 혼잣말 톤 ("A안은 타겟층에 잘 맞는데, B안도 예산 면에서 괜찮아 보여요")
- 하단: 수집된 맥락 요약 스트립 (한 줄)
- 유저 인터랙션 없음 (버튼 없음, 구경만)
- 시뮬레이션 완료 시 자동으로 deliver로 전환

**phase: deliver (Screen 3)**
- 상단: 진행 바 "완료 ✓"
- 메인 영역:
  - "이렇게 하는 게 가장 좋겠어요"
  - 선택된 결과물 렌더링 (마크다운 → HTML)
  - 근거 bullet 리스트 ("왜 이게 좋은지:")
- 액션 버튼 (하단):
  - [저장] → DB 저장 확정, 저장 완료 토스트
  - [다운로드] → .md 파일 다운로드
  - [수정 요청] → 수정 선택지 모달
  - [처음부터 다시] → 확인 후 context 초기화, phase → collect
- "다른 방향도 볼래요?" 섹션:
  - 접힌 상태로 나머지 후보 2개 카드
  - 클릭하면 펼쳐서 전문 확인 가능
- round > 1일 때 "이전 버전" 링크 표시:
  - 이전 round의 선택된 결과물을 확인 가능 (읽기 전용)
  - 이전 round 데이터는 DB에 보관 (simulations.round로 구분)

## API Routes

### `POST /api/projects`
- Body: `{ input: string }`
- 동작:
  1. project 생성 (phase: collect)
  2. 첫 입력으로 도메인 분류 (Gemini Flash)
  3. 프리셋 페르소나 있으면 로드, 없으면 동적 생성 (Gemini Flash)
  4. 첫 에이전트 질문 생성
- Response: `{ projectId, firstMessage }`

### `GET /api/projects`
- Response: 최근 프로젝트 목록 (최신순, 최대 10개)

### `GET /api/projects/[id]`
- Response: project + messages + collected_context + simulations

### `POST /api/projects/[id]/chat`
- Body: `{ message: string, optionIndex?: number }`
- 동작:
  1. 유저 응답을 messages에 저장
  2. 응답에서 context 추출 → collected_context에 저장
  3. question_count++
  4. 충분하면 `{ phase: "simulate", done: true }` 반환
  5. 아니면 다음 질문 생성 (Gemini Flash) → `{ question, inputType, options }` 반환
- 스트리밍: 질문 생성 시 SSE 스트리밍

### `POST /api/projects/[id]/simulate`
- 동작:
  1. collected_context 전체를 프롬프트에 주입
  2. Cerebras로 후보 3개 병렬 생성 (SSE 멀티스트림)
  3. 각 후보를 simulations 테이블에 저장 (round 현재값)
  4. 생성 중 혼잣말 코멘트도 SSE로 전달
  5. 완료 후 Gemini Pro로 3개 평가 → score 매기기 → 최고점 is_selected=1
  6. phase → deliver
- Response: SSE 스트림
  - `event: candidate` — 후보 생성 진행
  - `event: comment` — 혼잣말 코멘트
  - `event: evaluation` — 평가 결과
  - `event: done` — 완료

### `POST /api/projects/[id]/revise`
- Body: `{ selectedOption: string, customInput?: string }`
- 동작:
  1. revision_options에 저장
  2. round++
  3. phase → simulate (Simulate 화면 다시 거침)
  4. 수정 피드백 + 기존 context + 이전 round 결과물로 **3개 후보 전부 재생성**
  5. 이전 round의 simulation 데이터는 DB에 **보관** (round 번호로 구분)
- Response: `{ ok: true }` → 클라이언트는 phase 변경 감지 후 Simulate 화면으로 전환, simulate API 호출

### `GET /api/projects/[id]/revision-options`
- 동작: 현재 결과물 기반으로 수정 선택지 생성 (Gemini Flash)
- Response: `{ options: ["톤 변경", "분량 조절", "구조 변경", "핵심 내용 수정", "기타"] }`
  - 항상 마지막에 "기타 (직접 입력)" 포함

### `GET /api/projects/[id]/download`
- Response: 선택된 결과물을 .md 파일로 다운로드

## AI Provider 설정

### OpenRouter (메인 에이전트)

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// 메인 에이전트
const mainModel = openrouter('google/gemini-3-flash-preview');

// 평가 모델
const evalModel = openrouter('google/gemini-3.1-pro-preview');
```

### Cerebras (시뮬레이션)

Cerebras는 OpenAI-compatible API. Vercel AI SDK의 OpenAI-compatible provider 사용:

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const cerebras = createOpenAICompatible({
  name: 'cerebras',
  baseURL: 'https://api.cerebras.ai/v1',
  headers: { Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}` },
});

const simModel = cerebras('glm-4.7');
```

## 도메인 페르소나 시스템

### 프리셋 페르소나

| domain key | 페르소나 | 톤 |
|-----------|---------|-----|
| `career_coach` | 커리어 코치 | "제가 많은 지원서를 봐왔는데요" |
| `business_consultant` | 경영 컨설턴트 | "사업 타당성을 같이 검토해볼게요" |
| `travel_planner` | 여행 플래너 | "어떤 여행을 꿈꾸고 계세요?" |

### 동적 생성 (프리셋 없는 도메인)

첫 입력을 분석해서:
1. 도메인 분류 (Gemini Flash)
2. 해당 분야 전문가 페르소나 시스템 프롬프트 생성 (Gemini Flash)
3. project.persona_prompt에 저장
4. 이후 모든 API 호출에서 이 프롬프트를 system message로 사용

### 공통 페르소나 규칙 (모든 도메인)

- "AI" 단어 사용 금지
- 친근한 전문가 톤 — 권위적이지 않지만 확신
- "제가 알아서 할게요, 이것만 알려주세요"
- 쉬운 말로 설명, 전문 용어 없이
- 결과에 자신감 — "이게 가장 좋겠어요" (not "좋을 수도 있어요")

## Simulate 병렬 생성 상세

### 후보 생성 + 혼잣말 코멘트 (Tool Call 패턴)

각 후보 생성 시 Cerebras에 tool을 정의하여, 생성 중간중간 혼잣말 코멘트를 tool call parameter로 뱉도록 함:

```typescript
// Cerebras 호출 시 tool 정의
const tools = {
  add_comment: {
    description: "생성 중 떠오른 생각을 한 문장으로 코멘트",
    parameters: z.object({
      comment: z.string().describe("한 문장 코멘트. 예: '이 방향은 타겟층의 감성에 잘 맞을 것 같아요'"),
    }),
  },
};

// 각 후보 프롬프트에 포함:
// "결과물을 생성하면서, 중간중간 add_comment 도구를 호출하여
//  현재 방향에 대한 짧은 생각을 공유하세요."
```

서버에서 tool call 이벤트를 감지하면 SSE `event: comment`로 프론트에 전달.

### 전체 흐름

```
서버 (Route Handler)
│
├─ 3개 streamText() 병렬 실행 (각각 tools: { add_comment } 포함)
│   - 각 스트림에서 텍스트 chunk → event: candidate
│   - 각 스트림에서 tool_call(add_comment) → event: comment
│
├─ SSE 멀티플렉싱:
│   event: candidate, data: { index: 0, chunk: "..." }
│   event: comment, data: { index: 1, text: "B안은 실용적이지만 톤이 딱딱할 수 있어요" }
│   event: candidate, data: { index: 2, chunk: "..." }
│   ...
│   event: candidate, data: { index: 0, chunk: "", status: "done" }
│
└─ 3개 모두 완료 후:
   Gemini Pro에게 3개 전문 + context + 도메인 → 동적 평가 기준 생성 + 평가
   → score 매기기 → 최고점 is_selected=1
   → phase = deliver
```

### 평가 (Gemini Pro)

평가 기준은 도메인별로 **동적 생성**:

```typescript
// 평가 프롬프트 구조
const evaluationPrompt = `
당신은 ${domain} 분야의 전문 평가자입니다.

## 수집된 맥락
${collectedContextSummary}

## 평가할 후보
${candidates.map((c, i) => `### 후보 ${i + 1}: ${c.label}\n${c.content}`).join('\n\n')}

## 지시사항
1. 이 도메인과 유저의 요구사항에 맞는 평가 기준 3~5개를 먼저 정의하세요
2. 각 기준별로 후보마다 점수(0~100)를 매기세요
3. 총점으로 최종 순위를 매기고, 1위를 선택하세요
4. 선택 근거를 bullet point로 작성하세요
`;

// Structured Output
const evaluationSchema = z.object({
  criteria: z.array(z.object({
    name: z.string(),        // e.g., "타겟 부합도", "설득력", "구조"
    weight: z.number(),       // 0~1, 합계 1
  })),
  scores: z.array(z.object({
    candidateIndex: z.number(),
    criteriaScores: z.array(z.number()),  // 각 기준별 점수
    totalScore: z.number(),
  })),
  selectedIndex: z.number(),
  rationale: z.array(z.string()),  // Deliver 화면의 "근거 bullet"에 사용
});
```

- **동점 시**: `rationale`에서 "근소한 차이로 선택됨"을 명시, LLM이 판단한 순서를 따름
- **평가 결과 저장**: `simulations.score`에 totalScore, `simulations.rationale`에 근거 저장

## UI/UX 요구사항

- Typeform 스타일 전체 화면 전환 (스크롤 없음)
- 화면 전환: fade + slide 애니메이션
- 모바일 반응형:
  - 클립보드 패널은 하단 시트로
  - 후보 카드는 세로 스택
- 에이전트 톤: concept.md 참조
- 선택지는 항상 "기타 (직접 입력)" 포함
- "AI" 단어 사용 금지

## Collect 조기 종료 로직

Confidence-based termination. 턴 수가 아니라 "필수 정보가 충분한가"로 판단.

### 종료 판단 프로세스

매 유저 응답 후, 질문 생성 프롬프트에 다음을 포함:

```
수집된 컨텍스트: {collected_context 전체}
남은 질문 가능 횟수: {max_questions - question_count}

아래 중 하나를 반환하세요:
1. 다음 질문이 필요하면 → { "action": "ask", "question": ..., "inputType": ..., "options": ... }
2. 충분히 수집했으면 → { "action": "done", "summary": "..." }

종료 기준:
- 결과물을 만들기 위한 핵심 정보(목적, 대상, 톤, 범위)가 모두 수집됨
- 또는 max_questions에 도달
```

### Structured Output

질문 생성 시 Vercel AI SDK의 `generateObject()` + Zod 스키마 사용:

```typescript
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ask"),
    question: z.string(),
    inputType: z.enum(["choice", "text", "yesno"]),
    options: z.array(z.string()).optional(),
    contextKey: z.string(),  // 이 질문이 수집하려는 정보의 key
  }),
  z.object({
    action: z.literal("done"),
    summary: z.string(),
  }),
]);
```

## Context 추출 로직

유저 응답에서 구조화된 key-value를 추출하여 `collected_context`에 저장.

### 방식: 질문 생성 시 contextKey 선언

질문을 생성할 때 AI가 `contextKey`를 함께 반환. 유저가 응답하면:
- `key` = 질문의 `contextKey` (e.g., "target_audience", "budget")
- `value` = 유저 응답 원문 (선택지면 선택한 텍스트, 텍스트면 입력값)
- 같은 key에 대한 재응답(이전 버튼으로 돌아간 경우)은 덮어쓰기 (UPSERT)

### contextKey 예시 (도메인별)

| 도메인 | 주요 contextKey |
|--------|----------------|
| career_coach | purpose, target_company, experience_years, tone, key_achievements |
| business_consultant | business_type, target_market, budget, timeline, core_value |
| travel_planner | destination, travel_dates, budget, group_size, preferences |

contextKey는 AI가 동적으로 생성하므로, 프리셋은 프롬프트에 예시로만 포함.

## 도메인 분류 상세

### 분류 방식: Route Description Matching

프리셋 도메인 목록 + 설명을 프롬프트에 주입, LLM이 매칭:

```typescript
const DOMAIN_ROUTES = [
  { key: "career_coach", description: "이력서, 자기소개서, 면접 준비, 커리어 전환 상담" },
  { key: "business_consultant", description: "사업계획서, 시장 분석, 투자 제안서" },
  { key: "travel_planner", description: "여행 일정, 숙소, 맛집, 예산 계획" },
  { key: "content_creator", description: "블로그, SNS 콘텐츠, 마케팅 카피" },
  { key: "custom", description: "위 카테고리에 해당하지 않는 요청" },
] as const;
```

### 분류 결과 처리

- **프리셋 매칭**: 해당 도메인의 프리셋 persona_prompt 로드
- **custom**: Gemini Flash로 동적 페르소나 생성 → `project.persona_prompt`에 저장
- **분류 실패 fallback**: `custom`으로 처리 (동적 생성)

### Silent Mode

첫 입력이 명확한 의도를 포함하면 (e.g., "자기소개서 써줘") 분류 즉시 완료, 불필요한 확인 질문 없이 바로 Collect 시작.

## SSE 멀티스트림 프로토콜

### 서버 구현 (TransformStream 패턴)

```typescript
// POST /api/projects/[id]/simulate
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const response = new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });

  // 비동기 작업은 Response 반환 후 실행
  (async () => {
    try {
      // 3개 병렬 생성...
    } finally {
      await writer.close();
    }
  })();

  return response;
}
```

### SSE 이벤트 스키마

```
event: candidate
data: {"index": 0, "chunk": "텍스트 조각...", "status": "streaming"}

event: candidate
data: {"index": 0, "chunk": "", "status": "done"}

event: comment
data: {"text": "A안이 타겟층에 잘 맞는데..."}

event: evaluation
data: {"scores": [85, 72, 68], "selectedIndex": 0, "rationale": "..."}

event: error
data: {"index": 1, "message": "생성 실패"}

event: done
data: {}
```

- 각 candidate의 완료는 `status: "done"`으로 개별 시그널
- 전체 완료는 `event: done`
- 에러는 해당 candidate만 실패, 나머지는 계속 진행

### 클라이언트 소비 (fetch 기반, POST 지원)

```typescript
const res = await fetch(`/api/projects/${id}/simulate`, { method: 'POST' });
const reader = res.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (line.startsWith('event: ')) currentEvent = line.slice(7);
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      handleEvent(currentEvent, data);
    }
  }
}
```

### 프로그레스 바

각 candidate의 진행률은 **수신 chunk 수 기반** 추정:
- 예상 총 길이는 첫 SSE에서 `estimatedTokens` 힌트로 전달 (optional)
- 힌트 없으면 chunk 수신에 따라 0% → 진행 중 애니메이션 → `status: "done"`에서 100%

## 에러 처리

### API 에러 응답 형식

```typescript
{ error: string, code: "PROVIDER_ERROR" | "RATE_LIMIT" | "INVALID_INPUT" | "NOT_FOUND" }
```

### Provider 장애 처리

| 상황 | 처리 |
|------|------|
| Cerebras 후보 1개 실패 | 나머지 2개로 진행, 실패 카드에 "생성 실패" 표시 |
| Cerebras 전체 실패 | phase를 simulate에 유지, 유저에게 "잠시 후 다시 시도" 표시 |
| OpenRouter 실패 (Collect) | 에러 토스트 + 재시도 버튼 |
| 평가 (Gemini Pro) 실패 | 3개 중 첫 번째를 기본 선택, 유저에게 "직접 선택" UI 제공 |

### 브라우저 새로고침 복구

- `project.phase`가 DB에 저장되어 있으므로, 새로고침 시 `GET /api/projects/[id]`로 현재 상태 복원
- `simulate` phase 중 새로고침: 이미 저장된 simulation이 있으면 deliver로 전환, 없으면 simulate 재시작
- SSE 연결 끊김: 클라이언트에서 phase를 polling하다가 `deliver`가 되면 전환

## 클라이언트 상태 관리

### 데이터 페칭 전략

- `/project/[id]` 초기 로드: `GET /api/projects/[id]` → SSR 또는 CSR (SWR)
- phase 전환: 서버 응답의 `phase` 필드로 클라이언트 상태 업데이트
- Collect: 각 chat 응답에서 다음 질문 + phase 상태 수신
- Simulate: SSE 스트림 연결, `event: done` 수신 시 phase → deliver
- Deliver: 정적 데이터, 추가 페칭 없음

### SSE 연결 관리

- 타임아웃: 서버에서 30초마다 keepalive 코멘트 (`: keepalive\n\n`)
- 재연결: 클라이언트에서 연결 끊김 감지 시 phase polling → 이미 완료면 결과 로드
- cleanup: 컴포넌트 언마운트 시 reader.cancel()

## 이전/건너뛰기 동작

### ← 이전

1. 마지막 에이전트 질문 + 유저 응답 pair를 messages에서 논리 삭제 (또는 UI에서만 이전 질문으로 이동)
2. 해당 질문의 `collected_context` 항목 삭제
3. `question_count--`
4. 이전 질문을 다시 표시 (messages에서 복원)

### 건너뛰기 →

1. 해당 질문의 `collected_context`는 저장하지 않음 (key 자체가 없음)
2. `question_count++` (질문 횟수는 소모)
3. 다음 질문 생성 시 "유저가 이 질문을 건너뛰었음"을 컨텍스트에 포함

## Non-Goals (v1)

- 유저 인증/로그인
- 결과물 링크 공유
- 복수 에이전트/페르소나 전환
- 결제/구독
- 실시간 협업
- 이미지/파일 생성 (텍스트 결과물만)

## File Structure (예상)

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                         # Screen 0: Landing
│   ├── project/
│   │   └── [id]/
│   │       └── page.tsx                 # Screen 1~3 (phase 기반 전환)
│   └── api/
│       └── projects/
│           ├── route.ts                 # POST (create), GET (list)
│           └── [id]/
│               ├── route.ts             # GET (detail)
│               ├── chat/
│               │   └── route.ts         # POST (chat)
│               ├── simulate/
│               │   └── route.ts         # POST (simulate, SSE)
│               ├── revise/
│               │   └── route.ts         # POST (revise)
│               ├── revision-options/
│               │   └── route.ts         # GET
│               └── download/
│                   └── route.ts         # GET (.md download)
├── db/
│   ├── schema.ts                        # Drizzle 스키마
│   ├── index.ts                         # DB 연결
│   └── queries.ts                       # 쿼리 헬퍼
├── ai/
│   ├── providers.ts                     # OpenRouter + Cerebras 설정
│   ├── personas.ts                      # 프리셋 페르소나 + 동적 생성
│   ├── collect.ts                       # 질문 생성 로직
│   ├── simulate.ts                      # 시뮬레이션 병렬 생성 + 평가
│   └── revise.ts                        # 수정 선택지 생성
├── components/
│   ├── landing/
│   │   └── LandingPage.tsx
│   ├── collect/
│   │   ├── CollectView.tsx              # 전체 레이아웃
│   │   ├── QuestionCard.tsx             # 질문 + 입력 UI
│   │   ├── ChoiceInput.tsx              # choice 타입 카드 버튼
│   │   ├── TextInput.tsx                # text 타입
│   │   ├── YesNoInput.tsx               # yesno 타입
│   │   ├── ClipboardPanel.tsx           # 오른쪽 맥락 요약
│   │   └── ProgressBar.tsx              # 상단 진행 바
│   ├── simulate/
│   │   ├── SimulateView.tsx
│   │   ├── CandidateCard.tsx            # 후보 카드 + 프로그레스
│   │   └── AgentComment.tsx             # 혼잣말 코멘트
│   ├── deliver/
│   │   ├── DeliverView.tsx
│   │   ├── ResultDisplay.tsx            # 결과물 렌더링
│   │   ├── RationaleList.tsx            # 근거 bullet
│   │   ├── ActionButtons.tsx            # 저장/다운로드/수정/다시
│   │   ├── AlternativeCandidates.tsx    # 접기/펼치기 대안
│   │   └── RevisionModal.tsx            # 수정 선택지 모달
│   └── shared/
│       └── PhaseTransition.tsx          # 화면 전환 애니메이션
└── lib/
    ├── nanoid.ts                        # ID 생성
    └── constants.ts                     # MAX_QUESTIONS 등 상수
__tests__/
├── contracts/
│   ├── ai-providers.test.ts             # AI provider 계약 테스트
│   ├── db-schema.test.ts                # DB 스키마 계약 테스트
│   └── api-routes.test.ts               # API route 계약 테스트
├── smoke/
│   ├── ai-smoke.test.ts                 # AI 연결 스모크 (.env.local 필요)
│   └── db-smoke.test.ts                 # DB 연결 스모크
└── unit/
    ├── personas.test.ts                 # 페르소나 로직
    ├── collect.test.ts                  # Collect 질문 생성
    └── simulate.test.ts                 # Simulate 평가
```
