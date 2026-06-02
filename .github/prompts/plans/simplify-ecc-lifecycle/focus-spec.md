> task-id: simplify-ecc-lifecycle
> created: 2026-06-02
> status: confirmed

## 1. 问题

当前 ECC 生命周期是线性瀑布式，存在三个结构性缺陷：

1. **需求和架构串行** — analyst 输出 focus-spec → 签字 → architect 才介入。架构发现需求不合理时，只能走"需求变更"回退。
2. **需求变更被当异常** — `change-requested` 是被动触发，但需求变更实际是常态。
3. **ECC 执行层太重** — 7 阶段 + 每阶段人工确认 = 大量仪式开销。ECC 的 planner/architect/tdd-guide 本身就能处理这些，但 PMCP 在前面加了 3 道重复的门。

**根本矛盾**：用户说的是"问题"（日志记录的是工具调用不是对话），但系统要求用户给出"解决方案"（focus-spec 4 章格式）。

## 2. 方向

PMCP 只管两件事，中间全部交给 ECC：

```
Understand（PMCP）→ Execute（ECC 全量）→ Close（PMCP）
```

- **Understand**：对话式问题探索，产出 direction.md（10 行以内）
- **Execute**：ECC 自动编排 planner → architect → backend/frontend → tdd-guide → code-reviewer
- **Close**：总结归档，更新日志，git commit

## 3. 范围

IN: src/**
IN: .github/prompts/**
IN: adapters/**
IN: .prompts-mcp/**
IN: skills/**

**IN（要改的）：**

- `skills/ecc-workflow.md` — 从 7 阶段简化为 3 阶段
- `task-state.json` 的 stage 枚举 — 从 8 个简化为 4 个（understand → executing → closing → archived）
- 新增 `direction.md` 模板 — 替代 focus-spec.md 的 4 章格式
- `session-start.sh` / bootstrap 流程 — 适配新阶段
- PMCP CLI 的 `check_requirements` 和 `generatePlan` — 适配新的轻量流程

**OUT（不改的）：**

- `hooks/` 共享层（日志、session-end 等保留）
- recent-5.md / summary-10.md 的对话级日志格式（上次已改造）

## 4. 具体改动

### 4.1 新 stage 枚举

```
旧: spec-pending → confirmed → task-planning → developing → reviewing → user-confirming → completed → archived
新: understand → executing → closing → archived
```

| 新 stage | 含义 | 主导者 |
|----------|------|--------|
| understand | 问题探索 + 方向确认 | PMCP (对话式) |
| executing | ECC 自动编排开发 | ECC (planner/agents) |
| closing | 总结 + 归档 + git | PMCP |
| archived | 已归档 | - |

### 4.2 direction.md 模板

替代 focus-spec.md，10 行以内：

```markdown
> task-id: <id>
> created: <date>

## 问题
<用户描述的问题，1-3 句话>

## 方向
<确认的解决方向，1-2 句话>

## 约束
<不能改什么 / 技术限制，可选>
```

### 4.3 ecc-workflow.md 新版

Phase 1 (Understand):
- 用户描述问题（不是解决方案）
- AI 通过对话澄清问题本质
- 产出 direction.md
- 用户确认方向 → stage → executing

Phase 2 (Execute):
- 自动调用 planner agent 拆任务
- 用户确认计划一次
- 自动编排 backend/frontend/tdd-guide 执行
- 自动调用 code-reviewer 审查
- 中间不打断用户

Phase 3 (Close):
- 展示完成情况
- 用户确认 → git commit + 归档
- 更新 recent-5.md / summary-10.md

### 4.4 Bootstrap 适配

`pmcp start` 输出改为：
```
检测到 ECC → 3 阶段轻量流程
当前阶段: understand
请描述你遇到的问题（不是解决方案）
```

## 5. 禁止触碰

- 禁止修改 `src/` TypeScript 源码
- 禁止删除 hooks/ 和 adapters/ 目录
- 禁止破坏对话级日志系统（上次改造的成果）
- 禁止引入外部依赖

## 6. 验收标准

```
assertFileContains("skills/ecc-workflow.md", "Understand")
assertFileContains("skills/ecc-workflow.md", "Execute")
assertFileContains("skills/ecc-workflow.md", "Close")
assertFileNotContains("skills/ecc-workflow.md", "spec-pending")  // 旧阶段消失
assertFileExists(".github/prompts/plans/*/direction.md")  // direction.md 模板存在
assertStageCount(4)  // 只有 4 个 stage
```
