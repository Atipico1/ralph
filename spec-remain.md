# Ralph — 남은 작업

이미 구현 완료된 US-001~013 이후, 추가로 필요한 작업들.
`ralph-remain.sh`로 실행.

## US-014: 파일/이미지 업로드

### 구현 방식

파일 크기가 작으면 (< 5MB) 클라이언트에서 Base64로 읽어 처리. 큰 파일은 서버 업로드.

- **클라이언트 처리 (우선)**: FileReader로 읽어서 Base64 → API body에 포함
- **서버 처리 (fallback)**: FormData + `POST /api/projects/[id]/upload`로 서버에 저장

### 파일 타입별 처리

| 타입 | 처리 | context 활용 |
|------|------|-------------|
| 이미지 (jpg/png/webp/gif) | 클라이언트 썸네일 미리보기 + 서버에서 Vision API(Gemini Flash) 분석 | 분석 텍스트를 context에 주입 |
| PDF | 서버에서 pdf-parse로 텍스트 추출 | 추출 텍스트를 context에 주입 |
| 텍스트 (txt/md) | 클라이언트에서 FileReader.readAsText() | 내용을 context에 주입 |
| 문서 (docx) | 서버에서 mammoth로 텍스트 추출 | 추출 텍스트를 context에 주입 |
| 기타 | 파일명만 기록 | "유저가 [파일명] 파일을 첨부함"을 context에 |

### DB 변경

`uploaded_files` 테이블 추가 (spec.md에 정의됨).

### API

`POST /api/projects/[id]/upload`
- Body: FormData (`file` 필드)
- 처리: 파일 저장 → 타입별 분석/추출 → uploaded_files에 저장 → collected_context에 반영
- Response: `{ fileId, filename, extractedText?, analysis? }`

### Azure 배포 고려

- `uploads/` 디렉토리 → Azure Files 볼륨 마운트 필요 (or `/app/data/uploads/`)
- Dockerfile에 `pdf-parse`, `mammoth` 네이티브 의존성 포함 확인
- `serverExternalPackages`에 필요한 패키지 추가

### 테스트 시나리오

| # | 시나리오 | 입력 | 성공 조건 |
|---|---------|------|----------|
| T1 | JPG 이미지 업로드 | 아무 .jpg 파일 (< 5MB) | 썸네일 미리보기 표시 + 분석 텍스트 표시 + collected_context에 반영 |
| T2 | PNG 이미지 업로드 | .png 파일 | 위와 동일 |
| T3 | PDF 업로드 | 텍스트가 있는 .pdf | 텍스트 추출 성공 + "PDF 내용을 확인했습니다" 표시 + context 반영 |
| T4 | 텍스트 파일 업로드 | .txt 또는 .md | 내용 읽기 + context 반영 |
| T5 | 드래그앤드롭 | 파일을 드래그앤드롭 영역에 드롭 | 업로드 시작 + 결과 표시 |
| T6 | 파일 선택 버튼 | 클릭 → 파일 선택 다이얼로그 | 파일 선택 후 업로드 |
| T7 | 업로드 후 다음 질문 | 이미지 업로드 후 다음 질문 대기 | 다음 질문이 업로드 내용을 반영 |
| T8 | 대용량 파일 거부 | > 10MB 파일 | "10MB 이하 파일만 업로드 가능합니다" 에러 |
| T9 | 지원하지 않는 형식 | .exe, .zip 등 | 파일명만 기록 + 에이전트가 "파일을 확인했습니다" 정도 |

## US-015: 선택지 UX 개선

### 변경 사항

ChoiceInput 컴포넌트에서:
- 카드 클릭 → 즉시 submit ❌
- 카드 클릭 → 선택 상태(하이라이트) + [확인] 버튼 노출 ✓
- "기타" 카드 클릭 → 텍스트 입력 필드 노출 + [확인] 버튼

### 테스트 시나리오

| # | 시나리오 | 동작 | 성공 조건 |
|---|---------|------|----------|
| T1 | 카드 선택 | 카드 하나 클릭 | 선택 카드에 하이라이트(border/bg 변경) + [확인] 버튼 표시 |
| T2 | 선택 변경 | 다른 카드 클릭 | 이전 하이라이트 해제 + 새 카드 하이라이트 |
| T3 | 확인 클릭 | [확인] 클릭 | API 호출 + 다음 질문 전환 |
| T4 | 기타 선택 | "기타 (직접 입력)" 카드 클릭 | 텍스트 입력 필드 노출 |
| T5 | 기타 입력 후 확인 | 텍스트 입력 → [확인] | 입력한 텍스트로 API 호출 |
| T6 | 기타 → 일반 카드 | "기타" 선택 후 다른 카드 클릭 | 텍스트 필드 숨김 + 일반 카드 선택 |
| T7 | 확인 없이 대기 | 카드만 선택하고 가만히 있기 | 다음 질문으로 넘어가지 않음 |

## US-016: 홈으로 가기 + 네비게이션

### 구현 사항

- shared/Header.tsx 컴포넌트 — 모든 phase에서 표시
- 좌측: 홈 버튼 (Ralph 로고 또는 텍스트)
- collect phase에서 홈 클릭 → 확인 다이얼로그

### 테스트 시나리오

| # | 시나리오 | 동작 | 성공 조건 |
|---|---------|------|----------|
| T1 | Landing에서 헤더 | / 접속 | 헤더가 보이지 않거나 미니멀 (Landing은 풀스크린) |
| T2 | Collect에서 홈 | 홈 버튼 클릭 | "진행 중인 상담이 있습니다. 나가시겠습니까?" 다이얼로그 |
| T3 | 다이얼로그 취소 | "취소" 클릭 | 다이얼로그 닫힘 + 현재 페이지 유지 |
| T4 | 다이얼로그 확인 | "나가기" 클릭 | / 로 이동 |
| T5 | Simulate에서 홈 | 홈 버튼 클릭 | 바로 / 로 이동 (확인 없음) |
| T6 | Deliver에서 홈 | 홈 버튼 클릭 | 바로 / 로 이동 |
| T7 | 홈 이동 후 복귀 | 홈 → 최근 프로젝트 칩 클릭 | 해당 프로젝트의 현재 phase 표시 |

## US-017: Firecrawl 웹 검색 연동

### 구현 사항

`src/ai/firecrawl.ts` — spec.md에 정의된 클라이언트
- `firecrawlSearch(query)` → 검색 결과 5개
- `firecrawlScrape(url)` → 마크다운 추출

### 사용 위치

- `src/ai/collect.ts` — 유저 응답 후, 다음 질문 생성 전에 관련 정보 검색
- `src/ai/simulate.ts` — 후보 생성 전에 리서치

### 테스트 시나리오

| # | 시나리오 | 동작 | 성공 조건 |
|---|---------|------|----------|
| T1 | 여행 도메인 검색 | "여행지가 도쿄" 응답 | 다음 질문에 도쿄 관련 구체적 정보 반영 |
| T2 | 사업 도메인 검색 | "카페 창업" 응답 | 시뮬레이션에 시장 데이터 출처 포함 |
| T3 | API 키 없이 | FIRECRAWL_API_KEY 없는 상태 | 앱 정상 동작, 검색 없이 진행, 에러 없음 |
| T4 | 검색 실패 | Firecrawl API 에러 (rate limit 등) | graceful skip, 에러 없이 다음 단계 |
| T5 | 계약 테스트 | search 요청 스키마 | query, limit 필드 존재 확인 |
| T6 | 스모크 테스트 | firecrawlSearch("서울 여행") | results 배열 존재, 1개 이상 |

## US-018: AI SDK JSON 안정성 강화

### 구현 사항

모든 `generateText` + `experimental_output` 호출에 방어 레이어:
1. `NoObjectGeneratedError` catch → fallback 응답
2. `JSON.parse` 실패 시 → fallback 응답
3. DB 저장 전 `options` 필드 JSON 유효성 검증

### 테스트 시나리오

| # | 시나리오 | 동작 | 성공 조건 |
|---|---------|------|----------|
| T1 | 정상 응답 | AI가 올바른 JSON 반환 | 정상 처리 |
| T2 | 깨진 JSON | AI가 문법 오류 JSON 반환 | fallback 질문 표시, 앱 크래시 없음 |
| T3 | 빈 응답 | AI가 빈 응답 | fallback 질문 표시 |
| T4 | options 저장 | 올바른 options JSON | DB에 저장 + 페이지 로드 시 정상 파싱 |
| T5 | 깨진 options 로드 | DB에 깨진 JSON이 있는 경우 | 페이지 500 에러 없음, options null로 처리 |

## E2E 통합 테스트 시나리오 (agent-browser)

ralph-remain.sh Phase 2에서 실행. 모든 시나리오를 agent-browser CLI로 실제 브라우저에서 검증.
`agent-browser --help`로 사용법 확인.

### 전체 플로우 테스트

| # | 시나리오 | 성공 조건 |
|---|---------|----------|
| E1 | Landing → 입력 → Collect 진입 | 3초 이내 |
| E2 | Collect 5개 질문 응답 (choice + text + file 혼합) | 각 질문 전환 1초 이내 |
| E3 | 파일 업로드 (이미지) 후 다음 질문 | 업로드 + 분석 + 다음 질문까지 5초 이내 |
| E4 | choice에서 선택 → 변경 → 확인 | 즉시 넘어가지 않고 확인 클릭 시에만 전환 |
| E5 | Simulate 3개 후보 생성 완료 | 30초 이내 |
| E6 | Deliver 결과물 렌더링 + 근거 표시 | 즉시 |
| E7 | 수정 요청 → 선택지 → 재시뮬 → 새 결과 | 전체 40초 이내 |
| E8 | 다운로드 버튼 → .md 파일 | 파일 내용에 결과물 포함 |
| E9 | 홈 버튼 (collect에서) → 확인 다이얼로그 → 홈 | 다이얼로그 표시 + 홈 이동 |
| E10 | 홈 → 최근 프로젝트 클릭 → 복귀 | 해당 프로젝트의 현재 phase 표시 |
| E11 | 전체 플로우 (E1~E8) 1분 이내 완료 | Landing → Deliver까지 60초 이내 |
| E12 | 모든 화면에서 콘솔 에러 0건 | console.error 없음 |
| E13 | 모바일 뷰포트 (375px) | 모든 화면 깨지지 않음 |

### UI 품질 요구사항 (리뷰 시 반드시 체크)

모든 프론트엔드 태스크에서 아래 항목을 리서치 + 검증:

| 항목 | 기준 |
|------|------|
| **폰트** | Pretendard (한국어 최적화). 본문 16px, 제목 24~32px, 캡션 13px |
| **폰트 웨이트** | 제목 semibold(600), 본문 regular(400), 강조 medium(500) |
| **행간** | 본문 1.6~1.8, 제목 1.3 |
| **색상** | 주 액센트 1색 + 회색 스케일. 고대비. 버튼은 명확한 CTA |
| **화면 전환** | fade + slide 조합. duration 200~300ms. easing ease-out |
| **카드** | border-radius 12~16px, 적절한 그림자(shadow-sm~md), hover 효과 |
| **스페이싱** | 4px 단위 일관성 (Tailwind의 4/8/12/16/24/32/48) |
| **버튼** | 최소 터치 영역 44x44px, disabled 상태 명확, 로딩 상태 표시 |
| **반응형** | 모바일 375px에서 모든 UI 정상 |
| **빈 상태** | 데이터 없을 때 빈 상태 메시지 (회색 텍스트 + 가이드) |
| **로딩** | 스켈레톤 또는 스피너, 3초 이상이면 진행 메시지 |

리서치 시 한국어 서비스 UI 사례 (토스, 당근, 카카오) 참고하여 best practice 적용.
21st.dev Magic MCP로 컴포넌트 생성 시에도 위 기준 준수.

### 전체 루프 스모크 테스트 (필수)

질문 → 구체화 → 시뮬레이션 → 선택 → 최종 결과 → revision → 다시 루프가 **실제로** 돌아가는지 agent-browser로 E2E 검증. 특히 revision 후 재시뮬레이션이 정상 동작하는지 반드시 확인.

| # | 시나리오 | 성공 조건 |
|---|---------|----------|
| S1 | Landing → "자기소개서 써줘" 입력 | Collect phase 진입, 첫 질문 표시 |
| S2 | Collect 5개 질문 응답 (choice 2개 + text 2개 + file 1개) | 각 질문 전환, context 수집 |
| S3 | Collect 완료 → Simulate 자동 전환 | 후보 3개 카드 표시, 프로그레스 바 |
| S4 | Simulate 완료 → Deliver 자동 전환 | 최고 점수 후보 선택, 결과물 렌더링 |
| S5 | 수정 요청 클릭 → 선택지 모달 | 옵션 목록 + "기타" 표시 |
| S6 | 수정 옵션 선택 → 재시뮬레이션 | Simulate 화면 재진입, 후보 3개 재생성 (round 2) |
| S7 | 재시뮬 완료 → 새 Deliver | 새 결과물 표시, round 2 |
| S8 | 다운로드 | .md 파일 다운로드, 내용에 결과물 포함 |
| S9 | 전체 (S1~S8) 2분 이내 | 시간 측정 |

**S6이 가장 중요** — revision 후 phase가 simulate로 돌아가고 재시뮬이 완료되어 deliver에 새 결과가 나오는지.

### 회귀 테스트 (기존 US-001~013)

기존에 통과했던 모든 유저 스토리가 여전히 동작하는지 확인.
하나라도 깨지면 E2E_FAIL.
