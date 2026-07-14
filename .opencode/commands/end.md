---
description: 结束本轮开发：审查变更，归档任务，更新热状态
---

结束本轮开发：审查变更，归档任务，更新热状态。

## 步骤

### Step 1: 检查 Git 变更

运行 `git status --short`。

- 有未提交的改动 → 提示用户使用 `/commit` 先提交代码，或确认跳过。
- 没有改动 → 继续。

### Step 2: 敏感信息审查

运行 `pmcp audit`（或 `node build/cli.js audit`）。

- 发现 CRITICAL 级别且不在 .gitignore 中 → 阻止，提示修复后重新 `/end`
- 发现在 logs/ 或 test 文件中 → 提示"logs/ 和测试文件中的假数据不影响发布"，继续
- 未发现 → 继续

### Step 3: 归档方向文件

1. 检查 `.github/prompts/direction.md` 或 `.github/prompts/focus-spec.md` 是否存在
2. 如果存在，移入 `.github/prompts/focus-spec-history/<today>-archive.md`
3. 不存在 → 跳过

### Step 4: 更新 HOT_STATE.md

将 HOT_STATE.md 标记为"会话已结束"：

- 当前任务 → `（会话已结束）`
- 最近讨论 → 保留最后内容
- 下一步 → `（待新会话确定）`
- 阻塞点 → 保留或清空

### Step 5: 输出总结

```
## 本轮开发完成

- 敏感审查: 通过
- 归档: <归档文件或"无">
- 热状态: 已更新

描述新需求开始下一轮。
```

## 注意

- 不要跳过敏感信息审查
- 不要超过 15 行输出
