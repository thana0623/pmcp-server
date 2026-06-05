#!/usr/bin/env node

/**
 * postinstall script: copies commands/*.md to ~/.claude/commands/
 * so that /start and other global commands work immediately after npm i -g.
 */

import { mkdirSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const sourceDir = resolve(join(import.meta.dirname, '..', 'commands'));
const targetDir = join(homedir(), '.claude', 'commands');

try {
  // Ensure target directory exists
  mkdirSync(targetDir, { recursive: true });

  // Copy each .md file (skip if identical)
  const files = readdirSync(sourceDir).filter((f) => f.endsWith('.md'));
  let installed = 0;

  for (const file of files) {
    const src = join(sourceDir, file);
    const dst = join(targetDir, file);
    if (!existsSync(dst)) {
      copyFileSync(src, dst);
      installed++;
    }
  }

  if (installed > 0) {
    console.log(
      `\x1b[32m✅ pmcp-server: installed ${installed} global command(s) to ~/.claude/commands/\x1b[0m`,
    );
  }

  console.log(
    '\x1b[32m✅ pmcp-server installed successfully! Run \x1b[1mpmcp setup\x1b[22m to initialize your project.\x1b[0m',
  );
} catch (err) {
  // Non-fatal: warn but don't block install
  console.warn('⚠️  pmcp-server: could not install global commands:', err.message);
  console.log(
    '\x1b[32m✅ pmcp-server installed successfully! Run \x1b[1mpmcp setup\x1b[22m to initialize your project.\x1b[0m',
  );
}
