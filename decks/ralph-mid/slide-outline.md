# Ralph — 랄프톤 서울 중간발표 (5분)

## Slide 1: 표지
- 프로젝트명: **Ralph**
- 부제: 최소한의 질문으로, 최대한의 시뮬레이션, 최고의 결과물
- 팀명: 엑셀 팡션? 사용하지 마세요
- 팀원: 박성일
- GitHub: github.com/Atipico1/ralph

## Slide 2: 문제 — "AI 앞에서 머리가 하얘지는 사람들"
- 대상: 반복적인 문서작업/리서치가 필요한 일반인
- 핵심 문제: ChatGPT에 뭘 어떻게 물어야 할지 모름
- "자기소개서 써줘" → 쓸 수 없는 결과물 → 다시 시도 → 반복
- 적절한 컨텍스트를 제공하는 법을 모르기 때문
- 이 문제는 문서를 쓸 때 **매번** 발생

## Slide 3: 사례 — "여자친구의 자기소개서"
- 여자친구가 취업준비 중 자기소개서를 쓸 때
- ChatGPT에 "자기소개서 써줘"만 반복
- 경력, 강점, 지원 직무, 회사 특성 같은 컨텍스트를 넣어줘야 하는데 방법을 모름
- 결과: 뻔하고 쓸 수 없는 결과물만 계속 나옴
- 문제의 본질: **최적의 워크플로우를 모름**

## Slide 4: 솔루션 — Ralph
- 한 문장: **유저는 답만 하면, 에이전트가 최선의 결과물을 만들어줌**
- 유저가 프롬프트를 짜는 게 아니라, AI가 인터뷰를 주도해서 컨텍스트를 자동 수집
- 범용 도메인: 자기소개서, 사업계획서, 여행계획, 무엇이든
- 스크린샷: 랜딩 페이지 (assets/01-landing.png)

## Slide 5: 워크플로우 — Collect → Simulate → Deliver
- **Collect (상담)**: 에이전트가 질문, 유저는 답만 (Typeform 스타일)
  - 도메인 자동 분류 → 전문가 페르소나 적용
  - 질문/선택지 매번 동적 생성
  - Agentic 웹 리서치로 맥락 강화 (ReAct 루프)
  - 스크린샷: Collect 화면 (assets/02-collect.png)
- **Simulate (검토)**: 3개 후보 병렬 생성 → AI 평가 → 자동 선택
  - Cerebras로 초고속 생성 (~1초)
  - 혼잣말 코멘트로 사고 과정 실시간 표시
- **Deliver (결과)**: 최선의 결과물 + 근거 제시
  - 수정 요청 → 재시뮬레이션 가능
  - 스크린샷: Deliver 화면 (assets/05-deliver.png)

## Slide 6: 기술 스택 / AI 아키텍처
- Gemini Flash (OpenRouter): 도메인 분류, 컨텍스트 추출, 수정 옵션 생성
- Cerebras GLM 4.7: 초고속 병렬 후보 생성 (~1초/질문)
- Gemini Pro (OpenRouter): 도메인별 동적 평가 기준 생성 + 최선 선택
- Firecrawl + AI SDK: Agentic 웹 리서치 (search → reflect → search 반복)
- Vercel AI SDK: tool calling 기반 에이전트 오케스트레이션
- Next.js + SQLite(Drizzle ORM) + Tailwind CSS

## Slide 7: 나의 랄프 세팅
- `ralph.sh` — Bash 기반 자율 태스크 루프
- 워크플로우: prd.json에서 태스크 주입 → 리서치 서브에이전트 → 구현 → spec review → code review → 테스트 → 커밋
- 18개 유저 스토리를 정의 → Claude가 순서대로 자율 실행
- progress.txt에 누적 학습 → 다음 태스크에 패턴 재사용
- 계약 테스트 + 스모크 테스트로 품질 보장
- **핵심: 사람이 하나하나 시키지 않아도 돌아감**

## Slide 8: 현재 진행 상황
- US-001 ~ US-018 전체 구현 + E2E 검증 통과
- 175개 테스트 통과
- 핵심 루프 Collect → Simulate → Deliver 완전 동작
- Agentic 웹 검색 (ReAct 루프) 연동 완료
- 파일 업로드 (이미지/PDF/텍스트) 지원
- 수정 요청 → 재시뮬레이션 루프 동작
