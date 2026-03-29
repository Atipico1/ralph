# E2E Testing Context

## 목적

모든 유저 스토리의 acceptance criteria를 실제 브라우저에서 검증한다.
Phase 1(태스크 루프)에서 개별 태스크가 통과해도, 전체 플로우가 깨질 수 있으므로 E2E는 필수.

## 도구

- **agent-browser CLI**: 브라우저 자동화 (스크린샷, DOM 인터랙션, 콘솔 에러 확인)
  - 사용법: `agent-browser --help` 로 확인
  - **headful 모드로 실제 브라우저를 띄워서 테스트** (headless 아님)
  - 실제로 클릭, 입력, 스크롤, 파일 드래그앤드롭 등 유저 행동을 재현
  - 모든 E2E/스모크 테스트는 agent-browser CLI를 사용하여 실제 브라우저에서 검증
  - mock, stub, 시뮬레이션 절대 금지 — 실제 브라우저에서 실제 조작만
- **로컬 dev 서버**: `npm run dev` (백그라운드)

## E2E 테스트 흐름

```
1. npm run dev & (백그라운드 실행)
2. 서버 ready 대기 (localhost:3000 접근 가능할 때까지)
3. prd.json의 모든 유저 스토리에 대해:
   a. 해당 페이지로 agent-browser 네비게이션
   b. acceptance criteria 하나씩 검증
   c. 스크린샷 캡처 (증거)
   d. 브라우저 콘솔 에러 확인
4. 전체 플로우 통합 테스트:
   a. Landing → 입력 → Collect → 응답 반복 → Simulate → Deliver
   b. 수정 요청 → 재시뮬 → 새 결과
   c. 다운로드 확인
5. 서버 종료
```

## 검증 기준

### Screen 0 (Landing)
- 풀스크린 렌더링
- 텍스트 입력 + 시작 동작
- 최근 프로젝트 칩 표시
- 입력 후 /project/[id]로 redirect

### Screen 1 (Collect)
- 질문 하나씩 표시
- 입력 타입별 UI 렌더링 (choice, text, yesno)
- 선택지에 "기타" 옵션 존재
- 이전/건너뛰기 동작
- 클립보드 패널 업데이트
- 진행 바 업데이트

### Screen 2 (Simulate)
- 후보 카드 3개 표시
- 프로그레스 바 움직임
- 에이전트 코멘트 표시
- 완료 후 자동 전환

### Screen 3 (Deliver)
- 결과물 렌더링
- 근거 bullet 표시
- 저장 버튼 → 토스트
- 다운로드 버튼 → .md 파일
- 수정 요청 → 선택지 모달 → 재시뮬레이션
- 대안 접기/펼치기

### 공통
- 콘솔 에러 없음
- 모든 페이지 전환 시 깨지는 UI 없음
- 반응형 (모바일 뷰포트에서도 동작)

## 중간 파일

| 파일 | 용도 | 생성 시점 |
|------|------|----------|
| `.ralph/e2e-results.json` | 스토리별 pass/fail 결과 (bash가 파싱) | 매 E2E 실행 후 |

## 출력 규칙

### 1. 구조화된 결과 JSON (필수)

테스트 완료 후 반드시 아래 형식의 JSON 블록을 출력에 포함:

```e2e-results
{
  "results": [
    { "id": "US-001", "pass": true, "detail": "" },
    { "id": "US-002", "pass": false, "detail": "choice 입력에서 기타 옵션 누락" }
  ]
}
```

- 모든 유저 스토리에 대해 항목이 있어야 함 (누락 금지)
- `pass`는 boolean, `detail`은 실패 시 구체적 사유
- bash가 이 JSON을 `.ralph/e2e-results.json`에 저장하여 배포 게이트로 사용

### 2. 최종 신호

모든 스토리 pass:
```
E2E_PASS
```

하나라도 fail:
```
E2E_FAIL
```

`E2E_PASS`를 출력하지 않을 것. 실제로 검증한 후에만.
