# 实施计划：会话命令体系重构

## PRD

`.github/prompts/plans/session-commands.prd.md`

## 概览

5 个里程碑，按依赖顺序：先修 /end 注册机制（验证 slash 命令体系可用），再修 /start，再新建 /commit 和 /push，最后清理 session-end。

---

## Milestone 1: 修复 /end 注册

**目标**: /end slash 命令能正常触发

**问题诊断**:
- `commands/` 目录下没有 `end.md` — 只有 `start.md` 被 `postinstall` 脚本复制到 `~/.claude/commands/`
- `.github/prompts/skills/end.md` 存在但属于 skill 系统，不是 Claude Code 的 `/end` slash command
- 需要创建 `commands/end.md` 并在 `scripts/install-commands.js` 中注册

**改动文件**:
- `commands/end.md` — 新建，Claude Code slash command 版本
- `scripts/install-commands.js` — 确认 end.md 会被复制
- `.github/prompts/skills/end.md` — 可能需要微调内容

**验证**: 在 Claude Code 中输入 `/end`，能看到命令被识别并执行

---

## Milestone 2: 修复 /start 引导

**目标**: /start 启动时给出清晰流程引导，不被 hook 报错干扰

**问题诊断**:
- `commands/start.md` 存在但内容可能不够清晰
- PostToolUse hook（normalize-log.cjs）报错是独立问题 — 需要排查 `.prompts-mcp/normalize-log.cjs` 第 1 行的错误
- session-start.cjs 的引导输出可能被淹没在 bootstrap 大段输出中

**改动文件**:
- `commands/start.md` — 重写引导内容，让它更清晰
- `.github/prompts/skills/start.md` — 同步更新
- `.prompts-mcp/normalize-log.cjs` — 修复第 1 行报错

**验证**: /start 启动后看到清晰的 3-5 行引导，无 hook 报错

---

## Milestone 3: 新建 /commit 命令

**目标**: 用户主动触发，扫描敏感信息，确认后才 commit

**功能设计**:
1. 运行 `git diff --staged` 或 `git status` 展示变更
2. 扫描敏感信息模式（API key、密码、数据库连接串、私钥、token）
3. 如果发现敏感信息：
   - 阻断提交
   - 列出具体文件和行号
   - 给出修改建议（如：移到 .env、添加到 .gitignore）
   - 用户同意后自动修改
   - 重新扫描，通过后继续
4. 用户确认 commit message
5. 执行 `git add` + `git commit`

**敏感信息模式**:
- `password\s*[:=]` — 密码赋值
- `api[_-]?key\s*[:=]` — API key
- `secret\s*[:=]` — secret 赋值
- `token\s*[:=]` — token 赋值
- `BEGIN\s+(RSA|DSA|EC|OPENSSH)\s+PRIVATE\s+KEY` — 私钥
- DB 连接串含密码 — 匹配 `[protocol]://user:pass@host` 格式
- `AKIA[0-9A-Z]{16}` — AWS Access Key

**改动文件**:
- `commands/commit.md` — 新建，Claude Code slash command
- `.github/prompts/skills/commit.md` — 新建，skill 版本
- `scripts/install-commands.js` — 注册 commit.md

**验证**: 创建一个含密码的文件，/commit 应阻断并给出建议

---

## Milestone 4: 新建 /push 命令

**目标**: 用户主动触发，默认推送当前分支，用户要求时才创建 PR

**功能设计**:
1. 检查当前分支状态（是否有未提交的更改）
2. 检查与远端的差异（`git fetch` + `git status`）
3. 如果有冲突，提示用户先解决
4. 默认行为：`git push origin <current-branch>`
5. 如果用户说"创建 PR"或"提起 PR"：
   - 使用 `gh pr create` 或提示用户填写 PR 信息
   - 支持 MR（GitLab）的未来扩展

**改动文件**:
- `commands/push.md` — 新建，Claude Code slash command
- `.github/prompts/skills/push.md` — 新建，skill 版本
- `scripts/install-commands.js` — 注册 push.md

**验证**: /push 能正常推送分支，/push "创建 PR" 能创建 PR

---

## Milestone 5: 移除 session-end 自动提交

**目标**: session-end hook 只处理日志摘要，不执行 git 操作

**改动文件**:
- `.prompts-mcp/session-end.cjs` — 删除 `git add` 和 `git commit` 逻辑，保留 `generate-dialog-summary.sh` 调用
- `hooks/session-end.sh` — 同步删除 git 操作
- `adapters/claude-code/session-end.sh` — 同步删除 git 操作（如果有的话）

**保留的内容**:
- `generate-dialog-summary.sh` 调用 — 生成会话摘要写入 sessions.md
- `process-logs.sh` 调用 — 处理未处理的日志

**验证**: 结束会话后，sessions.md 有更新，但 `git log` 中没有新的 auto commit

---

## 依赖关系

```
Milestone 1 (修复 /end) ──→ Milestone 3 (新建 /commit) ──→ Milestone 5 (移除自动提交)
                   └──→ Milestone 2 (修复 /start)
                   └──→ Milestone 4 (新建 /push)
```

Milestone 1 必须先完成（验证 slash 命令注册机制可用），其他可以并行。

## 风险

| 风险 | 应对 |
|------|------|
| /commit 扫描误报 | 提供 `--force` 跳过选项 |
| 移除自动提交后用户忘记 commit | /end 归档前检查是否有未提交更改并提醒 |
| commands/ 安装脚本不生效 | 手动验证 `~/.claude/commands/` 目录 |
