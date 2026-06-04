#!/usr/bin/env node

/**
 * pmcp-server CLI
 *
 * CLI 入口，提供与 MCP Server 相同的功能。
 *
 * Usage:
 *   npx tsx src/cli.ts init [--project-root /path/to/project]
 *   npx tsx src/cli.ts bootstrap
 *   npx tsx src/cli.ts check "task description"
 *   npx tsx src/cli.ts plan "task description"
 *   npx tsx src/cli.ts log --title "xxx" --request "xxx" [--changes ...] [--decisions ...] [--todos ...]
 *   npx tsx src/cli.ts module-log <module> --change "xxx" [--files ...] [--decisions ...]
 *   npx tsx src/cli.ts module-read <module>
 *   npx tsx src/cli.ts todos add|complete|remove "todo text"
 *   npx tsx src/cli.ts help
 */

import { bootstrap, formatBootstrap } from './prompts-loader.js';
import {
  getProjectRoot,
  getPromptsDir,
  setProjectRoot,
  getGlobalSkillsDir,
  getCoreSkillsDir,
  getCustomSkillsDir,
} from './config.js';
import { initPrompts } from './prompts-generator.js';
import { readModuleLog, listModuleLogs, appendModuleLog } from './module-logger.js';
import { confirmDirection, readDirection } from './requirements-check.js';
import { listSkills, initGlobalSkills, isGlobalSkillsInitialized } from './skills-manager.js';
import { logDialog } from './dialog-logger.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '..');

const VALID_ASSISTANTS = ['claude-code', 'cline', 'cursor', 'windsurf', 'copilot', 'continue'];

// ─── 自动注册 ────────────────────────────────────────────────────────

function getClaudeMdPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~';
  return path.join(home, '.claude', 'CLAUDE.md');
}

const PMCP_BLOCK = [
  '',
  '## pmcp (Prompts MCP Server)',
  '',
  '`pmcp` is a globally installed CLI tool. When the user types `pmcp <command>` in any project, execute it immediately as a Bash command without exploring the project first. Do not read files, search the codebase, or try to understand what pmcp is — just run it.',
  '',
  'Key commands:',
  '- `/start` — quick load project memory (preferred, instant)',
  '- `pmcp start [path]` — bootstrap a project (init + load context)',
  '- `pmcp setup [path]` — initialize prompts-mcp in a project',
  '- `pmcp bootstrap` — reload context in an already-initialized project',
  '',
  'Example: when user says "pmcp start /path/to/project", run:',
  '```bash',
  'npx pmcp start /path/to/project',
  '```',
  '',
].join('\n');

function autoRegister(): void {
  const claudeMdPath = getClaudeMdPath();

  // Already registered
  if (fs.existsSync(claudeMdPath)) {
    const content = fs.readFileSync(claudeMdPath, 'utf-8');
    if (content.includes('## pmcp (Prompts MCP Server)')) return;
  }

  // Write
  const existing = fs.existsSync(claudeMdPath)
    ? fs.readFileSync(claudeMdPath, 'utf-8').trimEnd()
    : '';
  const newContent = existing + '\n' + PMCP_BLOCK;
  fs.mkdirSync(path.dirname(claudeMdPath), { recursive: true });
  fs.writeFileSync(claudeMdPath, newContent, 'utf-8');
}

// ─── Help ────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
Prompts MCP Server - CLI

Usage:
  prompts-mcp <command> [options]

Commands:
  start [--project-root <path>] [--assistant <name>]
       一键启动：自动初始化 + 加载 4 文档记忆（推荐）
  setup [--project-root <path>] [--assistant <name>]
       一键初始化：生成 prompts + hooks + MCP 配置
  bootstrap                       加载上下文（已初始化项目使用）
  refresh-context                 刷新 context.md 技术栈（保留用户编辑）
  confirm --goal <text>            方向确认（AI 追问后保存到 direction.md）
  log --title <t> --request <r>   记录对话日志（session-end 时自动归档到 sessions.md）
  module-log <name> --change <c>  记录模块修改
  module-read <name>              读取模块记录
  module-list                     列出所有模块记录
  skill <subcommand>              Skill 管理（见下文）
  tools                           扫描项目已安装工具，输出能力清单
  scenes                          列出所有开发场景及推荐工具
  recommend <scene>               推荐指定场景下应使用的工具
  audit                           发布前隐私审计（扫描密钥/Token/密码）
  publish [--bump patch|minor|major] [--token <npm_token>]
                                  一键发布：审计 + 版本 bump + npm + git + link
  register                        注册 pmcp 为用户级已知命令（~/.claude/CLAUDE.md）
  unregister                      取消注册
  help                            显示帮助

Skill subcommands:
  skill init                      初始化全局 skill 仓库
  skill list                      列出所有可用 skill
  skill create <name>             创建新的自定义 skill
  skill sync                      同步全局 skill 到当前项目
  skill export                    导出项目 skill 到全局仓库

Supported assistants:
  claude-code, cline, cursor, windsurf, copilot, continue

Examples:
  prompts-mcp start                                    # 一键启动（推荐）
  prompts-mcp start --project-root /path/to/project    # 指定项目启动
  prompts-mcp setup --project-root /path/to/project    # 仅初始化
  prompts-mcp bootstrap                                # 加载上下文
  prompts-mcp skill list                               # 查看 skill
`);
}

function printSeparator(title: string): void {
  const line = '═'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'start': {
      // Auto-register pmcp as known command (silent, first-time only)
      autoRegister();

      const rootIndex = args.indexOf('--project-root');
      const projectRoot =
        rootIndex !== -1
          ? path.resolve(args[rootIndex + 1])
          : args[1] && !args[1].startsWith('--')
            ? path.resolve(args[1])
            : getProjectRoot();

      const assistIndex = args.indexOf('--assistant');
      const assistant = assistIndex !== -1 ? args[assistIndex + 1] : 'claude-code';

      if (!VALID_ASSISTANTS.includes(assistant)) {
        console.error(`Unknown assistant: ${assistant}`);
        console.error(`Valid options: ${VALID_ASSISTANTS.join(', ')}`);
        process.exit(1);
      }

      printSeparator('Prompts MCP - 一键启动');

      // 切换 config 到目标项目
      setProjectRoot(projectRoot);

      // ── Step 1: 检查是否已初始化 ──
      const contextFile = path.join(projectRoot, '.github', 'prompts', 'context.md');
      const isInitialized = fs.existsSync(contextFile);

      if (!isInitialized) {
        console.log('[1/4] 项目未初始化，执行初始化...\n');

        // 运行 setup
        const result = initPrompts(projectRoot);
        console.log(`  Project: ${result.projectInfo.name}`);
        console.log(`  Path: ${result.promptsDir}`);
        for (const f of result.filesCreated) {
          console.log(`    + ${f}`);
        }

        // 初始化全局 skill 仓库（同步新增 skill）
        {
          const globalResult = initGlobalSkills({
            sourceDir: path.join(PACKAGE_ROOT, '.github', 'prompts', 'skills'),
          });
          if (globalResult.success && globalResult.created.length > 0) {
            console.log('    + 全局 skill 仓库已同步');
          }
        }

        // 复制 hooks 和 adapter
        const hooksSrc = path.join(PACKAGE_ROOT, 'hooks');
        const adapterSrc = path.join(PACKAGE_ROOT, 'adapters', assistant);
        const hooksDest = path.join(projectRoot, '.prompts-mcp', 'hooks');
        const adapterDest = path.join(projectRoot, '.prompts-mcp', 'adapters', assistant);

        if (fs.existsSync(hooksSrc)) {
          fs.cpSync(hooksSrc, hooksDest, { recursive: true });
        }
        if (fs.existsSync(adapterSrc)) {
          fs.cpSync(adapterSrc, adapterDest, { recursive: true });
        }

        // 写入 MCP server 路径
        const mcpCliPath = path.join(PACKAGE_ROOT, 'build', 'cli.js');
        const mcpConfigDir = path.join(projectRoot, '.prompts-mcp');
        fs.mkdirSync(mcpConfigDir, { recursive: true });
        fs.writeFileSync(path.join(mcpConfigDir, 'mcp-server-path'), mcpCliPath, 'utf-8');

        // 写入 .pmcp-root 标记
        const pmcpRootMarker = path.join(projectRoot, '.pmcp-root');
        if (!fs.existsSync(pmcpRootMarker)) {
          fs.writeFileSync(pmcpRootMarker, projectRoot, 'utf-8');
        }

        // 复制默认 skill 到项目
        const skillsSrc = path.join(PACKAGE_ROOT, '.github', 'prompts', 'skills');
        const skillsDest = path.join(projectRoot, '.github', 'prompts', 'skills');
        if (fs.existsSync(skillsSrc)) {
          if (!fs.existsSync(skillsDest)) {
            fs.mkdirSync(skillsDest, { recursive: true });
          }
          const skillFiles = fs.readdirSync(skillsSrc).filter((f) => f.endsWith('.md'));
          for (const f of skillFiles) {
            const destFile = path.join(skillsDest, f);
            if (!fs.existsSync(destFile)) {
              fs.copyFileSync(path.join(skillsSrc, f), destFile);
            }
          }
        }

        // 生成 .claude/settings.json
        if (assistant === 'claude-code') {
          const settingsDir = path.join(projectRoot, '.claude');
          const settingsPath = path.join(settingsDir, 'settings.json');
          fs.mkdirSync(settingsDir, { recursive: true });

          let existingSettings: any = {};
          if (fs.existsSync(settingsPath)) {
            try {
              existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            } catch {
              /* ignore */
            }
          }

          const hookBase = '.prompts-mcp';
          const newSettings = {
            ...existingSettings,
            hooks: {
              ...(existingSettings.hooks || {}),
              UserPromptSubmit: [
                {
                  hooks: [
                    {
                      type: 'command',
                      command: `node ${hookBase}/capture-prompt.cjs`,
                      timeout: 5,
                    },
                  ],
                },
              ],
              PreToolUse: [
                {
                  matcher: 'Write|Edit',
                  hooks: [
                    {
                      type: 'command',
                      command: `node ${hookBase}/pre-tool-use.cjs`,
                    },
                  ],
                },
              ],
              SessionStart: [
                {
                  matcher: '*',
                  hooks: [
                    {
                      type: 'command',
                      command: `node ${hookBase}/session-start.cjs`,
                      statusMessage: 'Loading project context...',
                    },
                  ],
                },
              ],
              PostToolUse: [
                {
                  matcher: 'Write|Edit',
                  hooks: [
                    {
                      type: 'command',
                      command: `node ${hookBase}/post-write-scan.cjs`,
                      timeout: 10,
                    },
                  ],
                },
                {
                  matcher: '*',
                  hooks: [
                    {
                      type: 'command',
                      command: `node ${hookBase}/normalize-log.cjs`,
                      timeout: 5,
                    },
                  ],
                },
              ],
              SessionEnd: [
                {
                  matcher: '*',
                  hooks: [
                    {
                      type: 'command',
                      command: `node ${hookBase}/session-end.cjs`,
                      statusMessage: 'Finalizing session...',
                      timeout: 30,
                    },
                  ],
                },
              ],
            },
          };

          fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
        }

        console.log('\n✅ 初始化完成\n');
      } else {
        console.log('[1/4] 项目已初始化，跳过\n');

        // 已有项目：基于版本号检查是否需要同步 hook 脚本
        const hooksSrc = path.join(PACKAGE_ROOT, 'hooks');
        const adapterSrc = path.join(PACKAGE_ROOT, 'adapters', assistant);
        const hooksDest = path.join(projectRoot, '.prompts-mcp', 'hooks');
        const adapterDest = path.join(projectRoot, '.prompts-mcp', 'adapters', assistant);

        const srcPkgPath = path.join(PACKAGE_ROOT, 'package.json');
        const srcVersion = fs.existsSync(srcPkgPath)
          ? JSON.parse(fs.readFileSync(srcPkgPath, 'utf-8')).version || '0'
          : '0';
        const destMarker = path.join(hooksDest, '.sync-version');
        let shouldSync = true;
        if (fs.existsSync(destMarker)) {
          shouldSync = fs.readFileSync(destMarker, 'utf-8').trim() !== srcVersion;
        }

        if (shouldSync) {
          if (fs.existsSync(hooksSrc)) {
            fs.cpSync(hooksSrc, hooksDest, { recursive: true });
          }
          if (fs.existsSync(adapterSrc)) {
            fs.cpSync(adapterSrc, adapterDest, { recursive: true });
          }
          fs.writeFileSync(destMarker, srcVersion, 'utf-8');
          console.log('    = Hook 脚本已同步到最新版本');
        } else {
          console.log('    = Hook 脚本已是最新版本');
        }

        // 同步新增 skill 文件到项目
        const skillsSrc = path.join(PACKAGE_ROOT, '.github', 'prompts', 'skills');
        const skillsDest = path.join(projectRoot, '.github', 'prompts', 'skills');
        if (fs.existsSync(skillsSrc)) {
          if (!fs.existsSync(skillsDest)) {
            fs.mkdirSync(skillsDest, { recursive: true });
          }
          const skillFiles = fs.readdirSync(skillsSrc).filter((f) => f.endsWith('.md'));
          let synced = 0;
          for (const f of skillFiles) {
            const destFile = path.join(skillsDest, f);
            if (!fs.existsSync(destFile)) {
              fs.copyFileSync(path.join(skillsSrc, f), destFile);
              synced++;
            }
          }
          if (synced > 0) {
            console.log(`    + 新增 skill 已同步: ${synced} 个`);
          }
        }
      }

      // ── Step 2: 确保全局 skill 仓库存在 + 同步新增 skill ──
      console.log('[2/4] 检查全局 Skill 仓库...\n');

      {
        const globalResult = initGlobalSkills({
          sourceDir: path.join(PACKAGE_ROOT, '.github', 'prompts', 'skills'),
        });
        if (globalResult.success) {
          if (globalResult.created.length > 0) {
            console.log('    + 全局 skill 仓库已同步');
            for (const f of globalResult.created) {
              console.log(`      + ${path.basename(f)}`);
            }
          } else {
            console.log('    = 全局 skill 仓库已完整');
          }
        }
      }

      // ── Step 3: 加载上下文 ──
      console.log('\n[3/3] 加载上下文...\n');
      const bootstrapResult = bootstrap();
      console.log(formatBootstrap(bootstrapResult));

      break;
    }

    case 'refresh-context': {
      const rootIndex = args.indexOf('--project-root');
      const projectRoot =
        rootIndex !== -1
          ? path.resolve(args[rootIndex + 1])
          : args[1] && !args[1].startsWith('--')
            ? path.resolve(args[1])
            : getProjectRoot();

      setProjectRoot(projectRoot);

      const { refreshContextMd } = await import('./prompts-generator.js');
      const result = refreshContextMd(projectRoot);

      if (result.updated) {
        console.log(`✅ context.md 已更新: ${result.changes.join(', ')}`);
      } else {
        console.log('✅ context.md 无需更新（技术栈无变化）');
      }
      break;
    }

    case 'setup': {
      // Auto-register pmcp as known command (silent, first-time only)
      autoRegister();

      const rootIndex = args.indexOf('--project-root');
      // 支持三种写法:
      //   pmcp setup                    -> 当前目录
      //   pmcp setup /path/to/project   -> 位置参数
      //   pmcp setup --project-root /path -> 命名参数
      const projectRoot =
        rootIndex !== -1
          ? path.resolve(args[rootIndex + 1])
          : args[1] && !args[1].startsWith('--')
            ? path.resolve(args[1])
            : getProjectRoot();

      const assistIndex = args.indexOf('--assistant');
      const assistant = assistIndex !== -1 ? args[assistIndex + 1] : 'claude-code';

      if (!VALID_ASSISTANTS.includes(assistant)) {
        console.error(`Unknown assistant: ${assistant}`);
        console.error(`Valid options: ${VALID_ASSISTANTS.join(', ')}`);
        process.exit(1);
      }

      printSeparator(`一键 Setup (${assistant})`);

      // 切换 config 到目标项目（所有后续步骤都基于此项目）
      setProjectRoot(projectRoot);

      // ── Step 1: 生成 prompts 文件 ──
      console.log('[1/5] 生成 prompts 文件...\n');
      const result = initPrompts(projectRoot);
      console.log(`  Project: ${result.projectInfo.name}`);
      console.log(`  Path: ${result.promptsDir}`);
      for (const f of result.filesCreated) {
        console.log(`    + ${f}`);
      }
      if (result.errors.length > 0) {
        for (const e of result.errors) {
          console.log(`    ! ${e}`);
        }
      }

      // ── Step 2: 初始化全局 Skill 仓库 + 复制项目 Skills ──
      console.log('\n[2/5] 初始化 Skill 系统...\n');

      // 初始化全局 skill 仓库（同步新增 skill）
      {
        const globalResult = initGlobalSkills({
          sourceDir: path.join(PACKAGE_ROOT, '.github', 'prompts', 'skills'),
        });
        if (globalResult.success) {
          if (globalResult.created.length > 0) {
            console.log('    + 全局 skill 仓库已同步');
            for (const f of globalResult.created) {
              console.log(`      + ${path.basename(f)}`);
            }
          } else {
            console.log('    = 全局 skill 仓库已完整');
          }
          console.log(`      路径: ${getGlobalSkillsDir()}`);
        } else {
          console.log('    ! 全局 skill 仓库初始化失败');
          for (const e of globalResult.errors) {
            console.log(`      ${e}`);
          }
        }
      }

      // 复制默认 skill 到项目（向后兼容）
      const skillsSrc = path.join(PACKAGE_ROOT, '.github', 'prompts', 'skills');
      const skillsDest = path.join(projectRoot, '.github', 'prompts', 'skills');
      if (fs.existsSync(skillsSrc)) {
        if (!fs.existsSync(skillsDest)) {
          fs.mkdirSync(skillsDest, { recursive: true });
        }
        const skillFiles = fs.readdirSync(skillsSrc).filter((f) => f.endsWith('.md'));
        for (const f of skillFiles) {
          const destFile = path.join(skillsDest, f);
          if (!fs.existsSync(destFile)) {
            fs.copyFileSync(path.join(skillsSrc, f), destFile);
            console.log(`    + skills/${f}`);
          } else {
            console.log(`    = skills/${f} (已存在，跳过)`);
          }
        }
      }

      // ── Step 3: 复制 hooks + adapter ──
      console.log('\n[3/5] 复制 hooks + adapter...\n');
      const hooksSrc = path.join(PACKAGE_ROOT, 'hooks');
      const adapterSrc = path.join(PACKAGE_ROOT, 'adapters', assistant);
      const hooksDest = path.join(projectRoot, '.prompts-mcp', 'hooks');
      const adapterDest = path.join(projectRoot, '.prompts-mcp', 'adapters', assistant);

      if (fs.existsSync(hooksSrc)) {
        fs.cpSync(hooksSrc, hooksDest, { recursive: true });
        console.log('    + .prompts-mcp/hooks/');
      }
      if (fs.existsSync(adapterSrc)) {
        fs.cpSync(adapterSrc, adapterDest, { recursive: true });
        console.log(`    + .prompts-mcp/adapters/${assistant}/`);
      }

      // ── Step 4: 写入 MCP server 路径 ──
      console.log('\n[4/5] 配置 MCP server 路径...\n');
      const mcpCliPath = path.join(PACKAGE_ROOT, 'build', 'cli.js');
      const mcpConfigDir = path.join(projectRoot, '.prompts-mcp');
      const mcpConfigPath = path.join(mcpConfigDir, 'mcp-server-path');
      fs.mkdirSync(mcpConfigDir, { recursive: true });
      fs.writeFileSync(mcpConfigPath, mcpCliPath, 'utf-8');
      console.log(`    + .prompts-mcp/mcp-server-path -> ${mcpCliPath}`);

      // ── Step 5: 生成 .claude/settings.json ──
      if (assistant === 'claude-code') {
        console.log('\n[5/5] 生成 .claude/settings.json...\n');
        const settingsDir = path.join(projectRoot, '.claude');
        const settingsPath = path.join(settingsDir, 'settings.json');
        fs.mkdirSync(settingsDir, { recursive: true });

        // 保留已有配置，合并 hooks
        let existingSettings: any = {};
        if (fs.existsSync(settingsPath)) {
          try {
            existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
          } catch {
            /* ignore */
          }
        }

        // hooks 使用相对路径（相对于项目根目录）
        const hookBase = '.prompts-mcp';
        const newSettings = {
          ...existingSettings,
          hooks: {
            ...(existingSettings.hooks || {}),
            UserPromptSubmit: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: `node ${hookBase}/capture-prompt.cjs`,
                    timeout: 5,
                  },
                ],
              },
            ],
            PreToolUse: [
              {
                matcher: 'Write|Edit',
                hooks: [
                  {
                    type: 'command',
                    command: `node ${hookBase}/pre-tool-use.cjs`,
                  },
                ],
              },
            ],
            SessionStart: [
              {
                matcher: '*',
                hooks: [
                  {
                    type: 'command',
                    command: `node ${hookBase}/session-start.cjs`,
                    statusMessage: 'Loading project context...',
                  },
                ],
              },
            ],
            PostToolUse: [
              {
                matcher: 'Write|Edit',
                hooks: [
                  {
                    type: 'command',
                    command: `node ${hookBase}/post-write-scan.cjs`,
                    timeout: 10,
                  },
                ],
              },
              {
                matcher: '*',
                hooks: [
                  {
                    type: 'command',
                    command: `node ${hookBase}/normalize-log.cjs`,
                    timeout: 5,
                  },
                ],
              },
            ],
            SessionEnd: [
              {
                matcher: '*',
                hooks: [
                  {
                    type: 'command',
                    command: `node ${hookBase}/session-end.cjs`,
                    statusMessage: 'Finalizing session...',
                    timeout: 30,
                  },
                ],
              },
            ],
          },
        };

        fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
        console.log('    + .claude/settings.json');
      } else {
        console.log(`\n[5/5] 跳过（${assistant} 不需要 .claude/settings.json）`);
      }

      // ── Step 6: 写入 .pmcp-root 标记文件 ──
      console.log('\n[6/6] 写入 .pmcp-root 标记...\n');
      const pmcpRootMarker = path.join(projectRoot, '.pmcp-root');
      if (!fs.existsSync(pmcpRootMarker)) {
        fs.writeFileSync(pmcpRootMarker, projectRoot, 'utf-8');
        console.log(`    + .pmcp-root -> ${projectRoot}`);
      } else {
        console.log('    = .pmcp-root (已存在，跳过)');
      }

      // ── 自动 Bootstrap ──
      console.log('\n' + '═'.repeat(60));
      console.log('  自动加载上下文...');
      console.log('═'.repeat(60) + '\n');

      const bootstrapResult = bootstrap();
      console.log(formatBootstrap(bootstrapResult));

      console.log('\n' + '═'.repeat(60));
      console.log('  Setup 完成！');
      console.log('═'.repeat(60));
      console.log('');
      console.log('下一步：用 Claude Code 打开项目，SessionStart hook 会自动加载上下文。');
      console.log('');
      break;
    }

    case 'init': {
      const rootIndex = args.indexOf('--project-root');
      const projectRoot = rootIndex !== -1 ? args[rootIndex + 1] : getProjectRoot();

      const assistIndex = args.indexOf('--assistant');
      const assistant = assistIndex !== -1 ? args[assistIndex + 1] : 'claude-code';

      if (!VALID_ASSISTANTS.includes(assistant)) {
        console.error(`Unknown assistant: ${assistant}`);
        console.error(`Valid options: ${VALID_ASSISTANTS.join(', ')}`);
        process.exit(1);
      }

      printSeparator(`初始化 Prompts 体系 (${assistant})`);

      // Step 1: Generate prompts files (existing logic)
      const result = initPrompts(projectRoot);

      console.log(`Project: ${result.projectInfo.name}`);
      console.log(`Path: ${result.promptsDir}\n`);
      console.log('Files created:');
      for (const f of result.filesCreated) {
        console.log(`  + ${f}`);
      }
      console.log('\nDetected project info:');
      console.log(`  Languages: ${result.projectInfo.languages.join(', ') || 'none'}`);
      console.log(`  Frameworks: ${result.projectInfo.frameworks.join(', ') || 'none'}`);

      if (result.errors.length > 0) {
        console.log('\nErrors:');
        for (const e of result.errors) {
          console.log(`  ! ${e}`);
        }
      }

      // Step 2: Scaffold hooks and adapter
      console.log('\n--- Setting up hooks and adapter ---\n');

      const hooksSrc = path.join(PACKAGE_ROOT, 'hooks');
      const adapterSrc = path.join(PACKAGE_ROOT, 'adapters', assistant);
      const hooksDest = path.join(projectRoot, '.prompts-mcp', 'hooks');
      const adapterDest = path.join(projectRoot, '.prompts-mcp', 'adapters', assistant);

      // Copy shared hooks
      if (fs.existsSync(hooksSrc)) {
        fs.cpSync(hooksSrc, hooksDest, { recursive: true });
        console.log('  + .prompts-mcp/hooks/ (shared core)');
      }

      // Copy adapter
      if (fs.existsSync(adapterSrc)) {
        fs.cpSync(adapterSrc, adapterDest, { recursive: true });
        console.log(`  + .prompts-mcp/adapters/${assistant}/`);
      }

      // Step 3: Generate assistant-specific config
      if (assistant === 'claude-code') {
        const settingsTemplate = path.join(adapterSrc, 'settings.json');
        const settingsDest = path.join(projectRoot, '.claude', 'settings.json');
        if (fs.existsSync(settingsTemplate)) {
          fs.mkdirSync(path.dirname(settingsDest), { recursive: true });
          fs.copyFileSync(settingsTemplate, settingsDest);
          console.log('  + .claude/settings.json');
        }
      } else if (assistant === 'cline') {
        const hooksTemplate = path.join(adapterSrc, 'hooks.json');
        const hooksDest2 = path.join(projectRoot, '.clinerules', 'hooks', 'prompts-mcp.json');
        if (fs.existsSync(hooksTemplate)) {
          fs.mkdirSync(path.dirname(hooksDest2), { recursive: true });
          fs.copyFileSync(hooksTemplate, hooksDest2);
          console.log('  + .clinerules/hooks/prompts-mcp.json');
        }
      } else if (assistant === 'cursor') {
        const rulesSrc = path.join(adapterSrc, 'rules.md');
        const rulesDest = path.join(projectRoot, '.cursor', 'rules', 'prompts-mcp.mdc');
        if (fs.existsSync(rulesSrc)) {
          fs.mkdirSync(path.dirname(rulesDest), { recursive: true });
          fs.copyFileSync(rulesSrc, rulesDest);
          console.log('  + .cursor/rules/prompts-mcp.mdc');
        }
      } else if (assistant === 'windsurf') {
        const rulesSrc = path.join(adapterSrc, 'rules.md');
        const rulesDest = path.join(projectRoot, '.windsurfrules');
        if (fs.existsSync(rulesSrc)) {
          fs.copyFileSync(rulesSrc, rulesDest);
          console.log('  + .windsurfrules');
        }
      } else if (assistant === 'copilot') {
        const rulesSrc = path.join(adapterSrc, 'rules.md');
        const rulesDest = path.join(projectRoot, '.github', 'copilot-instructions.md');
        if (fs.existsSync(rulesSrc)) {
          fs.mkdirSync(path.dirname(rulesDest), { recursive: true });
          fs.copyFileSync(rulesSrc, rulesDest);
          console.log('  + .github/copilot-instructions.md');
        }
      } else if (assistant === 'continue') {
        const rulesSrc = path.join(adapterSrc, 'rules.md');
        const rulesDest = path.join(projectRoot, '.continue', 'rules', 'prompts-mcp.md');
        if (fs.existsSync(rulesSrc)) {
          fs.mkdirSync(path.dirname(rulesDest), { recursive: true });
          fs.copyFileSync(rulesSrc, rulesDest);
          console.log('  + .continue/rules/prompts-mcp.md');
        }
      }

      // Write .pmcp-root marker for hook project-root discovery
      const pmcpRootMarker = path.join(projectRoot, '.pmcp-root');
      if (!fs.existsSync(pmcpRootMarker)) {
        fs.writeFileSync(pmcpRootMarker, projectRoot, 'utf-8');
        console.log('  + .pmcp-root (project root marker)');
      }

      // Print next steps
      console.log('\n--- Next steps ---\n');
      if (assistant === 'claude-code') {
        console.log('Claude Code hooks are configured in .claude/settings.json.');
        console.log('Auto-logging will start on next session.');
        console.log(
          'TIP: Use "setup" command instead of "init" for full automation (MCP + Skills).',
        );
      } else if (assistant === 'cline') {
        console.log(
          'Configure Cline hooks using the template in .clinerules/hooks/prompts-mcp.json.',
        );
        console.log('See: https://docs.cline.bot/customization/hooks');
      } else {
        console.log(
          `Rules file created. The AI will be instructed to use MCP tools at lifecycle points.`,
        );
        console.log(
          'Make sure the prompts-mcp MCP server is configured in your assistant settings.',
        );
      }
      console.log('');
      break;
    }

    case 'bootstrap': {
      printSeparator('一键启动');
      const result = bootstrap();
      console.log(formatBootstrap(result));
      break;
    }

    case 'confirm': {
      const goalIndex = args.indexOf('--goal');
      const acceptanceIndex = args.indexOf('--acceptance');
      const contextIndex = args.indexOf('--context');

      const goal =
        goalIndex !== -1
          ? args[goalIndex + 1]
          : args[1] && !args[1].startsWith('--')
            ? args[1]
            : '';
      const acceptance = acceptanceIndex !== -1 ? args[acceptanceIndex + 1] : undefined;
      const context = contextIndex !== -1 ? args[contextIndex + 1] : undefined;

      // 收集 --constraint 参数（可多个）
      const constraints: string[] = [];
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--constraint' && args[i + 1]) {
          constraints.push(args[i + 1]);
        }
      }

      if (!goal) {
        console.error('❌ 请提供目标描述。');
        console.error(
          '用法: pmcp confirm --goal "目标" [--constraint "约束"] [--acceptance "验收"]',
        );
        process.exit(1);
      }

      printSeparator('方向确认');
      const result = confirmDirection({ goal, constraints, acceptance, context });

      if (result.success) {
        console.log('✅ 方向已确认\n');
        console.log(result.content);
        console.log(`\n已保存到: ${result.filePath}`);
      } else {
        console.error(`❌ 确认失败: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'log': {
      const titleIndex = args.indexOf('--title');
      const requestIndex = args.indexOf('--request');
      const changesIndex = args.indexOf('--changes');
      const decisionsIndex = args.indexOf('--decisions');
      const todosIndex = args.indexOf('--todos');

      const title = titleIndex !== -1 ? args[titleIndex + 1] : '';
      const request = requestIndex !== -1 ? args[requestIndex + 1] : '';

      if (!title || !request) {
        console.error('❌ --title 和 --request 是必填参数。');
        process.exit(1);
      }

      const changes: string[] = [];
      if (changesIndex !== -1) {
        for (let i = changesIndex + 1; i < args.length; i++) {
          if (args[i].startsWith('--')) break;
          changes.push(args[i]);
        }
      }

      const decisions: string[] = [];
      if (decisionsIndex !== -1) {
        for (let i = decisionsIndex + 1; i < args.length; i++) {
          if (args[i].startsWith('--')) break;
          decisions.push(args[i]);
        }
      }

      const todos: string[] = [];
      if (todosIndex !== -1) {
        for (let i = todosIndex + 1; i < args.length; i++) {
          if (args[i].startsWith('--')) break;
          todos.push(args[i]);
        }
      }

      printSeparator('记录对话日志');
      const promptsDir = getPromptsDir();
      const { entryId, today } = logDialog(promptsDir, {
        title,
        request,
        changes,
        decisions,
        todos,
      });

      if (todos.length > 0) console.log('✅ todos.md 已追加');
      console.log(`\n📝 Entry-${String(entryId).padStart(3, '0')} (${today}): ${title}`);
      console.log('💡 daily/recent-5/summary-10 将在 session-end 时由 Shell writer 统一生成');
      break;
    }

    case 'module-log': {
      const moduleName = args[1];
      if (!moduleName) {
        console.error('❌ 请指定模块名称。');
        process.exit(1);
      }

      const changeIndex = args.indexOf('--change');
      const filesIndex = args.indexOf('--files');
      const decisionsIndex = args.indexOf('--decisions');

      const change = changeIndex !== -1 ? args[changeIndex + 1] : '';
      if (!change) {
        console.error('❌ --change 是必填参数。');
        process.exit(1);
      }

      const files: string[] = [];
      if (filesIndex !== -1) {
        for (let i = filesIndex + 1; i < args.length; i++) {
          if (args[i].startsWith('--')) break;
          files.push(args[i]);
        }
      }

      const decisions: string[] = [];
      if (decisionsIndex !== -1) {
        for (let i = decisionsIndex + 1; i < args.length; i++) {
          if (args[i].startsWith('--')) break;
          decisions.push(args[i]);
        }
      }

      const projectRoot = getProjectRoot();
      const today = new Date().toISOString().slice(0, 10);
      const result = appendModuleLog(projectRoot, moduleName, {
        date: today,
        change,
        files,
        decisions,
      });

      if (result.success) {
        console.log(`✅ 模块记录已更新: ${moduleName}`);
        console.log(`   变更: ${change}`);
      } else {
        console.error(`❌ 失败: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'module-read': {
      const moduleName = args[1];
      if (!moduleName) {
        console.error('❌ 请指定模块名称。');
        process.exit(1);
      }

      const projectRoot = getProjectRoot();
      const content = readModuleLog(projectRoot, moduleName);
      printSeparator(`模块记录: ${moduleName}`);
      console.log(content);
      break;
    }

    case 'module-list': {
      const projectRoot = getProjectRoot();
      const modules = listModuleLogs(projectRoot);
      printSeparator('模块记录列表');
      if (modules.length === 0) {
        console.log('* 暂无模块记录 *');
      } else {
        for (const m of modules) {
          console.log(`  📦 ${m}`);
        }
      }
      break;
    }

    case 'skill': {
      const subCommand = args[1]?.toLowerCase();

      if (!subCommand || subCommand === 'help') {
        console.log(`
Skill 管理命令

Usage:
  prompts-mcp skill <subcommand> [options]

Subcommands:
  init                    初始化全局 skill 仓库（~/.pmcp/skills/）
  list                    列出所有可用 skill
  create <name>           创建新的自定义 skill
  sync                    同步全局 skill 到当前项目
  export                  导出项目 skill 到全局仓库

Examples:
  prompts-mcp skill init
  prompts-mcp skill list
  prompts-mcp skill create my-skill
  prompts-mcp skill sync
  prompts-mcp skill export
`);
        break;
      }

      switch (subCommand) {
        case 'init': {
          printSeparator('初始化全局 Skill 仓库');

          if (isGlobalSkillsInitialized()) {
            console.log('✅ 全局 skill 仓库已存在');
            console.log(`   路径: ${getGlobalSkillsDir()}`);
          } else {
            const result = initGlobalSkills();
            if (result.success) {
              console.log('✅ 全局 skill 仓库初始化成功');
              console.log(`   路径: ${getGlobalSkillsDir()}`);
              console.log('\n创建的目录和文件:');
              for (const f of result.created) {
                console.log(`   + ${f}`);
              }
            } else {
              console.error('❌ 初始化失败');
              for (const e of result.errors) {
                console.error(`   ${e}`);
              }
              process.exit(1);
            }
          }

          console.log('\n目录结构:');
          console.log(`   ${getGlobalSkillsDir()}`);
          console.log('   ├── core/     (核心 skill，只读)');
          console.log('   └── custom/   (自定义 skill)');
          break;
        }

        case 'list': {
          printSeparator('可用 Skill 列表');

          const skills = listSkills();
          if (skills.length === 0) {
            console.log('暂无可用 skill');
            console.log('\n提示: 运行 "prompts-mcp skill init" 初始化全局 skill 仓库');
          } else {
            console.log('| # | Skill | 图标 | 说明 | 版本 | 来源 |');
            console.log('|---|-------|------|------|------|------|');
            skills.forEach((s, i) => {
              // 判断来源
              let source = 'project';
              if (s.filePath.includes('.prompts-mcp/skills')) {
                source = 'generated';
              } else if (s.filePath.includes('.pmcp/skills/core')) {
                source = 'core';
              } else if (s.filePath.includes('.pmcp/skills/custom')) {
                source = 'custom';
              }
              console.log(
                `| ${i + 1} | **${s.meta.name}** | ${s.meta.icon} | ${s.meta.description} | v${s.meta.version} | ${source} |`,
              );
            });
          }

          console.log(`\n全局 skill 目录: ${getGlobalSkillsDir()}`);
          console.log(`项目 skill 目录: ${getPromptsDir()}/skills`);
          break;
        }

        case 'create': {
          const skillName = args[2];
          if (!skillName) {
            console.error('❌ 请指定 skill 名称');
            console.error('用法: prompts-mcp skill create <name>');
            process.exit(1);
          }

          printSeparator(`创建自定义 Skill: ${skillName}`);

          // 确保全局 skill 仓库已初始化
          if (!isGlobalSkillsInitialized()) {
            console.log('全局 skill 仓库未初始化，正在初始化...');
            const initResult = initGlobalSkills();
            if (!initResult.success) {
              console.error('❌ 初始化失败');
              process.exit(1);
            }
          }

          const customDir = getCustomSkillsDir();
          const filePath = path.join(customDir, `${skillName}.md`);

          if (fs.existsSync(filePath)) {
            console.error(`❌ Skill 已存在: ${filePath}`);
            process.exit(1);
          }

          // 交互式创建（简化版，使用默认模板）
          const today = new Date().toISOString().slice(0, 10);
          const template = [
            '---',
            `name: ${skillName}`,
            'icon: 🎯',
            `description: ${skillName} skill`,
            'version: 1',
            `created: ${today}`,
            `updated: ${today}`,
            '---',
            '',
            '## 身份',
            '',
            `你是一个 ${skillName} 专家。`,
            '',
            '## 开发规范',
            '',
            '1. 遵循项目编码规范',
            '2. 保持代码简洁可读',
            '',
            '## 学习记录',
            '',
            `### v1 (${today})`,
            '- 初始版本',
            '',
          ].join('\n');

          fs.writeFileSync(filePath, template, 'utf-8');
          console.log(`✅ Skill 创建成功: ${filePath}`);
          console.log('\n下一步: 编辑文件完善 skill 内容');
          break;
        }

        case 'sync': {
          printSeparator('同步全局 Skill 到项目');

          if (!isGlobalSkillsInitialized()) {
            console.error('❌ 全局 skill 仓库未初始化');
            console.error('   运行: prompts-mcp skill init');
            process.exit(1);
          }

          const forceSync = args.includes('--force');
          if (forceSync) {
            console.log('⚡ 强制模式：将覆盖已存在的 skill\n');
          }

          const projectSkillsDir = path.join(getPromptsDir(), 'skills');
          if (!fs.existsSync(projectSkillsDir)) {
            fs.mkdirSync(projectSkillsDir, { recursive: true });
          }

          const coreDir = getCoreSkillsDir();
          const customDir = getCustomSkillsDir();
          let synced = 0;

          // 同步 core skill
          if (fs.existsSync(coreDir)) {
            const coreFiles = fs.readdirSync(coreDir).filter((f) => f.endsWith('.md'));
            for (const f of coreFiles) {
              const dest = path.join(projectSkillsDir, f);
              if (!fs.existsSync(dest) || forceSync) {
                fs.copyFileSync(path.join(coreDir, f), dest);
                console.log(`   ${forceSync ? '↻' : '+'} core/${f}`);
                synced++;
              }
            }
          }

          // 同步 custom skill
          if (fs.existsSync(customDir)) {
            const customFiles = fs.readdirSync(customDir).filter((f) => f.endsWith('.md'));
            for (const f of customFiles) {
              const dest = path.join(projectSkillsDir, f);
              if (!fs.existsSync(dest) || forceSync) {
                fs.copyFileSync(path.join(customDir, f), dest);
                console.log(`   ${forceSync ? '↻' : '+'} custom/${f}`);
                synced++;
              }
            }
          }

          if (synced === 0) {
            console.log('没有新 skill 需要同步');
            console.log('\n提示: 使用 --force 覆盖已存在的 skill');
          } else {
            console.log(`\n✅ 同步完成: ${synced} 个 skill`);
          }
          break;
        }

        case 'export': {
          printSeparator('导出项目 Skill 到全局仓库');

          if (!isGlobalSkillsInitialized()) {
            console.log('全局 skill 仓库未初始化，正在初始化...');
            const initResult = initGlobalSkills();
            if (!initResult.success) {
              console.error('❌ 初始化失败');
              process.exit(1);
            }
          }

          const projectSkillsDir = path.join(getPromptsDir(), 'skills');
          if (!fs.existsSync(projectSkillsDir)) {
            console.log('项目没有 skill 可导出');
            break;
          }

          const customDir = getCustomSkillsDir();
          const projectFiles = fs.readdirSync(projectSkillsDir).filter((f) => f.endsWith('.md'));
          let exported = 0;

          for (const f of projectFiles) {
            const dest = path.join(customDir, f);
            if (!fs.existsSync(dest)) {
              fs.copyFileSync(path.join(projectSkillsDir, f), dest);
              console.log(`   + ${f}`);
              exported++;
            } else {
              console.log(`   = ${f} (已存在，跳过)`);
            }
          }

          if (exported === 0) {
            console.log('没有新 skill 需要导出');
          } else {
            console.log(`\n✅ 导出完成: ${exported} 个 skill`);
          }
          break;
        }

        default: {
          console.error(`未知 skill 子命令: ${subCommand}`);
          console.error('运行 "prompts-mcp skill help" 查看帮助');
          process.exit(1);
        }
      }
      break;
    }

    case 'register': {
      printSeparator('注册 pmcp 为全局已知命令');

      const claudeMdPath = getClaudeMdPath();

      // Check if already registered
      if (fs.existsSync(claudeMdPath)) {
        const content = fs.readFileSync(claudeMdPath, 'utf-8');
        if (content.includes('## pmcp (Prompts MCP Server)')) {
          console.log('✅ pmcp 已注册，无需重复操作。');
          console.log(`   配置文件: ${claudeMdPath}`);
          break;
        }
      }

      autoRegister();

      console.log(`✅ pmcp 已注册为全局已知命令。`);
      console.log(`   配置文件: ${claudeMdPath}`);
      console.log('');
      console.log('现在在任何项目中输入 "pmcp start" 或 "pmcp setup"，');
      console.log('智能体将直接执行命令，不再探索项目。');
      break;
    }

    case 'unregister': {
      printSeparator('取消注册 pmcp');

      const claudeMdPath = getClaudeMdPath();

      if (!fs.existsSync(claudeMdPath)) {
        console.log('✅ 无需操作（CLAUDE.md 不存在）。');
        break;
      }

      let content = fs.readFileSync(claudeMdPath, 'utf-8');

      if (!content.includes('## pmcp (Prompts MCP Server)')) {
        console.log('✅ 无需操作（未找到 pmcp 注册信息）。');
        break;
      }

      // Remove the pmcp block (from ## pmcp ... to next ## or end)
      const pmcpRegex = /\n?## pmcp \(Prompts MCP Server\)[\s\S]*?(?=\n## |$)/;
      content = content.replace(pmcpRegex, '');
      content = content.trimEnd() + '\n';

      fs.writeFileSync(claudeMdPath, content, 'utf-8');

      console.log('✅ pmcp 注册信息已移除。');
      console.log(`   配置文件: ${claudeMdPath}`);
      break;
    }

    case 'tools': {
      const rootIndex = args.indexOf('--project-root');
      const projectRoot =
        rootIndex !== -1
          ? path.resolve(args[rootIndex + 1])
          : args[1] && !args[1].startsWith('--')
            ? path.resolve(args[1])
            : getProjectRoot();

      const { scanAll } = await import('./tool-scanner.js');
      const result = scanAll(projectRoot);
      console.log(result.summary);
      break;
    }

    case 'scenes': {
      const { listScenes } = await import('./tool-scanner.js');
      console.log(listScenes());
      break;
    }

    case 'recommend': {
      const scene = args[1]?.toLowerCase();
      if (!scene) {
        console.error('用法: pmcp recommend <scene>');
        console.error(
          '场景: coding / testing / debugging / reviewing / refactoring / deploying / documenting / exploring / planning',
        );
        process.exit(1);
      }
      const { recommendTools } = await import('./tool-scanner.js');
      console.log(recommendTools(scene as any));
      break;
    }

    case 'audit': {
      const rootIndex = args.indexOf('--project-root');
      const projectRoot =
        rootIndex !== -1
          ? path.resolve(args[rootIndex + 1])
          : args[1] && !args[1].startsWith('--')
            ? path.resolve(args[1])
            : getProjectRoot();

      const { scanSecrets } = await import('./secret-scanner.js');
      const result = scanSecrets(projectRoot);
      console.log(result.summary);
      if (!result.success) {
        process.exit(1);
      }
      break;
    }

    case 'publish': {
      const root = getProjectRoot();
      const bumpIdx = args.indexOf('--bump');
      const bump = bumpIdx !== -1 ? (args[bumpIdx + 1] as any) : 'patch';
      const tokenIdx = args.indexOf('--token');
      const npmToken = tokenIdx !== -1 ? args[tokenIdx + 1] : undefined;
      const msgIdx = args.indexOf('--message');
      const message = msgIdx !== -1 ? args[msgIdx + 1] : undefined;
      const skipAudit = args.includes('--skip-audit');

      const { publish, formatPublishResult } = await import('./publisher.js');
      const result = publish(root, { bump, npmToken, message, skipAudit });
      console.log(formatPublishResult(result));
      if (!result.success) {
        process.exit(1);
      }
      break;
    }

    default: {
      console.error(`未知命令: ${command}`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error('CLI Error:', error);
  process.exit(1);
});
