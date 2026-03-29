#!/bin/bash
# Ralph Loop — bash가 태스크 루프를 강제, Claude가 skills 따라 실행
# Usage: ./ralph.sh [--dry-run] [max_retries]
#   --dry-run: 실제 실행 없이 전체 플로우 시뮬레이션

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

# ── Claude CLI 설정 ─────────────────────────────────────────
# --max-turns: 런어웨이 방지 (서브에이전트 포함 최대 턴 수)
# --dangerously-skip-permissions: 자동화 루프에서 필수 (--print 모드)
CLAUDE_OPTS=(
    --dangerously-skip-permissions
    --print
    --model claude-opus-4-6
    --append-system-prompt-file "$SYSTEM_PROMPT"
    --max-turns 1000
)

log() { echo -e "\n=== $1 ==="; }
dry() { [ "$DRY_RUN" = true ]; }

# ── 유틸: Claude 호출 + 크래시 복구 ─────────────────────────
run_claude() {
    local prompt="$1"
    local attempt=0
    local max_attempts=2
    local output=""

    while [ "$attempt" -lt "$max_attempts" ]; do
        output=$(echo "$prompt" | claude "${CLAUDE_OPTS[@]}" 2>&1 | tee /dev/stderr) || true

        # 빈 출력이나 에러면 재시도
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

# ── system prompt 빌드 (스킬 전부 주입) ──────────────────────
mkdir -p "$DIR/.ralph"

# dry run에서는 system prompt 빌드를 스킵 (파일 없을 수 있음)
if dry; then
    touch "$SYSTEM_PROMPT"
else
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
2. Read spec.md for full context

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
     - 브라우저 테스트: cmux-browser만 (Playwright, Cypress 금지)

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

fi # end of dry guard for system prompt build

if ! dry; then
    log "System prompt built ($(wc -c < "$SYSTEM_PROMPT") bytes)"
fi

# ── Init ─────────────────────────────────────────────────────
[ -f "$PROGRESS" ] || echo -e "# Progress\nStarted: $(date)\n---" > "$PROGRESS"
[ -f "$PRD" ] || { echo "ERROR: prd.json not found. Create it first."; exit 1; }

# ── Dry Run ──────────────────────────────────────────────────
if dry; then
    log "DRY RUN — 실제 실행 없이 플로우 검증"

    TOTAL=$(jq '.userStories | length' "$PRD")
    PENDING=$(jq '[.userStories[] | select(.passes != true)] | length' "$PRD")
    DONE=$(( TOTAL - PENDING ))

    echo "총 태스크: $TOTAL (완료: $DONE, 남은: $PENDING)"
    echo ""

    # 필수 파일 체크
    ERRORS=0
    echo "── 필수 파일 체크 ──"
    for f in "$PRD" "$DIR/spec.md" "$DIR/CLAUDE.md" "$DIR/infra.md"; do
        if [ -f "$f" ]; then
            echo "  ✓ $(basename "$f")"
        else
            echo "  ✗ $(basename "$f") — MISSING"
            ERRORS=$((ERRORS + 1))
        fi
    done

    # 스킬 파일 체크
    echo ""
    echo "── 스킬 파일 체크 ──"
    for f in \
        "$SKILLS/subagent-driven-development/SKILL.md" \
        "$SKILLS/subagent-driven-development/implementer-prompt.md" \
        "$SKILLS/subagent-driven-development/spec-reviewer-prompt.md" \
        "$SKILLS/subagent-driven-development/code-quality-reviewer-prompt.md" \
        "$SKILLS/requesting-code-review/code-reviewer.md" \
        "$SKILLS/test-driven-development/SKILL.md" \
        "$SKILLS/verification-before-completion/SKILL.md" \
        "$SKILLS/receiving-code-review/SKILL.md"; do
        if [ -f "$f" ]; then
            echo "  ✓ $(echo "$f" | sed "s|$DIR/||")"
        else
            echo "  ✗ $(echo "$f" | sed "s|$DIR/||") — MISSING"
            ERRORS=$((ERRORS + 1))
        fi
    done

    # context 파일 체크
    echo ""
    echo "── context 파일 체크 ──"
    for f in "$CONTEXT/research.md" "$CONTEXT/testing.md" "$CONTEXT/e2e.md" "$CONTEXT/deploy.md"; do
        if [ -f "$f" ]; then
            echo "  ✓ $(echo "$f" | sed "s|$DIR/||")"
        else
            echo "  ✗ $(echo "$f" | sed "s|$DIR/||") — MISSING"
            ERRORS=$((ERRORS + 1))
        fi
    done

    # 빌드/테스트 도구 체크
    echo ""
    echo "── 빌드 도구 체크 ──"
    for cmd in node npm npx jq claude az cmux; do
        if command -v "$cmd" &>/dev/null; then
            echo "  ✓ $cmd ($(command -v "$cmd"))"
        else
            echo "  ✗ $cmd — NOT FOUND"
            ERRORS=$((ERRORS + 1))
        fi
    done

    # package.json 스크립트 체크
    echo ""
    echo "── npm 스크립트 체크 ──"
    if [ -f "$DIR/package.json" ]; then
        for script in dev build typecheck lint test; do
            if jq -e ".scripts.\"$script\"" "$DIR/package.json" &>/dev/null; then
                echo "  ✓ npm run $script"
            else
                echo "  ✗ npm run $script — NOT DEFINED"
                ERRORS=$((ERRORS + 1))
            fi
        done
    else
        echo "  ✗ package.json — MISSING (프로젝트 미초기화)"
        ERRORS=$((ERRORS + 1))
    fi

    # Azure 배포 설정 체크
    echo ""
    echo "── Azure 배포 체크 ──"
    if command -v az &>/dev/null; then
        if az account show &>/dev/null 2>&1; then
            ACCOUNT=$(az account show --query name -o tsv 2>/dev/null)
            echo "  ✓ az 로그인됨 ($ACCOUNT)"
        else
            echo "  ✗ az 로그인 안 됨 (az login 필요)"
            ERRORS=$((ERRORS + 1))
        fi
        if az group show --name anymorph-rg-kr &>/dev/null 2>&1; then
            echo "  ✓ 리소스 그룹 anymorph-rg-kr 존재"
        else
            echo "  ⚠ 리소스 그룹 anymorph-rg-kr 확인 불가 (로그인 후 재확인)"
        fi
    else
        echo "  ✗ az CLI — NOT FOUND"
        ERRORS=$((ERRORS + 1))
    fi

    # Dockerfile 체크
    if [ -f "$DIR/Dockerfile" ]; then
        echo "  ✓ Dockerfile"
    else
        echo "  ✗ Dockerfile — MISSING"
        ERRORS=$((ERRORS + 1))
    fi

    # 태스크 순서 미리보기
    echo ""
    echo "── 실행 예정 태스크 ──"
    for idx in $(seq 0 $((TOTAL - 1))); do
        PASSES=$(jq -r ".userStories[$idx].passes" "$PRD")
        ID=$(jq -r ".userStories[$idx].id" "$PRD")
        TITLE=$(jq -r ".userStories[$idx].title" "$PRD")
        AC_COUNT=$(jq ".userStories[$idx].acceptanceCriteria | length" "$PRD" 2>/dev/null || echo "?")
        if [ "$PASSES" = "true" ]; then
            echo "  ✓ $ID: $TITLE (완료)"
        else
            echo "  → $ID: $TITLE (AC: ${AC_COUNT}개)"
        fi
    done

    # 전체 플로우 미리보기
    echo ""
    echo "── 전체 플로우 ──"
    echo "  1. 태스크 루프 (${PENDING}개)"
    echo "     리서치 → 구현 → spec review → code review → 테스트 → 커밋"
    echo "  2. E2E 검증"
    echo "     전체 유저 스토리 기반 cmux-browser 테스트"
    echo "  3. 배포"
    echo "     az containerapp up --name ralph-app --resource-group anymorph-rg-kr --source ."
    echo ""

    if [ "$ERRORS" -gt 0 ]; then
        echo "⚠ $ERRORS개 문제 발견. 위 항목 해결 후 실행하세요."
        exit 1
    else
        echo "✓ 모든 체크 통과. ./ralph.sh 로 실행하세요."
        exit 0
    fi
fi

# ══════════════════════════════════════════════════════════════
# Phase 1: 태스크 루프 (구현 → 리뷰 → 테스트 → 커밋)
# ══════════════════════════════════════════════════════════════
TOTAL=$(jq '.userStories | length' "$PRD")
log "Phase 1 — 태스크 루프 ($TOTAL tasks)"

for idx in $(seq 0 $((TOTAL - 1))); do
    PASSES=$(jq -r ".userStories[$idx].passes" "$PRD")
    [ "$PASSES" = "true" ] && continue

    STORY_ID=$(jq -r ".userStories[$idx].id" "$PRD")
    STORY_TITLE=$(jq -r ".userStories[$idx].title" "$PRD")
    STORY=$(jq ".userStories[$idx]" "$PRD")

    log "Task $STORY_ID: $STORY_TITLE"

    OUTPUT=$(run_claude "Execute this task. Commit message: feat: $STORY_ID - $STORY_TITLE

$STORY")

    if echo "$OUTPUT" | grep -q "TASK_PASS"; then
        jq ".userStories[$idx].passes = true" "$PRD" > "$PRD.tmp" && mv "$PRD.tmp" "$PRD"
        echo -e "\n## $(date '+%m-%d %H:%M') $STORY_ID DONE\n---" >> "$PROGRESS"
        echo "$STORY_ID done."
    else
        echo "$STORY_ID FAILED."
        echo -e "\n## $(date '+%m-%d %H:%M') $STORY_ID FAILED\n---" >> "$PROGRESS"
        git checkout . 2>/dev/null || true
    fi
done

# ── Phase 1 완료 확인 ────────────────────────────────────────
REMAINING=$(jq '[.userStories[] | select(.passes != true)] | length' "$PRD")
if [ "$REMAINING" -gt 0 ]; then
    log "Phase 1 FAILED — $REMAINING tasks remaining"
    exit 1
fi

# ══════════════════════════════════════════════════════════════
# Phase 2: E2E 검증 (유저 스토리 기반 브라우저 테스트)
# ══════════════════════════════════════════════════════════════
log "Phase 2 — E2E 검증 (유저 스토리 기반)"

E2E_RESULTS="$DIR/.ralph/e2e-results.json"

# E2E용 system prompt 빌드
cat > "$E2E_PROMPT" <<E2E_SYSPROMPT_EOF
# E2E Tester System Prompt

$(cat "$CONTEXT/e2e.md")

---

$(cat "$CONTEXT/testing.md")

---

## E2E 결과 출력 형식 (반드시 이 JSON을 출력에 포함할 것)

테스트 완료 후 반드시 아래 형식의 JSON 블록을 출력하세요:

\`\`\`e2e-results
{
  "results": [
    { "id": "US-001", "pass": true, "detail": "" },
    { "id": "US-002", "pass": false, "detail": "choice 입력에서 기타 옵션 누락" }
  ]
}
\`\`\`

모든 스토리가 pass이면 마지막에 E2E_PASS 출력.
하나라도 fail이면 E2E_FAIL 출력.
E2E_SYSPROMPT_EOF

ALL_STORIES=$(jq '[.userStories[] | {id, title, acceptanceCriteria}]' "$PRD")

E2E_CLAUDE_OPTS=(
    --dangerously-skip-permissions
    --print
    --model claude-opus-4-6
    --append-system-prompt-file "$E2E_PROMPT"
    --max-turns 1000
)

# ── E2E 실행 함수 ────────────────────────────────────────────
run_e2e() {
    local prompt="$1"
    local output
    output=$(echo "$prompt" | claude "${E2E_CLAUDE_OPTS[@]}" 2>&1 | tee /dev/stderr) || true

    # e2e-results JSON 블록 추출 → 파일로 저장
    echo "$output" | sed -n '/```e2e-results/,/```/p' | sed '1d;$d' > "$E2E_RESULTS" 2>/dev/null || true

    echo "$output"
}

# ── 첫 E2E 실행 ──────────────────────────────────────────────
E2E_OUTPUT=$(run_e2e "Verify ALL user stories below by running the app and testing in the browser.
Follow the E2E Testing Context in your system prompt exactly.

## User Stories to Verify

$ALL_STORIES")

# ── E2E 상태 확인 함수 ───────────────────────────────────────
check_e2e_all_pass() {
    if [ ! -f "$E2E_RESULTS" ]; then
        return 1
    fi
    local fail_count
    fail_count=$(jq '[.results[] | select(.pass == false)] | length' "$E2E_RESULTS" 2>/dev/null || echo "999")
    [ "$fail_count" -eq 0 ]
}

get_e2e_failures() {
    if [ -f "$E2E_RESULTS" ]; then
        jq '[.results[] | select(.pass == false)]' "$E2E_RESULTS" 2>/dev/null || echo "[]"
    else
        echo "[]"
    fi
}

# ── E2E 결과 처리 ────────────────────────────────────────────
if check_e2e_all_pass; then
    log "Phase 2 PASS — 모든 유저 스토리 E2E 통과"
else
    log "Phase 2 — E2E 실패 항목 발견"

    # 수정 + 전체 재검증 루프 (최대 MAX_RETRIES 회)
    for retry in $(seq 1 "$MAX_RETRIES"); do
        FAILURES=$(get_e2e_failures)
        FAIL_IDS=$(echo "$FAILURES" | jq -r '.[].id' 2>/dev/null | tr '\n' ', ')
        log "E2E Fix 시도 $retry/$MAX_RETRIES — 실패: $FAIL_IDS"

        # Step 1: 수정 (Phase 1 system prompt 사용 — skills 포함)
        run_claude "E2E tests failed for the following stories. Fix the code.

## Failed Stories
$FAILURES

## Instructions
1. Read each failure detail
2. Fix the root cause in the code
3. Run npm run typecheck && npm run lint && npm test
4. Commit fixes: git add -A && git commit -m 'fix: e2e failures (attempt $retry)'
5. Output TASK_PASS when fixes are committed"

        # Step 2: 전체 재검증 (모든 스토리 — 회귀 방지)
        log "E2E 전체 재검증 (회귀 체크 포함)"
        E2E_OUTPUT=$(run_e2e "Re-verify ALL user stories after fixes. Check every story, not just the ones that failed.
Previous failures were: $FAIL_IDS
But you MUST verify ALL stories to catch regressions.

## ALL User Stories to Verify

$ALL_STORIES")

        if check_e2e_all_pass; then
            log "E2E Fix 성공 (시도 $retry) — 모든 스토리 통과"
            break
        fi

        if [ "$retry" -eq "$MAX_RETRIES" ]; then
            FINAL_FAILURES=$(get_e2e_failures)
            log "E2E Fix 실패 — $MAX_RETRIES회 시도 후 포기"
            echo "남은 실패 항목:"
            echo "$FINAL_FAILURES" | jq -r '.[] | "  ✗ \(.id): \(.detail)"' 2>/dev/null
            exit 1
        fi
    done
fi

# ── E2E 결과 로그 ────────────────────────────────────────────
if [ -f "$E2E_RESULTS" ]; then
    echo "" >> "$PROGRESS"
    echo "## $(date '+%m-%d %H:%M') E2E Results" >> "$PROGRESS"
    jq -r '.results[] | if .pass then "  ✓ \(.id)" else "  ✗ \(.id): \(.detail)" end' "$E2E_RESULTS" >> "$PROGRESS" 2>/dev/null
    echo "---" >> "$PROGRESS"
fi

# ══════════════════════════════════════════════════════════════
# Phase 3: 배포 (Azure Container Apps)
# ══════════════════════════════════════════════════════════════

# 배포 게이트: 모든 태스크 pass + E2E 전체 pass
if ! check_e2e_all_pass; then
    log "Phase 3 BLOCKED — E2E 미통과 상태에서는 배포 불가"
    exit 1
fi

TASK_REMAINING=$(jq '[.userStories[] | select(.passes != true)] | length' "$PRD")
if [ "$TASK_REMAINING" -gt 0 ]; then
    log "Phase 3 BLOCKED — $TASK_REMAINING 태스크 미완료"
    exit 1
fi

if [ "$SKIP_DEPLOY" = true ]; then
    log "Phase 3 — 배포 스킵 (--no-deploy)"
    log "Ralph Loop 완료 ✓ (배포 제외)"
    exit 0
fi

log "Phase 3 — Azure 배포"

npm run build || { log "빌드 실패 — 배포 중단"; exit 1; }

az containerapp up \
    --name ralph-app \
    --resource-group anymorph-rg-kr \
    --source .

# 배포된 앱 URL 추출
APP_URL=$(az containerapp show \
    --name ralph-app \
    --resource-group anymorph-rg-kr \
    --query "properties.configuration.ingress.fqdn" \
    -o tsv 2>/dev/null)

if [ -z "$APP_URL" ]; then
    log "WARNING: 앱 URL을 가져올 수 없음. 배포 검증 스킵."
    log "Ralph Loop 완료 ✓ (배포 검증 미실행)"
    exit 0
fi

APP_URL="https://$APP_URL"
log "Phase 4 — 배포 검증 ($APP_URL)"

# health check (curl)
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" --max-time 30 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" != "200" ]; then
    log "Phase 4 FAILED — HTTP $HTTP_STATUS (expected 200)"
    exit 1
fi

echo "HTTP 200 OK"

# cmux-browser로 프로덕션 스모크 테스트
DEPLOY_VERIFY_OUTPUT=$(echo "Verify the deployed app at $APP_URL works correctly using cmux-browser.

## Instructions

1. Open $APP_URL in cmux-browser
2. Verify:
   - Landing page renders correctly ('안녕하세요! 무엇을 도와드릴까요?')
   - Text input and start button are visible
   - Create a test project with input '테스트 자기소개서'
   - Verify redirect to /project/[id]
   - Verify Collect phase starts (first question appears)
   - Check browser console for errors
3. Take screenshots as evidence

Output DEPLOY_PASS if all checks pass.
Output DEPLOY_FAIL: [issues] if any fail." \
| claude "${E2E_CLAUDE_OPTS[@]}" 2>&1 | tee /dev/stderr) || true

if echo "$DEPLOY_VERIFY_OUTPUT" | grep -q "DEPLOY_PASS"; then
    log "Phase 4 PASS — 프로덕션 검증 통과"
    log "Ralph Loop 전체 완료 ✓"
    exit 0
fi

# ── Phase 4 수정 루프 ────────────────────────────────────────
log "Phase 4 — 프로덕션 검증 실패. 수정 루프 시작."

for deploy_retry in $(seq 1 "$MAX_RETRIES"); do
    DEPLOY_FAILURES=$(echo "$DEPLOY_VERIFY_OUTPUT" | grep -A 100 "DEPLOY_FAIL" || echo "unknown")

    log "Deploy Fix 시도 $deploy_retry/$MAX_RETRIES"

    # Step 1: progress.txt + e2e-results.json + 실패 내용 전부 넘겨서 수정
    run_claude "Production deployment verification failed. Fix the issues.

## Deploy Failures
$DEPLOY_FAILURES

## Context
- App URL: $APP_URL
- Read progress.txt for full history of what was built and tested
- Read .ralph/e2e-results.json for E2E test history
- The app passed local E2E but fails in production — likely environment/build/config issue

## Instructions
1. Analyze the failure — compare local E2E (passed) vs production (failed)
2. Check common production issues:
   - Environment variables (OPENROUTER_API_KEY, CEREBRAS_API_KEY, DATABASE_PATH)
   - next.config.ts output: 'standalone'
   - SQLite binary compatibility (alpine)
   - API routes accessible in production
3. Fix the root cause
4. Run npm run typecheck && npm run lint && npm test
5. Commit: git add -A && git commit -m 'fix: production issue (attempt $deploy_retry)'
6. Output TASK_PASS when done"

    # Step 2: 재빌드 + 재배포
    log "재빌드 + 재배포"
    npm run build || { log "빌드 실패"; continue; }

    az containerapp up \
        --name ralph-app \
        --resource-group anymorph-rg-kr \
        --source . || { log "배포 실패"; continue; }

    # 배포 안정화 대기
    sleep 15

    # Step 3: 재검증
    log "프로덕션 재검증 (시도 $deploy_retry)"
    DEPLOY_VERIFY_OUTPUT=$(echo "Re-verify the deployed app at $APP_URL using cmux-browser.
Previous failures: $DEPLOY_FAILURES

1. Open $APP_URL in cmux-browser
2. Verify landing page, project creation, Collect phase
3. Check browser console for errors
4. Take screenshots

Output DEPLOY_PASS if all checks pass.
Output DEPLOY_FAIL: [remaining issues] if any fail." \
    | claude "${E2E_CLAUDE_OPTS[@]}" 2>&1 | tee /dev/stderr) || true

    if echo "$DEPLOY_VERIFY_OUTPUT" | grep -q "DEPLOY_PASS"; then
        log "Deploy Fix 성공 (시도 $deploy_retry)"
        break
    fi

    if [ "$deploy_retry" -eq "$MAX_RETRIES" ]; then
        log "Deploy Fix 실패 — $MAX_RETRIES회 시도 후 포기"
        echo "$DEPLOY_VERIFY_OUTPUT" | grep -A 10 "DEPLOY_FAIL" || true
        exit 1
    fi
done

log "Ralph Loop 전체 완료 ✓"
