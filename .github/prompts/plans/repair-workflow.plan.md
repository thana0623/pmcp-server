# Plan: 测试修复工作流（/test）

**Source PRD**: `.github/prompts/plans/repair-workflow.prd.md`
**Selected Milestone**: #1 — `/test` 命令 + 诊断流程
**Complexity**: Medium

## Summary

创建 `/test` 命令，让用户在手动测试阶段报告 bug 时，Agent 先做模块诊断（定位真正出问题的模块），再出修复 plan，确认后执行。引入修复轮次计数，多轮失败时主动引导归档 + /clear。

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `commands/end.md` | 命令文件放在 `commands/` 目录，纯 markdown，步骤式指令 |
| Naming | `commands/commit.md` | 命令名 kebab-case，文件头一句话描述用途 |
| Flow | `commands/end.md:3-9` | 先检查 task-state.json 判断阶段，有活跃任务才继续 |
| Flow | `commands/commit.md:19-36` | 检查 → 展示 → 确认 → 执行 → 输出结果 |
| Stage | `.prompts-mcp/pre-tool-use.cjs:139-158` | `test` 阶段允许 test 文件 + IN scope 写入 |
| Module | `src/module-logger.ts` | module-read 读模块历史，module-log 记录修改 |

## Files to Change

| File | Action | Why |
|---|---|---|
| `commands/test.md` | CREATE | `/test` 命令定义：诊断 → 修复 plan → 执行 → 轮次计数 |
| `.prompts-mcp/pre-tool-use.cjs` | UPDATE | `test` 阶段允许写 `.github/prompts/plans/` 和 `state.md`（已允许） |
| `commands/start.md` | UPDATE | 在建议中增加测试阶段提示 `/test` |
| `.github/prompts/task-state.json` | UPDATE | stage 流转增加 test 相关状态 |

## Tasks

### Task 1: 创建 `commands/test.md`

- **Action**: 创建 `/test` 命令文件，定义结构化修复流程
- **Mirror**: `commands/end.md` 的步骤式结构
- **核心流程**:
  1. 接收用户 bug 描述（`<bug-description>` 参数）
  2. 诊断阶段：用 codegraph 或 grep 定位相关模块，读取模块历史（module-read）
  3. 输出诊断结果：哪个模块、什么问题、影响范围
  4. 生成修复 plan（写入 `.github/prompts/plans/fix-*.md`）
  5. 等用户确认后执行修复
  6. 修复后提示用户重新测试
  7. 轮次计数：记录在 `state.md` 的"发现的问题"中，3 轮未修复 → 引导 /end + /clear
- **Validate**: 手动测试 `/test` 命令流程

### Task 2: 更新 PreToolUse hook

- **Action**: 在 `test` 阶段允许写 `.github/prompts/plans/` 目录（用于 fix plan）
- **Mirror**: `understand` 阶段已有 `plans/` 写入权限
- **Validate**: 阶段为 test 时能写入 plans/fix-*.md

### Task 3: 更新 `commands/start.md`

- **Action**: 在建议表中增加测试阶段的提示
- **Mirror**: 现有的状态 → 建议映射表
- **内容**: 有活跃任务且 stage 为 implement/test → 提示"/test 报告 bug"
- **Validate**: /start 在 implement 阶段显示 /test 提示

### Task 4: 更新 task-state.json 阶段流转

- **Action**: 确认 `test` 阶段在 hook 中的兼容性，确保 stage 能从 implement 正常流转到 test
- **Mirror**: 现有 STAGE_COMPAT 映射
- **Validate**: 手动设置 stage=test 后 hook 行为正确

## Validation

```bash
# 1. 验证命令文件存在
cat commands/test.md

# 2. 验证 hook 允许 test 阶段写 plans/
# 手动设置 task-state.json stage=test，尝试写 plans/fix-test.md

# 3. 验证 /start 在 implement 阶段显示 /test 提示
# 手动测试 /start
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Agent 诊断仍定位错模块 | 中 | 流程强制先诊断再动手，比盲目改好 |
| 用户忘记用 /test | 中 | /start 增加提示 |
| 轮次阈值不合理 | 低 | 先硬编码 3 轮，后续可调 |

## Acceptance

- [ ] `commands/test.md` 创建完成，流程清晰
- [ ] PreToolUse hook 允许 test 阶段写 plans/
- [ ] `/start` 在测试阶段显示 `/test` 提示
- [ ] 手动走一遍完整流程：/start → 开发 → /test 报 bug → 诊断 → 修复 → 重新测试
