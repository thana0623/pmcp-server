/**
 * prompts-loader.ts
 *
 * 轻量记忆层加载模块。
 * 只加载 context.md，HOT_STATE.md 由 /start 命令直接读取。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getPromptsDir } from './config.js';
import { formatSkillList } from './skills-manager.js';

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
  hasEcc: boolean;
  skills: string;
}

// ─── Prompt Loaders ──────────────────────────────────────────────────

function loadContext(): LoadedContext {
  const filePath = path.join(getPromptsDir(), 'context.md');
  return { content: readFileSafe(filePath), path: filePath };
}

// ─── Bootstrap ───────────────────────────────────────────────────────

/**
 * 一键启动：加载项目上下文
 */
export function bootstrap(): BootstrapResult {
  const context = loadContext();

  const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
  const hasEcc = fs.existsSync(path.join(homeDir, '.claude', 'rules', 'ecc'));
  const skills = formatSkillList({ hasEcc });

  return { context, hasEcc, skills };
}

// ─── 格式化 ────────────────────────────────────────────────────────

/**
 * 格式化 bootstrap 结果为精简文本
 */
export function formatBootstrap(result: BootstrapResult): string {
  const lines: string[] = [];

  lines.push('# pmcp');
  lines.push('');

  // 项目上下文
  if (result.context.content) {
    lines.push('## 项目上下文');
    lines.push('');
    const contextLines = result.context.content.split('\n').slice(0, 30);
    lines.push(...contextLines);
    if (result.context.content.split('\n').length > 30) lines.push('... (截断)');
    lines.push('');
  }

  // Skills
  if (result.skills) {
    lines.push(result.skills);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('上下文已加载。请描述你的问题。');
  lines.push('');

  return lines.join('\n');
}
