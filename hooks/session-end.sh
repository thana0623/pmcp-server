#!/bin/bash
# Shared session-end hook (assistant-agnostic)
# Updates HOT_STATE.md as fallback if not recently updated
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

HOT_STATE_FILE="$PROJECT_DIR/HOT_STATE.md"

# Update HOT_STATE.md fallback (if not recently updated)
NOW=$(date '+%Y-%m-%d %H:%M')

if [ -f "$HOT_STATE_FILE" ]; then
  if command -v stat >/dev/null 2>&1; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      MTIME=$(stat -f %m "$HOT_STATE_FILE" 2>/dev/null || echo 0)
    else
      MTIME=$(stat -c %Y "$HOT_STATE_FILE" 2>/dev/null || echo 0)
    fi
    CURRENT=$(date +%s)
    DIFF=$(( CURRENT - MTIME ))
    if [ "$DIFF" -lt 1800 ]; then
      echo "HOT_STATE.md recently updated ($(( DIFF / 60 )) min ago), skipping fallback."
      exit 0
    fi
  fi
fi

# Generate fallback state from git
echo "Generating HOT_STATE.md fallback from git status..."

RECENT_COMMITS=$(git log --oneline -5 2>/dev/null || echo "（无法读取 git log）")
CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null | head -10 || echo "（无法读取 git diff）")
STAGED=$(git diff --cached --name-only 2>/dev/null | head -5 || true)

cat > "$HOT_STATE_FILE" << HOTEOF
# 会话热状态

> 本文件由 /loop 定时更新，/start 自动加载。
> 窗口关闭时 session-end hook 会兜底更新。

**最后更新**: $NOW（session-end 兜底）

## 当前任务
（会话已结束，无法确定具体任务）

## 最近讨论
- （会话已结束，对话上下文已丢失）
- 以下为 git 记录的最近改动：

$RECENT_COMMITS

## 下一步
- （待新会话确定）

## 阻塞点
- （无）

## 最近改动文件
$CHANGED_FILES

## 暂存区
$STAGED
HOTEOF

echo "HOT_STATE.md fallback updated."
