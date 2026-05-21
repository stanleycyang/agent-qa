#!/usr/bin/env bash
# SessionStart hook: greet with AgentQA status and reset per-session tracker.
# stdin: { "session_id": "...", "source": "startup|resume|...", ... }
# stdout: human-readable text shown to the user; non-zero exit shouldn't block.

set -u

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
. "$HERE/_lib.sh"

state_dir="$(agentqa_state_dir)"
mkdir -p "$state_dir" 2>/dev/null || true
: > "$(agentqa_state_file)" 2>/dev/null || true

specs="$(agentqa_count_specs)"
branch="$(agentqa_current_branch)"

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  key_status="ANTHROPIC_API_KEY not set (impact analysis will be path-only)"
else
  key_status="ANTHROPIC_API_KEY set"
fi

printf 'AgentQA: %s spec(s) on branch %s | %s\n' \
  "$specs" "$branch" "$key_status"

exit 0
