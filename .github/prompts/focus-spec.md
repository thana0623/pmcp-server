> task-id: native-claude-code-skills
> created: 2026-05-24T09:12:00Z
> status: confirmed

## 1. 场景还原

`pmcp start` 启动后，用户输入 `/analyst`、`/architect`、`/backend` 等 Claude Code 原生 slash command 来激活角色，角色 prompt 加载后指导 Claude 按 pmcp 规范工作。

## 2. 核心业务边界

IN: src/cli.ts
IN: src/prompts-loader.ts
IN: .github/prompts/task-state.json
IN: .github/prompts/focus-spec.md
OUT: src/index.ts
OUT: hooks/
OUT: adapters/
IN: package.json

## 3. 禁止触碰黑名单

- 禁止删除 pmcp skill 文件（.github/prompts/skills/）
- 禁止在 skill 转换时引入 npm YAML 解析库
- 禁止修改 parseFrontmatter 函数

## 4. 核心测试断言清单

- assertCompilePass()
- assertTrue(fs.existsSync('.claude/skills/analyst/SKILL.md'))
- assertTrue(fs.existsSync('.claude/skills/architect/SKILL.md'))
- assertStringContains(SKILL.md content, 'user-invocable: true')
