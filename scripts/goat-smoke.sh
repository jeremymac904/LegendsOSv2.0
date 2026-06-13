#!/usr/bin/env bash
# GOAT Architect Command API — curl smoke test for EVERY endpoint.
#
# Usage:
#   GOAT_COMMAND_API_KEY=<key> ./scripts/goat-smoke.sh [base_url]
#
#   base_url defaults to https://legendsos.app
#   For local dev: GOAT_COMMAND_API_KEY=<key> ./scripts/goat-smoke.sh http://localhost:3000
#
# Exits non-zero if any check fails.

set -u

BASE_URL="${1:-https://legendsos.app}"
KEY="${GOAT_COMMAND_API_KEY:-}"

PASS=0
FAIL=0
declare -a FAILURES=()

note() { printf '%s\n' "$*"; }

# check <name> <expected_status> <needle> <curl args...>
check() {
  local name="$1" expected="$2" needle="$3"
  shift 3
  local tmp; tmp="$(mktemp)"
  local status
  status=$(curl -sS -o "$tmp" -w "%{http_code}" "$@" 2>>"$tmp" || echo "000")
  local body; body="$(cat "$tmp")"; rm -f "$tmp"
  if [[ "$status" == "$expected" && "$body" == *"$needle"* ]]; then
    PASS=$((PASS+1))
    note "  PASS  $name ($status)"
  else
    FAIL=$((FAIL+1))
    FAILURES+=("$name: expected $expected + '$needle', got $status: ${body:0:300}")
    note "  FAIL  $name (got $status, wanted $expected)"
  fi
}

AUTH=(-H "Authorization: Bearer $KEY")
JSON=(-H "Content-Type: application/json")

note "GOAT smoke test against: $BASE_URL"
note ""

note "[1/14] get_health (public)"
check "get_health" 200 '"status":"ok"' "$BASE_URL/api/goat/health"

note "[2/14] openapi schema (public)"
check "openapi" 200 '"GOAT Architect Command API"' "$BASE_URL/api/goat/openapi"

note "[3/14] bearer auth fails closed"
check "auth_rejects_bad_token" 401 '"unauthorized"' \
  -H "Authorization: Bearer wrong-token-on-purpose" "$BASE_URL/api/goat/capabilities"

if [[ -z "$KEY" ]]; then
  note ""
  note "GOAT_COMMAND_API_KEY is not set — skipping the 11 authenticated checks."
  note "Result: $PASS passed, $FAIL failed (auth checks only)"
  [[ $FAIL -eq 0 ]] || exit 1
  exit 0
fi

note "[4/14] list_capabilities"
check "list_capabilities" 200 '"mcp_servers"' "${AUTH[@]}" "$BASE_URL/api/goat/capabilities"

note "[5/14] create_project"
STAMP="$(date +%s)"
check "create_project" 201 '"project"' "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"name\":\"Smoke Test Project $STAMP\",\"description\":\"goat-smoke.sh probe — safe to delete\",\"tags\":[\"smoke\"]}" \
  "$BASE_URL/api/goat/projects"

note "[6/14] search_projects"
check "search_projects" 200 '"projects"' "${AUTH[@]}" \
  "$BASE_URL/api/goat/projects/search?query=smoke&limit=5"

note "[7/14] write_memory"
check "write_memory" 201 '"memory"' "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"title\":\"Smoke memory $STAMP\",\"content\":\"goat-smoke.sh probe — safe to delete\",\"scope\":\"smoke\",\"tags\":[\"smoke\"]}" \
  "$BASE_URL/api/goat/memory"

note "[8/14] search_memory"
check "search_memory" 200 '"memories"' "${AUTH[@]}" \
  "$BASE_URL/api/goat/memory/search?query=smoke&limit=5"

note "[9/14] get_repo_status"
check "get_repo_status" 200 '"deployed"' "${AUTH[@]}" "$BASE_URL/api/goat/repo/status"

note "[10/14] plan_agent_task"
PLAN_BODY=$(curl -sS "${AUTH[@]}" "${JSON[@]}" \
  -d '{"goal":"Smoke test: add a tiny API endpoint and validate it","constraints":["do not deploy"]}' \
  "$BASE_URL/api/goat/agent/plan")
if [[ "$PLAN_BODY" == *'"run"'* ]]; then
  PASS=$((PASS+1)); note "  PASS  plan_agent_task"
else
  FAIL=$((FAIL+1)); FAILURES+=("plan_agent_task: $PLAN_BODY"); note "  FAIL  plan_agent_task"
fi
RUN_ID=$(printf '%s' "$PLAN_BODY" | sed -n 's/.*"id":"\([0-9a-f-]\{36\}\)".*/\1/p' | head -1)

note "[11/14] execute_agent_task (dry_run)"
check "execute_agent_task" 201 '"simulated":true' "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"run_id\":\"$RUN_ID\",\"mode\":\"dry_run\",\"notes\":\"smoke\"}" \
  "$BASE_URL/api/goat/agent/execute"

note "[12/14] get_run_status"
check "get_run_status" 200 '"run"' "${AUTH[@]}" "$BASE_URL/api/goat/runs/$RUN_ID"

note "[13/14] research_github + research_ai_news"
check "research_github" 200 '"results"' "${AUTH[@]}" "${JSON[@]}" \
  -d '{"query":"agent framework","language":"typescript","limit":3}' \
  "$BASE_URL/api/goat/research/github"
check "research_ai_news" 200 '"results"' "${AUTH[@]}" "${JSON[@]}" \
  -d '{"query":"Claude","days":14,"limit":3}' \
  "$BASE_URL/api/goat/research/ai-news"

note "[14/14] prepare_secret_file (+ secret rejection)"
check "prepare_secret_file" 200 '"OPEN_ME_ADD_KEYS.txt"' "${AUTH[@]}" "${JSON[@]}" \
  -d '{"service":"OpenAI","env_var_names":["OPENAI_API_KEY"],"notes":"needed for image generation"}' \
  "$BASE_URL/api/goat/secrets/prepare"
check "prepare_secret_file_rejects_values" 400 '"secret_value_detected"' "${AUTH[@]}" "${JSON[@]}" \
  -d '{"service":"OpenAI","env_var_names":["OPENAI_API_KEY"],"notes":"the key is sk-aaaaaaaaaaaaaaaaaaaaaaaa"}' \
  "$BASE_URL/api/goat/secrets/prepare"

note ""
note "Result: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  note ""
  note "Failures:"
  for f in "${FAILURES[@]}"; do note "  - $f"; done
  exit 1
fi
