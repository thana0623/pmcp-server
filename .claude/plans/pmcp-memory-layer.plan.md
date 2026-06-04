# Plan: pmcp 4 文档记忆模型

**Source PRD**: `.claude/prds/pmcp-memory-layer.prd.md`
**Selected Milestone**: Milestone 1 — 4 文档模型
**Complexity**: Medium

## Summary

将 pmcp 的记忆层从当前的 10+ 个文档精简为 4 个：context.md（项目全貌）、state.md（当前状态）、sessions.md（最近会话摘要）、decisions.md（关键决策）。同时改造 bootstrap 输出，从全量注入改为按需加载，减少上下文垃圾。

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `src/prompts-loader.ts:37` | `LoadedContext { content, path }` 接口 |
| File I/O | `src/prompts-loader.ts:18` | `readFileSafe()` / `readJsonSafe()` 安全读取 |
| Formatting | `src/prompts-loader.ts:697` | `formatBootstrapCompact()` 精简输出模式 |
| Hook output | `hooks/generate-dialog-summary.sh:138` | markdown 块追加模式 |
| State | `src/prompts-loader.ts:50` | JSON state file (`log-state.json`) |

## Files to Change

| File | Action | Why |
|---|---|---|
| `src/prompts-loader.ts` | UPDATE | 新增 4 个 loader，重写 BootstrapResult，重写 formatBootstrap |
| `hooks/generate-dialog-summary.sh` | UPDATE | 写入 state.md + sessions.md 替代 recent-5 + summary-10 |
| `hooks/session-end.sh` | UPDATE | 调用新的归档逻辑 |
| `src/cli.ts` | UPDATE | bootstrap 命令使用新格式 |
| `src/config.ts` | UPDATE | 移除不再需要的路径常量 |
| `.github/prompts/state.md` | CREATE | 新文档模板（init 时生成） |
| `.github/prompts/sessions.md` | CREATE | 新文档模板（init 时生成） |
| `.github/prompts/decisions.md` | CREATE | 新文档模板（init 时生成） |
| `src/prompts-generator.ts` | UPDATE | init 时生成新 4 文档模板 |

## Tasks

### Task 1: 定义新的 4 文档 loader

- **Action**: 在 `prompts-loader.ts` 中新增 `loadState()`, `loadSessions()`, `loadDecisions()` 三个 loader，返回 `LoadedContext`。保留 `loadContext()` 不变。
- **Mirror**: `src/prompts-loader.ts:125` — `loadContext()` 的模式
- **Validate**: `npm test` 通过

```typescript
// 新增接口
export function loadState(): LoadedContext {
  const filePath = path.join(getPromptsDir(), 'state.md');
  return { content: readFileSafe(filePath), path: filePath };
}

export function loadSessions(): LoadedContext {
  const filePath = path.join(getPromptsDir(), 'sessions.md');
  return { content: readFileSafe(filePath), path: filePath };
}

export function loadDecisions(): LoadedContext {
  const filePath = path.join(getPromptsDir(), 'decisions.md');
  return { content: readFileSafe(filePath), path: filePath };
}
```

### Task 2: 重写 BootstrapResult 接口

- **Action**: 将 `BootstrapResult` 从 15+ 字段精简为 6 个：context, state, sessions, decisions, hasEcc, skills
- **Mirror**: `src/prompts-loader.ts:56` — 现有接口定义
- **Validate**: TypeScript 编译通过

```typescript
export interface BootstrapResult {
  context: LoadedContext;      // 项目全貌
  state: LoadedContext;        // 当前状态
  sessions: LoadedContext;     // 最近会话摘要
  decisions: LoadedContext;    // 关键决策
  hasEcc: boolean;
  skills: string;
}
```

### Task 3: 重写 `bootstrap()` 函数

- **Action**: 只加载 4 个文档 + hasEcc + skills。移除对 recent-5, summary-10, todos, dev-rules, focusSpec, taskState, logState, modules, archiveHistory, eccWorkflow 的加载。
- **Mirror**: `src/prompts-loader.ts:204` — 现有 bootstrap 函数
- **Validate**: `npm test` 通过

### Task 4: 重写 `formatBootstrap()` 和 `formatBootstrapCompact()`

- **Action**: 精简输出格式。移除 Hard Gate 相关代码、阶段引导代码、角色选择代码。输出改为：
  ```
  # pmcp
  
  ## 项目状态
  {state.md 内容，截断到 15 行}
  
  ## 最近会话
  {sessions.md 内容，截断到 10 行}
  
  ## 关键决策
  {decisions.md 内容，截断到 10 行}
  
  ---
  上下文已加载。请描述你的问题。
  ```
- **Mirror**: `src/prompts-loader.ts:697` — formatBootstrapCompact 的精简风格
- **Validate**: `npm test` 通过

### Task 5: 更新 `generate-dialog-summary.sh`

- **Action**: 将 session 摘要写入 `sessions.md` 而非 `recent-5.md`。格式改为：
  ```markdown
  ## 2026-06-03 下午
  - **做了什么**: 重构 pmcp 记忆层，精简为 4 文档模型
  - **关键决策**: 砍掉 Hard Gate，pmcp 定位为个人 AI 记忆层
  - **下一步**: 完成 bootstrap 重写
  ```
  同时更新 `state.md` 的"当前进度"部分。
- **Mirror**: `hooks/generate-dialog-summary.sh:138` — 现有 markdown 块追加模式
- **Validate**: 手动运行 hook 检查输出

### Task 6: 更新 `session-end.sh`

- **Action**: 移除对 `recent-5.md`, `summary-10.md`, `log-state.json` 的 git commit。改为 commit `state.md`, `sessions.md`, `decisions.md`。
- **Mirror**: `hooks/session-end.sh:33` — 现有 git add 模式
- **Validate**: 手动运行检查

### Task 7: 更新 `prompts-generator.ts` — init 生成新模板

- **Action**: `initPrompts()` 生成 4 个文档模板：
  - `context.md` — 保留现有逻辑（扫描项目结构）
  - `state.md` — 空模板，带结构说明
  - `sessions.md` — 空模板，带结构说明
  - `decisions.md` — 空模板，带结构说明
  移除对 `recent-5.md`, `summary-10.md`, `todos.md`, `dev-rules.md`, `modules/` 的生成。
- **Mirror**: `src/prompts-generator.ts:47` — 现有 scanProject 模式
- **Validate**: `pmcp init` 生成正确文件

### Task 8: 更新 `cli.ts`

- **Action**: 移除不再需要的 CLI 命令（`check`, `plan`, `todos`）。保留 `init`, `bootstrap`, `start`, `setup`。
- **Mirror**: `src/cli.ts:1` — 现有 CLI 入口
- **Validate**: `pmcp bootstrap` 输出正确

### Task 9: 清理旧代码

- **Action**: 移除 `prompts-loader.ts` 中不再需要的函数：
  - `loadDaily()`, `loadRecent5()`, `loadSummary10()`, `loadTodos()`, `loadDevRules()`
  - `loadFocusSpec()`, `loadLogState()`, `loadTaskState()`, `loadArchiveHistory()`
  - `listModules()`, `extractStageSection()`
  - `LogState`, `TaskState` 接口
- **Mirror**: N/A — 这是删除操作
- **Validate**: `npm run build` 编译通过，`npm test` 通过

### Task 10: 文档模板

- **Action**: 定义 3 个新文档的初始模板：

  **state.md**:
  ```markdown
  # 项目状态
  
  ## 当前任务
  （无活跃任务）
  
  ## 进度
  （无）
  
  ## 阻塞点
  （无）
  ```

  **sessions.md**:
  ```markdown
  # 会话记录
  
  > 由 session-end hook 自动维护。保留最近 3 天。
  ```

  **decisions.md**:
  ```markdown
  # 关键决策
  
  > 只记录"为什么"，不记录"做了什么"。
  > 格式：日期 + 决策 + 原因
  ```

- **Validate**: 模板文件存在且格式正确

## Validation

```bash
# 编译
npm run build

# 测试
npm test

# 手动验证
npx tsx src/cli.ts bootstrap
# 检查输出是否只有 4 文档内容，无 Hard Gate，无阶段引导

# 检查生成的文件
ls -la .github/prompts/{state,sessions,decisions,context}.md
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 现有项目升级后旧文档丢失 | 中 | init 时备份旧文件到 `.github/prompts/.backup/` |
| session-end hook 产出质量差 | 中 | 用固定模板约束输出格式（做了什么/决策/下一步） |
| 4 文档不够用 | 低 | 先跑 2 周再决定是否扩展 |

## Acceptance

- [ ] BootstrapResult 只有 6 个字段
- [ ] formatBootstrap 输出 < 50 行
- [ ] 4 个文档模板在 init 时正确生成
- [ ] session-end hook 正确写入 state.md + sessions.md
- [ ] `npm run build` 编译通过
- [ ] `npm test` 全部通过
- [ ] 旧代码（Hard Gate, 阶段引导, Skills 嵌入）已移除
