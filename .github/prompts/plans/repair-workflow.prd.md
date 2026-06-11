# 测试修复工作流（/test）

## Problem

当前项目的开发流程是"plan → 实现 → 测试"，但测试阶段是断裂的。用户手动运行项目进行基准测试和需求测试，发现 bug 后报告给 Agent，Agent 没有结构化的修复流程 — 直接开始盲目修改，经常定位错模块（后端出错改前端），多轮修改后上下文爆炸，被迫 /end，修复变成查东墙补西墙。规划系统在迭代阶段彻底失能，退化为纯归档工具。

## Evidence

- 用户实际开发发票模块：plan 正常 → 开发结束 → 基准测试发现接口不通或前端逻辑问题 → 进入自由修改 → Agent 在错误模块打转 → 上下文爆炸 → 被迫 /end
- Agent 无法自主定位 bug 所在模块，需要用户手动指出"重新审核模块代码"才能发现问题
- 多轮修改很少能做出 plan 级的修改，只能通过模块 review 重新调整

## Users

- **Primary**: 单人开发者，手动运行项目做基准测试和需求测试，通过对话向 Agent 报告 bug
- **Not for**: 团队协作场景、自动化 CI/CD 流程、AI 自动测试（AI 写测试测自己的代码没有意义）

## Hypothesis

我们相信 **引入 `/test` 命令构建"诊断 → 修复计划 → 执行 → 失败归档"的结构化修复流程** 能 **让 Agent 在修 bug 时准确定位模块、不漂移、不炸上下文** 给 **单人开发者**。我们知道对了当 **修 bug 时 Agent 先诊断模块再动手，多轮失败时主动归档而非死循环**。

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| 修复定位准确率 | Agent 首次定位到正确模块 > 80% | 用户反馈 |
| 上下文爆炸率 | 因修复导致被迫 /end 的比例下降 | 会话记录 |
| 修复质量 | plan 级修复 vs 补丁式修复 | 用户主观评估 |

## Scope

**MVP** — `/test` 命令 + 修复流程编排

**Out of scope**
- 自动化测试集成（CI/CD）— 用户明确不需要
- AI 自动生成测试用例 — AI 测自己没有意义
- 多人协作场景 — 当前只有单人使用

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | `/test` 命令 + 诊断流程 | 用户报告 bug 时，Agent 先做模块诊断再出修复 plan | in-progress | [plan](repair-workflow.plan.md) |
| 2 | 多轮失败检测 + 归档引导 | 修 N 轮没修好，主动归档 + 引导 /clear | complete | [plan](repair-workflow.plan.md) |
| 3 | 阶段流转集成 | `/test` 与现有 `/start` `/end` `/commit` 流程打通 | complete | [plan](repair-workflow.plan.md) |

## Open Questions

- [ ] 多轮失败的阈值是多少轮？（3 轮？5 轮？）
- [ ] `/test` 的触发方式：手动输入 `/test` + 描述 bug？还是对话中自动识别？
- [ ] 模块诊断的深度：只定位模块名？还是定位到具体函数/接口？

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Agent 诊断仍不准确 | 中 | 高 | 引入 codegraph 结构化查询辅助定位 |
| 用户不记得用 /test | 中 | 中 | 在 /start 流程中提示测试阶段使用 /test |
| 归档时机太早或太晚 | 低 | 中 | 阈值可配置，先硬编码 3 轮再调 |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
