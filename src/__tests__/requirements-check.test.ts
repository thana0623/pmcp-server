import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { confirmDirection, readDirection } from '../requirements-check.js';
import { setProjectRoot } from '../config.js';

// 使用临时目录避免污染项目
let tmpDir: string;
let promptsDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmcp-test-'));
  promptsDir = path.join(tmpDir, '.github', 'prompts');
  fs.mkdirSync(promptsDir, { recursive: true });
  setProjectRoot(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('confirmDirection', () => {
  it('fails when goal is empty', () => {
    const result = confirmDirection({ goal: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('目标不能为空');
  });

  it('writes direction.md with goal only', () => {
    const result = confirmDirection({ goal: '加登录功能' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('## 目标');
    expect(result.content).toContain('加登录功能');
    expect(result.content).not.toContain('## 约束');
    expect(result.content).not.toContain('## 验收');
  });

  it('writes direction.md with all fields', () => {
    const result = confirmDirection({
      goal: '加登录功能',
      constraints: ['不能改现有 API', '保持向后兼容'],
      acceptance: '邮箱密码能登录成功',
      context: '用 JWT token',
    });
    expect(result.success).toBe(true);
    expect(result.content).toContain('## 目标');
    expect(result.content).toContain('加登录功能');
    expect(result.content).toContain('## 约束');
    expect(result.content).toContain('- 不能改现有 API');
    expect(result.content).toContain('- 保持向后兼容');
    expect(result.content).toContain('## 验收');
    expect(result.content).toContain('邮箱密码能登录成功');
    expect(result.content).toContain('## 补充');
    expect(result.content).toContain('用 JWT token');
  });

  it('includes confirmed timestamp', () => {
    const result = confirmDirection({ goal: '测试' });
    expect(result.content).toContain('> confirmed:');
  });
});

describe('readDirection', () => {
  it('returns null when direction.md does not exist', () => {
    expect(readDirection()).toBeNull();
  });

  it('reads back written direction', () => {
    confirmDirection({ goal: '测试目标' });
    const content = readDirection();
    expect(content).toContain('测试目标');
  });
});
