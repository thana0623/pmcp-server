---
description: 需求分析 — 追问用户需求，输出 PRD 文档，无业务死角才往下走
---

需求分析命令。目标：搞清楚用户到底要什么，避免"用户想 A 说 B 做 C"。

## 使用方式

```
/plan-prd 我想给项目加一个 xxx 功能
```

## 核心原则

1. **禁止推断** — 不明白就问，不猜用户意图
2. **每次 3 个问题** — 不要一次问太多，分轮追问
3. **无死角才停** — 直到业务边界清晰、没有模糊节点才输出 PRD
4. **用户确认** — PRD 输出后等用户确认，确认前不进入 /plan

## 流程

### Step 1: 初始理解

读取用户描述，识别模糊点。输出初始理解：

```
我理解你要做的是：[一句话复述]

但我需要确认几个关键点：
1. [问题 1]
2. [问题 2]
3. [问题 3]
```

### Step 2: 多轮追问

根据用户回答，继续追问。每轮 3 个问题：

```
明白了。还有几个细节：
1. [问题 1]
2. [问题 2]
3. [问题 3]
```

追问方向：
- **业务边界**：什么在范围内？什么不在？
- **用户场景**：谁在什么时候触发什么操作？
- **异常处理**：出错了怎么办？边界条件？
- **验收标准**：怎么算做完了？
- **技术约束**：有没有不能改的东西？有没有必须用的技术？

### Step 3: 输出 PRD

当所有模糊点都澄清后，输出 PRD 文件。

**文件路径**：`.claude/plans/<task-id>.prd.md`

**格式**（参照 hot-session-state.prd.md）：

```markdown
# [功能名称]

## Problem

[用户要解决什么问题，1-3 句话]

## Evidence

[实际经历/痛点，为什么需要这个功能]

## Users

- **Primary**: [主要用户]
- **Not for**: [不适用的场景]

## Hypothesis

We believe **[方案]** will **[解决什么问题]** for **[谁]**.
We'll know we're right when **[验证标准]**.

## Success Metrics

| Metric | Target | How measured |
|--------|--------|--------------|
| [指标 1] | [目标值] | [怎么衡量] |
| [指标 2] | [目标值] | [怎么衡量] |

## Scope

**MVP** — [最小可行版本包含什么]

**Out of scope** — [明确不做什么]

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|-----------|---------|--------|------|
| 1 | [阶段 1] | [产出] | pending | — |
| 2 | [阶段 2] | [产出] | pending | — |

## Open Questions

- [ ] [待确认问题 1]
- [ ] [待确认问题 2]

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [风险 1] | [概率] | [影响] | [缓解措施] |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
```

### Step 4: 等待确认

输出 PRD 后停止，提示用户：

```
PRD 已输出到 .claude/plans/<task-id>.prd.md

请审查：
- Problem 描述是否准确？
- Scope 边界是否清晰？
- 有没有遗漏的场景？

确认后输入 /plan 开始拆分任务。
```

## 注意

- 追问不要超过 5 轮，超过说明需求本身不成熟，建议用户先想清楚
- 每轮只问 3 个问题，不要信息过载
- PRD 输出后不要自动进入 /plan，必须等用户确认
- task-id 用 kebab-case，如 `hot-session-state`、`user-login`
