# Safe Publish — 安全发布流水线

## Problem

发布 pmcp-server 时存在三个问题：
1. **漏推送** — 只推了 git 忘了 npm publish，或只 npm publish 忘了 npm link，需要反复提醒
2. **token 处理慢** — npm Access Token 传过去后，AI 经常反应不过来，需要说得很清楚才行
3. **隐私泄露风险** — 曾经在私人仓库上传了密钥，处理起来很麻烦，害怕再次发生

成本：每次发布耗费 5-10 分钟反复确认，且存在隐私泄露的不可逆风险。

## Evidence

- 推送时除非说得很清楚，否则一律不推送 npm，需要单独再次处理
- 给了 npm Access Token 后 AI 找半天反应不过来
- 曾经在私人仓库上传了密钥，处理起来很麻烦
- 经常漏掉 npm link 导致本地其他项目用不了

## Users

- **Primary**: 个人开发者（用户自己），发布 npm 包时需要安全、完整的发布流程
- **Not for**: CI/CD 自动化、团队协作发布、非 npm 项目

## Hypothesis

我们相信**在发布前自动审计隐私信息 + 一键完成 npm publish + git push + npm link + 版本号 bump + README 更新**会**解决"漏推送、token 处理慢、隐私泄露"的问题**。

用了之后，**每次发布 30 秒内完成全部推送，且零隐私泄露。**

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| 发布完成时间 | < 30 秒（从触发到全部完成） | 用户自报 |
| 漏推送率 | 0%（npm/git/link 全部完成） | 用户自报 |
| 隐私拦截率 | 100%（密钥/token/密码全部拦截） | 审计日志 |
| 误报率 | < 5%（正常代码不被误拦） | 用户自报 |

## Scope

**MVP — 四个核心能力**

1. **隐私审计** — 脚本扫描：API Key、密码、Token、私钥等模式；AI 审查：上下文相关的隐私问题
2. **版本管理** — 自动 bump version（patch/minor/major），根据变更类型决定
3. **一键发布** — npm publish + git push + npm link 一步完成
4. **README 同步** — 版本号变更时自动更新 README

**Out of scope**

- CI/CD 集成 — 用户明确不要
- Changelog 自动生成 — 后续迭代
- 多包发布 — 只处理单包
- 依赖审计 — 只审计代码内容，不审计依赖

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | 隐私审计引擎 | 脚本扫描 + AI 审查，拦截密钥/token/密码 | complete | [safe-publish.plan.md](../plans/safe-publish.plan.md) |
| 2 | 版本管理 | 自动 bump version，根据变更类型决定 patch/minor/major | complete | — |
| 3 | 一键发布 | npm publish + git push + npm link 一步完成 | complete | — |
| 4 | README 同步 | 版本号变更时自动更新 README | complete | — |

## Open Questions

- [ ] 版本号 bump 规则：patch/minor/major 如何决定？用户指定还是自动判断？
- [ ] npm Access Token 如何传递？环境变量还是命令行参数？
- [ ] 审计发现隐私信息后：直接拦截还是给用户选择？
- [ ] git commit message 格式：自动还是用户输入？

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 审计脚本误报正常代码 | 中 | 中 | 提供白名单机制，用户可标记误报 |
| npm token 传递不安全 | 低 | 高 | 使用环境变量，不硬编码 |
| 版本号 bump 错误 | 低 | 中 | 发布前确认版本号 |
| npm publish 失败（版本已存在） | 中 | 低 | 自动检测并提示 bump |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
