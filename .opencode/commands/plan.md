---
description: 任务拆分 — 读取 PRD，分阶段制定执行计划
---

任务拆分命令。读取 plan-prd.md，按阶段拆分为可执行的 plan。

## 使用方式

```
/plan .claude/plans/<task-id>.prd.md
```

或（自动关联最近的 PRD）：

```
/plan
```

## 核心原则

1. **分阶段执行** — 不一次性全做，按里程碑拆分
2. **每阶段可验证** — 每个任务有明确的验证方式
3. **参照现有模式** — 新代码要遵循项目已有的代码风格和架构
4. **最小改动** — 只改必要的文件，不过度设计

## 流程

### Step 1: 读取 PRD

读取指定的 `.prd.md` 文件（或自动查找 `.claude/plans/` 下最新的 PRD）。

提取：
- Problem（要解决什么）
- Scope（做什么/不做什么）
- Delivery Milestones（分几期）

### Step 2: 确定执行范围

从 PRD 的 Milestones 中选择当前要执行的阶段：

```
PRD 定义了 N 个里程碑：
1. [里程碑 1] — [产出]
2. [里程碑 2] — [产出]
...

本次执行哪个里程碑？（输入编号，或 "all" 执行全部）
```

### Step 3: 分析代码影响

用 codegraph 或 grep 分析：
- 涉及哪些文件
- 现有代码有什么模式可以参照
- 有没有类似的实现可以参考

### Step 4: 输出 Plan

**文件路径**：`.claude/plans/<task-id>.plan.md`

**格式**（参照 hot-session-state.plan.md）：

```markdown
# Plan: [功能名称]

**Source PRD**: `.claude/plans/<task-id>.prd.md`
**Selected Milestone**: [选择的里程碑]
**Complexity**: Small / Medium / Large

## Summary

[一句话总结要做什么]

## Patterns to Mirror

| Category | Source | Pattern |
|----------|--------|---------|
| [类别] | [来源文件] | [要遵循的模式] |

## Files to Change

| File | Action | Why |
|------|--------|-----|
| `path/to/file.ts` | CREATE/UPDATE/DELETE | [为什么改] |

## Tasks

### Task 1: [任务名称]
- **Action**: [具体做什么]
- **Mirror**: [参考哪个现有模式]
- **Validate**: [怎么验证]

### Task 2: [任务名称]
- **Action**: [具体做什么]
- **Mirror**: [参考哪个现有模式]
- **Validate**: [怎么验证]

## Validation

```bash
# 验证命令
npm run build
npm test
```

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| [风险] | [概率] | [缓解措施] |

## Acceptance

- [ ] [验收条件 1]
- [ ] [验收条件 2]
- [ ] npm run build 通过
- [ ] npm test 通过
```

### Step 5: 等待确认

输出 Plan 后提示用户：

```
Plan 已输出到 .claude/plans/<task-id>.plan.md

共 N 个任务，预计改动 M 个文件。

确认后开始执行（按 Task 顺序逐项完成，每项完成后 git commit）。
```

## 注意

- 如果没有找到 PRD，提示用户先运行 /plan-prd
- Plan 中的 Tasks 要具体到"改什么文件的什么部分"，不要太抽象
- 每个 Task 都要有 Validate 步骤，不能只写"改完就行"
- 复杂度评估：Small（< 5 个文件）、Medium（5-15 个文件）、Large（> 15 个文件）
- Large 任务建议拆分为多个 Plan 分期执行
