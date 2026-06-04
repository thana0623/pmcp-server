import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanSecrets } from '../secret-scanner.js';
import { setProjectRoot } from '../config.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmcp-test-'));
  setProjectRoot(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('scanSecrets', () => {
  it('returns success when no secrets found', () => {
    fs.writeFileSync(path.join(tmpDir, 'safe.ts'), 'const x = 1;');
    const result = scanSecrets(tmpDir);
    expect(result.success).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('detects AWS Access Key', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.ts'), 'const key = "AKIAIOSFODNN7EXAMPLE";');
    const result = scanSecrets(tmpDir);
    expect(result.success).toBe(false);
    expect(result.findings.some((f) => f.pattern === 'AWS Access Key')).toBe(true);
  });

  it('detects GitHub Token', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'config.ts'),
      'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn";',
    );
    const result = scanSecrets(tmpDir);
    expect(result.success).toBe(false);
    expect(result.findings.some((f) => f.pattern === 'GitHub Token')).toBe(true);
  });

  it('detects npm Token', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'config.ts'),
      'const token = "npm_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn";',
    );
    const result = scanSecrets(tmpDir);
    expect(result.success).toBe(false);
    expect(result.findings.some((f) => f.pattern === 'npm Token')).toBe(true);
  });

  it('detects Private Key', () => {
    fs.writeFileSync(path.join(tmpDir, 'key.pem'), '-----BEGIN RSA PRIVATE KEY-----');
    const result = scanSecrets(tmpDir);
    expect(result.success).toBe(false);
    expect(result.findings.some((f) => f.pattern === 'Private Key')).toBe(true);
  });

  it('detects password assignment', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.ts'), 'const password = "supersecret123";');
    const result = scanSecrets(tmpDir);
    expect(result.success).toBe(false);
    expect(result.findings.some((f) => f.pattern === 'Password Assignment')).toBe(true);
  });

  it('excludes node_modules', () => {
    const nmDir = path.join(tmpDir, 'node_modules');
    fs.mkdirSync(nmDir);
    fs.writeFileSync(path.join(nmDir, 'pkg.ts'), 'const key = "AKIAIOSFODNN7EXAMPLE";');
    const result = scanSecrets(tmpDir);
    expect(result.success).toBe(true);
  });

  it('excludes test mock data', () => {
    fs.writeFileSync(path.join(tmpDir, 'test.ts'), 'const mock_token = "fake_value_for_testing";');
    const result = scanSecrets(tmpDir);
    expect(result.findings.filter((f) => f.file.includes('test.ts')).length).toBe(0);
  });

  it('masks secret values in snippet', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.ts'), 'const key = "AKIAIOSFODNN7EXAMPLE";');
    const result = scanSecrets(tmpDir);
    expect(result.findings[0].snippet).toContain('****');
    expect(result.findings[0].snippet).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });
});
