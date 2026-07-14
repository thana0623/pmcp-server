---
description: 代码审查 — 引导 CodeGraph 独立 review，换模型换上下文找问题
---

代码审查引导命令。目标：用 CodeGraph 做独立的代码审查，不被执行阶段的上下文污染。

## 使用方式

```
/code-review
```

## 核心原则

1. **独立上下文** — review 阶段不复用 build 阶段的上下文
2. **换模型** — 建议用不同模型做 review（如 build 用 deepseek，review 用 mimo）
3. **只找问题** — review 只负责发现问题，不负责修复
4. **输出修复任务** — 发现问题后生成修复任务，回到 build 循环

## 流程

### Step 1: 确认变更范围

运行 `git diff --stat` 和 `git diff --name-only`，列出本次变更的文件。

输出：

```
本次变更涉及 N 个文件：
- [file 1] — [改动类型：新增/修改/删除]
- [file 2] — [改动类型]
...

准备进行代码审查。
```

### Step 2: 引导 CodeGraph review

提示用户：

```
建议用 CodeGraph 进行独立 review：

方式 1：换模型（推荐）
  在新窗口中用不同模型运行 OpenCode，执行以下 review：
  
  "请审查以下文件的代码质量，重点关注：
   1. SQL 注入风险
   2. XSS 漏洞
   3. 硬编码密钥/凭据
   4. N+1 查询
   5. 认证鉴权漏洞
   6. 输入校验缺失
   7. 异常处理不当
   
   使用 codegraph_trace 追踪调用链，
   使用 codegraph_impact 评估改动影响范围。
   
   文件列表：
   [Step 1 中的文件列表]"

方式 2：同窗口 review
  直接在当前会话中用 CodeGraph 工具审查。
```

### Step 3: Review Checklist

输出标准化的 review checklist：

```markdown
## Code Review Checklist

### 安全性
- [ ] SQL 注入：所有数据库查询是否使用参数化？
- [ ] XSS：用户输入是否在输出时转义？
- [ ] 硬编码凭据：代码中是否有明文密码/API key/token？
- [ ] 认证鉴权：接口是否有权限校验？
- [ ] CSRF：状态变更接口是否有 CSRF 防护？

### 代码质量
- [ ] 输入校验：外部输入是否校验？
- [ ] 异常处理：错误是否被捕获并妥善处理？
- [ ] N+1 查询：是否有循环内的数据库查询？
- [ ] 资源释放：文件/连接是否正确关闭？
- [ ] 类型安全：是否有 any 类型或类型断言？

### 架构一致性
- [ ] 模块边界：是否遵循现有架构模式？
- [ ] 命名规范：是否与项目风格一致？
- [ ] 重复代码：是否有可以提取的公共逻辑？

### 可维护性
- [ ] 函数长度：单个函数是否过长（> 50 行）？
- [ ] 注释：复杂逻辑是否有注释？
- [ ] 测试：新增代码是否有对应测试？
```

### Step 4: 收集 Review 结果

用户完成 review 后，收集发现的问题：

```
请列出 review 发现的问题（按严重程度排序）：

1. 🔴 CRITICAL — [问题描述] — [文件:行号]
2. 🟡 WARNING — [问题描述] — [文件:行号]
3. 🟢 INFO — [问题描述] — [文件:行号]
```

### Step 5: 生成修复任务

如果有 CRITICAL 或 WARNING 级别的问题：

```
发现 N 个需要修复的问题。生成修复任务：

## 修复任务

### Task 1: [问题描述]
- 文件: [file:line]
- 问题: [具体问题]
- 修复方案: [建议的修复方式]

### Task 2: [问题描述]
- 文件: [file:line]
- 问题: [具体问题]
- 修复方案: [建议的修复方式]

请修复后重新运行测试（/test），然后再次 /code-review 确认。
```

如果只有 INFO 级别的问题：

```
Review 通过，未发现 CRITICAL/WARNING 级别问题。
N 个 INFO 级别建议可后续优化。

可以继续 /commit 提交代码。
```

## 注意

- review 只找问题不修复，修复是 build 阶段的事
- 如果用户没有 CodeGraph，可以退化为手动 review（用 grep 和 read 检查）
- review 结果不需要写入文件，直接在对话中输出即可
- 每次 build 后都应该走一次 /code-review
