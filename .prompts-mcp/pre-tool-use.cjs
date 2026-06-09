#!/usr/bin/env node
/**
 * PreToolUse Hook - Scope Guard (v3: 6-stage lifecycle)
 *
 * Stage-based write control (new 6-stage pipeline):
 *   understand  -> direction.md + task-state.json + plans/ writable
 *   plan        -> task-state.json + plans/ writable
 *   implement   -> IN scope writable (project source code)
 *   test        -> test files + task-state.json writable
 *   review      -> task-state.json only (read-review stage)
 *   publish     -> task-state.json + recent-5.md + summary-10.md writable
 *   archived    -> all writes ALLOWED (ready for new requirement)
 *
 * Legacy stages are auto-mapped to new stages for backward compatibility.
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// ─── Stage compatibility mapping ─────────────────────────────────────
const STAGE_COMPAT = {
  'spec-pending': 'understand',
  'confirmed': 'plan',
  'task-planning': 'plan',
  'executing': 'implement',
  'developing': 'implement',
  'incomplete': 'implement',
  'testing': 'test',
  'reviewing': 'review',
  'user-confirming': 'review',
  'completed': 'publish',
  'published': 'publish',
  'change-requested': 'understand',
};

function normalizeStage(raw) {
  return STAGE_COMPAT[raw] || raw;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const tool = data.tool_name || '';
    const file = (data.tool_input && data.tool_input.file_path) || '';

    // Non-write tools -> allow
    if (tool !== 'Write' && tool !== 'Edit' && tool !== 'apply_patch') {
      process.exit(0);
    }

    const cwd = process.cwd().replace(/\\/g, '/');
    const statePath = path.join(cwd, '.github', 'prompts', 'task-state.json');
    const specPath = path.join(cwd, '.github', 'prompts', 'focus-spec.md');
    const directionPath = path.join(cwd, '.github', 'prompts', 'direction.md');
    const plansDir = path.join(cwd, '.github', 'prompts', 'plans');

    // Read task state (strip BOM if present)
    let rawStage = 'understand';
    let storedHash = '';
    try {
      const raw = fs.readFileSync(statePath, 'utf8').replace(/^﻿/, '');
      const state = JSON.parse(raw);
      rawStage = state.stage || 'understand';
      storedHash = state.contractHash || '';
    } catch (_) {
      rawStage = 'understand';
    }

    const stage = normalizeStage(rawStage);

    // Normalize file path
    let normalizedFile = file.replace(/\\/g, '/');
    if (normalizedFile.startsWith(cwd + '/')) {
      normalizedFile = normalizedFile.slice(cwd.length + 1);
    }
    normalizedFile = normalizedFile.replace(/^\.[\/]/, '').replace(/^\//, '');

    // task-state.json -> always allow
    if (normalizedFile.endsWith('/task-state.json') || normalizedFile === 'task-state.json') {
      process.exit(0);
    }

    // state.md -> always allow (for "发现的问题" updates)
    if (normalizedFile.endsWith('/state.md') || normalizedFile === 'state.md') {
      process.exit(0);
    }

    // ─── New 6-stage lifecycle ───────────────────────────────────────

    // understand: direction.md + plans/ writable
    if (stage === 'understand') {
      if (normalizedFile.endsWith('/direction.md') || normalizedFile.endsWith('/focus-spec.md')) {
        process.exit(0);
      }
      if (normalizedFile.includes('/plans/')) {
        process.exit(0);
      }
      process.stderr.write('[hook] BLOCKED: stage=understand, file=' + normalizedFile + '\n');
      process.exit(2);
    }

    // plan: plans/ writable (for architecture docs, task breakdown)
    if (stage === 'plan') {
      if (normalizedFile.includes('/plans/')) {
        process.exit(0);
      }
      if (normalizedFile.endsWith('/direction.md') || normalizedFile.endsWith('/focus-spec.md')) {
        process.exit(0);
      }
      process.stderr.write('[hook] BLOCKED: stage=plan, file=' + normalizedFile + '\n');
      process.exit(2);
    }

    // implement: IN scope writable (project source code)
    if (stage === 'implement') {
      const inPatterns = readInPatterns(specPath, directionPath, plansDir);

      // If no IN patterns found, allow all writes (ECC is in control)
      if (inPatterns.length === 0) {
        process.exit(0);
      }

      if (inPatterns.includes('*')) {
        process.exit(0);
      }

      const matches = inPatterns.some(p => matchPattern(p, normalizedFile));
      if (!matches) {
        process.stderr.write('[hook] BLOCKED: out of scope, file=' + normalizedFile + '\n');
        process.exit(2);
      }
      process.exit(0);
    }

    // test: test files + task-state.json writable
    if (stage === 'test') {
      // Allow test files, spec files, and common test patterns
      if (normalizedFile.includes('.test.') || normalizedFile.includes('.spec.') ||
          normalizedFile.includes('__tests__') || normalizedFile.includes('/test/') ||
          normalizedFile.includes('/tests/')) {
        process.exit(0);
      }
      // Also allow IN scope (implementation fixes during test)
      const inPatterns = readInPatterns(specPath, directionPath, plansDir);
      if (inPatterns.length === 0 || inPatterns.includes('*')) {
        process.exit(0);
      }
      const matches = inPatterns.some(p => matchPattern(p, normalizedFile));
      if (matches) {
        process.exit(0);
      }
      process.stderr.write('[hook] BLOCKED: stage=test, file=' + normalizedFile + '\n');
      process.exit(2);
    }

    // review: read-only stage, only task-state.json writable (already handled above)
    if (stage === 'review') {
      process.stderr.write('[hook] BLOCKED: stage=review (read-only), file=' + normalizedFile + '\n');
      process.exit(2);
    }

    // publish: session management files writable
    if (stage === 'publish') {
      if (normalizedFile.endsWith('/recent-5.md') || normalizedFile.endsWith('/summary-10.md')) {
        process.exit(0);
      }
      if (normalizedFile.endsWith('/sessions.md') || normalizedFile.endsWith('/archive-index.md')) {
        process.exit(0);
      }
      process.stderr.write('[hook] BLOCKED: stage=publish, file=' + normalizedFile + '\n');
      process.exit(2);
    }

    // archived: all writes allowed
    if (stage === 'archived') {
      process.exit(0);
    }

    // Default: allow
    process.exit(0);
  } catch (_) {
    process.exit(0);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────

function readInPatterns(specPath, directionPath, plansDir) {
  let specContent = '';

  // Try direction.md first, then focus-spec.md
  try {
    if (fs.existsSync(directionPath)) {
      specContent = fs.readFileSync(directionPath, 'utf8');
    }
  } catch (_) {}

  if (!specContent) {
    try {
      if (fs.existsSync(specPath)) {
        specContent = fs.readFileSync(specPath, 'utf8');
      }
    } catch (_) {}
  }

  if (!specContent) {
    try {
      if (fs.existsSync(plansDir)) {
        const dirs = fs.readdirSync(plansDir);
        for (const d of dirs) {
          const dp = path.join(plansDir, d, 'direction.md');
          if (fs.existsSync(dp)) {
            specContent = fs.readFileSync(dp, 'utf8');
            break;
          }
          const sp = path.join(plansDir, d, 'focus-spec.md');
          if (fs.existsSync(sp)) {
            specContent = fs.readFileSync(sp, 'utf8');
            break;
          }
        }
      }
    } catch (_) {}
  }

  const inPatterns = [];
  for (const line of specContent.split('\n')) {
    const m = line.match(/^IN:\s*(.+)$/);
    if (m) {
      inPatterns.push(m[1].trim().replace(/[​‌‍﻿]/g, '').trim());
    }
  }
  return inPatterns;
}

function matchPattern(pattern, filePath) {
  const np = pattern.replace(/\\/g, '/');
  if (np.endsWith('/**')) {
    const dir = np.slice(0, -3);
    return filePath.startsWith(dir + '/') || filePath === dir;
  }
  if (np.includes('*')) {
    const regex = new RegExp('^' + np.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
    return regex.test(filePath);
  }
  return filePath === np || filePath.startsWith(np + '/');
}
