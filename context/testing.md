# Testing Context

## 테스트 전략

모든 테스트는 **계약 테스트(Contract Test)** + **스모크 테스트(Smoke Test)** 두 레이어로 구성한다.

### 계약 테스트 (Contract Test)

외부 의존성(AI API, DB 등)의 인터페이스가 기대대로 동작하는지 검증.
실제 API를 호출하지 않고, 요청/응답 형태의 계약을 검증한다.

- **AI Provider 계약**: OpenRouter, Cerebras API의 요청 형식과 응답 스키마 검증
  - streamText 호출 시 올바른 model ID가 전달되는지 (`google/gemini-3-flash-preview`, `google/gemini-3.1-pro-preview`, Cerebras GLM 4.7)
  - 응답이 Vercel AI SDK의 기대 형식과 일치하는지
  - tool call 스키마가 zod 정의와 일치하는지
- **Firecrawl 계약**: search/scrape API의 요청 형식과 응답 스키마 검증
  - search 요청에 query, limit 필드가 올바르게 전달되는지
  - scrape 요청에 url, formats 필드가 올바르게 전달되는지
  - FIRECRAWL_API_KEY 없을 때 graceful skip 동작 검증
- **DB 계약**: Drizzle 스키마와 실제 쿼리 결과의 타입 일치 검증
  - 각 테이블의 insert/select 타입 검증
  - FK 관계가 올바르게 resolve되는지
- **API Route 계약**: 각 엔드포인트의 request/response 스키마 검증
  - zod로 정의된 request body 검증
  - response 형식이 프론트엔드 기대와 일치하는지

### 스모크 테스트 (Smoke Test)

`.env.local`에서 환경변수를 읽어서 **실제 유저 스토리 흐름대로** 외부 서비스를 호출.
mock 절대 금지. 실제 API 키로 실제 엔드포인트를 호출하는 테스트만.

- **도메인 분류 스모크**: `classifyDomain("자기소개서 써줘")` 호출 → 실제 OpenRouter(Gemini Flash) 응답에서 domain key 반환 확인
- **질문 생성 스모크**: 수집된 context + 페르소나 프롬프트로 실제 질문 생성 → inputType, options 필드 존재 확인
- **시뮬레이션 스모크**: 간단한 context로 Cerebras 호출 → 텍스트 응답 스트리밍 확인
- **평가 스모크**: 후보 2개 텍스트로 OpenRouter(Gemini Pro) 평가 호출 → score 반환 확인
- **Firecrawl 스모크**: `firecrawlSearch("서울 여행")` → results 배열 존재 확인
- **DB 스모크**: project 생성 → message 삽입 → collected_context 삽입 → 조회 확인
- 각 스모크 테스트는 해당 API 키 없으면 자동 스킵 (에러 아님)
- 스모크 테스트는 `npm run test:smoke`로 별도 실행
- `.env.local` 없으면 스모크 테스트 자동 스킵 (에러 아님)

### 테스트 파일 구조

```
__tests__/
├── contracts/
│   ├── ai-providers.test.ts     # AI provider 계약 (모델 ID 검증 포함)
│   ├── firecrawl.test.ts        # Firecrawl API 계약
│   ├── db-schema.test.ts        # DB 스키마 계약
│   └── api-routes.test.ts       # API route 계약
├── smoke/
│   ├── ai-smoke.test.ts         # AI 연결 스모크
│   ├── firecrawl-smoke.test.ts  # Firecrawl 연결 스모크
│   └── db-smoke.test.ts         # DB 연결 스모크
└── unit/
    ├── personas.test.ts         # 페르소나 로직
    ├── collect.test.ts          # Collect 질문 생성 로직
    └── simulate.test.ts         # Simulate 평가 로직
```

### npm 스크립트

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:smoke": "SMOKE=1 vitest run __tests__/smoke/"
}
```

### 환경변수 로딩

스모크 테스트에서 `.env.local`을 로드:

```typescript
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

const skip = !process.env.OPENROUTER_API_KEY;
describe.skipIf(skip)('AI Smoke Tests', () => { ... });
```

### 테스트 규칙

- 계약 테스트는 외부 호출 없이 빠르게 실행 — 요청/응답 형식만 검증
- **스모크 테스트에 mock 절대 금지** — 실제 API 키로 실제 엔드포인트 호출만 허용
- 스모크 테스트는 유저 스토리 흐름을 따라 실제 호출 (더미 프롬프트 금지)
- 스모크 테스트는 .env.local이 없으면 graceful skip
- 모든 API route에 대해 최소 1개의 계약 테스트 필수
- AI 호출 로직에 대해 요청/응답 스키마 계약 테스트 필수
- mock은 계약 테스트에서 요청 형식 검증 시에만 사용 (내부 로직 mock 금지)
