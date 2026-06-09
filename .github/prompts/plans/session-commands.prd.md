# 会话命令体系重构

## Problem

prompts-mcp-server 的会话生命周期命令存在三个问题：/start 启动时没有清晰引导用户走流程（反而被 hook 报错干扰），/end slash 命令未注册成功无法触发，session-end hook 自动执行 git commit/push 导致含敏感信息的代码（如数据库凭据）未经审核就被推送到远端仓库。刚刚发生了一起真实事故：私人数据库信息被自动提交到远端仓库。

## Evidence

- 2026-06-09 真实事故：私人数据库信息被自动提交到远端仓库（私人仓库，但未经审核）
- /start 启动时 PostToolUse hook 报错 4 次，干扰用户注意力
- /end 命令在上一次会话中未注册成功，无法触发
- session-end hook 自动 git commit 跳过了代码审核流程

## Users

- **Primary**: 项目开发者，日常开发中使用 prompts-mcp-server 管理会话生命周期
- **Not for**: 团队协作场景（当前是个人项目）

## Hypothesis

我们相信 **将 git commit 和 push 从 session-end 自动 hook 拆分为用户主动触发的 /commit 和 /push 两个 slash 命令，并修复 /start 引导和 /end 注册** 会**防止未经审核的敏感信息被推送到远端仓库**。验证标准：**连续 30 天所有 git 推送都经过 /commit 或 /push 命令的显式触发，无意外自动推送**。

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| 自动推送事件 | 0 次/月 | session-end hook 不再包含 git 操作 |
| 敏感信息泄露 | 0 次 | /commit 命令拦截含敏感信息的提交 |
| 命令可用性 | /start /end /commit /push 全部可触发 | 手动测试每个命令 |

## Scope

**MVP** — 以下五项改动足以验证假设：

1. 修复 /start — 启动时给出清晰的流程引导，不被 hook 报错干扰
2. 修复 /end — 确保 slash 命令正确注册，执行审查 + 归档
3. 新建 /commit — 敏感信息扫描 + diff 预览 + 用户确认后才执行 git commit
4. 新建 /push — 分支冲突检查 + 用户确认后才执行 git push / 创建 PR
5. session-end hook 移除自动 git commit/push，只保留日志处理

**Out of scope**

- 完整 CI/CD 流程 — 不是这次的重点
- 自动化秘密扫描工具集成（如 gitleaks）— MVP 用模式匹配即可
- 团队协作工作流 — 当前是个人项目

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | 修复 /start 引导 | 启动时用户看到清晰的流程提示，无 hook 报错干扰 | pending | — |
| 2 | 修复 /end 注册 | /end 命令可正常触发，执行审查 + 归档 | pending | — |
| 3 | 新建 /commit 命令 | 用户主动触发，扫描敏感信息，确认后才 commit | pending | — |
| 4 | 新建 /push 命令 | 用户主动触发，检查分支冲突，确认后才 push/PR | pending | — |
| 5 | 移除 session-end 自动提交 | session-end hook 只处理日志，不碰 git | pending | — |

## Open Questions

- [x] /commit 扫描哪些敏感信息模式？→ API key、密码、数据库连接串、私钥、token
- [x] /commit 发现敏感信息时是阻断提交还是仅警告？→ **阻断 + 给出修改建议，用户同意后自动修改，然后继续提交**
- [x] /push 是否需要支持自动创建 PR？→ **默认只推送当前分支。用户明确要求时才创建 PR/MR**
- [x] 远端仓库？→ **用户不说则用默认远端（origin）**
- [x] /start 的引导形式？→ **技能文件，做不强制的文字提示**

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| /commit 误报导致正常提交被阻断 | 中 | 中 | 提供 --force 跳过扫描的选项 |
| 移除自动提交后用户忘记手动 commit | 中 | 低 | /end 归档前提示是否需要 /commit |
| slash 命令注册机制本身有 bug | 低 | 高 | 先修复 /end 验证注册机制，再扩展 /commit 和 /push |

---
*Status: READY — all questions answered. Implementation planning via /plan.*
