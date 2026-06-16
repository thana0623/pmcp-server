# pmcp

AI 无关的上下文生命周期基础设施。让你跨会话连续工作，不丢上下文。

核心问题：**新会话不知道上一个会话在做什么，只能靠 git diff 推测。**

---

## 快速开始

```bash
npm install -g pmcp-server
cd /your/project
pmcp setup
```

SessionStart hook 自动加载上下文，SessionEnd hook 自动更新热状态。

---

## 核心概念：HOT_STATE.md

项目根目录下的单一热状态文件，记录：
- 当前任务
- 最近讨论
- 下一步
- 阻塞点

**自动更新**：/loop 定时更新 + session-end 兜底。  
**自动加载**：/start 读取 HOT_STATE.md 恢复上下文。

---

## 命令

| 命令 | 用途 |
|------|------|
| `/start` | 加载 HOT_STATE.md，恢复上下文 |
| `/end` | 敏感审查 + 归档 + 更新热状态 |
| `/loop` | 启动定时热状态更新（CronCreate） |
| `/test <bug>` | 诊断 → 修复 → 轮次管控（5 轮自动 /end） |
| `/commit` | 敏感扫描 + 提交 |
| `/push` | 推送到远端 |
| `/plan-prd` | 生成 PRD |
| `/plan` | 生成实现计划 |

---

## 日常开发流程

```
/start → 描述需求 → /plan-prd → /plan → 写代码 → 手动测试
  ↓
/test <bug> → 修 → 重测 → 修 → ...（5 轮自动 /end）
  ↓
测试通过 → /commit → /push → /end
```

### 上下文管理

**核心原则**：每个会话只做一件事，做完就 /end。

| 场景 | 操作 |
|------|------|
| 对话超过 30 轮 | /end，开新会话 /start |
| AI 开始重复试过的方案 | /end，开新会话 |
| 一个 bug 修了 5 轮 | /test 自动提醒 /end |
| 换一个完全不同的任务 | /end，开新会话 |

HOT_STATE.md 自动记录进度，新会话 /start 恢复上下文，不用从头来。

---

## 上下文文件

| 文件 | 职责 | 谁维护 |
|------|------|--------|
| `context.md` | 项目全貌（技术栈、结构） | pmcp setup / bootstrap |
| `HOT_STATE.md` | 会话热状态 | /loop + session-end hook |
| `todos.md` | 待办事项 | /test + log_dialog |

---

## CLI 命令

```bash
pmcp setup              # 首次初始化
pmcp start              # 启动项目（非 Claude Code 环境）
pmcp bootstrap          # 重新加载上下文
pmcp audit              # 敏感信息审查
pmcp publish            # 一键发布
pmcp skill list         # 查看可用角色
```

---

## 文件结构

```
your-project/
  .github/prompts/
    context.md              # 项目上下文
    todos.md                # 待办事项
    skills/                 # 角色定义
    focus-spec-history/     # 归档的任务
  HOT_STATE.md              # 会话热状态（根目录）
  .prompts-mcp/             # hooks（自动生成）
  logs/dialogs/             # 对话日志（自动生成）
```

---

## 技术栈

- TypeScript (ESM)
- @modelcontextprotocol/sdk
- Bash hooks（零依赖）

---

MIT
