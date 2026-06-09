# 会话记录

> 由 session-end hook 自动维护。保留最近 3 天。
## 2026-06-05 晚上

- **做了什么**: /start
- **改动**: (无代码修改)
- **消息数**: 9 条

## 2026-06-08 晚上

- **做了什么**: 文档清理 + 6 阶段开发流水线重写 + /clear 引导
- **改动**: ecc-workflow.md v3, prompts-loader.ts, session-start.sh, README.md, context.md, start.md, .gitignore
- **关键决策**: 核心文档精简到 4 个，focus-spec.md 降级为归档，ECC plans/prds 不入库
- **消息数**: 20+ 条

## 2026-06-08 晚上

- **做了什么**: /start
- **改动**: (无代码修改)
- **消息数**: 11 条

## 2026-06-09 上午

- **做了什么**: 6阶段流水线对齐 — README重写 + /end命令 + PreToolUse hook + BOM修复
- **改动**: README.md, cli.ts, prompts-loader.ts, prompts-generator.ts, pre-tool-use.cjs, session-start.cjs/sh, skills/end.md, state.md
- **关键决策**: 阶段名从3阶段扩展为6阶段(understand/plan/implement/test/review/publish/archived)，兼容旧阶段名；/end只管审查+归档，git commit由session-end hook自动处理
- **消息数**: 20+ 条


