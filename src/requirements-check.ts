/**
 * requirements-check.ts
 *
 * 需求方向确认。
 *
 * 核心原则：
 * 1. 对话式追问由 AI 完成，工具只负责保存确认结果
 * 2. 确认后生成简洁的 direction.md
 * 3. 不做硬性 checklist，不阻塞
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getPromptsDir } from './config.js';

// ─── 方向确认 ────────────────────────────────────────────────────────

export interface DirectionInput {
  /** 一句话目标 */
  goal: string;
  /** 关键约束 */
  constraints?: string[];
  /** 验收标准 */
  acceptance?: string;
  /** 补充说明 */
  context?: string;
}

export interface DirectionResult {
  success: boolean;
  filePath?: string;
  content?: string;
  error?: string;
}

/**
 * 保存确认后的方向到 direction.md
 */
export function confirmDirection(input: DirectionInput): DirectionResult {
  const { goal, constraints, acceptance, context } = input;

  if (!goal?.trim()) {
    return { success: false, error: '目标不能为空' };
  }

  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push(`> confirmed: ${now}`);
  lines.push('');
  lines.push('## 目标');
  lines.push(goal.trim());

  if (constraints && constraints.length > 0) {
    lines.push('');
    lines.push('## 约束');
    for (const c of constraints) {
      lines.push(`- ${c}`);
    }
  }

  if (acceptance?.trim()) {
    lines.push('');
    lines.push('## 验收');
    lines.push(acceptance.trim());
  }

  if (context?.trim()) {
    lines.push('');
    lines.push('## 补充');
    lines.push(context.trim());
  }

  lines.push('');

  const content = lines.join('\n');
  const promptsDir = getPromptsDir();
  const filePath = path.join(promptsDir, 'direction.md');

  try {
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, filePath, content };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * 读取当前 direction.md
 */
export function readDirection(): string | null {
  const filePath = path.join(getPromptsDir(), 'direction.md');
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}
