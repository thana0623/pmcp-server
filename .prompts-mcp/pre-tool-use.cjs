#!/usr/bin/env node
/**
 * PreToolUse Hook - Scope Guard (v2: 3-stage lifecycle)
 *
 * Stage-based write control:
 *   understand  -> direction.md + task-state.json writable
 *   executing   -> IN scope writable (ECC agent development)
 *   closing     -> task-state.json writable; other files read-only
 *   archived    -> all writes ALLOWED (ready for new requirement)
 *
 * Legacy stages (still supported for backward compatibility):
 *   spec-pending      -> only focus-spec.md and task-state.json writable
 *   confirmed         -> focus-spec.md BLOCKED; other files hash-verified + scope-checked
 *   task-planning     -> focus-spec.md writable (add task breakdown); IN scope writable
 *   developing        -> IN scope writable
 *   reviewing         -> all writes BLOCKED
 *   user-confirming   -> only task-state.json writable
 *   change-requested  -> all project files writable
 *   completed         -> all writes BLOCKED
 *   incomplete        -> same as developing
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

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
    const plansDir = path.join(cwd, '.github', 'prompts', 'plans');

    // Read task state
    let stage = 'understand';
    let storedHash = '';
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      stage = state.stage || 'understand';
      storedHash = state.contractHash || '';
    } catch (_) {
      stage = 'understand';
    }

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

    // === New 3-stage lifecycle ===

    // understand: direction.md + task-state.json + plans/ writable
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

    // executing: IN scope writable (ECC handles the details)
    if (stage === 'executing') {
      // Try to read IN scope from focus-spec.md or direction.md in plans/
      let specContent = '';
      try {
        specContent = fs.readFileSync(specPath, 'utf8');
      } catch (_) {
        // focus-spec.md doesn't exist, try direction.md in plans/
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

      // Extract IN patterns
      const inPatterns = [];
      for (const line of specContent.split('\n')) {
        const m = line.match(/^IN:\s*(.+)$/);
        if (m) {
          inPatterns.push(m[1].trim().replace(/[锛?][^锛?]*[锛?]\s*$/, '').trim());
        }
      }

      // If no IN patterns found, allow all writes (ECC is in control)
      if (inPatterns.length === 0) {
        process.exit(0);
      }

      if (inPatterns.includes('*')) {
        process.exit(0);
      }

      const matches = inPatterns.some(p => {
        const np = p.replace(/\\/g, '/');
        if (np.endsWith('/**')) {
          const dir = np.slice(0, -3);
          return normalizedFile.startsWith(dir + '/') || normalizedFile === dir;
        }
        if (np.includes('*')) {
          const regex = new RegExp('^' + np.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
          return regex.test(normalizedFile);
        }
        return normalizedFile === np || normalizedFile.startsWith(np + '/');
      });

      if (!matches) {
        process.stderr.write('[hook] BLOCKED: out of scope, file=' + normalizedFile + '\n');
        process.exit(2);
      }

      process.exit(0);
    }

    // closing: task-state.json + recent-5.md + summary-10.md writable
    if (stage === 'closing') {
      if (normalizedFile.endsWith('/recent-5.md') || normalizedFile.endsWith('/summary-10.md')) {
        process.exit(0);
      }
      if (normalizedFile.endsWith('/archive-index.md')) {
        process.exit(0);
      }
      process.stderr.write('[hook] BLOCKED: stage=closing, file=' + normalizedFile + '\n');
      process.exit(2);
    }

    // archived: all writes allowed
    if (stage === 'archived') {
      process.exit(0);
    }

    // === Legacy stages (backward compatibility) ===

    if (normalizedFile.endsWith('/focus-spec.md') || normalizedFile === 'focus-spec.md') {
      if (stage === 'confirmed') {
        process.stderr.write('[hook] BLOCKED: contract locked (stage=confirmed)\n');
        process.exit(2);
      }
      process.exit(0);
    }

    // spec-pending: only focus-spec.md and plans/ writable
    if (stage === 'spec-pending') {
      if (normalizedFile.includes('/plans/')) {
        process.exit(0);
      }
      process.stderr.write('[hook] BLOCKED: stage=spec-pending, file=' + normalizedFile + '\n');
      process.exit(2);
    }

    // confirmed: hash integrity check
    if (stage === 'confirmed') {
      let specContent = '';
      try {
        specContent = fs.readFileSync(specPath, 'utf8');
      } catch (_) {
        process.stderr.write('[hook] BLOCKED: cannot read focus-spec.md\n');
        process.exit(2);
      }

      const actualHash = crypto.createHash('sha256').update(specContent).digest('hex');
      if (!storedHash || actualHash !== storedHash) {
        try {
          const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
          state.stage = 'spec-pending';
          state.history = state.history || [];
          state.history.unshift({
            stage: 'spec-pending',
            entered: new Date().toISOString(),
            note: 'hash mismatch'
          });
          fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
        } catch (_) {}

        process.stderr.write('[hook] BLOCKED: hash mismatch\n');
        process.exit(2);
      }
      // Hash OK -> fall through to IN scope check
    }

    // task-planning: focus-spec writable
    if (stage === 'task-planning') {
      if (normalizedFile.endsWith('/focus-spec.md') || normalizedFile === 'focus-spec.md') {
        process.exit(0);
      }
    }

    // developing/incomplete/task-planning: IN scope writable
    if (stage === 'developing' || stage === 'incomplete' || stage === 'task-planning') {
      let specContent = '';
      try {
        specContent = fs.readFileSync(specPath, 'utf8');
      } catch (_) {
        process.stderr.write('[hook] BLOCKED: cannot read focus-spec.md\n');
        process.exit(2);
      }

      const inPatterns = [];
      for (const line of specContent.split('\n')) {
        const m = line.match(/^IN:\s*(.+)$/);
        if (m) {
          inPatterns.push(m[1].trim().replace(/[锛?][^锛?]*[锛?]\s*$/, '').trim());
        }
      }

      if (inPatterns.length === 0) {
        process.stderr.write('[hook] BLOCKED: no IN scope defined\n');
        process.exit(2);
      }

      if (inPatterns.includes('*')) {
        process.exit(0);
      }

      const matches = inPatterns.some(p => {
        const np = p.replace(/\\/g, '/');
        if (np.endsWith('/**')) {
          const dir = np.slice(0, -3);
          return normalizedFile.startsWith(dir + '/') || normalizedFile === dir;
        }
        if (np.includes('*')) {
          const regex = new RegExp('^' + np.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
          return regex.test(normalizedFile);
        }
        return normalizedFile === np || normalizedFile.startsWith(np + '/');
      });

      if (!matches) {
        process.stderr.write('[hook] BLOCKED: out of scope, file=' + normalizedFile + '\n');
        process.exit(2);
      }

      process.exit(0);
    }

    // reviewing: all writes BLOCKED
    if (stage === 'reviewing') {
      process.stderr.write('[hook] BLOCKED: stage=reviewing\n');
      process.exit(2);
    }

    // user-confirming: only task-state.json writable
    if (stage === 'user-confirming') {
      process.stderr.write('[hook] BLOCKED: stage=user-confirming\n');
      process.exit(2);
    }

    // completed: all writes BLOCKED
    if (stage === 'completed') {
      process.stderr.write('[hook] BLOCKED: stage=completed\n');
      process.exit(2);
    }

    // change-requested: allow all
    if (stage === 'change-requested') {
      process.exit(0);
    }

    // Default: allow
    process.exit(0);
  } catch (_) {
    process.exit(0);
  }
});
