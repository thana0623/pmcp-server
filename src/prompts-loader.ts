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

// ─── 工作流阶段引导 ───────────────────────────────────────────────

interface TaskState {
  stage: string;
  taskId: string;
  contractHash: string;
  history: Array<{ stage: string; entered: string; note?: string }>;
}

function readTaskState(): TaskState | null {
  try {
    const filePath = path.join(getPromptsDir(), 'task-state.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ─── 阶段兼容映射 ────────────────────────────────────────────────────
// 旧阶段名 → 新阶段名（6 阶段流水线）
const STAGE_COMPAT: Record<string, string> = {
  'spec-pending': 'understand',
  confirmed: 'plan',
  'task-planning': 'plan',
  executing: 'implement',
  developing: 'implement',
  incomplete: 'implement',
  testing: 'test',
  reviewing: 'review',
  'user-confirming': 'review',
  completed: 'publish',
  published: 'publish',
  'change-requested': 'understand',
};

function normalizeStage(raw: string): string {
  return STAGE_COMPAT[raw] || raw;
}

const STAGE_GUIDANCE: Record<string, { phase: string; next: string }> = {
  understand: { phase: '需求分析', next: '确认方向后自动进入任务规划' },
  plan: { phase: '任务规划', next: '确认计划后自动开始编码' },
  implement: { phase: '编码实现', next: '完成一个子任务后自动测试' },
  test: { phase: '测试验证', next: '测试通过后自动进入代码审查' },
  review: { phase: '代码审查', next: '审查通过后运行 /end 归档' },
  publish: { phase: '提交发布', next: '运行 /end 归档，session-end 自动 git commit' },
  archived: { phase: '无任务', next: '描述你的问题，开始需求分析' },
};

function getLastCompletedTaskId(taskState: TaskState | null): string {
  if (!taskState?.taskId) return '';
  // Only return taskId if the task is in a terminal state
  const stage = normalizeStage(taskState.stage);
  if (stage === 'archived' || stage === 'publish') {
    return taskState.taskId;
  }
  return '';
}

function formatWorkflowGuidance(taskState: TaskState | null): string {
  const lines: string[] = [];

  lines.push('## 工作流');
  lines.push('');

  if (!taskState || !taskState.stage || normalizeStage(taskState.stage) === 'archived') {
    lines.push('阶段: 无任务');
    lines.push('下一步: 描述你的问题，开始需求分析');
    // Suggest /clear if there was a previous task
    const lastTask = getLastCompletedTaskId(taskState);
    if (lastTask) {
      lines.push('');
      lines.push(`💡 上一个任务「${lastTask}」已归档。如果新需求无关，建议先 /clear 清理上下文。`);
    }
  } else {
    const stage = normalizeStage(taskState.stage);
    const guidance = STAGE_GUIDANCE[stage] || STAGE_GUIDANCE['archived'];
    lines.push(`阶段: ${guidance.phase}（${taskState.taskId || '未命名'}）`);
    lines.push(`下一步: ${guidance.next}`);
  }

  return lines.join('\n');
}

// ─── 格式化 ────────────────────────────────────────────────────────

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

  // 工作流阶段引导
  const taskState = readTaskState();
  lines.push(formatWorkflowGuidance(taskState));
  lines.push('');

  lines.push('---');
  lines.push('');

  // 单行行动提示（不重复阶段信息）
  if (!taskState || !taskState.stage || normalizeStage(taskState.stage) === 'archived') {
    lines.push('上下文已加载。请描述你的问题。');
  }
  lines.push('');

  return lines.join('\n');
}
