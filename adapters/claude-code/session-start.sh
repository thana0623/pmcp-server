#!/bin/bash
# Claude Code adapter: SessionStart hook
# Checks if prompts are initialized, loads context
# Supports monorepo: walks up directories to find .pmcp-root marker

set -euo pipefail

START_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROMPTS_SUBDIR="${PROMPTS_SUBDIR:-.github/prompts}"

# ─── 向上查找项目根目录 ─────────────────────────────────────────────────
# 优先级：
#   1. .pmcp-root 标记文件（精确定位）
#   2. .github/prompts/context.md 存在的目录（兼容无标记的项目）

find_project_root() {
  local dir="$1"

  # 策略 1: 查找 .pmcp-root 标记
  local check_dir="$dir"
  while true; do
    if [ -f "$check_dir/.pmcp-root" ]; then
      echo "$check_dir"
      return 0
    fi
    local parent
    parent=$(dirname "$check_dir")
    if [ "$parent" = "$check_dir" ]; then
      break  # 到达文件系统根目录
    fi
    check_dir="$parent"
  done

  # 策略 2: 查找 .github/prompts/context.md
  check_dir="$dir"
  while true; do
    if [ -f "$check_dir/$PROMPTS_SUBDIR/context.md" ]; then
      echo "$check_dir"
      return 0
    fi
    local parent
    parent=$(dirname "$check_dir")
    if [ "$parent" = "$check_dir" ]; then
      break
    fi
    check_dir="$parent"
  done

  return 1
}

# ─── Fallback: 告诉智能体如何初始化 ──────────────────────────────────────

print_fallback() {
  echo ""
  echo "## Prompts MCP - 未初始化"
  echo ""
  echo "当前项目未找到 prompts-mcp 配置。"
  echo ""
  echo "**请告知用户运行以下命令初始化：**"
  echo '```'
  echo "npx prompts-mcp setup"
  echo '```'
  echo ""
  echo "初始化完成后重新开始对话即可自动加载上下文。"
  echo ""
  echo "> 在此之前，请勿自由探索项目目录或执行任何操作。"
  echo "> 等待用户完成初始化后再继续。"
  echo ""
}

# ─── 主流程 ──────────────────────────────────────────────────────────────

PROJECT_DIR=$(find_project_root "$START_DIR") || {
  # 找不到项目根，输出 fallback 指令
  print_fallback
  exit 0
}

CONTEXT_FILE="$PROJECT_DIR/$PROMPTS_SUBDIR/context.md"

if [ ! -f "$CONTEXT_FILE" ]; then
  print_fallback
  exit 0
fi

# Read MCP server path from config (set by `setup` command)
MCP_CONFIG="$PROJECT_DIR/.prompts-mcp/mcp-server-path"
if [ -f "$MCP_CONFIG" ]; then
  MCP_CLI_PATH=$(cat "$MCP_CONFIG")
else
  # Fallback: try local build
  MCP_CLI_PATH="$PROJECT_DIR/build/cli.js"
fi

if [ ! -f "$MCP_CLI_PATH" ]; then
  echo ""
  echo "## Prompts MCP - Server 未找到"
  echo ""
  echo "MCP server CLI 不存在: \`$MCP_CLI_PATH\`"
  echo ""
  echo "**请告知用户重新运行 setup：**"
  echo '```'
  echo "npx prompts-mcp setup"
  echo '```'
  echo ""
  exit 0
fi

# 检查全局 skill 仓库是否已初始化
GLOBAL_SKILLS_DIR="${HOME:-$USERPROFILE}/.pmcp/skills"
if [ ! -d "$GLOBAL_SKILLS_DIR/core" ]; then
  echo ""
  echo "## ⚠️ 全局 Skill 仓库未初始化"
  echo ""
  echo "个人 skill 仓库尚未创建。建议运行以下命令初始化："
  echo '```'
  echo "npx prompts-mcp skill init"
  echo '```'
  echo ""
  echo "初始化后可获得："
  echo "- 核心角色 skill（architect, backend, frontend, review）"
  echo "- 跨项目共享的个人 skill 仓库"
  echo "- 分层 skill 管理（全局只读 + 项目可写）"
  echo ""
fi

# Run bootstrap to load all context
BOOTSTRAP_OUTPUT=$(cd "$PROJECT_DIR" && node "$MCP_CLI_PATH" bootstrap 2>&1)

# Print context to stdout (Claude Code will see this)
echo "$BOOTSTRAP_OUTPUT"
