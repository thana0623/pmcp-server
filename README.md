# pmcp

个人 AI 工作流工具。自动引导你从需求到发布。

核心问题：**我想的是 A，说给 AI 的是 B，做出来的是 B 不是 A。**

---

## 快速开始

```bash
npm install -g pmcp-server
cd /your/project
pmcp start
```

SessionStart hook 自动加载上下文，SessionEnd hook 自动 git commit。

---

## 两个入口

pmcp 只有两个命令入口：**/start** 和 **/end**。

```
/start ──→ 加载上下文，告诉你当前状态，引导进入 6 阶段流水线
/end   ──→ 审查变更，归档任务，清理上下文，结束本轮开发
```

中间的所有阶段（需求分析 → 拆任务 → 编码 → 测试 → 审查）由 AI 自动引导，你只需在关键节点确认。

---

## 日常流程（一次完整开发）

```
/start
  ↓
描述需求 → AI 追问澄清 → 你确认方向
  ↓
AI 调用 planner 拆任务 → 你确认计划
  ↓
AI 逐项编码（每项自动引入 CodeGraph 上下文）
  ↓
每完成一项 → 自动测试 → 通过继续，失败修复
  ↓
全部完成 → AI 调用 code-reviewer 审查
  ↓
审查通过 → /end（审查 + 归档 + 清理）
```

### 你在每个阶段做什么

| 阶段 | 你做什么 | AI 自动做什么 | 涉及的 ECC 工具 |
|------|---------|--------------|----------------|
| **Understand** | 描述问题，回答追问，确认方向 | 追问澄清，产出 direction.md | — |
| **Plan** | 确认或调整计划 | 调用 planner 拆分子任务 | `planner` agent |
| **Implement** | 等待，或在 AI 卡住时提供信息 | 编码 + CodeGraph 上下文 | `backend`/`frontend`/`architect` agent |
| **Test** | 手动验证（启动服务、访问页面） | 运行测试，失败时自动修复 | `tdd-guide` agent |
| **Review** | 确认审查结果 | 调用 code-reviewer 全面审查 | `code-reviewer` agent |
| **Publish** | 运行 /end 归档 | session-end hook 自动 git commit | `pmcp audit` |

### 测试循环：Bug 是正常的

测试阶段一定会发现 bug 或新需求。这是设计预期，不是流程问题：

```
编码 → 测试 → 发现 bug → 修复 → 重新测试 → 通过 → 下一项
                ↑                              |
                └──────── 如果还失败 ───────────┘
```

**上下文爆炸的应对策略：**

当修复循环超过 3 轮或上下文明显变长时：

1. **当前子任务的 bug** → 继续修，不要中断
2. **发现新需求/新 bug** → 记录到 state.md 的"发现的问题"区域，不要立刻处理
3. **所有子任务完成但 review 发现问题** → 回到 Implement 修，但每修一个就跑一次测试
4. **上下文快满了** → 用 `/end` 归档当前进度，`/clear` 清理，`/start` 继续

```
上下文管理规则：
- 一次只做一件事
- 发现新问题先记下来，不要跳去做
- 修 bug 时不要引入新功能
- 超过 3 轮修复 → /end 归档，/clear 重来
```

---

## /end 流程

`/end` 是 `/start` 的对称操作。一个任务完成或上下文过长时调用。

### /end 做什么

```
1. 敏感信息审查
   - 扫描 API Key / Token / 密码 / 私钥
   - 发现 → 阻止，提示修复
   - 未发现 → 通过

2. 归档任务
   - direction.md → focus-spec-history/
   - state.md → 清空当前任务，保留"发现的问题"
   - sessions.md → 记录本次会话

3. 上下文判断
   - 下一个需求和本次无关 → 提示 /clear
   - 下一个需求和本次相关 → 提示继续
```

> Git commit 由 session-end hook 自动处理，/end 不管提交。

### /end 触发时机

| 时机 | 说明 |
|------|------|
| 所有子任务完成 + review 通过 | 正常结束 |
| 修了 3+ 轮还失败 | 先归档，/clear 后重来 |
| 上下文明显变长 | 归档当前进度，避免丢失 |
| 会话快结束 | 手动触发，确保不丢工作 |
| 需求变更，方向完全不同 | /end 当前 → /clear → /start 新需求 |

---

## CLI 命令速查

```bash
# 生命周期（你最常用的）
pmcp start              # 启动项目，加载上下文
pmcp setup              # 首次初始化（prompts + hooks + MCP + skills）
pmcp bootstrap          # 重新加载上下文（不重新初始化）

# 流水线中 AI 调用的（你一般不需要手动跑）
pmcp confirm            # 确认方向（Understand → Plan 的转折点）
pmcp audit              # 敏感信息审查（Publish 阶段自动调用）
pmcp publish            # 一键发布（审查 + 版本 + npm + push）

# 工具
pmcp skill list         # 查看可用角色
pmcp tools              # 扫描项目工具
```

**什么时候用什么：**

| 场景 | 命令 |
|------|------|
| 新项目首次使用 | `pmcp setup` |
| 每次打开项目 | `pmcp start`（自动） |
| 上下文加载失败 | `pmcp bootstrap` |
| 想手动审查代码 | `pmcp audit` |
| 想发 npm 包 | `pmcp publish` |

---

## 上下文文件

pmcp 维护 4 个核心文件（每次会话自动加载）：

| 文件 | 职责 | 谁维护 |
|------|------|--------|
| `context.md` | 项目全貌（技术栈、结构） | bootstrap 自动刷新 |
| `state.md` | 当前状态（任务、进度、阻塞、发现的问题） | AI + 你 |
| `sessions.md` | 最近会话记录 | session-end hook |
| `decisions.md` | 关键决策（只记"为什么"） | 你 |

### state.md 的"发现的问题"区域

测试循环中发现的 bug 和新需求记录在这里，不立刻处理：

```markdown
## 发现的问题
- [ ] 登录接口返回 500（本轮不修，归档后处理）
- [ ] 用户名校验太宽松（新需求，下一轮做）
```

归档时，这个区域的内容会随 direction.md 一起存入 focus-spec-history/。

---

## 和 ECC 的关系

pmcp 管「搞清楚问题」和「记录结果」，ECC 管「怎么实现代码」。

```
pmcp:  /start → 流水线引导 → /end → 归档
ECC:          planner / backend / frontend / code-reviewer / tdd-guide
```

不装 ECC 也能用（AI 手动执行每个阶段），装了 ECC 后 AI 自动调用对应 agent。

---

## 文件结构

```
your-project/
  .github/prompts/
    context.md              # 项目上下文（自动刷新）
    state.md                # 当前状态 + 发现的问题
    sessions.md             # 会话记录（自动）
    decisions.md            # 关键决策
    task-state.json         # 阶段状态机
    skills/                 # 角色定义
    focus-spec-history/     # 归档的任务
  .prompts-mcp/             # hooks + adapter（自动生成）
  logs/dialogs/             # 对话日志（自动生成）
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
