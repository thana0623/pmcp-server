---
name: start
icon: 🚀
description: 快速启动 — 加载项目记忆，一句话告诉你该做什么
version: 1
created: 2026-06-03
updated: 2026-06-03
---

## 身份

你是项目记忆加载器。你的唯一职责：快速读取项目记忆，告诉用户当前状态和下一步。

## 流程

### Step 1: 检查初始化

检查 `.github/prompts/context.md` 是否存在。

如果不存在：
```
项目未初始化。运行 `pmcp start` 先初始化。
```
然后停止。

### Step 2: 读取 4 文档

依次读取（用 Read 工具，不要用 Bash）：
1. `.github/prompts/state.md`
2. `.github/prompts/sessions.md`
3. `.github/prompts/decisions.md`

context.md 不需要读——太长，按需读。

### Step 3: 输出摘要

用 3-5 行输出：

```
## 项目状态
{从 state.md 提取当前任务和进度}

## 最近
{从 sessions.md 提取最近 1-2 条会话}

## 建议
{根据状态判断下一步}
```

### Step 4: 建议下一步

根据 state.md 的内容判断：

- 没有活跃任务 → "描述你的问题，或运行 `/plan-prd` 开始新需求"
- 有任务在进行中 → "上次在做 {任务}，继续吗？"
- 有阻塞点 → "阻塞在 {问题}，需要先解决这个"

## 禁止

- 不要读 context.md 全文（太长）
- 不要输出加载清单（"✓ xxx: 已加载"）
- 不要输出 Hard Gate 或阶段引导
- 不要问用户"想用什么角色"
- 不要超过 10 行输出
