结束本轮开发：审查变更，归档任务，清理上下文。

## 步骤

### Step 1: 检查是否有活跃任务

读取 `.github/prompts/task-state.json`。

- stage 为空、`understand` 或 `archived` → 提示"当前没有活跃任务，无需归档"，停止。
- 有活跃任务 → 继续。记录 taskId 和 stage。

### Step 1.5: 检查未解决的 bug（test 阶段）

如果 stage 是 `test`，读取 `.github/prompts/state.md` 的"发现的问题"。

- 有未标记 ✅ 的 bug → 输出警告：

```
## ⚠️ 发现未解决的 bug

以下问题尚未修复：
- <bug 1>
- <bug 2>

归档后这些问题会保留在"发现的问题"中，下一轮会话可以看到。
确认归档？(y/n)
```

- 用户确认 → 继续
- 用户拒绝 → 停止，建议继续用 /test 修复

### Step 2: 检查 Git 变更

运行 `git status --short`。

- 有未提交的改动 → 提示用户使用 `/commit` 先提交代码，或确认跳过。
- 没有改动 → 跳过。

### Step 3: 敏感信息审查

运行 `pmcp audit`（或 `node build/cli.js audit`）。

- 发现 CRITICAL 级别且不在 .gitignore 中 → 阻止，提示修复后重新 `/end`
- 发现在 logs/ 或 test 文件中 → 提示"logs/ 和测试文件中的假数据不影响发布"，继续
- 未发现 → 继续

### Step 4: 归档任务

1. 检查 `.github/prompts/direction.md` 或 `.github/prompts/focus-spec.md` 是否存在
2. 如果存在，移入 `focus-spec-history/<task-id>-<today>.md`
3. 更新 `.github/prompts/state.md`：
   - 清空"当前任务" → `（无活跃任务）`
   - 清空"进度" → `（无）`
   - 清空"阻塞点" → `（无）`
   - **保留"发现的问题"不动**
4. 更新 `.github/prompts/task-state.json`：stage → `archived`
5. 追加 `.github/prompts/sessions.md`：记录本次会话摘要

### Step 5: 输出总结

```
## 本轮开发完成

- 任务: <task-id>
- 敏感审查: 通过
- 归档: focus-spec-history/<task-id>-<date>.md
- 发现的问题: <N> 个（已记录，供下一轮处理）

描述新需求开始下一轮，或 /clear 清理上下文。
```

## 注意

- 不要跳过敏感信息审查
- 不要清空"发现的问题"
- 不要超过 20 行输出
