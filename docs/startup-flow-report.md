# pmcp v1.5.2 启动流程报告

## 一、pmcp 现在是什么

**个人 AI 记忆层** — 不是工作流工具，不是门控系统。

```
pmcp 只做三件事：
1. 记录 — 你做了什么决策、改了什么、为什么改
2. 传递 — 下次打开任何 AI 工具，自动拿到昨天的上下文
3. 引导 — 根据状态建议下一步该做什么
```

## 二、启动流程

### 方式 1: /start（推荐，秒级）

```
用户输入: /start
↓
AI 读取 4 个文件（< 1 秒）：
  .github/prompts/state.md        ← 当前任务、进度、阻塞
  .github/prompts/sessions.md     ← 最近 3 天会话记录
  .github/prompts/decisions.md    ← 关键决策
  .github/prompts/context.md      ← 按需读，不全量加载
↓
AI 输出 3-5 行摘要 + 建议下一步
```

**输出示例：**
```
## 项目状态
当前任务：重构 pmcp 为记忆层
进度：4 文档模型已完成

## 最近
6/3 下午：重写 prompts-loader.ts，精简为 4 文档

## 建议
继续下一个 milestone，或描述新问题
```

### 方式 2: pmcp start（bash，完整初始化）

```
用户输入: pmcp start
↓
Step 1: 检查是否已初始化
  - 未初始化 → 运行 initPrompts()，生成 4 个模板文件
  - 已初始化 → 跳过，同步 hook 脚本

Step 2: 同步全局 skill 仓库
  - 检查 ~/.pmcp/skills/ 是否完整

Step 3: 加载上下文
  - 调用 bootstrap() 读取 4 个文档
  - 输出 formatBootstrap() 摘要
```

**输出示例：**
```
═══════════════════════════════════════════════════════════
  Prompts MCP - 一键启动
═══════════════════════════════════════════════════════════

[1/3] 项目已初始化，跳过
    = Hook 脚本已同步到最新版本

[2/3] 检查全局 Skill 仓库...
    = 全局 skill 仓库已完整

[3/3] 加载上下文...

# pmcp

## 项目状态
（无活跃任务）

## 最近会话
（无）

## 关键决策
（无）

---
上下文已加载。请描述你的问题。
```

## 三、4 文档模型

```
.github/prompts/
├── context.md       ← 项目全貌（init 时自动生成，很少变）
├── state.md         ← 当前状态（session-end 自动更新）
├── sessions.md      ← 最近 3 天会话摘要（session-end 自动追加）
└── decisions.md     ← 关键决策（手动或 AI 自动记录）
```

### 各文档职责

| 文档 | 谁写 | 什么时候写 | 内容 |
|------|------|-----------|------|
| context.md | pmcp init | 项目初始化时 | 技术栈、目录结构、框架检测 |
| state.md | session-end hook | 每次会话结束 | 当前任务、进度、阻塞点、最近会话 |
| sessions.md | session-end hook | 每次会话结束 | 时间 + 做了什么 + 改了什么文件 |
| decisions.md | 用户/AI | 做关键决策时 | 日期 + 决策 + 原因 |

### 自动维护

```
session-end hook 自动执行：
  1. 读取本次会话的用户消息 + git diff
  2. 生成决策级摘要（3 句话，不是日志）
  3. 追加到 sessions.md
  4. 更新 state.md 的"最近会话"
  5. git commit
```

## 四、工作流引导

`/start` skill 根据 state.md 自动判断下一步：

```
state.md 无活跃任务
  → "描述你的问题，或运行 /plan-prd 开始新需求"

state.md 有任务在进行中
  → "上次在做 {任务}，继续吗？"

state.md 有阻塞点
  → "阻塞在 {问题}，需要先解决这个"
```

## 五、与 ECC 的关系

```
pmcp = 记忆层（跨会话）
ECC  = 执行层（会话内）

pmcp 不做：
  ✗ 工作流编排（ECC planner 做）
  ✗ 代码审查（ECC code-reviewer 做）
  ✗ 测试驱动（ECC tdd-guide 做）
  ✗ 门控拦截（已移除 Hard Gate）

pmcp 做：
  ✓ 记住你昨天做了什么
  ✓ 告诉你当前状态
  ✓ 建议你下一步该做什么
```

## 六、命令速查

| 命令 | 用途 | 速度 |
|------|------|------|
| `/start` | 快速加载记忆 + 建议下一步 | < 1 秒 |
| `pmcp start` | 完整初始化 + 加载上下文 | 3-5 秒 |
| `pmcp setup` | 首次初始化项目 | 5-10 秒 |
| `pmcp bootstrap` | 重新加载上下文 | 1-2 秒 |

## 七、迁移指南

从旧版（v1.5.1 及之前）升级：

```
旧文档（可删除）：
  .github/prompts/recent-5.md
  .github/prompts/summary-10.md
  .github/prompts/todos.md
  .github/prompts/dev-rules.md
  .github/prompts/log-state.json
  .github/prompts/task-state.json
  .github/prompts/focus-spec.md
  .github/prompts/daily/
  .github/prompts/modules/

新文档（自动生成）：
  .github/prompts/context.md    ← 已有，保留
  .github/prompts/state.md      ← 新增
  .github/prompts/sessions.md   ← 新增
  .github/prompts/decisions.md  ← 新增
```

运行 `pmcp start` 会自动检测并生成缺失的新文档。

---
*pmcp v1.5.2 — 个人 AI 记忆层*
