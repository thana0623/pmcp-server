# Plan: 隐私审计引擎

**Source PRD**: `.claude/prds/safe-publish.prd.md`
**Selected Milestone**: #1 隐私审计引擎 — 脚本扫描 + AI 审查，拦截密钥/token/密码
**Complexity**: Medium

## Summary

新增 `secret-scanner.ts` 模块，在发布前扫描代码中的隐私信息（API Key、密码、Token、私钥等）。通过 MCP tool `audit_secrets` 暴露给 AI，CLI 命令 `pmcp audit` 直接调用。扫描通过后才能执行发布流程。

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `src/requirements-check.ts:18-34` | Input/Result 接口分离 |
| Errors | `src/requirements-check.ts:82-86` | `{ success, error }` 返回模式 |
| CLI | `src/cli.ts:1561-1573` | switch-case + dynamic import |
| MCP tool | `src/index.ts:390-398` | scan_tools 注册方式 |

## Files to Change

| File | Action | Why |
|---|---|---|
| `src/secret-scanner.ts` | **CREATE** | 核心模块：隐私信息扫描引擎 |
| `src/index.ts` | **UPDATE** | 注册 `audit_secrets` MCP tool |
| `src/cli.ts` | **UPDATE** | 添加 `pmcp audit` CLI 命令 |
| `src/__tests__/secret-scanner.test.ts` | **CREATE** | 单元测试 |

## Tasks

### Task 1: 创建 `src/secret-scanner.ts`

- **Action**: 新建模块，实现隐私信息扫描
- **核心函数**:
  - `scanSecrets(projectRoot: string): ScanResult` — 扫描项目文件
  - `scanFile(filePath: string): Finding[]` — 扫描单个文件
  - `matchPatterns(line: string): PatternMatch[]` — 正则匹配
- **扫描模式**:
  - API Key: `/(?:api[_-]?key|apikey)\s*[:=]\s*['"]([a-zA-Z0-9]{20,})['"]/i`
  - Token: `/(?:token|access[_-]?token)\s*[:=]\s*['"]([a-zA-Z0-9]{20,})['"]/i`
  - Password: `/(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"]/i`
  - Private Key: `/-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/`
  - AWS Key: `/AKIA[0-9A-Z]{16}/`
  - GitHub Token: `/ghp_[a-zA-Z0-9]{36}/`
  - npm Token: `/npm_[a-zA-Z0-9]{36}/`
- **排除规则**:
  - `node_modules/` 目录
  - `.git/` 目录
  - `build/` 目录
  - `.env` 文件（提醒但不拦截）
  - 测试文件中的 mock 数据
- **数据结构**:
  ```typescript
  interface SecretFinding {
    file: string;
    line: number;
    column: number;
    pattern: string;      // 匹配的模式名
    severity: 'critical' | 'high' | 'medium';
    snippet: string;      // 脱敏后的代码片段
  }
  interface ScanResult {
    success: boolean;     // true = 无 critical/high 发现
    findings: SecretFinding[];
    summary: string;      // markdown 格式汇总
  }
  ```
- **Validate**: `npx tsc --noEmit` 通过

### Task 2: 在 `index.ts` 注册 MCP tool

- **Action**: 在 `setupToolHandlers()` 中添加 `audit_secrets` tool
- **Schema**:
  ```json
  {
    "name": "audit_secrets",
    "description": "【隐私审计】扫描代码中的密钥、Token、密码等隐私信息。发布前必须调用。",
    "inputSchema": {
      "type": "object",
      "properties": {
        "projectRoot": { "type": "string", "description": "项目根目录（可选）" }
      }
    }
  }
  ```
- **Validate**: 启动 MCP server 后 `audit_secrets` 可调用

### Task 3: 在 `cli.ts` 添加 `pmcp audit` 命令

- **Action**: 在 `main()` 的 switch-case 中添加 `audit` 分支
- **Behavior**: 调用 `scanSecrets()` 并打印结果，有 critical 发现时 exit 1
- **Validate**: `npx pmcp audit` 输出扫描结果

### Task 4: 单元测试

- **Action**: 创建 `src/__tests__/secret-scanner.test.ts`
- **Tests**:
  - 检测 API Key 模式
  - 检测 Token 模式
  - 检测 Password 模式
  - 检测 Private Key 模式
  - 排除 node_modules
  - 排除测试 mock 数据
  - 无发现时返回 success=true
- **Validate**: `npx vitest run`

## Validation

```bash
# 类型检查
npx tsc --noEmit

# 单元测试
npx vitest run src/__tests__/secret-scanner.test.ts

# CLI 验证
npx pmcp audit

# 构建验证
npm run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 正则误报（如示例代码中的假密钥） | 中 | 提供白名单文件 `.secretscanignore` |
| 扫描大项目慢 | 低 | 限制文件大小 < 1MB，跳过二进制文件 |
| 模式覆盖不全 | 中 | 后续可扩展模式列表 |

## Acceptance

- [ ] `scanSecrets` 能检测 API Key、Token、Password、Private Key
- [ ] 排除 node_modules、.git、build 目录
- [ ] `pmcp audit` CLI 命令可用
- [ ] MCP tool `audit_secrets` 可调用
- [ ] 有 critical 发现时返回非零退出码
- [ ] 单元测试通过
- [ ] `npm run build` 成功
