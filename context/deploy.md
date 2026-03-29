# Deploy Context

## 배포 대상

Azure Container Apps (infra.md 참조)

- 리소스 그룹: `anymorph-rg-kr`
- 앱 이름: `ralph-app`
- Dockerfile: 프로젝트 루트의 Dockerfile 사용

## 배포 전 체크리스트

1. **빌드 성공**: `npm run build` exit 0
2. **테스트 통과**: `npm run typecheck && npm run lint && npm test`
3. **E2E 통과**: Phase 2 완료
4. **Dockerfile 확인**: standalone 빌드 + SQLite 바이너리 포함
5. **환경변수**: 배포 시 OPENROUTER_API_KEY, CEREBRAS_API_KEY, FIRECRAWL_API_KEY, DATABASE_PATH 설정 필요

## 배포 명령

```bash
az containerapp up \
  --name ralph-app \
  --resource-group anymorph-rg-kr \
  --source .
```

## 배포 후 검증

배포 완료 후 앱 URL에 접속하여:
1. 랜딩 페이지 렌더링 확인
2. 프로젝트 생성 → Collect → Simulate → Deliver 한 사이클 확인
3. 콘솔 에러 없음

## next.config.ts 필수 설정

```typescript
output: "standalone"
```

## 환경변수 설정 (배포 후)

```bash
az containerapp update \
  --name ralph-app \
  --resource-group anymorph-rg-kr \
  --set-env-vars \
    OPENROUTER_API_KEY=... \
    CEREBRAS_API_KEY=... \
    FIRECRAWL_API_KEY=... \
    DATABASE_PATH=/app/data/local.db
```
