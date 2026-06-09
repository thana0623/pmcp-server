# 项目上下文总览（Context）

> 用途：统一沉淀项目当前技术栈、历史决策、待办事项，以及每日记录索引。
> 自动生成时间: 2026-06-09

## 1. 当前技术栈

### 检测到的语言
- TypeScript
- JavaScript

### 检测到的框架
- (未检测到)

### 构建工具
- npm/yarn/pnpm

### 数据库/中间件
- H2

### 包管理器
- npm

### 项目结构
```
prompts-mcp-server/
├── adapters/
├── build/
├── commands/
├── docs/
├── hooks/
├── logs/
├── rules/
├── scripts/
├── src/
```


## 2. 开发规范

> 以下为通用规范，可根据项目实际情况补充修改。

### 通用原则
1. 所有代码变更必须同步更新对应文档。
2. 每次对话完成后必须执行日志记录。
3. 需求不明确时禁止猜测，必须先澄清。

### 前端规范

- 框架: Unknown
- 组件化开发，保持风格一致
- API 调用统一封装
- 状态管理集中管理


### 后端规范
- (未检测到后端代码)

### 环境配置
- 公共配置可提交
- 本地配置不提交（使用 .example 模板）
- 敏感信息通过环境变量注入

## 3. 待办事项

- [ ] context.md 动态化 — bootstrap 时自动扫描项目结构
- [ ] dialog-logger 补测试
- [ ] 配置 CI/CD 流程

## 4. 全局文档结构

> 全局文档 = 每次会话需维护的核心文件，当前 4 个。
> 项目文档（daily/、skills/、plans/、focus-spec-history/、modules/）用后归档，不维护。

### 核心 4 文件

| 文件 | 职责 | 加载时机 |
|------|------|---------|
| `context.md` | 项目全貌 | `/start` |
| `state.md` | 当前状态 + 阻塞点 | `/start` |
| `sessions.md` | 最近会话 + 任务归档 | `/start` |
| `decisions.md` | 关键决策 | `/start` |

### 自动生成物（不手动维护）

| 文件 | 生成方式 |
|------|---------|
| `recent-5.md` | session-end hook 自动更新 |
| `summary-10.md` | session-end hook 自动更新 |
| `todos.md` | `pmcp setup` 生成，`update_todo` MCP 工具更新 |
| `dev-rules.md` | `pmcp setup` 生成，CLAUDE.md 为权威来源 |
| `task-state.json` | PreToolUse hook 管理 |
| `log-state.json` | dialog-logger 管理 |

### 历史归档（用后丢弃）

- 任务焦点: `focus-spec-history/` — 每个任务完成后归档至此
- 日常记录: `daily/` — 按日期归档

### 参考文档（按需读取，不加载）

- 日志工作流规范: `docs/workflow-log.md`
- v2 架构参考: `docs/v2-architecture-reference.md`
- 模块记录: `.github/prompts/modules/`

## 5. 开发流水线（6 阶段自动引导）

```
Understand → Plan → Implement → Test → Review → Publish
  需求分析    拆任务    编码实现     测试    代码审查   提交发布
```

| 阶段 | 做什么 | 自动引导 |
|------|--------|---------|
| Understand | AI 追问澄清，产出 direction.md | 确认后自动进入 Plan |
| Plan | 调用 planner 拆分子任务 | 确认后自动进入 Implement |
| Implement | 逐项编码，CodeGraph 辅助 | 每项完成后自动进入 Test |
| Test | 运行测试 + 手动验证 | 通过后继续下一项或进入 Review |
| Review | 调用 code-reviewer 审查 | 通过后自动进入 Publish |
| Publish | 敏感审查 → commit → push | 完成后归档，提示 /clear |

### 上下文管理

- 任务归档后，新需求与上一个无关时，主动提示 `/clear` 清理上下文
- 避免旧任务信息干扰新需求
