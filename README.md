# pmcp

个人 AI 工作流工具。自动引导你从需求到发布。

解决的核心问题：**我想的是 A，说给 AI 的是 B，做出来的是 B 不是 A。**

---

## 它做什么

```
你描述需求 → AI 追问澄清 → 自动拆任务 → 逐项编码 → 逐项测试 → 代码审查 → 敏感审查 → 提交发布
```

6 阶段自动引导，你只需在关键节点确认：

1. **需求分析** — AI 追问澄清，产出方向确认
2. **任务规划** — 自动拆分为可执行子任务
3. **编码实现** — 每个子任务自动引入 CodeGraph 上下文
4. **测试验证** — 每完成一项自动测试，不等全部做完
5. **代码审查** — 自动调用 code-reviewer，发现问题自动回退修复
6. **提交发布** — 敏感信息审查 → git commit → push → 可选 npm 发布

---

## 快速开始

```bash
# 安装（一次性）
npm install -g pmcp-server

# 启动项目
cd /your/project
pmcp start
```

完事。SessionStart hook 自动加载上下文，SessionEnd hook 自动 git commit。

---

## 日常流程

```
1. 打开项目 → 自动加载上下文 + 显示当前阶段
2. 描述需求 → AI 自然追问（不是 checklist，是对话）
3. 确认方向 → 自动进入任务规划
4. 确认计划 → 自动开始逐项编码
5. 每完成一项 → 自动测试 → 通过后继续下一项
6. 全部完成 → 自动代码审查 → 审查通过
7. 敏感审查 → git commit → push → 发布
8. 下一个需求 → 无关时自动提示 /clear 清理上下文
```

---

## 6 阶段开发流水线

```
Understand → Plan → Implement → Test → Review → Publish
  需求分析    拆任务    编码实现     测试    代码审查   提交发布
```

| 阶段 | 做什么 | 自动引导 |
|------|--------|---------|
| Understand | AI 追问澄清，产出 direction.md | 确认后自动进入 Plan |
| Plan | 调用 planner 拆分子任务 | 确认后自动进入 Implement |
| Implement | 逐项编码，CodeGraph 辅助上下文 | 每项完成后自动进入 Test |
| Test | 运行测试 + 手动验证引导 | 通过后继续下一项或进入 Review |
| Review | 调用 code-reviewer 全面审查 | 通过后自动进入 Publish |
| Publish | 敏感审查 → commit → push → 发布 | 完成后归档，提示 /clear |

### CodeGraph 集成

在 Implement 和 Review 阶段自动引入 CodeGraph：

| 时机 | 工具 | 目的 |
|------|------|------|
| 开始子任务前 | `codegraph_context` | 理解相关代码结构 |
| 修改已有功能 | `codegraph_trace` | 追踪调用链 |
| 新增功能 | `codegraph_search` | 找类似模式参考 |
| 改完代码后 | `codegraph_impact` | 检查影响范围 |
| Review 阶段 | `codegraph_explore` | 审查上下文 |

---

## CLI 命令

```bash
pmcp start              # 启动项目（初始化 + 加载上下文）
pmcp setup              # 完整初始化（prompts + hooks + MCP + skills）
pmcp bootstrap          # 重新加载上下文
pmcp confirm            # 确认方向（AI 追问后调用）
pmcp audit              # 敏感信息审查
pmcp publish            # 一键发布（审查 + 版本 + npm + push）
pmcp skill list         # 查看可用角色
pmcp tools              # 扫描项目工具
```

---

## 上下文管理

pmcp 维护 4 个核心文档（每次会话自动加载）：

| 文件 | 职责 |
|------|------|
| `context.md` | 项目全貌（技术栈、结构） |
| `state.md` | 当前状态（任务、进度、阻塞） |
| `sessions.md` | 最近会话（自动归档） |
| `decisions.md` | 关键决策 |

任务完成后自动归档到 `focus-spec-history/`。

### /clear 引导

当一个任务归档后，如果下一个需求和上一个无关，系统会主动提示：

```
上一个任务「xxx」已归档。如果新需求无关，建议先 /clear 清理上下文。
```

避免旧任务信息干扰新需求。

---

## 和 ECC 的关系

pmcp 管「确认方向 + 自动引导 + 记录留痕」，ECC 管「怎么做代码」。

| pmcp | ECC |
|------|-----|
| 6 阶段自动引导 | 65 个 agents 执行开发 |
| 需求确认 → direction.md | 22 个 hooks 质量保障 |
| 上下文 4 文件记忆 | 70+ skills 框架模式 |
| CodeGraph 集成时机 | code-reviewer / tdd-guide |

不装 ECC 也能用，装了 ECC 更强。

---

## 文件结构

```
your-project/
  .github/prompts/
    context.md          # 项目上下文
    state.md            # 当前状态
    sessions.md         # 会话记录
    decisions.md        # 关键决策
    task-state.json     # 阶段状态机
    skills/             # 角色定义
    focus-spec-history/ # 归档的任务
  .prompts-mcp/         # hooks + adapter（自动生成）
  logs/dialogs/         # 对话日志（自动生成）
```

---

## 技术栈

- TypeScript (ESM)
- @modelcontextprotocol/sdk
- Bash hooks（零依赖）

---

## 开发

```bash
npm install
npm run build
npm test
```

---

MIT
