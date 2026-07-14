---
name: git-workflow
description: Git 工作流 — 安全提交、推送、发布
---

## 身份

你是 Git 工作流守门员。负责安全地提交、推送、发布代码。

## /commit 流程

### Step 1: 检查 Git 状态

用 Bash 运行 `git status --short`。

- 没有变更 → 提示"没有需要提交的改动"，停止。
- 有变更 → 继续。

### Step 2: 展示变更

用 Bash 运行 `git diff` 和 `git diff --cached`。

输出变更摘要：哪些文件改了，改了什么。不超过 15 行。

### Step 3: 扫描敏感信息

对所有变更的文件运行敏感信息扫描。检查以下模式：

| 模式 | 说明 |
|------|------|
| `password\s*[:=]\s*['"][^'"]+['"]` | 密码赋值 |
| `api[_-]?key\s*[:=]\s*['"][^'"]+['"]` | API key |
| `secret\s*[:=]\s*['"][^'"]+['"]` | secret 赋值 |
| `token\s*[:=]\s*['"][^'"]+['"]` | token 赋值 |
| `BEGIN\s+(RSA\|DSA\|EC\|OPENSSH)\s+PRIVATE\s+KEY` | 私钥 |
| DB 连接串含密码 | 匹配 `[protocol]://user:pass@host` 格式 |
| `AKIA[0-9A-Z]{16}` | AWS Access Key |

**排除检查：**
- `.gitignore` 中的文件
- `logs/` 目录
- `*.test.*` / `*.spec.*` 测试文件
- `.env.example` 文件

### Step 4: 确认 Commit Message

根据变更内容生成 commit message 建议（遵循 conventional commits 格式）。

### Step 5: 执行提交

```bash
git add -A
git commit -m "<message>"
```

## /push 流程

### Step 1: 检查远端状态

```bash
git fetch origin
git status -sb
```

- 本地落后于远端 → 提示"建议先 pull"
- 本地领先或同步 → 继续

### Step 2: 确认推送

展示分支、远端、提交数，确认后执行。

### Step 3: 执行推送

```bash
git push origin <current-branch>
```

## /end 流程

### Step 1: 检查 Git 变更

- 有未提交的改动 → 提示 `/commit`
- 没有改动 → 继续

### Step 2: 敏感信息审查

运行 `pmcp audit`。

### Step 3: 归档任务

将 direction.md/focus-spec.md 移入 focus-spec-history/。

### Step 4: 更新 HOT_STATE.md

标记会话已结束，保留最后内容。

### Step 5: 输出总结

```
## 本轮开发完成

- 敏感审查: 通过
- 归档: <归档文件或"无">
- 热状态: 已更新

描述新需求开始下一轮。
```

## 禁止

- 不要跳过敏感信息扫描
- 不要 force push（除非用户明确要求）
- 不要自动创建 PR（除非用户明确要求）
