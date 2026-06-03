# Project: prompts-mcp-server

## Architecture

This project is an AI-agnostic context lifecycle infrastructure. The MCP server and CLI are fully generic — they contain zero references to any specific AI assistant.

The hook system uses an adapter pattern:
- `hooks/` — shared core scripts (assistant-agnostic)
- `adapters/<assistant>/` — thin wrappers that normalize each assistant's format

This project is developed with Claude Code, so `.claude/settings.json` is configured to use the `adapters/claude-code/` adapter.

## Session Lifecycle

### Phase 1: Session Start (automated by hook)

The `adapters/claude-code/session-start.sh` hook automatically:
- Checks if `.github/prompts/context.md` exists
- Loads all context via `bootstrap` CLI command

### Phase 2: During Conversation

- Read context files to understand the project
- Before coding: use `check_requirements` MCP tool, then `make_plan`
- Consult module history via `read_module` before modifying modules

### Phase 3: Auto-Logging (automated by hook)

The `adapters/claude-code/normalize-log.sh` hook normalizes Claude Code's tool call data into a standard JSON format, then pipes it to `hooks/auto-log.sh` which appends to `logs/dialogs/YYYY-MM-DD.jsonl`.

### Phase 4: Session End (automated by hook)

The `adapters/claude-code/session-end.sh` hook delegates to `hooks/session-end.sh` which:
1. Runs `process-logs.sh` to update recent-5.md and summary-10.md
2. Git commits all changes

## ECC Usage Workflow

ECC (Everything Claude Code) provides rules, agents, and hooks for structured development.

### Trigger Phrases

| 你说 | Agent | 做什么 |
|------|-------|--------|
| "帮我规划一下" | planner | 拆任务、列假设、确认后再动手 |
| "用 TDD 方式来做" | tdd-guide | 先写测试 → 再实现 → 再重构 |
| "帮我 review 一下" | code-reviewer | 按安全+质量清单审查 |
| "检查安全问题" | security-reviewer | 扫描安全漏洞 |
| "帮我设计架构" | architect | 系统设计 |
| "构建报错了" | build-error-resolver | 修构建错误 |
| "重构一下这段代码" | refactor-cleaner | 清理死代码、提取函数 |

### Daily Flow

```
1. 描述问题 → "我想给 xxx 加一个 yyy 功能"
2. 规划     → Claude 先复述需求、列假设、问问题、给方案
3. 写代码   → 每次改 .ts 文件后自动类型检查（PostToolUse hook）
4. 测试     → "跑一下测试"
5. 审查     → "帮我 review"
6. 结束     → 自动 build 验证（Stop hook）
```

### Automatic Hooks (configured in ~/.claude/settings.json)

| Hook | Trigger | Action |
|------|---------|--------|
| PostToolUse | Write/Edit 文件后 | `tsc --noEmit` 类型检查（30s 超时） |
| Stop | Session 结束 | `npm run build` 验证构建 |

### Rules (auto-loaded from ~/.claude/rules/ecc/)

Rules are automatically injected into every conversation — no manual trigger needed:
- Coding style (immutability, KISS, file organization)
- Code review standards (80% coverage, security checklist)
- Git workflow (conventional commits, PR process)
- Security guidelines, testing requirements, performance optimization
