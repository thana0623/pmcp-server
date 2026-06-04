#!/bin/bash
# 会话摘要生成器（assistant-agnostic）
# 读取 session 的用户消息 + git diff，生成决策级摘要
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
export SESSIONS_DIR="$PROJECT_DIR/logs/sessions"
export DIALOGS_DIR="$PROJECT_DIR/logs/dialogs"
export SESSION_ID="${SESSION_ID:-unknown}"

mkdir -p "$DIALOGS_DIR"

node -e "
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = process.env.PROJECT_DIR;
const PROMPTS_DIR = process.env.PROMPTS_DIR;
const SESSIONS_DIR = process.env.SESSIONS_DIR;
const SESSION_ID = process.env.SESSION_ID;

const SESSIONS_FILE = path.join(PROMPTS_DIR, 'sessions.md');
const STATE_FILE = path.join(PROMPTS_DIR, 'state.md');

// ─── 读取用户消息 ─────────────────────────────────────────────────────
const promptFile = path.join(SESSIONS_DIR, SESSION_ID + '.prompts.jsonl');
let userMessages = [];
if (fs.existsSync(promptFile)) {
  const lines = fs.readFileSync(promptFile, 'utf8').split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const d = JSON.parse(line);
      if (d.prompt) userMessages.push(d.prompt);
    } catch {}
  }
}

// 无用户消息则跳过（自动化 session）
if (userMessages.length === 0) {
  process.exit(0);
}

// ─── 获取变更文件 ──────────────────────────────────────────────────────
let changedFiles = [];
try {
  const status = execSync('git status --porcelain', {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    timeout: 5000
  }).trim();
  if (status) {
    changedFiles = status.split('\n')
      .map(l => l.slice(3).trim())
      .filter(f => f && !f.startsWith('logs/') && !f.startsWith(PROMPTS_SUBDIR));
  }
} catch {}

// 也检查今天的 git commits
try {
  const log = execSync('git log --since=\"today\" --name-only --oneline', {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    timeout: 5000
  }).trim();
  if (log) {
    const commitFiles = log.split('\n')
      .filter(l => l && !l.match(/^[a-f0-9]{7,}/) && !l.startsWith('logs/') && !l.startsWith(PROMPTS_SUBDIR));
    changedFiles = [...new Set([...changedFiles, ...commitFiles])];
  }
} catch {}

// ─── 生成决策级摘要 ──────────────────────────────────────────────────
const firstMsg = userMessages[0];
const cleanMsg = firstMsg
  .replace(/^(你好|hi|hello|hey|嗨|哈喽)[,，\s]*/i, '')
  .replace(/^(请|帮我|帮忙|麻烦|能不能|可以帮我)[,，\s]*/i, '')
  .trim();
const userQuestion = cleanMsg.length > 0 ? cleanMsg.slice(0, 200) : firstMsg.slice(0, 200);

// 生成改动列表（最多 5 个文件）
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
const timeStr = now.toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+/, '');
const today = now.toISOString().slice(0, 10);
const hour = now.getHours();
const period = hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上';

const sessionBlock = [
  '',
  '## ' + today + ' ' + period,
  '',
  '- **做了什么**: ' + userQuestion,
  changesDesc ? '- **改动**: ' + changesDesc : '- **改动**: (无代码修改)',
  '- **消息数**: ' + userMessages.length + ' 条',
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
const lastSessionLine = '- ' + today + ' ' + period + ': ' + userQuestion.slice(0, 100);
if (stateContent.includes('## 最近会话')) {
  // 替换最近会话部分
  stateContent = stateContent.replace(
    /## 最近会话\n[\s\S]*?(?=\n## |$)/,
    '## 最近会话\n' + lastSessionLine + '\n'
  );
} else {
  // 追加最近会话部分
  stateContent = stateContent.trimEnd() + '\n\n## 最近会话\n' + lastSessionLine + '\n';
}

fs.writeFileSync(STATE_FILE, stateContent);

console.log('会话摘要已生成: ' + today + ' ' + period + ' (' + userMessages.length + ' 条消息, ' + changedFiles.length + ' 个文件)');
"
