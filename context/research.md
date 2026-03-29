# Research Context

## 구현 전 리서치 규칙

모든 태스크를 구현하기 전에, 먼저 **리서치 서브에이전트를 디스패치**하여 best practice를 조사한다.

### 언제 리서치하나

매 태스크의 구현 단계(implementer subagent 디스패치) 전에:

1. **먼저 `progress.txt`의 Codebase Patterns 섹션을 읽는다** — 이전 태스크에서 이미 발견한 패턴/best practice 확인
2. 해당 태스크에서 사용하는 기술/패턴에 대해 리서치 서브에이전트 디스패치
3. 리서치 결과를 implementer의 context에 포함
4. 리서치 없이 구현에 들어가지 말 것

### 리서치 서브에이전트 프롬프트 템플릿

```
Agent(
  description: "Research best practices for [topic]",
  prompt: |
    Research best practices for implementing [specific feature/pattern].

    ## What to Research
    - [기술 A]의 권장 사용법
    - 일반적인 실수와 회피법
    - 최신 버전의 API 변경사항

    ## How to Research
    1. Context7 MCP로 라이브러리 문서 조회 (hallucination 방지)
    2. 프로젝트 내 resources/*.md에 문서 URL이 있으면 직접 fetch
    3. 코드베이스에서 기존 패턴 확인

    ## Output
    - 권장 패턴 (코드 예시 포함)
    - 피해야 할 안티패턴
    - 이 태스크에 적용할 구체적 권장사항
)
```

### 리서치 대상 예시

| 태스크 | 리서치 대상 |
|--------|-----------|
| US-001 프로젝트 초기화 | Next.js App Router + Tailwind 최신 설정법 |
| US-002 DB 스키마 | Drizzle ORM + SQLite best practices |
| US-003 AI Provider | Vercel AI SDK + OpenRouter + Cerebras 연동법 |
| US-006 채팅 엔드포인트 | Vercel AI SDK useChat + streamText + tool calling 패턴 |
| US-010 Simulate SSE | 병렬 streamText + SSE 멀티플렉싱 패턴 |
| US-014 파일 업로드 | FileReader + FormData + Vision API 패턴 |
| US-015~016 UI 개선 | 한국어 UI best practices, 폰트/타이포그래피, 화면 전환 애니메이션, 21st.dev 컴포넌트 활용법 |

### 리서치 도구 우선순위

1. **Context7 MCP** — 외부 라이브러리 문서 (Vercel AI SDK, Drizzle 등)
2. **resources/*.md** — 프로젝트 내장 문서 URL (Cerebras, 21st.dev 등)
3. **WebSearch/WebFetch** — 위 두 가지로 해결 안 될 때
4. **기존 코드베이스** — 이미 구현된 패턴 확인

### 리서치 결과 저장

리서치 결과 중 **범용 패턴**은 반드시 `progress.txt`의 Codebase Patterns 섹션에 추가:

```markdown
## Codebase Patterns
- Vercel AI SDK: streamText는 Route Handler에서 사용, useChat은 클라이언트
- Drizzle: push 명령어로 스키마 동기화, migrate는 프로덕션용
- OpenRouter: createOpenRouter()로 provider 생성, model ID는 "org/model" 형식
```

이렇게 하면 다음 태스크에서 같은 내용을 다시 리서치하지 않아도 된다.

### 리서치 결과 활용

리서치 결과는 implementer subagent의 Context 섹션에 주입:

```
Agent("Implement US-003", prompt: |
  ## Task
  [태스크 전문]

  ## Research Findings
  [리서치 서브에이전트가 찾은 best practices]

  ## Your Job
  위 리서치 결과를 따라 구현...
)
```
