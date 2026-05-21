#!/usr/bin/env bash
# Shared helpers for AgentQA Claude Code hooks.
# Sourced — do not execute directly.

set -u

agentqa_repo_root() {
  if git_root=$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" rev-parse --show-toplevel 2>/dev/null); then
    printf '%s\n' "$git_root"
  else
    printf '%s\n' "${CLAUDE_PROJECT_DIR:-$PWD}"
  fi
}

agentqa_state_dir() {
  local root
  root=$(agentqa_repo_root)
  printf '%s/.agentqa/.claude-state\n' "$root"
}

agentqa_state_file() {
  printf '%s/touched-files\n' "$(agentqa_state_dir)"
}

agentqa_specs_dir() {
  printf '%s/.agentqa/specs\n' "$(agentqa_repo_root)"
}

agentqa_count_specs() {
  local dir
  dir=$(agentqa_specs_dir)
  if [ -d "$dir" ]; then
    find "$dir" -maxdepth 4 -type f \( -name '*.yaml' -o -name '*.yml' \) 2>/dev/null | wc -l | tr -d ' '
  else
    printf '0\n'
  fi
}

agentqa_current_branch() {
  git -C "$(agentqa_repo_root)" rev-parse --abbrev-ref HEAD 2>/dev/null || printf '(no-git)\n'
}

# Read a JSON field with jq if available; falls back to empty string.
agentqa_jq() {
  local query="$1"
  local input="$2"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r "$query // empty" 2>/dev/null
  else
    printf ''
  fi
}

agentqa_is_source_file() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.vue|*.svelte|*.py|*.go|*.rs|*.rb|*.java|*.kt|*.cs|*.css|*.scss|*.html)
      return 0 ;;
    *) return 1 ;;
  esac
}
