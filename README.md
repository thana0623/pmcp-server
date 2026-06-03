# pmcp

个人 AI 工作流工具。不断优化体验。

解决的核心问题：**我想的是 A，说给 AI 的是 B，做出来的是 B 不是 A。**

---

## 它做什么

```
你描述需求 → AI 追问澄清 → 你确认方向 → AI 开干 → 自动记录到 git
```

就这三件事：

1. **方向确认** — 动手前先对齐，避免做出来不是你想要的
2. **上下文加载** — 每次对话自动加载项目背景，不用从头说
3. **对话留痕** — 每次对话的变更自动 git commit

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
1. 打开项目 → 自动加载上下文
2. 描述需求 → AI 自然追问（不是 checklist，是对话）
3. 确认方向 → pmcp confirm 保存到 direction.md
4. AI 执行 → ECC agents 接管（如果装了 ECC）
5. 关闭会话 → 自动 git commit
```

---

## CLI 命令

```bash
pmcp start              # 启动项目（初始化 + 加载上下文）
pmcp confirm            # 确认方向（AI 追问后调用）
pmcp bootstrap          # 重新加载上下文
pmcp skill list         # 查看可用角色
pmcp module-read <name> # 查看模块历史
pmcp new-requirement    # 开始新需求（重置状态）
```

---

## 方向确认

核心交互。不是 checklist 打分，是对话式追问。

```bash
pmcp confirm --goal "加登录功能" --acceptance "邮箱密码能登录成功"
```

生成 `direction.md`：

```markdown
> confirmed: 2026-06-03T10:30:00Z

## 目标
加登录功能

## 验收
邮箱密码能登录成功
```

---

## 和 ECC 的关系

pmcp 管「确认方向 + 记录留痕」，ECC 管「怎么做代码」。

| pmcp | ECC |
|------|-----|
| 需求确认 → direction.md | 65 个 agents 执行开发 |
| 对话日志 → git 自动提交 | 22 个 hooks 质量保障 |
| 上下文加载（recent-5, summary-10） | 70+ skills 框架模式 |

不装 ECC 也能用，装了 ECC 更强。

---

## 文件结构

```
your-project/
  .github/prompts/
    direction.md        # 确认的方向
    context.md          # 项目上下文
    recent-5.md         # 最近 5 条对话
    summary-10.md       # 滚动摘要
    todos.md            # 待办
    modules/            # 模块变更记录
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
