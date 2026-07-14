# Project: prompts-mcp-server

## 开发命令

```bash
npm run build       # TypeScript 编译（tsc -p tsconfig.json）
npm test            # vitest 运行所有测试
npm run lint        # eslint 检查 src/
npm run lint:fix    # eslint 自动修复
npm run format      # prettier 格式化 src/
npm run dev         # 开发模式启动 MCP Server（tsx src/index.ts）
npm run dev:cli     # 开发模式启动 CLI（tsx src/cli.ts）
```

**验证顺序**：修改代码后，按 `build → test → lint` 顺序验证。

## 架构

双入口架构：

| 入口 | 文件 | 用途 |
|------|------|------|
| MCP Server | `src/index.ts` → `build/index.js` | 通过 stdio 传输，供 AI 助手调用 |
| CLI | `src/cli.ts` → `build/cli.js` | 命令行入口，`pmcp` 命令 |

适配器模式（hooks + adapters）：

- `hooks/` — 共享核心脚本（与 AI 助手无关）
- `adapters/<assistant>/` — 薄包装层，规范化各助手的格式
- 支持的助手：claude-code、cline、cursor、windsurf、copilot、continue

## 模块系统

- ESM（`"type": "module"`）
- Node16 模块解析（`"module": "Node16"`）
- import 路径必须带 `.js` 后缀（如 `import { config } from './config.js'`）
- Target: ES2022

## 测试

- 框架：vitest，配置在 `vitest.config.ts`
- 测试文件：`src/__tests__/*.test.ts`
- 运行全部：`npm test`
- 运行单个：`npx vitest run src/__tests__/frontmatter.test.ts`
- 监听模式：`npm run test:watch`

## 关键源文件

| 文件 | 职责 |
|------|------|
| `src/config.ts` | .env 白名单加载、项目根目录查找（`.pmcp-root` 标记） |
| `src/tool-schemas.ts` | MCP 工具定义（16 个工具的 schema） |
| `src/skills-manager.ts` | Skill CRUD + 全局仓库同步 |
| `src/prompts-generator.ts` | 扫描项目结构，自动生成 prompts 体系 |
| `src/prompts-loader.ts` | bootstrap 加载器 |
| `src/secret-scanner.ts` | 敏感信息扫描 |
| `src/tool-scanner.ts` | 工具能力扫描 + 场景推荐 |
| `src/publisher.ts` | 一键发布（审计 + bump + npm + git） |

## OpenCode 集成

本项目通过 `opencode.json` 配置为 OpenCode 的本地 MCP Server。

- MCP 工具：启动时自动加载 `build/index.js`，16 个工具对 LLM 可用
- Skills：`.opencode/skills/*/SKILL.md`（从 `.github/prompts/skills/` 适配）
- Commands：`.opencode/commands/*.md`（从 `commands/` 适配）

修改 `src/` 下的 TypeScript 代码后，必须 `npm run build` 重新编译，MCP Server 才会使用新代码。

## 开发工作流

### 完整流程

```
/plan-prd → /plan → Build → Test → /code-review → /commit
   ↑                    ↑        │          │
   │                    └────────┘          │
   │                   测试失败回到 Build     │
   │                                        │
   └──────────── review 发现问题 ───────────┘
```

### 各阶段说明

| 阶段 | 命令 | 做什么 | 输出 |
|------|------|--------|------|
| 需求分析 | `/plan-prd` | 追问用户需求，3 个问题多轮追问，无业务死角才停 | `.claude/plans/<id>.prd.md` |
| 任务拆分 | `/plan` | 读 PRD，分阶段拆分任务，列出要改的文件 | `.claude/plans/<id>.plan.md` |
| 执行 | Build | 按 plan 逐项执行，每次改完代码 git commit | 代码变更 |
| 测试 | `/test` | 核心质量保证，测试失败回到 Build | 测试结果 |
| 代码审查 | `/code-review` | 引导 CodeGraph 独立 review，换模型换上下文 | 问题清单 |
| 提交 | `/commit` | 敏感信息扫描 + 提交 | git commit |

### 轮次管控

- 每次 build 结束 → `git commit`（通过 git diff 恢复上下文）
- **5 轮**：提醒"同一问题已修 5 轮"
- **10 轮** 或 **上下文膨胀/注意力分散** → 建议 `/end`，开新窗口
- 新窗口恢复方式：`git diff` + `plan.md` + `HOT_STATE.md`

### 环境管理（PitStop）

当前为 CLI 工具，手动使用，不接入 MCP：

```bash
pitstop check    # 检查环境是否满足要求
pitstop start    # 启动所有服务
pitstop stop     # 一键停止
pitstop report   # 查看日志摘要
```

agent 可以建议用户运行 PitStop，但不自动调用。后续完善后接入 MCP。

### MCP 工具一览

| 前缀 | 来源 | 工具 |
|------|------|------|
| `pmcp_*` | prompts-mcp-server | auto_start, bootstrap, log_dialog, list_skills, select_skill, update_todos 等 17 个 |
| `codegraph_*` | CodeGraph（全局） | codegraph_search, codegraph_explore, codegraph_trace, codegraph_impact 等 |
| `pitstop_*` | PitStop（待接入） | pitstop_check, pitstop_start, pitstop_stop 等 |
