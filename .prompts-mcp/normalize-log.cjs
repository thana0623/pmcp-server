#!/usr/bin/env node
/**
 * Universal PostToolUse hook (assistant-agnostic)
 * Normalizes tool call data for any supported assistant and appends to dialog log
 *
 * Supports:
 *   Claude Code: {"tool_name":"Edit","tool_input":{"file_path":"src/file.ts"},"session_id":"abc123",...}
 *   Codex: {"tool_name":"shell_command","tool_input":{"command":"npm test"},"session":"abc123",...}
 */

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.env.CODEX_PROJECT_DIR || process.cwd();

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    if (process.stdin.isTTY) { resolve(''); } else { process.stdin.resume(); }
  });
}

async function main() {
  const input = await readStdin();
  if (!input.trim()) return;

  let data;
  try {
    data = JSON.parse(input.replace(/^\uFEFF/, '').trim());
  } catch {
    return;
  }

  const toolName = data.tool_name || data.tool || 'unknown';
  const ti = data.tool_input || {};
  const session = data.session_id || data.session || 'unknown';

  // Detect assistant automatically
  const isCodex = data.assistant === 'codex'
    || toolName === 'shell_command'
    || toolName === 'apply_patch'
    || toolName.startsWith('mcp__')
    || toolName.startsWith('codex_app__');
  const assistant = isCodex ? 'codex' : 'claude-code';

  // Skip read-only tools (completely silent)
  const skip = ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
    'TaskList', 'TaskGet', 'TaskOutput', 'Skill'];
  if (skip.includes(toolName)) return;

  // Build display tool name and summary
  let displayTool = toolName;
  let target = '';
  let summary = 'Tool call: ' + toolName;

  if (isCodex) {
    // Map Codex-specific tool names to readable names
    if (toolName === 'shell_command') {
      displayTool = 'Bash';
      target = (ti.command || '').slice(0, 200);
      summary = 'Ran: ' + target.slice(0, 100);
    } else if (toolName === 'apply_patch') {
      displayTool = 'Edit';
      target = ti.file_path || '';
      summary = 'Edited: ' + target;
    } else if (toolName.startsWith('mcp__codegraph__')) {
      displayTool = 'CodeGraph';
      target = ti.query || ti.symbol || ti.task || '';
      summary = toolName.replace('mcp__codegraph__', '');
    } else if (toolName.startsWith('mcp__')) {
      displayTool = 'MCP';
      target = ti.query || ti.symbol || '';
      summary = toolName.replace(/^mcp__[^_]+__/, '');
    } else if (toolName === 'tool_search') {
      displayTool = 'ToolSearch';
      target = ti.query || '';
      summary = 'Searched: ' + target;
    }
  } else {
    // Keep Claude Code tool names as-is
    displayTool = toolName;
    switch (toolName) {
      case 'Edit':
        target = ti.file_path || '';
        summary = 'Modified ' + target;
        break;
      case 'Write':
        target = ti.file_path || '';
        summary = 'Created/rewrote ' + target;
        break;
      case 'Bash':
        target = (ti.command || '').slice(0, 200);
        summary = 'Ran: ' + target.slice(0, 100);
        break;
      case 'NotebookEdit':
        target = ti.notebook_path || '';
        summary = 'Edited notebook ' + target;
        break;
      case 'TaskCreate':
        target = ti.subject || '';
        summary = 'Created task: ' + target;
        break;
      case 'TaskUpdate':
        target = ti.taskId || '';
        summary = 'Updated task ' + target + ' -> ' + (ti.status || '');
        break;
      case 'Agent':
        target = (ti.agent_type || '') + (ti.label ? ':' + ti.label : '');
        summary = 'Agent: ' + (ti.agent_type || '');
        break;
    }
  }

  // Lightweight logging for Agent-like calls (separate file)
  if (toolName === 'Agent') {
    const dialogsDir = path.join(PROJECT_DIR, 'logs', 'dialogs');
    fs.mkdirSync(dialogsDir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const readsFile = path.join(dialogsDir, today + '.reads.jsonl');
    const entry = {
      tool: displayTool, session, time: new Date().toISOString(),
      target: (ti.agent_type || '') + (ti.label ? ':' + ti.label : '')
    };
    fs.appendFileSync(readsFile, JSON.stringify(entry) + '\n');
    return;
  }

  const entry = {
    tool: displayTool,
    target: String(target).slice(0, 500),
    summary: String(summary).slice(0, 500),
    session, time: new Date().toISOString(), assistant
  };

  const logsDir = path.join(PROJECT_DIR, 'logs', 'dialogs');
  fs.mkdirSync(logsDir, { recursive: true });

  // Anti-feedback-loop: skip hook infrastructure paths
  if (/auto-log\.sh|process-logs\.sh|session-end\.sh|normalize-log\./.test(target)) return;
  if (/\.codex[/\\](hooks|settings|rules)/.test(target)) return;

  const logFile = path.join(logsDir, new Date().toISOString().slice(0, 10) + '.jsonl');
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
}

main();
