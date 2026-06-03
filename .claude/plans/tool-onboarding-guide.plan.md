# Plan: 工具能力扫描

**Source PRD**: `.claude/prds/tool-onboarding-guide.prd.md`
**Selected Milestone**: #1 工具能力扫描 — 引入工具后自动识别并输出能力清单
**Complexity**: Medium

## Summary

新增 `tool-scanner.ts` 模块，扫描项目中已安装的工具（npm 依赖、MCP Server 配置、CLI 命令），为每个工具生成"能力卡片"（是什么、解决什么、关键命令、适用场景）。通过 MCP tool `scan_tools` 暴露给 AI，AI 拿到清单后可以主动引导用户使用。

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `src/requirements-check.ts:18-34` | Interface 定义在文件顶部，Input/Result 分离 |
| Errors | `src/requirements-check.ts:82-86` | try-catch + `{ success, error }` 返回模式 |
| Module | `src/requirements-check.ts` | 单文件模块，export 函数 + 接口 |
| MCP tool | `src/index.ts:80-132` | 在 `setupToolHandlers()` 中注册，inputSchema 用 JSON Schema |
| CLI | `src/cli.ts:98-111` | switch-case 分支 + printSeparator 输出 |
| Config | `src/config.ts:39-64` | 集中配置，环境变量覆盖 |

## Files to Change

| File | Action | Why |
|---|---|---|
| `src/tool-scanner.ts` | **CREATE** | 核心模块：扫描工具 + 生成能力卡片 |
| `src/index.ts` | **UPDATE** | 注册 `scan_tools` MCP tool |
| `src/cli.ts` | **UPDATE** | 添加 `pmcp tools` CLI 命令 |
| `src/__tests__/tool-scanner.test.ts` | **CREATE** | 单元测试 |

## Tasks

### Task 1: 创建 `src/tool-scanner.ts`

- **Action**: 新建模块，实现工具扫描逻辑
- **核心函数**:
  - `scanProjectTools(projectRoot: string): ToolInfo[]` — 扫描 package.json 的 dependencies + devDependencies
  - `scanMcpServers(): ToolInfo[]` — 读取 `~/.claude/settings.json` 中的 MCP server 配置
  - `generateToolCard(tool: ToolInfo): string` — 为单个工具生成 markdown 能力卡片
  - `scanAll(): ScanResult` — 汇总所有扫描结果
- **数据结构**:
  ```typescript
  interface ToolInfo {
    name: string;           // 包名或工具名
    source: 'npm' | 'mcp' | 'cli';  // 来源
    version?: string;       // 版本号
    description?: string;   // 一句话描述
    commands?: string[];    // 关键命令
    useCases?: string[];    // 适用场景
  }
  interface ScanResult {
    tools: ToolInfo[];
    summary: string;        // markdown 格式的汇总
  }
  ```
- **Mirror**: `requirements-check.ts` 的 Input/Result 接口模式
- **Validate**: `npx tsc --noEmit` 通过

### Task 2: 在 `index.ts` 注册 MCP tool

- **Action**: 在 `setupToolHandlers()` 中添加 `scan_tools` tool
- **Schema**:
  ```json
  {
    "name": "scan_tools",
    "description": "【工具扫描】扫描项目已安装的工具（npm 依赖、MCP Server），输出能力清单和使用建议。",
    "inputSchema": {
      "type": "object",
      "properties": {
        "projectRoot": { "type": "string", "description": "项目根目录（可选）" }
      }
    }
  }
  ```
- **Mirror**: `init_prompts` tool 的注册方式（`src/index.ts:84-96`）
- **Validate**: 启动 MCP server 后 `scan_tools` 可调用

### Task 3: 在 `cli.ts` 添加 `pmcp tools` 命令

- **Action**: 在 `main()` 的 switch-case 中添加 `tools` 分支
- **Behavior**: 调用 `scanAll()` 并打印结果
- **Mirror**: `module-list` 命令的输出格式（`src/cli.ts`）
- **Validate**: `npx pmcp tools` 输出工具清单

### Task 4: 单元测试

- **Action**: 创建 `src/__tests__/tool-scanner.test.ts`
- **Tests**:
  - `scanProjectTools` 正确解析 package.json
  - `scanMcpServers` 正确读取 settings.json
  - `generateToolCard` 输出格式正确
  - 空项目不报错
- **Mirror**: `requirements-check.test.ts` 的测试结构
- **Validate**: `npx vitest run`

## Validation

```bash
# 类型检查
npx tsc --noEmit

# 单元测试
npx vitest run

# CLI 验证
npx pmcp tools

# 构建验证
npm run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 工具描述信息不全（package.json 中 description 太短） | 高 | MVP 先用 description，后续可扩展为读 README |
| MCP server 配置格式不统一 | 中 | 只解析已知格式，未知格式跳过 |
| 扫描结果太多噪音（devDependencies 中大量无关包） | 中 | 过滤已知工具类别，只展示有意义的 |

## Acceptance

- [ ] `scanProjectTools` 能从 package.json 读取依赖列表
- [ ] `scanMcpServers` 能从 settings.json 读取 MCP 配置
- [ ] `generateToolCard` 为每个工具输出结构化能力卡片
- [ ] `pmcp tools` CLI 命令可用
- [ ] MCP tool `scan_tools` 可调用
- [ ] 单元测试通过
- [ ] `npm run build` 成功
