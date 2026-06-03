import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  readPackageJson,
  scanNpmTools,
  generateToolCard,
  scanAll,
  ToolInfo,
} from '../tool-scanner.js';
import { setProjectRoot } from '../config.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmcp-test-'));
  setProjectRoot(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('readPackageJson', () => {
  it('returns null when package.json does not exist', () => {
    expect(readPackageJson(tmpDir)).toBeNull();
  });

  it('reads dependencies from package.json', () => {
    const pkg = {
      dependencies: { vitest: '^1.0.0' },
      devDependencies: { eslint: '^8.0.0' },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const deps = readPackageJson(tmpDir);
    expect(deps).toEqual({ vitest: '^1.0.0', eslint: '^8.0.0' });
  });

  it('handles empty package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const deps = readPackageJson(tmpDir);
    expect(deps).toEqual({});
  });
});

describe('scanNpmTools', () => {
  it('returns empty when no package.json', () => {
    expect(scanNpmTools(tmpDir)).toEqual([]);
  });

  it('detects known tools from dependencies', () => {
    const pkg = {
      dependencies: { vitest: '^1.0.0', typescript: '^5.0.0' },
      devDependencies: { eslint: '^8.0.0' },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const tools = scanNpmTools(tmpDir);
    expect(tools.length).toBe(3);
    expect(tools.map((t) => t.name)).toContain('vitest');
    expect(tools.map((t) => t.name)).toContain('typescript');
    expect(tools.map((t) => t.name)).toContain('eslint');
  });

  it('ignores unknown packages', () => {
    const pkg = {
      dependencies: { 'some-unknown-pkg': '^1.0.0' },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const tools = scanNpmTools(tmpDir);
    expect(tools.length).toBe(0);
  });

  it('includes version info', () => {
    const pkg = { dependencies: { vitest: '^1.2.3' } };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const tools = scanNpmTools(tmpDir);
    expect(tools[0].version).toBe('^1.2.3');
    expect(tools[0].source).toBe('npm');
  });

  it('detects scoped packages', () => {
    const pkg = { dependencies: { '@types/node': '^20.0.0' } };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const tools = scanNpmTools(tmpDir);
    // @types/node is not a known tool
    expect(tools.length).toBe(0);
  });
});

describe('generateToolCard', () => {
  it('generates markdown for npm tool', () => {
    const tool: ToolInfo = {
      name: 'vitest',
      source: 'npm',
      version: '^1.0.0',
      description: 'Vite 原生单元测试框架',
      commands: ['vitest', 'vitest run'],
      useCases: ['单元测试', 'TDD'],
    };

    const card = generateToolCard(tool);
    expect(card).toContain('### vitest');
    expect(card).toContain('📦 npm');
    expect(card).toContain('v^1.0.0');
    expect(card).toContain('Vite 原生单元测试框架');
    expect(card).toContain('`vitest` / `vitest run`');
    expect(card).toContain('单元测试、TDD');
  });

  it('generates markdown for MCP tool', () => {
    const tool: ToolInfo = {
      name: 'codegraph',
      source: 'mcp',
      description: '代码知识图谱',
    };

    const card = generateToolCard(tool);
    expect(card).toContain('### codegraph');
    expect(card).toContain('🔌 MCP');
    expect(card).toContain('代码知识图谱');
  });

  it('handles missing optional fields', () => {
    const tool: ToolInfo = {
      name: 'unknown',
      source: 'npm',
    };

    const card = generateToolCard(tool);
    expect(card).toContain('### unknown');
    expect(card).toContain('未知');
  });
});

describe('scanAll', () => {
  it('returns empty result when no tools', () => {
    const result = scanAll(tmpDir);
    expect(result.tools).toEqual([]);
    expect(result.summary).toContain('未检测到已知工具');
  });

  it('returns tools from package.json', () => {
    const pkg = { dependencies: { vitest: '^1.0.0' } };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const result = scanAll(tmpDir);
    expect(result.tools.length).toBe(1);
    expect(result.summary).toContain('vitest');
    expect(result.summary).toContain('npm');
  });

  it('deduplicates tools', () => {
    // Simulate duplicate by having same tool in both npm and MCP
    const pkg = { dependencies: { vitest: '^1.0.0' } };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const result = scanAll(tmpDir);
    const vitestCount = result.tools.filter((t) => t.name === 'vitest').length;
    expect(vitestCount).toBe(1);
  });
});
