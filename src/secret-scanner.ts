/**
 * secret-scanner.ts
 *
 * 隐私信息扫描引擎。
 *
 * 核心原则：
 * 1. 正则扫描代码中的密钥、Token、密码等隐私信息
 * 2. 发现 critical/high 级别时拦截发布
 * 3. 提供脱敏后的代码片段，不暴露实际密钥
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getProjectRoot } from './config.js';

// ─── 数据类型 ────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium';

export interface SecretFinding {
  file: string;
  line: number;
  column: number;
  pattern: string;
  severity: Severity;
  snippet: string;
}

export interface ScanResult {
  success: boolean;
  findings: SecretFinding[];
  summary: string;
}

// ─── 扫描模式 ────────────────────────────────────────────────────────

interface ScanPattern {
  name: string;
  regex: RegExp;
  severity: Severity;
}

const SCAN_PATTERNS: ScanPattern[] = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/, severity: 'critical' },
  { name: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{36}/, severity: 'critical' },
  { name: 'GitHub OAuth', regex: /gho_[a-zA-Z0-9]{36}/, severity: 'critical' },
  { name: 'npm Token', regex: /npm_[a-zA-Z0-9]{36}/, severity: 'critical' },
  { name: 'Private Key', regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, severity: 'critical' },
  { name: 'OpenAI Key', regex: /sk-[a-zA-Z0-9]{48}/, severity: 'critical' },
  { name: 'Anthropic Key', regex: /sk-ant-[a-zA-Z0-9]{48}/, severity: 'critical' },
  { name: 'Slack Token', regex: /xox[bporas]-[a-zA-Z0-9-]+/, severity: 'high' },
  {
    name: 'API Key Assignment',
    regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([a-zA-Z0-9]{20,})['"]/i,
    severity: 'high',
  },
  {
    name: 'Token Assignment',
    regex: /(?:token|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]([a-zA-Z0-9]{20,})['"]/i,
    severity: 'high',
  },
  {
    name: 'Password Assignment',
    regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"]/i,
    severity: 'high',
  },
  {
    name: 'Secret Assignment',
    regex: /(?:secret|client[_-]?secret)\s*[:=]\s*['"]([a-zA-Z0-9]{20,})['"]/i,
    severity: 'high',
  },
  { name: 'Bearer Token', regex: /Bearer\s+[a-zA-Z0-9._-]{20,}/, severity: 'medium' },
  { name: 'Generic Secret', regex: /['"]([a-zA-Z0-9]{40,})['"]/, severity: 'medium' },
];

// ─── 排除规则 ────────────────────────────────────────────────────────

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'build',
  'dist',
  '.next',
  '.cache',
  'coverage',
  '.nyc_output',
  '.turbo',
]);

const EXCLUDE_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);

const EXCLUDE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.map',
  '.min.js',
  '.min.css',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

// ─── 白名单 ──────────────────────────────────────────────────────────

const WHITELIST_PATTERNS = [
  /(?:^|\s)example(?:\s|$)/i,
  /placeholder/i,
  /your[_-]?(api[_-]?key|token|password)/i,
  /xxx+/i,
  /test[_-]?key/i,
  /mock[_-]?/i,
  /fake[_-]?/i,
  /dummy[_-]?/i,
];

function isWhitelisted(line: string): boolean {
  return WHITELIST_PATTERNS.some((p) => p.test(line));
}

// ─── 脱敏 ────────────────────────────────────────────────────────────

function maskSecret(value: string): string {
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

function getSnippet(line: string, column: number, matchLength: number): string {
  const start = Math.max(0, column - 10);
  const end = Math.min(line.length, column + matchLength + 10);
  let snippet = line.slice(start, end);
  // 脱敏匹配部分
  const matchStart = column - start;
  const matchEnd = matchStart + matchLength;
  const match = snippet.slice(matchStart, matchEnd);
  snippet = snippet.slice(0, matchStart) + maskSecret(match) + snippet.slice(matchEnd);
  return `...${snippet}...`;
}

// ─── 文件扫描 ────────────────────────────────────────────────────────

function shouldSkipFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  if (EXCLUDE_FILES.has(basename)) return true;

  const ext = path.extname(filePath).toLowerCase();
  if (EXCLUDE_EXTENSIONS.has(ext)) return true;

  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) return true;
    if (!stat.isFile()) return true;
  } catch {
    return true;
  }

  return false;
}

function scanFile(filePath: string): SecretFinding[] {
  if (shouldSkipFile(filePath)) return [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const lines = content.split('\n');
  const findings: SecretFinding[] = [];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    if (isWhitelisted(line)) continue;

    for (const pattern of SCAN_PATTERNS) {
      const match = pattern.regex.exec(line);
      if (match) {
        findings.push({
          file: filePath,
          line: lineNum + 1,
          column: match.index,
          pattern: pattern.name,
          severity: pattern.severity,
          snippet: getSnippet(line, match.index, match[0].length),
        });
      }
    }
  }

  return findings;
}

// ─── 目录扫描 ────────────────────────────────────────────────────────

function scanDirectory(dir: string): SecretFinding[] {
  const findings: SecretFinding[] = [];

  function walk(currentDir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        findings.push(...scanFile(fullPath));
      }
    }
  }

  walk(dir);
  return findings;
}

// ─── 汇总 ────────────────────────────────────────────────────────────

function formatSummary(findings: SecretFinding[]): string {
  const lines: string[] = [];
  lines.push('# 🔒 隐私审计报告');
  lines.push('');

  if (findings.length === 0) {
    lines.push('✅ **未发现隐私信息。** 可以安全发布。');
    return lines.join('\n');
  }

  const critical = findings.filter((f) => f.severity === 'critical');
  const high = findings.filter((f) => f.severity === 'high');
  const medium = findings.filter((f) => f.severity === 'medium');

  lines.push(`⚠️ **发现 ${findings.length} 处隐私信息：**`);
  lines.push('');
  lines.push(`- 🔴 Critical: ${critical.length}`);
  lines.push(`- 🟠 High: ${high.length}`);
  lines.push(`- 🟡 Medium: ${medium.length}`);
  lines.push('');

  if (critical.length > 0 || high.length > 0) {
    lines.push('## ❌ 发布已拦截');
    lines.push('');
    lines.push('以下发现必须修复后才能发布：');
    lines.push('');

    for (const f of [...critical, ...high]) {
      lines.push(`### ${f.pattern} [${f.severity.toUpperCase()}]`);
      lines.push(`- 文件: \`${f.file}:${f.line}\``);
      lines.push(`- 代码: \`${f.snippet}\``);
      lines.push('');
    }
  }

  if (medium.length > 0) {
    lines.push('## ⚠️ 建议检查');
    lines.push('');
    for (const f of medium) {
      lines.push(`- \`${f.file}:${f.line}\` — ${f.pattern}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('修复建议：');
  lines.push('1. 将密钥移到环境变量');
  lines.push('2. 使用 `.env` 文件（确保在 `.gitignore` 中）');
  lines.push('3. 使用密钥管理服务（如 AWS Secrets Manager、Vault）');

  return lines.join('\n');
}

// ─── 主函数 ──────────────────────────────────────────────────────────

export function scanSecrets(projectRoot?: string): ScanResult {
  const root = projectRoot || getProjectRoot();
  const findings = scanDirectory(root);

  // 过滤掉自身生成的文件
  const filtered = findings.filter(
    (f) =>
      !f.file.includes('.claude/prds') &&
      !f.file.includes('.claude/plans') &&
      !f.file.includes('.secretscanignore'),
  );

  const hasBlocking = filtered.some((f) => f.severity === 'critical' || f.severity === 'high');

  return {
    success: !hasBlocking,
    findings: filtered,
    summary: formatSummary(filtered),
  };
}
