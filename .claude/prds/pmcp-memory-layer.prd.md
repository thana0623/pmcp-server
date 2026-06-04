# pmcp — 个人 AI 记忆层

## Problem

开发者每天开新会话时，需要花 5-10 分钟手动让 AI 了解项目背景、昨天做了什么、当前进度。session 结束时又要等 AI 总结半天才能保存状态。pmcp 目前的 bootstrap 全量注入上下文，制造噪声且没有工作流引导——开发者得自己想"下一步做什么"。

**成本**：每天 10 分钟上下文重建 × 260 工作日 = 每年 43 小时浪费在"让 AI 听懂话"上。

## Evidence

- 用户每天手动让 AI 保存状态，快下班时 AI 总结半天，体验拖沓
- 记忆层太重，文档太多，启动时全量注入上下文垃圾
- 没有可复用工作流引导，每次都要自己决定下一步该用什么工具
- pmcp 的启动流程（bash + 输出解析）比 ECC 的 slash command 慢 3-4 倍

## Users

- **Primary**: 个人开发者（当前），使用 AI 辅助编码工具（Claude Code / Cursor / 等），需要跨会话保持项目上下文
- **Secondary**: 开源用户，拿到项目后能快速理解并使用
- **Not for**: 团队协作场景（暂不考虑多人记忆合并）

## Hypothesis

我们相信 **一个 4 文档的轻量记忆层 + 工作流引导 + 秒级启动** 会 **让开发者省掉每天 10 分钟的上下文重建时间，并通过自动建议下一步命令来标准化开发流程**。当 **开发者连续一周不需要手动解释"昨天干了什么"时**，我们就知道做对了。

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| 启动到 AI 可用 | < 3 秒 | 从输入命令到 AI 输出第一句话 |
| 记忆文档数 | ≤ 4 个 | 文件计数 |
| 手动保存状态次数 | 0 次/天 | 用户自报 |
| 工作流引导采纳率 | > 50% | 用户按建议执行的比例 |

## Scope

**MVP — 4 个文档 + 秒级启动 + 工作流引导**

### 4 个记忆文档

```
.pmcp/
├── context.md       ← 项目全貌（init 时生成，很少变）
├── state.md         ← 当前状态：在做什么、进度、阻塞（session-end 自动更新）
├── sessions.md      ← 最近 3 天会话摘要（自动追加，自动裁剪旧的）
└── decisions.md     ← 关键决策记录（只记"为什么"，不记"做了什么"）
```

### 启动流程

```
当前：用户 → pmcp start（bash） → 输出文字 → AI 解析 → 回复（8-10 秒）
目标：用户 → /start（skill） → AI 直接读文件 → 建议下一步（2-3 秒）
```

- 把 `pmcp start` 的核心逻辑做成 Claude Code skill（slash command）
- 启动后 AI 读 4 个文件，一句话总结状态 + 建议下一步命令
- 保留 bash 命令作为 fallback（其他 AI 工具用）

### 工作流引导

bootstrap 完成后，AI 根据 `state.md` 自动判断当前阶段并建议下一步：

```
没有需求？     → 建议 /plan-prd
有需求没拆？   → 建议 planner agent
拆完没写？     → 开发中，提示 tdd-guide
写完了？       → 建议 code-reviewer + git commit
提交后？       → 自动归档到 sessions.md
```

**不改 ECC 本身，只在 pmcp 层面做建议。**

### session-end 自动归档

- session 结束时自动更新 `state.md` 和 `sessions.md`
- 产出是决策级摘要（3 句话），不是日志级记录
- 用户不需要手动触发，hook 自动完成

**Out of scope**

- Hard Gate / PreToolUse 拦截 — 太硬，ECC hooks 更灵活
- Skills 系统 — 这是 ECC 的事
- focus-spec / task-state / dev-rules — 这是 ECC planner 的事
- 工作流编排引擎 — ECC agents 已经做完了
- E2E 测试自动化 — 不是记忆层的职责
- 多人协作记忆 — 暂不需要

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | 4 文档模型 | 砍掉多余文档，只保留 context/state/sessions/decisions | complete | [plan](.claude/plans/pmcp-memory-layer.plan.md) |
| 2 | 秒级启动 | /start skill 替代 pmcp start，启动 < 3 秒 | complete | — |
| 3 | 工作流引导 | bootstrap 后自动建议下一步命令 | complete | — |
| 4 | session-end 自动归档 | hook 自动更新 state.md + sessions.md，用户零操作 | complete | — |
| 5 | 清理旧代码 | 砍掉 Hard Gate、Skills、dev-rules 等非记忆层代码 | complete | — |

## Open Questions

- [ ] decisions.md 是自动提取还是用户手动标记"这是个决策"？
- [ ] sessions.md 保留最近 3 天够吗？还是需要可配置？
- [ ] 其他 AI 工具（Cursor 等）的启动流程怎么做？也用 skill 还是用 bash？
- [ ] pmcp 的 MCP server 还保留吗？还是纯 CLI + skill？

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| session-end 摘要质量差 | 中 | 记录无用 | 用固定模板约束输出格式 |
| 其他 AI 工具不支持 skill | 高 | 启动流程不通用 | 保留 bash 命令作为 fallback |
| 4 文档不够用 | 低 | 需要扩展 | 先跑 2 周再决定 |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
