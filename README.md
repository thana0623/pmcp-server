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

## 斜杠命令

在 AI 助手中直接使用：

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
| `/recommend` | 根据场景推荐工具 |
| `/scenes` | 列出所有开发场景 |

---

## CLI 命令

### 项目生命周期

```bash
pmcp setup              # 首次初始化（生成 prompts + hooks + MCP 配置）
pmcp start              # 一键启动（初始化 + 加载上下文 + 角色选择）
pmcp bootstrap          # 重新加载上下文（已初始化项目）
pmcp refresh-context    # 刷新 context.md 技术栈（保留用户编辑）
pmcp confirm --goal "..." # 方向确认（保存到 direction.md）
```

### 日志与模块追踪

```bash
pmcp log --title "..." --request "..."   # 记录对话日志（追加到 todos.md）
pmcp module-log <name> --change "..."    # 记录模块修改
pmcp module-read <name>                  # 读取模块历史
pmcp module-list                         # 列出所有模块记录
```

### 工具与场景

```bash
pmcp tools              # 扫描项目已安装工具，输出能力清单
pmcp scenes             # 列出所有开发场景及推荐工具
pmcp recommend coding   # 推荐指定场景下应使用的工具
```

### Skill 系统

```bash
pmcp skill init         # 初始化全局 skill 仓库
pmcp skill list         # 列出所有可用 skill
pmcp skill create <n>   # 创建新的自定义 skill
pmcp skill sync         # 同步全局 skill 到当前项目
pmcp skill export       # 导出项目 skill 到全局仓库
```

### 发布

```bash
pmcp audit              # 发布前隐私审计（扫描密钥/Token/密码）
pmcp publish            # 一键发布：审计 + 版本 bump + npm + git + link
pmcp publish --bump minor --token <npm_token>
```

### 注册

```bash
pmcp register           # 注册 pmcp 为用户级已知命令（~/.claude/CLAUDE.md）
pmcp unregister         # 取消注册
```

---

## 内置 Skill（17 个）

| Skill | 图标 | 说明 |
|-------|------|------|
| analyst | 📋 | 需求分析师，场景还原、边界枚举、反例验证 |
| architect | 🏗️ | 系统架构师，架构一致性、模块边界、API 规范 |
| audit | 🔒 | 发布前隐私审计 |
| backend | 🔧 | 后端开发专家，API 设计、数据库、服务端架构 |
| backend-java | ☕ | SpringBoot 后端工程师 |
| commit | 🔒 | 安全提交 — 敏感扫描 + diff 预览 + 确认 |
| database-handler | 🗄️ | 数据库处理员，数据插入/修改/清洗/备份 |
| devops | 🚀 | 运维工程师，Docker、CI/CD、监控 |
| end | 🏁 | 结束开发 — 审查变更、归档任务、清理上下文 |
| frontend | 🎨 | 前端 UI 工程师，现代化 UI 系统 |
| publish | 🚀 | 一键安全发布 |
| push | 🚀 | 推送分支 — 冲突检查 + 确认后推送 |
| recommend | 🎯 | 根据场景推荐工具 |
| review | 🔍 | 代码审查员，架构一致性、命名规范、坏模式检测 |
| scenes | 🎬 | 列出所有开发场景 |
| start | 🚀 | 快速启动 — 加载项目记忆 |
| tools | 🔧 | 扫描已安装工具 |

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

## 支持的 AI 助手

claude-code / cline / cursor / windsurf / copilot / continue

---

## 技术栈

- TypeScript (ESM)
- @modelcontextprotocol/sdk
- Bash hooks（零依赖）

---

MIT
