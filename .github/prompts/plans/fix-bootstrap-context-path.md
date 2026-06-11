# Fix: bootstrap 加载时 context.md 路径找不到

## 诊断
- 模块: `prompts-loader.ts` + `config.ts`
- 根因: `config.projectRoot` 默认用 `process.cwd()`，没有像 `session-start.cjs` 一样遍历目录找项目根。当 cwd 不是项目根目录时，路径拼接错误。

## 修复方案
1. 在 `config.ts` 中添加 `findProjectRoot()` 函数（复用 session-start.cjs 的逻辑）
2. `config.projectRoot` 默认值改为 `findProjectRoot()` 而非 `process.cwd()`
3. 查找策略：先找 `.pmcp-root` 标记，再找 `.github/prompts/context.md`

## 影响范围
- `src/config.ts` — projectRoot 默认值逻辑
- 所有依赖 `getProjectRoot()` 的模块（prompts-loader、prompts-generator、module-logger 等）

## 验证方式
- 在项目根目录运行 `node build/cli.js bootstrap` → 正常加载
- 在子目录运行 `node ../build/cli.js bootstrap` → 也能找到项目根
