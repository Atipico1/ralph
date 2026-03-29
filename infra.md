# Ralph Infrastructure

## Tech Stack

| Layer | Choice | Note |
|-------|--------|------|
| Framework | Next.js (App Router) | fullstack, AGENTS.md 자동 생성 |
| Language | TypeScript | |
| DB | SQLite (better-sqlite3) | 로컬 파일 `local.db` |
| ORM | Drizzle ORM | SQLite 드라이버, 마이그레이션 간단 |
| UI 컴포넌트 | 21st.dev Magic MCP | `/ui` 명령으로 컴포넌트 생성 |
| 스타일링 | Tailwind CSS | 21st.dev 컴포넌트와 호환 |
| 브라우저 자동화 | agent-browser CLI | 스크린샷 캡처, UI 인터랙션 |
| UI 검증 | 스크린샷 + Claude Vision | 시각적 깨짐 자동 탐지 |

## 환경

- 로컬: `next dev` + `./local.db`
- 배포: Azure Container Apps + `/app/data/local.db`
- DB 파일 gitignore 처리

## 배포 (Azure Container Apps)

- 리소스 그룹: `anymorph-rg-kr`
- `next.config.ts`에 `output: "standalone"` 설정
- DB 경로: 환경변수 `DATABASE_PATH`로 분리
- SQLite 로컬 파일시스템 → CIFS 문제 없음 (App Service와 다름)
- DB 영구 보존 필요 시 Azure Files 볼륨 마운트

```bash
# 한방 배포 (Dockerfile 자동 감지 → 빌드 → 배포)
az containerapp up \
  --name ralph-app \
  --resource-group anymorph-rg-kr \
  --source .

# DB 영구 보존이 필요하면 Azure Files 볼륨 마운트
az containerapp update \
  --name ralph-app \
  --resource-group anymorph-rg-kr \
  --set-env-vars DATABASE_PATH="/app/data/local.db"
```

## 결정 사항

- 인증: 없음
- 도메인: 필요 시 az cli로 커스텀 도메인 추가 (`az containerapp hostname add`)
- 환경변수: `.env.local`로 로컬 관리

## DB 관리

- Drizzle ORM으로 스키마 정의 (`src/db/schema.ts`)
- `better-sqlite3`로 직접 파일 접근
- 마이그레이션: `drizzle-kit push` (로컬이므로 push로 충분)

## MCP 서버

```json
{
  "21st-dev-magic": {
    "command": "npx",
    "args": ["-y", "@21st-dev/magic@latest"],
    "env": { "API_KEY": "..." }
  }
}
```

## Ralph Loop 워크플로우

```
프롬프트 입력
  → Claude가 코드 작성 (Next.js + SQLite)
  → 21st.dev로 UI 컴포넌트 가져오기
  → next dev로 실행
  → 브라우저 자동화로 스크린샷 캡처
  → Claude Vision으로 UI 검증
  → 문제 있으면 자동 수정 → 반복
```
