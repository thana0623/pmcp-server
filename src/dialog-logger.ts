/**
 * dialog-logger.ts
 *
 * 对话日志记录模块。
 * 职责：管理 todos.md 的写入。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Todos ──────────────────────────────────────────────────────────

function appendTodos(promptsDir: string, todos: string[]): void {
  const todosPath = path.join(promptsDir, 'todos.md');
  let content = '';
  if (fs.existsSync(todosPath)) {
    content = fs.readFileSync(todosPath, 'utf-8');
  } else {
    content = `# 待办事项\n\n## 进行中\n\n*(暂无)*\n\n## 已完成\n\n*(暂无)*\n`;
  }

  const inProgressMarker = '## 进行中';
  const idx = content.indexOf(inProgressMarker);
  if (idx !== -1) {
    const afterMarker = content.indexOf('\n', idx) + 1;
    const newTodos = todos.map(t => `- [ ] ${t}`).join('\n');
    content = content.slice(0, afterMarker) + `\n${newTodos}` + content.slice(afterMarker);
  }

  fs.writeFileSync(todosPath, content, 'utf-8');
}

// ─── High-level: logDialog ──────────────────────────────────────────

export interface LogDialogParams {
  title: string;
  request: string;
  changes?: string[];
  decisions?: string[];
  todos?: string[];
}

export interface LogDialogResult {
  today: string;
}

/**
 * 记录一次对话日志。
 * 此函数只负责 todos.md 的追加。
 */
export function logDialog(
  promptsDir: string,
  params: LogDialogParams
): LogDialogResult {
  const today = new Date().toISOString().slice(0, 10);
  const todos = params.todos || [];

  if (todos.length > 0) {
    appendTodos(promptsDir, todos);
  }

  return { today };
}
