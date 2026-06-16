#!/bin/bash
# SessionEnd hook: update HOT_STATE.md fallback

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
HOT_STATE_FILE="$PROJECT_DIR/HOT_STATE.md"

cd "$PROJECT_DIR"

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
      echo "HOT_STATE.md recently updated, skipping fallback."
      exit 0
    fi
  fi
fi

echo "Generating HOT_STATE.md fallback..."
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
