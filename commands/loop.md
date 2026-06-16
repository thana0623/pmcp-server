启动定时热状态更新。使用 CronCreate 创建 30 分钟循环任务。

## 步骤

1. 使用 CronCreate 工具创建定时任务：
   - cron: `*/30 * * * *`（每 30 分钟）
   - recurring: true
   - prompt: 见下方

2. 告诉用户：已启动热状态更新，每 30 分钟自动记录当前会话状态到 HOT_STATE.md。

3. 如果用户指定了自定义间隔（如 `/loop 15`），使用对应分钟数。

## CronCreate Prompt

使用以下 prompt 作为 CronCreate 的 prompt 参数：

```
更新 HOT_STATE.md 热状态文件。根据当前对话内容，用 Edit 工具更新 HOT_STATE.md 的 4 个 section：
1. 当前任务 — 一句话描述正在做什么
2. 最近讨论 — 最近 2-3 轮对话的关键内容
3. 下一步 — 接下来要做什么
4. 阻塞点 — 当前遇到的问题（无则写"无"）

最后更新时间用当前日期时间。保持简洁，每个 section 不超过 3 行。
```

## 注意

- 这是 Claude Code 的 CronCreate，任务只在当前会话存活
- 7 天后自动过期，需要重新启动
- 窗口关闭后任务消失，但 session-end hook 会兜底更新 HOT_STATE.md
- 不要设置过短的间隔（< 10 分钟），会浪费 token
