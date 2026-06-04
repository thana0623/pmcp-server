/**
 * prompts-loader.ts
 *
 * 轻量记忆层加载模块。
 * 只加载 4 个文档：context.md / state.md / sessions.md / decisions.md
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getProjectRoot, getPromptsDir } from './config.js';
import { formatSkillList } from './skills-manager.js';

export { getProjectRoot, getPromptsDir };

// ─── 文件读取 ────────────────────────────────────────────────────────

function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

// ─── 数据类型 ────────────────────────────────────────────────────────

export interface LoadedContext {
  content: string;
  path: string;
}

export interface BootstrapResult {
  context: LoadedContext;
  state: LoadedContext;
  sessions: LoadedContext;
  decisions: LoadedContext;
  hasEcc: boolean;
  skills: string;
}

// ─── Prompt Loaders ──────────────────────────────────────────────────

export function loadContext(): LoadedContext {
  const filePath = path.join(getPromptsDir(), 'context.md');
  return { content: readFileSafe(filePath), path: filePath };
}

export function loadState(): LoadedContext {
  const filePath = path.join(getPromptsDir(), 'state.md');
  return { content: readFileSafe(filePath), path: filePath };
}

export function loadSessions(): LoadedContext {
  const filePath = path.join(getPromptsDir(), 'sessions.md');
  return { content: readFileSafe(filePath), path: filePath };
}

export function loadDecisions(): LoadedContext {
  const filePath = path.join(getPromptsDir(), 'decisions.md');
  return { content: readFileSafe(filePath), path: filePath };
}

// ─── Bootstrap ───────────────────────────────────────────────────────

/**
 * 一键启动：加载 4 文档记忆
 */
export function bootstrap(): BootstrapResult {
  const context = loadContext();
  const state = loadState();
  const sessions = loadSessions();
  const decisions = loadDecisions();

  const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
  const hasEcc = fs.existsSync(path.join(homeDir, '.claude', 'rules', 'ecc'));
  const skills = formatSkillList({ hasEcc });

  return { context, state, sessions, decisions, hasEcc, skills };
}

/**
 * 格式化 bootstrap 结果为精简文本
 */
export function formatBootstrap(result: BootstrapResult): string {
  const lines: string[] = [];

  lines.push('# pmcp');
  lines.push('');

  // 项目状态
  if (result.state.content) {
    lines.push('## 项目状态');
    lines.push('');
    const stateLines = result.state.content.split('\n').slice(0, 15);
    lines.push(...stateLines);
    if (result.state.content.split('\n').length > 15) lines.push('... (截断)');
    lines.push('');
  }

  // 最近会话
  if (result.sessions.content) {
    lines.push('## 最近会话');
    lines.push('');
    const sessionLines = result.sessions.content.split('\n').slice(0, 10);
    lines.push(...sessionLines);
    if (result.sessions.content.split('\n').length > 10) lines.push('... (截断)');
    lines.push('');
  }

  // 关键决策
  if (result.decisions.content) {
    lines.push('## 关键决策');
    lines.push('');
    const decisionLines = result.decisions.content.split('\n').slice(0, 10);
    lines.push(...decisionLines);
    if (result.decisions.content.split('\n').length > 10) lines.push('... (截断)');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('上下文已加载。请描述你的问题。');
  lines.push('');

  return lines.join('\n');
}
