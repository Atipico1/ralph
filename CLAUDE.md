# Ralph

Next.js + TypeScript + SQLite(Drizzle ORM) 프로젝트. 기술 스택은 `infra.md` 참조.

## 문서

프로젝트 관련 문서들:

- `infra.md` — 기술 스택, 배포 설정
- `spec.md` — 기능 명세 (single source of truth)
- `context/research.md` — 구현 전 리서치 규칙
- `context/testing.md` — 테스트 전략 (계약 테스트 + 스모크 테스트)
- `context/e2e.md` — E2E 브라우저 테스트 규칙
- `context/deploy.md` — Azure 배포 규칙
- `resources/21stdev.md` — 21st.dev MCP 사용법
- `resources/cerebras.md` — Cerebras 관련
- `resources/firecrawl.md` — Firecrawl 관련
- `resources/dicebear.md` — DiceBear 아바타 라이브러리 (에이전트 캐릭터 UI)

## 문서 참조 방법

### resources/ 폴더 (프로젝트 내장 문서)

각 md 파일에 공식 문서 URL 리스트가 있다. 필요한 페이지를 curl/WebFetch로 직접 가져와서 사용:

- `resources/21stdev.md` — 21st.dev API (relay.an.dev) 엔드포인트, SDK 사용법
- `resources/cerebras.md` — Cerebras Inference API, 모델, 기능별 문서 URL
- `resources/firecrawl.md` — Firecrawl API, SDK, 기능별 문서 URL

```bash
# 예: Cerebras 모델 목록이 필요하면
curl -s https://inference-docs.cerebras.ai/models/overview.md
```

### Context7 MCP (외부 라이브러리)

AI SDK, Drizzle ORM 등 `resources/`에 없는 외부 라이브러리는 **Context7 MCP**를 통해 최신 문서를 조회한다.
hallucination 방지를 위해 기억에 의존하지 말고 문서를 확인한다.

### 환경변수

API 키 등 환경변수는 `.env.local`에서 관리한다. 코드에서 `process.env.*`로 읽어서 사용.

- `OPENROUTER_API_KEY` — OpenRouter (LLM 라우팅)
- `FIRECRAWL_API_KEY` — Firecrawl (웹 스크래핑)
- `CEREBRAS_API_KEY` — Cerebras (빠른 추론)
- `21ST_DEV_API_KEY` — 21st.dev (sandbox/agent API)

## Skills

이 프로젝트는 superpowers 기반 스킬 시스템을 사용합니다. 각 스킬은 `skills/` 디렉토리에 있습니다.

### 워크플로우

```
brainstorming → writing-plans → plan-review → subagent-driven-development → test
```

1. **brainstorming** (`skills/brainstorming/SKILL.md`) — 아이디어를 설계/명세로 발전
2. **writing-plans** (`skills/writing-plans/SKILL.md`) — 명세를 실행 가능한 태스크로 분할
3. **plan review** (`skills/writing-plans/plan-document-reviewer-prompt.md`) — 계획 검증
4. **subagent-driven-development** (`skills/subagent-driven-development/SKILL.md`) — 태스크 실행의 핵심
   - `implementer-prompt.md` — 구현 서브에이전트 템플릿
   - `spec-reviewer-prompt.md` — spec 준수 검증 (적대적 리뷰)
   - `code-quality-reviewer-prompt.md` — 코드 품질 검증
5. **test-driven-development** (`skills/test-driven-development/SKILL.md`) — TDD 강제
6. **verification-before-completion** (`skills/verification-before-completion/SKILL.md`) — 완료 전 검증 강제

### 코드 리뷰 참조

- `skills/requesting-code-review/SKILL.md` — 리뷰 요청 방법
- `skills/requesting-code-review/code-reviewer.md` — 리뷰어 에이전트 프롬프트
- `skills/receiving-code-review/SKILL.md` — 리뷰 피드백 수신 방법

## Ralph Loop (자율 실행 모드)

`ralph.sh`로 실행하면 bash가 태스크 루프를 강제합니다.

### 실행 흐름 (3 Phases)

```
Phase 1: 태스크 루프 (context/research.md + context/testing.md 주입)
  ralph.sh가 prd.json에서 태스크를 하나씩 주입
  → 리서치 서브에이전트 → 구현 → spec review → code review → 테스트 → 커밋
  → TASK_PASS / TASK_FAIL

Phase 2: E2E 검증 (context/e2e.md 주입)
  → agent-browser로 모든 유저 스토리 브라우저 검증
  → E2E_PASS / E2E_FAIL → 수정 루프

Phase 3: 배포 (context/deploy.md 참조)
  → npm run build → az containerapp up
```

### 컨텍스트 관리

| 컨텍스트 | 파일 | Phase |
|----------|------|-------|
| 태스크 상태 | `prd.json` | Phase 1 |
| 누적 학습 | `progress.txt` | Phase 1 |
| 기능 명세 | `spec.md` | Phase 1 |
| 코드 상태 | `git history` | 전체 |
| 리서치 규칙 | `context/research.md` | Phase 1 (system prompt) |
| 테스트 규칙 | `context/testing.md` | Phase 1, 2 (system prompt) |
| E2E 규칙 | `context/e2e.md` | Phase 2 (system prompt) |
| 배포 규칙 | `context/deploy.md` | Phase 3 |

### 태스크 실행 시 필수 규칙

1. `progress.txt`의 Codebase Patterns 섹션을 먼저 읽는다
2. `prd.json`에서 현재 태스크의 acceptance criteria를 확인한다
3. **리서치 서브에이전트를 먼저 디스패치**한다 (context/research.md 참조)
4. `skills/subagent-driven-development/SKILL.md`의 프로세스를 따른다
5. **Spec review를 통과하기 전에 code quality review를 시작하지 않는다**
6. **모든 테스트는 계약 테스트 + 스모크 테스트** (context/testing.md 참조)
7. **verification-before-completion을 따른다** — 테스트를 실행하지 않고 "통과" 주장 금지
8. 모든 단계 통과 시 `TASK_PASS`, 실패 시 `TASK_FAIL: [사유]` 출력

### progress.txt 형식

```markdown
## Codebase Patterns
- [범용 패턴만 기록]

## YYYY-MM-DD HH:MM — US-001
- 구현 내용
- 변경 파일
- Learnings for future iterations:
  - [다음 이터레이션이 알아야 할 것]
---
```

## 품질 기준

- TypeScript strict mode (any 타입 금지)
- TDD: 테스트 먼저, 구현은 테스트 통과를 위한 최소한만
- 커밋 전 반드시: `npm run typecheck && npm run lint && npm test`

## 프론트엔드 구현

프론트엔드(UI/UX) 태스크는 반드시 **ui-ux-pro-max** 스킬을 사용한다.
UI 컴포넌트는 **21st.dev Magic MCP**로 생성한다 (`/ui` 명령).

### UI 품질 기준 (팬시해야 함)

구현 전 한국어 서비스 UI best practice를 리서치할 것 (토스, 당근, 카카오 참고).

- **폰트**: Pretendard. 본문 16px, 제목 24~32px, 캡션 13px
- **폰트 웨이트**: 제목 semibold(600), 본문 regular(400), 강조 medium(500)
- **행간**: 본문 1.6~1.8, 제목 1.3
- **화면 전환**: fade + slide, 200~300ms, ease-out
- **카드**: rounded-xl(12~16px), shadow-sm~md, hover 효과
- **스페이싱**: 4px 단위 일관성
- **버튼**: 최소 44x44px 터치 영역, disabled/loading 상태 명확
- **반응형**: 375px 모바일에서 정상
- **빈 상태/로딩**: 스켈레톤 또는 스피너, 빈 상태 가이드 메시지

## 브라우저 테스트

프론트엔드 테스트, UI 검증, E2E 테스트는 **agent-browser CLI**를 사용한다.
사용법은 `agent-browser --help`로 확인.

- UI 변경이 포함된 태스크는 반드시 agent-browser로 브라우저에서 검증할 것
- `npm run dev`로 로컬 서버를 띄운 후 agent-browser로 접근
- 스크린샷 캡처, DOM 인터랙션, 콘솔 에러 확인 모두 agent-browser로 수행
- acceptance criteria에 "브라우저에서 확인" 항목이 있으면 agent-browser 검증 필수
- 모든 유저 스토리에 대해 빠짐없이 테스트 (하나도 스킵 금지)

## Build & Test

```bash
npm run dev          # 개발 서버
npm run build        # 빌드
npm run typecheck    # 타입 체크
npm run lint         # 린트
npm test             # 테스트 (계약 + 유닛)
npm run test:smoke   # 스모크 테스트 (.env.local 필요, 없으면 자동 스킵)
```

## 중간 파일 (런타임)

Ralph Loop 실행 시 생성되는 중간 파일. 전부 `.ralph/` 아래 (gitignored).

| 파일 | 생성 시점 | 소비 시점 | 형식 |
|------|----------|----------|------|
| `.ralph/system-prompt.md` | Phase 1 시작 | 매 태스크 claude 호출 시 `--append-system-prompt-file` | markdown |
| `.ralph/e2e-prompt.md` | Phase 2 시작 | E2E claude 호출 시 `--append-system-prompt-file` | markdown |
| `.ralph/e2e-results.json` | 매 E2E 실행 후 | bash가 jq로 파싱 → 배포 게이트 | JSON |

## 영속 파일

| 파일 | 누가 쓰나 | 누가 읽나 | 용도 |
|------|----------|----------|------|
| `prd.json` | bash (passes 업데이트) | Claude (태스크 확인), bash (루프 제어) | 태스크 상태 |
| `progress.txt` | Claude (학습 기록) | Claude (다음 태스크 시 Codebase Patterns 먼저) | 누적 학습 |
| `spec.md` | 사람 (사전 작성) | Claude (전체 맥락) | 기능 명세 |

## 모델 + 인프라 (절대 변경 금지)

Ralph Loop 서브에이전트: `claude-opus-4-6`

### 제품 런타임 AI 모델 (spec.md에 정의)

| 용도 | 모델 ID (정확히 이것만) | Provider |
|------|----------------------|----------|
| 메인 에이전트 | `google/gemini-3-flash-preview` | OpenRouter |
| 시뮬레이션 생성 + 코멘트 | Cerebras GLM 4.7 | Cerebras |
| 시뮬레이션 평가 | `google/gemini-3.1-pro-preview` | OpenRouter |

### 인프라 고정 (다른 것 사용 금지)

| 항목 | 사용 | 금지 |
|------|------|------|
| UI 컴포넌트 | 21st.dev Magic MCP | shadcn/ui 직접 설치, 수동 컴포넌트 |
| 스타일 | Tailwind CSS | CSS modules, styled-components |
| DB | SQLite + Drizzle ORM | Prisma, TypeORM |
| AI SDK | Vercel AI SDK (`ai`) | LangChain, 직접 fetch |
| AI Provider | OpenRouter + Cerebras | 직접 Google/Anthropic API |
| 브라우저 테스트 | agent-browser | Playwright, Cypress |

코드 리뷰 시 위 목록과 다른 모델명/라이브러리가 사용되면 **즉시 reject**.
