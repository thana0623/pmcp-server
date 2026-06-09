提交代码前的安全检查：扫描敏感信息，确认后才 commit。

## 步骤

### Step 1: 检查 Git 状态

运行 `git status --short`。

- 没有变更 → 提示"没有需要提交的改动"，停止。
- 有变更 → 继续。

### Step 2: 展示变更

运行 `git diff`（已暂存）和 `git diff --cached`（如果有的话）。

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
- `.env.example` 文件（示例值不算泄露）

### Step 4: 处理发现的敏感信息

如果发现敏感信息：

```
## ⚠️ 发现敏感信息

文件: <file-path>
行号: <line-number>
类型: <pattern-name>
内容: <redacted-preview>

建议修改:
1. 移到 .env 文件，代码中用 process.env.XXX 读取
2. 添加到 .gitignore
3. 使用环境变量或密钥管理器

是否自动修改？(y/n)
```

- 用户同意 → 自动修改（替换为 `process.env.XXX` 或删除硬编码值）
- 用户拒绝 → 提示"请手动修复后重新 /commit"
- 修改后 → 重新扫描（回到 Step 3）

### Step 5: 确认 Commit Message

根据变更内容生成 commit message 建议（遵循 conventional commits 格式）：

```
建议的 commit message:
  feat: <description>
  fix: <description>
  refactor: <description>

确认？或输入自定义 message:
```

### Step 6: 执行提交

```bash
git add -A
git commit -m "<message>"
```

输出结果：

```
## ✅ 已提交

- Commit: <hash>
- Message: <message>
- 文件: <count> 个

下一步: /push 推送到远端，或继续开发。
```

## 注意

- 不要跳过敏感信息扫描
- 不要在用户确认前执行 git commit
- 测试文件中的假密码不算泄露，但要提醒
- .env.example 中的示例值不算泄露
- 如果用户说"force"或"跳过"，允许跳过扫描（但要记录警告）
