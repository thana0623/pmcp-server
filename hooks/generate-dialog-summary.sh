#!/bin/bash
# 会话摘要生成器（assistant-agnostic）
# 从 logs/dialogs/*.jsonl 读取工具调用记录，生成决策级摘要
# 写入 sessions.md 和 state.md
#
# 环境变量（由 adapter 设置）：
#   PROJECT_DIR     — 项目根目录（默认: pwd）
#   PROMPTS_SUBDIR  — prompts 子目录（默认: .github/prompts）
#   SESSION_ID      — 当前 session 标识

set -euo pipefail

export PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
export PROMPTS_SUBDIR="${PROMPTS_SUBDIR:-.github/prompts}"
export PROMPTS_DIR="$PROJECT_DIR/$PROMPTS_SUBDIR"
export DIALOGS_DIR="$PROJECT_DIR/logs/dialogs"
export SESSION_ID="${SESSION_ID:-unknown}"

mkdir -p "$DIALOGS_DIR"

node -e "
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = process.env.PROJECT_DIR;
const PROMPTS_DIR = process.env.PROMPTS_DIR;
const DIALOGS_DIR = process.env.DIALOGS_DIR;
const SESSION_ID = process.env.SESSION_ID;
const PROMPTS_SUBDIR = process.env.PROMPTS_SUBDIR;

const SESSIONS_FILE = path.join(PROMPTS_DIR, 'sessions.md');
const STATE_FILE = path.join(PROMPTS_DIR, 'state.md');

// ─── 从 logs/dialogs/*.jsonl 读取工具调用记录 ────────────────────────
const today = new Date().toISOString().slice(0, 10);
const jsonlFile = path.join(DIALOGS_DIR, today + '.jsonl');

let toolCalls = [];
if (fs.existsSync(jsonlFile) && fs.statSync(jsonlFile).size > 0) {
  const lines = fs.readFileSync(jsonlFile, 'utf8').split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const d = JSON.parse(line);
      // 如果指定了 SESSION_ID，只取当前 session 的记录
      if (SESSION_ID !== 'unknown' && d.session && d.session !== SESSION_ID) continue;
      toolCalls.push(d);
    } catch {}
  }
}

// 无工具调用则跳过
if (toolCalls.length === 0) {
  process.exit(0);
}

// ─── 从工具调用中提取变更文件 ─────────────────────────────────────────
const changedFiles = [...new Set(
  toolCalls
    .filter(c => ['Edit', 'Write', 'NotebookEdit'].includes(c.tool) && c.target)
    .map(c => c.target)
)];

// ─── 从工具调用中提取活动摘要 ─────────────────────────────────────────
const editFiles = toolCalls
  .filter(c => ['Edit', 'Write'].includes(c.tool) && c.target)
  .map(c => c.target)
  .filter((f, i, arr) => arr.indexOf(f) === i)
  .slice(0, 8);

const bashCommands = toolCalls
  .filter(c => c.tool === 'Bash' && c.target)
  .map(c => c.target.slice(0, 100))
  .slice(0, 5);

// 生成"做了什么"描述
let activityDesc = '';
if (editFiles.length > 0) {
  activityDesc = '修改 ' + editFiles.slice(0, 3).join(', ');
  if (editFiles.length > 3) activityDesc += ' 等 ' + editFiles.length + ' 个文件';
} else if (bashCommands.length > 0) {
  activityDesc = '执行命令: ' + bashCommands[0].slice(0, 60);
} else {
  activityDesc = '对话（' + toolCalls.length + ' 次工具调用）';
}

// 生成改动列表
let changesDesc = '';
if (changedFiles.length > 0) {
  const displayFiles = changedFiles.slice(0, 5);
  changesDesc = displayFiles.join(', ');
  if (changedFiles.length > 5) {
    changesDesc += ' 等 ' + changedFiles.length + ' 个文件';
  }
}

// ─── 写入 sessions.md ────────────────────────────────────────────────
const now = new Date();
const hour = now.getHours();
const period = hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上';

const sessionBlock = [
  '',
  '## ' + today + ' ' + period,
  '',
  '- **做了什么**: ' + activityDesc,
  changesDesc ? '- **改动**: ' + changesDesc : '- **改动**: (无代码修改)',
  '- **消息数**: ' + toolCalls.length + ' 条',
  ''
].join('\n');

// 追加到 sessions.md
let sessionsContent = '';
if (fs.existsSync(SESSIONS_FILE)) {
  sessionsContent = fs.readFileSync(SESSIONS_FILE, 'utf8');
} else {
  sessionsContent = '# 会话记录\n\n> 由 session-end hook 自动维护。保留最近 3 天。\n';
}

// 追加新条目
sessionsContent = sessionsContent.trimEnd() + '\n' + sessionBlock + '\n';

// 裁剪：只保留最近 3 天的条目
const allBlocks = sessionsContent.split(/\n(?=## \d{4}-\d{2}-\d{2} )/);
const header = allBlocks[0];
const entries = allBlocks.slice(1);

// 按日期分组，保留最近 3 天
const dateGroups = new Map();
for (const entry of entries) {
  const dateMatch = entry.match(/^## (\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    const date = dateMatch[1];
    if (!dateGroups.has(date)) dateGroups.set(date, []);
    dateGroups.get(date).push(entry);
  }
}

const sortedDates = [...dateGroups.keys()].sort().slice(-3);
const recentEntries = sortedDates.map(d => dateGroups.get(d).join('\n')).join('\n');

sessionsContent = header.trimEnd() + '\n' + recentEntries + '\n';

fs.writeFileSync(SESSIONS_FILE, sessionsContent);

// ─── 更新 state.md ──────────────────────────────────────────────────
let stateContent = '';
if (fs.existsSync(STATE_FILE)) {
  stateContent = fs.readFileSync(STATE_FILE, 'utf8');
} else {
  stateContent = [
    '# 项目状态',
    '',
    '## 当前任务',
    '（无活跃任务）',
    '',
    '## 进度',
    '（无）',
    '',
    '## 阻塞点',
    '（无）',
    '',
  ].join('\n');
}

// 更新"最近会话"部分
const lastSessionLine = '- ' + today + ' ' + period + ': ' + activityDesc.slice(0, 100);
if (stateContent.includes('## 最近会话')) {
  stateContent = stateContent.replace(
    /## 最近会话\n[\s\S]*?(?=\n## |$)/,
    '## 最近会话\n' + lastSessionLine + '\n'
  );
} else {
  stateContent = stateContent.trimEnd() + '\n\n## 最近会话\n' + lastSessionLine + '\n';
}

fs.writeFileSync(STATE_FILE, stateContent);

console.log('会话摘要已生成: ' + today + ' ' + period + ' (' + toolCalls.length + ' 次调用, ' + changedFiles.length + ' 个文件修改)');
"
