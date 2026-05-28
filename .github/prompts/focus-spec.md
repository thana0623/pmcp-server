> task-id: enforce-contract-immutability
> created: 2026-05-28T01:10:00+08:00
> status: confirmed

## 1. 场景还原

用户签字确认 focus-spec.md 后进入编码阶段。编码过程中发现需求需要变更（技术限制、边界遗漏等）。当前系统**没有任何技术手段阻止** AI 直接修改已签字的 focus-spec.md——hook 对 focus-spec 写入始终放行。结果：契约形同虚设，签字白做，需求变更未经人类审批就被静默篡改。

## 2. 核心业务边界

**IN（肯定在范围内）：**
IN: .prompts-mcp/pre-tool-use.cjs
IN: .github/prompts/task-state.json
IN: adapters/claude-code/session-start.sh
IN: .github/prompts/plans/enforce-contract-immutability/**
IN: src/__tests__/pre-tool-use.test.ts

**OUT（肯定不在范围内）：**
- 不修改 ECC 规则文件
- 不修改 hooks/ 目录下的共享脚本
- 不改变 focus-spec.md 的 4 章格式

## 3. 禁止触碰黑名单

- 禁止移除 pre-tool-use.cjs 中对 focus-spec.md 的写保护检查
- 禁止在 stage=confirmed 时允许绕过完整性校验的任何路径
- 禁止将 contract-hash 校验做成可选（必须是强制的）

## 4. 核心测试断言清单

```
assertBlockWriteWhenConfirmed()           // stage=confirmed 时，Write/Edit focus-spec.md 被拦截
assertAllowWriteWhenPending()             // stage=spec-pending 时，Write/Edit focus-spec.md 放行
assertAllowWriteWhenChangeRequested()     // stage=change-requested 时，Write/Edit focus-spec.md 放行
assertHashMismatchBlocksCoding()          // focus-spec 内容被篡改后，hash 不匹配，stage 回退到 spec-pending
assertChangeRequestRequiresConfirmation() // 变更后的 focus-spec 重新进入 pending-confirmation 等待签字
assertTaskStateUpdatedOnChange()          // 变更时 task-state.json 记录 change-requested stage
```
