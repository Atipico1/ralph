# Ralph — 남은 작업

이미 구현 완료된 US-001~013 이후, 추가로 필요한 작업들.

## 버그 수정

### BUG-001: JSON 파싱 에러 방어
- `src/app/project/[id]/page.tsx`에서 `JSON.parse(options)`에 try-catch 추가 ✓ (이미 수정됨)
- AI SDK `experimental_output`의 JSON 파싱 에러도 방어 필요
- `src/ai/collect.ts`에서 `NoObjectGeneratedError` 캐치 ✓ (이미 처리됨)

## 기능 추가

### US-014: 파일/이미지 업로드
- Collect 단계에서 `file` input_type 추가
- 드래그앤드롭 + 파일 선택 버튼 UI
- 파일 타입별 처리:
  - 이미지 (jpg/png/webp): 썸네일 미리보기 + Vision API 분석
  - PDF: 텍스트 추출 (pdf-parse)
  - 텍스트/문서: 내용 읽기
- `uploaded_files` 테이블 추가 (spec.md에 정의됨)
- `POST /api/projects/[id]/upload` 엔드포인트
- 추출/분석 결과를 collected_context에 반영
- acceptance criteria:
  - 이미지 업로드 → 썸네일 + 분석 텍스트 표시
  - PDF 업로드 → 텍스트 추출 성공
  - 업로드된 파일이 다음 질문 생성에 반영됨
  - 브라우저에서 드래그앤드롭 동작 확인 (cmux-browser)
  - Typecheck passes

### US-015: 선택지 UX 개선 — 선택 후 확인 버튼
- choice 입력에서 선택해도 즉시 다음 질문으로 넘어가지 않음
- 선택 상태를 유지하고, [확인] 버튼으로 명시적으로 다음 진행
- 선택 변경 가능 (확인 전에 다른 카드 클릭)
- "기타 (직접 입력)" 선택 시 텍스트 입력 필드 표시
- acceptance criteria:
  - choice 카드 선택 → 선택 상태 유지 (하이라이트)
  - 다른 카드 클릭 → 선택 변경
  - [확인] 버튼 클릭 시에만 다음 질문
  - "기타" 선택 → 텍스트 입력 필드 노출
  - 브라우저에서 확인 (cmux-browser)
  - Typecheck passes

### US-016: 홈으로 가기 + 네비게이션
- 모든 phase(collect/simulate/deliver)에서 홈으로 돌아가기 버튼
- 좌측 상단 또는 로고 영역에 홈 링크
- collect phase에서 뒤로 가기: 직전 질문으로 (이미 구현된 "← 이전"과 동일)
- deliver phase에서 뒤로 가기: simulate 결과 다시 보기 (phase는 변경 안 함, 읽기 전용)
- 홈으로 갈 때 진행 중인 작업이 있으면 확인 다이얼로그
- acceptance criteria:
  - 모든 화면에서 홈 버튼 표시
  - 홈 클릭 → "/" 로 이동
  - collect 중 홈 클릭 → "진행 중인 상담이 있습니다. 나가시겠습니까?" 확인
  - 브라우저에서 확인 (cmux-browser)
  - Typecheck passes

### US-017: Firecrawl 웹 검색 연동
- Collect: 유저 응답 기반 사전 조사 → 더 좋은 후속 질문
- Simulate: 후보 생성 전 리서치 → 근거 있는 결과물
- `src/ai/firecrawl.ts` 클라이언트 구현 (spec.md에 정의됨)
- FIRECRAWL_API_KEY 없으면 graceful skip
- acceptance criteria:
  - "여행지가 도쿄" 입력 시 → 다음 질문에 도쿄 관련 정보 반영
  - 시뮬레이션 결과에 웹 검색 출처 포함
  - API 키 없이도 앱 정상 동작 (검색 없이 진행)
  - 계약 테스트: Firecrawl 요청/응답 스키마 검증
  - 스모크 테스트: 실제 검색 호출 확인
  - Typecheck passes

## 품질 개선

### US-018: AI SDK JSON 안정성
- `experimental_output`에서 간헐적 JSON 파싱 에러 발생
- 모든 AI 호출에서 `NoObjectGeneratedError` + 일반 JSON 파싱 에러 방어
- fallback 응답 제공 (에러 시에도 앱이 죽지 않게)
- DB에 저장하기 전 JSON.stringify/parse 라운드트립 검증
