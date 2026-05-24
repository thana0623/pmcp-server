> task-id: simplify-architecture
> created: 2026-05-24T12:00:00Z
> status: confirmed

## 1. 场景还原

pmcp 系统存在过度设计：`.claude/skills/` 转换层不可靠（Windows bug）、`active-role` 多余、`auto-log.sh` 实时 recent-5 更新属锦上添花。本次精简架构，砍掉不可靠和冗余组件，保留硬防线。

## 2. 核心业务边界

IN: src/cli.ts
IN: src/prompts-loader.ts
IN: hooks/auto-log.sh
IN: hooks/process-logs.sh
IN: .prompts-mcp/hooks/auto-log.sh
IN: .prompts-mcp/hooks/process-logs.sh
IN: adapters/claude-code/session-start.sh
IN: .prompts-mcp/adapters/claude-code/session-start.sh
IN: .github/prompts/focus-spec.md
IN: .prompts-mcp/pre-tool-use.cjs
IN: package.json
OUT: src/index.ts
OUT: adapters/claude-code/settings.json

## 3. 禁止触碰黑名单

- 禁止删除 PreToolUse hook（scope 校验是唯一硬防线）
- 禁止修改 task-state.json schema
- 禁止修改 parseFrontmatter 函数
- 禁止删除 SessionStart 补处理逻辑

## 4. 核心测试断言清单

- assertCompilePass()
- assertStringContains(bootstrap 输出, 角色列表来自 .github/prompts/skills/ 而非 .claude/skills/)
- assertFalse(fs.existsSync('.claude/skills/')) ← 不再生成此目录
- SessionStart 补处理逻辑保留
- PreToolUse scope 校验保留
- npm test 25/25
