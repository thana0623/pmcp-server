#!/bin/bash
# Shared session-end hook (assistant-agnostic)
# Generates dialog summary only
# Note: git commit/push is now handled by /commit and /push commands
#
# Environment variables (set by adapter):
#   PROJECT_DIR     — project root (default: pwd)
#   PROMPTS_SUBDIR  — prompts subdirectory (default: .github/prompts)
#   SESSION_ID      — current session identifier

set -euo pipefail

export PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
export PROMPTS_SUBDIR="${PROMPTS_SUBDIR:-.github/prompts}"
export SESSION_ID="${SESSION_ID:-unknown}"

cd "$PROJECT_DIR"

# Step 1: Generate dialog summary → writes to sessions.md + state.md
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/generate-dialog-summary.sh" ]; then
  bash "$SCRIPT_DIR/generate-dialog-summary.sh" 2>/dev/null || true
fi

# Git commit/push is now handled by /commit and /push commands
# No auto-commit on session end
