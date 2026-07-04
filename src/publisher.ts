/**
 * publisher.ts
 *
 * 安全发布流水线。
 *
 * 核心原则：
 * 1. 发布前必须通过隐私审计
 * 2. 一键完成 npm publish + git push + npm link
 * 3. 自动 bump version + 更新 README
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { scanSecrets } from './secret-scanner.js';

// ─── 数据类型 ────────────────────────────────────────────────────────

export type BumpType = 'patch' | 'minor' | 'major';

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  [key: string]: unknown;
}

export interface PublishOptions {
  /** npm Access Token */
  npmToken?: string;
  /** 版本号 bump 类型 */
  bump?: BumpType;
  /** 指定版本号（覆盖 bump） */
  version?: string;
  /** git commit message */
  message?: string;
  /** 跳过隐私审计 */
  skipAudit?: boolean;
  /** 跳过 npm publish */
  skipNpm?: boolean;
  /** 跳过 git push */
  skipGit?: boolean;
  /** 跳过 npm link */
  skipLink?: boolean;
}

export interface PublishResult {
  success: boolean;
  steps: StepResult[];
  error?: string;
}

export interface StepResult {
  name: string;
  success: boolean;
  output?: string;
  error?: string;
}

// ─── 版本管理 ────────────────────────────────────────────────────────

function readPackageJson(projectRoot: string): PackageJson {
  const pkgPath = path.join(projectRoot, 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PackageJson;
}

function writePackageJson(projectRoot: string, pkg: PackageJson): void {
  const pkgPath = path.join(projectRoot, 'package.json');
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

function bumpVersion(current: string, type: BumpType): string {
  const parts = current.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

// ─── README 同步 ─────────────────────────────────────────────────────

function updateReadmeVersion(projectRoot: string, oldVersion: string, newVersion: string): boolean {
  const readmePath = path.join(projectRoot, 'README.md');
  if (!fs.existsSync(readmePath)) return false;

  let content = fs.readFileSync(readmePath, 'utf-8');
  if (!content.includes(oldVersion)) return false;

  content = content.replace(new RegExp(oldVersion.replace(/\./g, '\\.'), 'g'), newVersion);
  fs.writeFileSync(readmePath, content, 'utf-8');
  return true;
}

// ─── 命令执行 ────────────────────────────────────────────────────────

function run(bin: string, args: string[], cwd: string): { success: boolean; output: string } {
  try {
    const output = execFileSync(bin, args, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: output.trim() };
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    return { success: false, output: err.stderr || err.message || '' };
  }
}

// ─── 发布流程 ────────────────────────────────────────────────────────

export function publish(projectRoot: string, options: PublishOptions = {}): PublishResult {
  const root = projectRoot;
  const steps: StepResult[] = [];

  // Step 1: 隐私审计
  if (!options.skipAudit) {
    const auditResult = scanSecrets(root);
    if (!auditResult.success) {
      return {
        success: false,
        steps: [
          {
            name: '隐私审计',
            success: false,
            error: '发现隐私信息，发布已拦截。运行 `pmcp audit` 查看详情。',
          },
        ],
        error: '隐私审计失败',
      };
    }
    steps.push({ name: '隐私审计', success: true, output: '未发现隐私信息' });
  }

  // Step 2: 版本号 bump
  const pkg = readPackageJson(root);
  const oldVersion = pkg.version || '0.0.0';
  let newVersion: string;

  if (options.version) {
    newVersion = options.version;
  } else {
    const bumpType = options.bump || 'patch';
    newVersion = bumpVersion(oldVersion, bumpType);
  }

  pkg.version = newVersion;
  writePackageJson(root, pkg);
  steps.push({ name: '版本号', success: true, output: `${oldVersion} → ${newVersion}` });

  // Step 3: 更新 README
  const readmeUpdated = updateReadmeVersion(root, oldVersion, newVersion);
  steps.push({
    name: 'README 同步',
    success: true,
    output: readmeUpdated ? `已更新 ${oldVersion} → ${newVersion}` : '无需更新',
  });

  // Step 4: npm publish
  if (!options.skipNpm) {
    const npmArgs = options.npmToken
      ? ['publish', `--//registry.npmjs.org/:_authToken=${options.npmToken}`]
      : ['publish'];
    const npmResult = run('npm', npmArgs, root);
    steps.push({
      name: 'npm publish',
      success: npmResult.success,
      output: npmResult.success ? `v${newVersion} 已发布` : npmResult.output,
      error: npmResult.success ? undefined : npmResult.output,
    });
    if (!npmResult.success) {
      return { success: false, steps, error: 'npm publish 失败' };
    }
  }

  // Step 5: git commit + push
  if (!options.skipGit) {
    const commitMsg = options.message || `chore: bump version to ${newVersion}`;
    run('git', ['add', '-A'], root);
    const commitResult = run('git', ['commit', '-m', commitMsg], root);
    steps.push({
      name: 'git commit',
      success: commitResult.success,
      output: commitResult.success ? commitMsg : commitResult.output,
      error: commitResult.success ? undefined : commitResult.output,
    });

    if (commitResult.success) {
      const pushResult = run('git', ['push', 'origin', 'HEAD:master'], root);
      steps.push({
        name: 'git push',
        success: pushResult.success,
        output: pushResult.success ? '已推送到 master' : pushResult.output,
        error: pushResult.success ? undefined : pushResult.output,
      });
    }
  }

  // Step 6: npm link
  if (!options.skipLink) {
    const linkResult = run('npm', ['link'], root);
    steps.push({
      name: 'npm link',
      success: linkResult.success,
      output: linkResult.success ? '全局链接已更新' : linkResult.output,
      error: linkResult.success ? undefined : linkResult.output,
    });
  }

  const allSuccess = steps.every((s) => s.success);
  return { success: allSuccess, steps };
}

// ─── 格式化输出 ──────────────────────────────────────────────────────

export function formatPublishResult(result: PublishResult): string {
  const lines: string[] = [];

  if (result.success) {
    lines.push('# ✅ 发布成功');
  } else {
    lines.push('# ❌ 发布失败');
  }

  lines.push('');
  lines.push('| 步骤 | 状态 | 说明 |');
  lines.push('|------|------|------|');

  for (const step of result.steps) {
    const status = step.success ? '✅' : '❌';
    const detail = step.error || step.output || '';
    lines.push(`| ${step.name} | ${status} | ${detail} |`);
  }

  if (result.error) {
    lines.push('');
    lines.push(`**错误**: ${result.error}`);
  }

  return lines.join('\n');
}
