#!/bin/bash
# Ralph Loop — 태스크 실행 + E2E + 배포
# Usage: ./ralph.sh [--dry-run] [--no-deploy] [max_retries]

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD="$DIR/prd.json"
PROGRESS="$DIR/progress.txt"
SKILLS="$DIR/skills"
SYSTEM_PROMPT="$DIR/.ralph/system-prompt.md"
E2E_PROMPT="$DIR/.ralph/e2e-prompt.md"
CONTEXT="$DIR/context"

# ── 옵션 파싱 ───────────────────────────────────────────────
DRY_RUN=false
SKIP_DEPLOY=false
while [[ "${1:-}" == --* ]]; do
    case "$1" in
        --dry-run)    DRY_RUN=true; shift ;;
        --no-deploy)  SKIP_DEPLOY=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done
MAX_RETRIES="${1:-3}"

CLAUDE_OPTS=(
    --dangerously-skip-permissions
    --print
    --model claude-opus-4-6
    --append-system-prompt-file "$SYSTEM_PROMPT"
    --max-turns 1000
)

log() { echo -e "\n=== $1 ==="; }
dry() { [ "$DRY_RUN" = true ]; }

run_claude() {
    local prompt="$1"
    local attempt=0
    local max_attempts=2
    local output=""

    while [ "$attempt" -lt "$max_attempts" ]; do
        output=$(echo "$prompt" | claude "${CLAUDE_OPTS[@]}" 2>&1 | tee /dev/stderr) || true

        if [ -z "$output" ] || echo "$output" | grep -qi "error.*rate.limit\|connection.*reset\|timeout"; then
            attempt=$((attempt + 1))
            if [ "$attempt" -lt "$max_attempts" ]; then
                log "Claude 호출 실패 — ${attempt}/${max_attempts} 재시도 (30초 대기)"
                sleep 30
            fi
        else
            break
        fi
    done

    echo "$output"
}

# ── system prompt 빌드 ──────────────────────────────────────
mkdir -p "$DIR/.ralph"

if ! dry; then
cat > "$SYSTEM_PROMPT" <<SYSPROMPT_EOF
# Ralph Controller System Prompt

You are a controller executing tasks using subagent-driven development.
You MUST follow the skills below exactly. These are not suggestions — they are rules.
Use model claude-opus-4-6 for all subagents.

## Skills

$(cat "$SKILLS/subagent-driven-development/SKILL.md")

---

## Subagent Templates

### Implementer
$(cat "$SKILLS/subagent-driven-development/implementer-prompt.md")

### Spec Reviewer
$(cat "$SKILLS/subagent-driven-development/spec-reviewer-prompt.md")

### Code Quality Reviewer
$(cat "$SKILLS/subagent-driven-development/code-quality-reviewer-prompt.md")

### Code Reviewer Agent
$(cat "$SKILLS/requesting-code-review/code-reviewer.md")

---

## Quality Standards

### Test-Driven Development
$(cat "$SKILLS/test-driven-development/SKILL.md")

### Verification Before Completion
$(cat "$SKILLS/verification-before-completion/SKILL.md")

### Receiving Code Review
$(cat "$SKILLS/receiving-code-review/SKILL.md")

---

## Research Before Implementation

$(cat "$CONTEXT/research.md")

---

## Testing Standards

$(cat "$CONTEXT/testing.md")

---

## Task Execution Protocol

For each task, follow this exact sequence:

1. Read progress.txt (Codebase Patterns section first)
2. Read spec.md AND spec-remain.md for full context

3. **Dispatch research subagent** (BEFORE implementation)
   - Research best practices for technologies used in this task
   - Use Context7 MCP for library docs, resources/*.md for project docs
   - Pass findings to implementer

4. **Dispatch implementer subagent** (use Implementer template)
   - Include research findings in Context section
   - Fill [placeholders] with actual task details + context from spec/progress
   - DONE → Step 5 | BLOCKED → TASK_FAIL | NEEDS_CONTEXT → provide and retry

5. **Dispatch spec reviewer subagent** (use Spec Reviewer template)
   - Include acceptance criteria + implementer report
   - SPEC_FAIL → implementer fixes → re-review (max 2 rounds)

6. **Dispatch code quality reviewer subagent** (use Code Reviewer template)
   - Include git diff + requirements
   - DO NOT start before spec review passes
   - QUALITY_FAIL → fix → re-review (max 2 rounds)
   - **INFRA COMPLIANCE CHECK (반드시 포함):**
     모델명/라이브러리가 아래와 정확히 일치하는지 확인. 다르면 QUALITY_FAIL.
     - AI 모델: google/gemini-3-flash-preview (메인), Cerebras GLM 4.7 (시뮬레이션), google/gemini-3.1-pro-preview (평가)
     - UI 컴포넌트: 21st.dev Magic MCP만 사용 (shadcn/ui 직접 설치 금지)
     - 스타일: Tailwind CSS만 (CSS modules, styled-components 금지)
     - DB: SQLite + Drizzle ORM만 (Prisma, TypeORM 금지)
     - AI SDK: Vercel AI SDK만 (LangChain, 직접 fetch 금지)
     - Provider: OpenRouter + Cerebras만 (직접 Google/Anthropic API 호출 금지)
     - 브라우저 테스트: agent-browser만 (Playwright, Cypress 금지)
   - **UI QUALITY CHECK (프론트엔드 태스크 시 반드시):**
     - 폰트: Pretendard, 본문 16px, 제목 24~32px
     - 화면 전환 애니메이션 있는지 (fade/slide, 200~300ms)
     - 카드 rounded-xl + shadow + hover 효과
     - 버튼 최소 44x44px 터치 영역, disabled/loading 상태
     - 한국어 UI best practice 적용됐는지 (토스/당근/카카오 스타일)
     - 팬시하지 않으면 QUALITY_FAIL

7. **Run tests** (follow verification-before-completion + testing standards)
   - npm run typecheck && npm run lint && npm test
   - Tests MUST include contract tests + smoke tests (see Testing Standards)
   - Failure → dispatch fix subagent → retest (max 3 rounds)
   - NO completion claims without running the actual commands

8. **Commit** — git add -A && git commit

9. Append learnings to progress.txt

OUTPUT exactly one of:
  TASK_PASS
  TASK_FAIL: [reason]
SYSPROMPT_EOF

log "System prompt built ($(wc -c < "$SYSTEM_PROMPT") bytes)"
fi

# ── Init ─────────────────────────────────────────────────────
[ -f "$PROGRESS" ] || echo -e "# Progress\nStarted: $(date)\n---" > "$PROGRESS"
if [ ! -f "$PRD" ]; then
    echo "ERROR: prd.json not found. Create it first."
    exit 1
fi

# ── Dry Run ──────────────────────────────────────────────────
if dry; then
    log "DRY RUN"
    TOTAL=$(jq '.userStories | length' "$PRD")
    PENDING=$(jq '[.userStories[] | select(.passes != true)] | length' "$PRD")
    echo "총 태스크: $TOTAL (남은: $PENDING)"
    for idx in $(seq 0 $((TOTAL - 1))); do
        ID=$(jq -r ".userStories[$idx].id" "$PRD")
        TITLE=$(jq -r ".userStories[$idx].title" "$PRD")
        PASSES=$(jq -r ".userStories[$idx].passes" "$PRD")
        [ "$PASSES" = "true" ] && echo "  ✓ $ID: $TITLE" || echo "  → $ID: $TITLE"
    done
    exit 0
fi

# ── Phase 1: 태스크 루프 ────────────────────────────────────
TOTAL=$(jq '.userStories | length' "$PRD")
log "Phase 1 — 태스크 루프 ($TOTAL tasks)"

for idx in $(seq 0 $((TOTAL - 1))); do
    PASSES=$(jq -r ".userStories[$idx].passes" "$PRD")
    [ "$PASSES" = "true" ] && continue

    STORY_ID=$(jq -r ".userStories[$idx].id" "$PRD")
    STORY_TITLE=$(jq -r ".userStories[$idx].title" "$PRD")
    STORY=$(jq ".userStories[$idx]" "$PRD")

    log "Task $STORY_ID: $STORY_TITLE"

    TASK_DONE=false
    for task_attempt in $(seq 1 "$MAX_RETRIES"); do
        OUTPUT=$(run_claude "Execute this task. Commit message: feat: $STORY_ID - $STORY_TITLE

$STORY")

        if echo "$OUTPUT" | grep -q "TASK_PASS"; then
            jq ".userStories[$idx].passes = true" "$PRD" > "$PRD.tmp" && mv "$PRD.tmp" "$PRD"
            echo -e "\n## $(date '+%m-%d %H:%M') $STORY_ID DONE\n---" >> "$PROGRESS"
            echo "$STORY_ID done."
            TASK_DONE=true
            break
        fi

        echo "$STORY_ID FAILED (attempt $task_attempt/$MAX_RETRIES)."

        if [ "$task_attempt" -lt "$MAX_RETRIES" ]; then
            # 실패 시 Claude에게 에러 넘겨서 수정 후 재시도
            FAIL_REASON=$(echo "$OUTPUT" | grep -A 5 "TASK_FAIL" || echo "unknown failure")
            log "Claude에게 수정 위임 ($task_attempt/$MAX_RETRIES)"
            run_claude "Previous attempt to implement $STORY_ID failed:

$FAIL_REASON

Read progress.txt for context. Fix the issue and try again.
Output TASK_PASS when done, TASK_FAIL: [reason] if still blocked."
        fi
    done

    if [ "$TASK_DONE" = false ]; then
        echo -e "\n## $(date '+%m-%d %H:%M') $STORY_ID FAILED ($MAX_RETRIES attempts)\n---" >> "$PROGRESS"
        git checkout . 2>/dev/null || true
        log "WARNING: $STORY_ID failed after $MAX_RETRIES attempts. Skipping to next task."
    fi
done

REMAINING=$(jq '[.userStories[] | select(.passes != true)] | length' "$PRD")
if [ "$REMAINING" -gt 0 ]; then
    log "WARNING: Phase 1 — $REMAINING tasks still remaining. Continuing to Phase 2."
fi

# ── Phase 2: E2E ────────────────────────────────────────────
log "Phase 2 — E2E 검증"

E2E_RESULTS="$DIR/.ralph/e2e-results-remain.json"

cat > "$E2E_PROMPT" <<E2E_EOF
# E2E Tester System Prompt

$(cat "$CONTEXT/e2e.md")

---

$(cat "$CONTEXT/testing.md")

---

## 추가 검증 사항 (남은 태스크)

- 파일 업로드 (이미지/PDF) 동작 확인
- choice 선택 → 확인 버튼 UX
- 홈 버튼 네비게이션 + 확인 다이얼로그
- 전체 플로우가 1분 내에 완료 가능한지 체감 확인

## 성능 기준

전체 유저 플로우 (Landing → Collect → Simulate → Deliver)가 1분 이내에 완료되어야 한다.
각 단계별 목표:
- Landing → Collect 진입: 3초 이내
- Collect 질문 생성 (각 질문): 3초 이내
- Simulate 후보 3개 생성: 30초 이내
- Simulate 평가: 5초 이내
- Deliver 렌더링: 즉시

## E2E 결과 출력 형식

\`\`\`e2e-results
{
  "results": [
    { "id": "US-014", "pass": true, "detail": "" },
    { "id": "US-015", "pass": false, "detail": "..." }
  ]
}
\`\`\`

E2E_PASS 또는 E2E_FAIL
E2E_EOF

# 현재 태스크 + 완료된 v1 태스크 전부 검증 (회귀 체크)
ALL_STORIES=$(jq '[.userStories[] | {id, title, acceptanceCriteria}]' "$PRD")
ORIG_STORIES="[]"
[ -f "$DIR/archive/prd-v1.json" ] && ORIG_STORIES=$(jq '[.userStories[] | {id, title, acceptanceCriteria}]' "$DIR/archive/prd-v1.json")

E2E_CLAUDE_OPTS=(
    --dangerously-skip-permissions
    --print
    --model claude-opus-4-6
    --append-system-prompt-file "$E2E_PROMPT"
    --max-turns 1000
)

run_e2e() {
    local prompt="$1"
    local output
    output=$(echo "$prompt" | claude "${E2E_CLAUDE_OPTS[@]}" 2>&1 | tee /dev/stderr) || true
    echo "$output" | sed -n '/```e2e-results/,/```/p' | sed '1d;$d' > "$E2E_RESULTS" 2>/dev/null || true
    echo "$output"
}

E2E_OUTPUT=$(run_e2e "Verify ALL user stories (both original and new).

## New Stories (US-014~018)
$ALL_STORIES

## Original Stories (회귀 체크)
$ORIG_STORIES")

check_e2e_all_pass() {
    [ -f "$E2E_RESULTS" ] && [ "$(jq '[.results[] | select(.pass == false)] | length' "$E2E_RESULTS" 2>/dev/null || echo 999)" -eq 0 ]
}

if check_e2e_all_pass; then
    log "Phase 2 PASS"
else
    for retry in $(seq 1 "$MAX_RETRIES"); do
        FAILURES=$(jq '[.results[] | select(.pass == false)]' "$E2E_RESULTS" 2>/dev/null || echo "[]")
        log "E2E Fix $retry/$MAX_RETRIES"
        run_claude "Fix E2E failures: $FAILURES"
        E2E_OUTPUT=$(run_e2e "Re-verify ALL stories after fixes.
## New: $ALL_STORIES
## Original: $ORIG_STORIES")
        check_e2e_all_pass && break
        if [ "$retry" -eq "$MAX_RETRIES" ]; then
            FINAL_FAILURES=$(jq -r '.results[] | select(.pass == false) | "  ✗ \(.id): \(.detail)"' "$E2E_RESULTS" 2>/dev/null || echo "  (결과 파싱 불가)")
            log "WARNING: E2E — $MAX_RETRIES회 시도 후에도 실패 항목 있음. 배포 단계로 계속 진행."
            echo "$FINAL_FAILURES"
        fi
    done
fi

# ── Phase 3: 배포 (Claude가 에러 수정) ──────────────────────
if [ "$SKIP_DEPLOY" = true ]; then
    log "배포 스킵 (--no-deploy)"
    log "Ralph Loop 완료 (배포 제외)"
    exit 0
fi

ENV_FILE="$DIR/.env.local"
if [ ! -f "$ENV_FILE" ]; then
    log "WARNING: .env.local not found — 배포 스킵"
    log "Ralph Loop 완료 (배포 제외)"
    exit 0
fi

parse_env_vars() {
    local vars=""
    while IFS='=' read -r key value; do
        [[ -z "$key" || "$key" == \#* ]] && continue
        [ "$key" = "DATABASE_PATH" ] && value="/app/data/local.db"
        vars="$vars $key=$value"
    done < "$ENV_FILE"
    grep -q "^DATABASE_PATH=" "$ENV_FILE" || vars="$vars DATABASE_PATH=/app/data/local.db"
    echo "$vars"
}

for deploy_attempt in $(seq 1 "$MAX_RETRIES"); do
    log "Phase 3 — 배포 (시도 $deploy_attempt/$MAX_RETRIES)"

    # 빌드
    BUILD_LOG=$(npm run build 2>&1) || true
    if echo "$BUILD_LOG" | grep -q "exited with code: 1\|Build error\|ELIFECYCLE"; then
        log "빌드 실패 — Claude에게 수정 위임"
        run_claude "Build failed. Fix the build error and commit.

## Build Log (last 50 lines)
$(echo "$BUILD_LOG" | tail -50)

## Instructions
1. Read the error carefully
2. Fix the root cause (check next.config.ts, imports, native modules)
3. Run npm run build to verify
4. Commit: git add -A && git commit -m 'fix: build error (deploy attempt $deploy_attempt)'
5. Output TASK_PASS when build succeeds"
        continue
    fi

    # 배포
    DEPLOY_LOG=$(az containerapp up --name ralph-app --resource-group anymorph-rg-kr --source . 2>&1) || true
    if echo "$DEPLOY_LOG" | grep -qi "error\|failed\|unauthorized"; then
        log "az containerapp up 실패 — Claude에게 수정 위임"
        run_claude "Azure deployment failed. Diagnose and fix.

## Deploy Log
$(echo "$DEPLOY_LOG" | tail -30)

## Instructions
1. Analyze the deployment error
2. Common issues: Dockerfile, native modules (alpine), env vars, resource group
3. Fix Dockerfile or config if needed
4. Commit: git add -A && git commit -m 'fix: deploy config (attempt $deploy_attempt)'
5. Output TASK_PASS when fixed"
        continue
    fi

    # 환경변수 설정
    ENV_VARS=$(parse_env_vars)
    ENV_LOG=$(az containerapp update --name ralph-app --resource-group anymorph-rg-kr --set-env-vars $ENV_VARS 2>&1) || true
    if echo "$ENV_LOG" | grep -qi "error\|failed"; then
        log "환경변수 설정 실패 — Claude에게 위임"
        run_claude "Azure env var update failed: $(echo "$ENV_LOG" | tail -10)
Fix and output TASK_PASS."
        continue
    fi

    log "배포 성공"
    break
done

# ── Phase 4: 배포 검증 (Claude가 수정 루프) ──────────────────
APP_URL=$(az containerapp show --name ralph-app --resource-group anymorph-rg-kr --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null)
[ -z "$APP_URL" ] && { log "앱 URL 추출 실패 — 배포 검증 스킵"; exit 0; }
APP_URL="https://$APP_URL"
log "Phase 4 — 배포 검증 ($APP_URL)"

sleep 15  # 배포 안정화 대기

for verify_attempt in $(seq 1 "$MAX_RETRIES"); do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" --max-time 30 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" != "200" ]; then
        log "HTTP $HTTP_STATUS — Claude에게 수정 위임 ($verify_attempt/$MAX_RETRIES)"
        run_claude "Production health check failed. HTTP $HTTP_STATUS at $APP_URL.

## Instructions
1. Check common issues: env vars missing, DB path, module compatibility
2. Fix code if needed
3. Rebuild: npm run build
4. Output TASK_PASS when ready for redeploy"

        npm run build 2>&1 || true
        az containerapp up --name ralph-app --resource-group anymorph-rg-kr --source . 2>&1 || true
        sleep 15
        continue
    fi

    echo "HTTP 200 OK"

    DEPLOY_OUTPUT=$(echo "Verify $APP_URL with agent-browser.
1. Open landing page — verify greeting text and input
2. Create test project with '테스트 자기소개서'
3. Verify Collect phase starts (first question appears)
4. Check console for errors
Output DEPLOY_PASS or DEPLOY_FAIL: [issues]" \
    | claude "${E2E_CLAUDE_OPTS[@]}" 2>&1 | tee /dev/stderr) || true

    if echo "$DEPLOY_OUTPUT" | grep -q "DEPLOY_PASS"; then
        log "Phase 4 PASS — 프로덕션 검증 통과"
        break
    fi

    if [ "$verify_attempt" -eq "$MAX_RETRIES" ]; then
        log "WARNING: Phase 4 — 프로덕션 검증 $MAX_RETRIES회 실패. 수동 확인 필요."
        break
    fi

    log "프로덕션 검증 실패 — Claude에게 수정 위임 ($verify_attempt/$MAX_RETRIES)"
    FAILURES=$(echo "$DEPLOY_OUTPUT" | grep -A 20 "DEPLOY_FAIL" || echo "unknown")
    run_claude "Production verification failed at $APP_URL.
## Failures
$FAILURES
Read progress.txt for context. Fix, commit, output TASK_PASS."

    npm run build 2>&1 || true
    az containerapp up --name ralph-app --resource-group anymorph-rg-kr --source . 2>&1 || true
    sleep 15
done

log "Ralph Remain 전체 완료 ✓"
