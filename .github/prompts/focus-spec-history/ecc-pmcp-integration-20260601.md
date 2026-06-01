> task-id: ecc-pmcp-integration
> created: 2026-06-01
> status: confirmed

## 1. 场景还原

PMCP 和 ECC 是两套独立系统，角色高度重叠（architect、review、frontend 等），导致流程混乱。
需要统一角色系统：ECC 存在时用 ECC agents，不存在时回退到 PMCP skills。
同时将 ECC 的学习功能（/learn、/skill-create）接入 PMCP 的 skill 学习记录。

## 2. 核心业务边界

**IN（肯定在范围内）：**
IN: src/**
IN: .github/prompts/**
IN: .prompts-mcp/**
IN: ~/.claude/agents/**
IN: README.md

**OUT（肯定不在范围内）：**
- PMCP Skills 原始文件（不删除、不修改）
- ECC agents 原始文件（不修改已有的）

## 3. 禁止触碰黑名单

- `.github/prompts/skills/*.md`（保留作为独立模式后备）
- `~/.claude/agents/architect.md`（已存在，不修改）
- `~/.claude/agents/code-reviewer.md`（已存在，不修改）
- `~/.claude/agents/code-architect.md`（已存在，不修改）

## 4. 核心测试断言清单

- `assertEqual(pmcp listSkills(hasEcc=true).includes("architect"), false)` — ECC 模式下排除重叠 skill
- `assertEqual(pmcp listSkills(hasEcc=false).includes("architect"), true)` — 独立模式保留全部 skill
- `assertExists(~/.claude/agents/analyst.md)` — 新 agent 已创建
- `assertContains(bootstrapOutput, "analyst agent")` — ECC 输出引用 ECC agents

## 5. 任务拆分

### T1: 扩展 task-state 状态机
- 新增阶段：task-planning, developing, reviewing, user-confirming, incomplete
- pre-tool-use.cjs 支持新阶段的写入控制
- 完成标准：所有新阶段可正确转换，写入控制生效

### T2: 增强 bootstrap 阶段引导
- prompts-loader.ts 输出当前阶段 + 下一步指引
- archived 阶段展示归档摘要（最后 1-3 条）
- 完成标准：每个阶段输出正确的引导信息

### T3: 归档历史轻量加载
- archive-index.md 存储摘要索引
- bootstrap 只加载最后 1-3 条摘要
- 完成标准：归档后自动追加摘要，启动时只加载摘要

### T4: 中途退出恢复
- 检测 incomplete 状态
- 提示继续/放弃选择
- 完成标准：中途退出后可恢复或安全放弃

## 6. 完成标准

- [ ] 状态机支持 8 个阶段正确转换
- [ ] bootstrap 每个阶段输出引导信息
- [ ] 归档历史只加载 1-3 条摘要
- [ ] 中途退出可恢复
- [ ] type check 通过
- [ ] README 更新
