#!/usr/bin/env node

/**
 * pmcp-server - 通用 MCP Server
 *
 * 提供以下工具：
 *   - auto_start         - 会话自动启动，加载全部上下文 + 规则 + Skills
 *   - init_prompts       - 扫描项目，自动生成原始 prompts 体系
 *   - bootstrap          - 一键启动，自动读取传递链 + 模块记录
 *   - log_dialog         - 记录对话日志（todos.md + 自动 git commit）
 *   - log_module         - 记录模块修改（目录式）
 *   - read_module        - 修改前读取模块记录
 *   - update_todos       - 更新待办事项
 *   - add_rule           - 添加项目规范规则
 *   - list_rules         - 列出所有自定义规则
 *   - remove_rule        - 删除一条规则
 *   - commit_dialog      - 手动触发 git commit
 *   - list_skills        - 列出所有可用角色技能
 *   - select_skill       - 选择一个 Skill 作为当前身份
 *   - update_skill       - 自我优化：追加学习记录、更新规范
 *   - add_skill          - 创建新的角色技能
 *
 * 通过环境变量 PROJECT_ROOT 指定目标项目路径。
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { bootstrap, formatBootstrap } from './prompts-loader.js';
import { config, getProjectRoot, getPromptsDir } from './config.js';
import { initPrompts } from './prompts-generator.js';
import { readModuleLog, appendModuleLog } from './module-logger.js';
import {
  listSkills,
  selectSkill,
  updateSkill,
  addSkill,
  formatSkillList,
} from './skills-manager.js';
import { gitAutoCommit, gitStatus, isGitRepo } from './git-utils.js';
import { logDialog } from './dialog-logger.js';
import { TOOL_DEFINITIONS } from './tool-schemas.js';
import {
  scanAll,
  recommendTools,
  listScenes,
  detectScene,
} from './tool-scanner.js';
import { scanSecrets } from './secret-scanner.js';
import { publish, formatPublishResult } from './publisher.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

class PromptsMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: config.serverName,
        version: config.serverVersion,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupToolHandlers();

    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  // ─── Tool Handlers ──────────────────────────────────────────────

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFINITIONS,
    }));

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: { params: { name: string; arguments?: any } }) => {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'init_prompts':
            return this.handleInitPrompts(args);
          case 'bootstrap':
            return this.handleBootstrap();
          case 'log_dialog':
            return this.handleLogDialog(args);
          case 'log_module':
            return this.handleLogModule(args);
          case 'read_module':
            return this.handleReadModule(args);
          case 'update_todos':
            return this.handleUpdateTodos(args);
          case 'auto_start':
            return this.handleAutoStart();
          case 'commit_dialog':
            return this.handleCommitDialog(args);
          case 'list_skills':
            return this.handleListSkills();
          case 'select_skill':
            return this.handleSelectSkill(args);
          case 'update_skill':
            return this.handleUpdateSkill(args);
          case 'add_skill':
            return this.handleAddSkill(args);
          case 'scan_tools':
            return this.handleScanTools(args);
          case 'recommend_tools':
            return this.handleRecommendTools(args);
          case 'list_scenes':
            return this.handleListScenes();
          case 'audit_secrets':
            return this.handleAuditSecrets(args);
          case 'safe_publish':
            return this.handleSafePublish(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      },
    );
  }

  // ─── Tool Implementations ───────────────────────────────────────

  /**
   * init_prompts: 初始化 prompts 体系
   */
  private async handleInitPrompts(args: any) {
    const projectRoot = typeof args?.projectRoot === 'string' ? args.projectRoot : getProjectRoot();

    const result = initPrompts(projectRoot);

    const lines: string[] = [];
    lines.push('# 🚀 Prompts 体系初始化完成');
    lines.push('');
    lines.push(`**项目**: ${result.projectInfo.name}`);
    lines.push(`**路径**: ${result.promptsDir}`);
    lines.push('');

    lines.push('## ✅ 已创建文件');
    lines.push('');
    for (const f of result.filesCreated) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');

    lines.push('## 📋 检测到的项目信息');
    lines.push('');
    lines.push(`- 语言: ${result.projectInfo.languages.join(', ') || '未检测到'}`);
    lines.push(`- 框架: ${result.projectInfo.frameworks.join(', ') || '未检测到'}`);
    lines.push(`- 构建工具: ${result.projectInfo.buildTools.join(', ') || '未检测到'}`);
    lines.push(`- 数据库: ${result.projectInfo.databases.join(', ') || '未检测到'}`);
    lines.push(
      `- 前端: ${result.projectInfo.hasFrontend ? result.projectInfo.frontendFramework : '无'}`,
    );
    lines.push(
      `- 后端: ${result.projectInfo.hasBackend ? result.projectInfo.backendFramework : '无'}`,
    );
    lines.push('');

    if (result.errors.length > 0) {
      lines.push('## ⚠️ 错误');
      lines.push('');
      for (const e of result.errors) {
        lines.push(`- ❌ ${e}`);
      }
      lines.push('');
    }

    lines.push('## 📖 下一步');
    lines.push('');
    lines.push('1. 检查生成的 prompts 文件，根据项目实际情况补充修改');
    lines.push('2. 运行 `bootstrap` 验证加载正常');
    lines.push('3. 开始开发时，先运行 `check_requirements` 澄清需求');

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  }

  /**
   * bootstrap: 一键启动
   */
  private async handleBootstrap() {
    const result = bootstrap();
    const formatted = formatBootstrap(result);

    return {
      content: [{ type: 'text', text: formatted }],
    };
  }

  /**
   * log_dialog: 记录对话日志
   */
  private async handleLogDialog(args: any) {
    const title = typeof args?.title === 'string' ? args.title : '';
    const request = typeof args?.request === 'string' ? args.request : '';
    const changes: string[] = Array.isArray(args?.changes) ? args.changes : [];
    const decisions: string[] = Array.isArray(args?.decisions) ? args.decisions : [];
    const todos: string[] = Array.isArray(args?.todos) ? args.todos : [];

    if (!title || !request) {
      return {
        content: [{ type: 'text', text: '❌ "title" 和 "request" 是必填参数。' }],
        isError: true,
      };
    }

    try {
      const promptsDir = getPromptsDir();
      const { today } = logDialog(promptsDir, {
        title,
        request,
        changes,
        decisions,
        todos,
      });

      let commitInfo = '';
      if (config.autoCommit && isGitRepo()) {
        const commitMsg = `dialog: ${title}`;
        const commitResult = gitAutoCommit(commitMsg);
        if (commitResult.success) {
          commitInfo = `\n- git commit: ✅ ${commitResult.hash}`;
        } else {
          commitInfo = `\n- git commit: ⚠️ ${commitResult.error}`;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ 对话日志已记录。

- 日期: ${today}
- 标题: ${title}
- todos: 已追加${commitInfo}`,
          },
        ],
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ 记录日志失败: ${msg}` }],
        isError: true,
      };
    }
  }

  /**
   * log_module: 记录模块修改
   */
  private async handleLogModule(args: any) {
    const moduleName = typeof args?.moduleName === 'string' ? args.moduleName : '';
    const change = typeof args?.change === 'string' ? args.change : '';
    const files: string[] = Array.isArray(args?.files) ? args.files : [];
    const decisions: string[] = Array.isArray(args?.decisions) ? args.decisions : [];

    if (!moduleName || !change) {
      return {
        content: [{ type: 'text', text: '❌ "moduleName" 和 "change" 是必填参数。' }],
        isError: true,
      };
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
      return {
        content: [
          {
            type: 'text',
            text: `✅ 模块记录已更新: ${moduleName}\n\n变更: ${change}\n日期: ${today}`,
          },
        ],
      };
    } else {
      return {
        content: [{ type: 'text', text: `❌ 更新模块记录失败: ${result.error}` }],
        isError: true,
      };
    }
  }

  /**
   * read_module: 读取模块记录
   */
  private async handleReadModule(args: any) {
    const moduleName = typeof args?.moduleName === 'string' ? args.moduleName : '';

    if (!moduleName) {
      return {
        content: [{ type: 'text', text: '❌ "moduleName" 是必填参数。' }],
        isError: true,
      };
    }

    const projectRoot = getProjectRoot();
    const content = readModuleLog(projectRoot, moduleName);

    return {
      content: [{ type: 'text', text: `# 模块记录: ${moduleName}\n\n${content}` }],
    };
  }

  /**
   * update_todos: 更新待办事项
   */
  private async handleUpdateTodos(args: any) {
    const action = typeof args?.action === 'string' ? args.action : '';
    const todo = typeof args?.todo === 'string' ? args.todo : '';

    if (!action || !todo) {
      return {
        content: [{ type: 'text', text: '❌ "action" 和 "todo" 是必填参数。' }],
        isError: true,
      };
    }

    try {
      const promptsDir = getPromptsDir();
      const todosPath = path.join(promptsDir, 'todos.md');

      let content = '';
      if (fs.existsSync(todosPath)) {
        content = fs.readFileSync(todosPath, 'utf-8');
      } else {
        content = `# 待办事项\n\n## 进行中\n\n*(暂无)*\n\n## 已完成\n\n*(暂无)*\n`;
      }

      switch (action) {
        case 'add': {
          // 在"进行中"区域添加
          const inProgressMarker = '## 进行中';
          const idx = content.indexOf(inProgressMarker);
          if (idx !== -1) {
            const afterMarker = content.indexOf('\n', idx) + 1;
            content =
              content.slice(0, afterMarker) + `\n- [ ] ${todo}` + content.slice(afterMarker);
          }
          break;
        }
        case 'complete': {
          // 将 - [ ] 改为 - [x] 并移到已完成
          content = content.replace(`- [ ] ${todo}`, `- [x] ${todo}`);
          break;
        }
        case 'remove': {
          content = content.replace(`- [ ] ${todo}\n`, '');
          content = content.replace(`- [x] ${todo}\n`, '');
          break;
        }
      }

      fs.writeFileSync(todosPath, content, 'utf-8');

      return {
        content: [{ type: 'text', text: `✅ 待办事项已更新: ${action} "${todo}"` }],
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ 更新待办失败: ${msg}` }],
        isError: true,
      };
    }
  }

  // ─── 新增工具实现 ───────────────────────────────────────────────

  /**
   * auto_start: 会话自动启动
   */
  private async handleAutoStart() {
    const result = bootstrap();
    const formatted = formatBootstrap(result);

    const lines: string[] = [];
    lines.push('# 🚀 会话已自动启动');
    lines.push('');
    lines.push('> 以下为当前项目的记忆上下文，请基于此开始工作。');
    lines.push('');
    lines.push(formatted);

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  }

  /**
   * commit_dialog: 手动 git commit
   */
  private async handleCommitDialog(args: any) {
    const message = typeof args?.message === 'string' ? args.message : '';
    const files: string[] = Array.isArray(args?.files) ? args.files : [];

    if (!message) {
      return {
        content: [{ type: 'text', text: '❌ "message" 是必填参数。' }],
        isError: true,
      };
    }

    if (!isGitRepo()) {
      return {
        content: [{ type: 'text', text: '❌ 当前目录不是 git 仓库。' }],
        isError: true,
      };
    }

    const result = gitAutoCommit(message, files.length > 0 ? files : undefined);

    if (result.success) {
      const status = gitStatus();
      return {
        content: [
          {
            type: 'text',
            text: `✅ Git 提交成功。\n\n- 提交信息: ${message}\n- Commit: ${result.hash}\n- 分支: ${status?.branch || 'unknown'}`,
          },
        ],
      };
    } else {
      return {
        content: [{ type: 'text', text: `❌ Git 提交失败: ${result.error}` }],
        isError: true,
      };
    }
  }

  // ─── Skill 工具实现 ───────────────────────────────────────────────

  /**
   * list_skills: 列出所有可用 skill
   */
  private async handleListSkills() {
    const skillList = formatSkillList();

    if (!skillList) {
      return {
        content: [
          {
            type: 'text',
            text: '🎭 暂无可用 Skill。\n\n使用 `add_skill` 工具或在 `.github/prompts/skills/` 目录下创建 .md 文件来添加 Skill。',
          },
        ],
      };
    }

    return {
      content: [{ type: 'text', text: skillList }],
    };
  }

  /**
   * select_skill: 选择一个 skill 作为当前身份
   */
  private async handleSelectSkill(args: any) {
    const name = typeof args?.name === 'string' ? args.name : '';

    if (!name) {
      return {
        content: [{ type: 'text', text: '❌ "name" 是必填参数。请指定要选择的 Skill 名称。' }],
        isError: true,
      };
    }

    const skill = selectSkill(name);
    if (!skill) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Skill 不存在: ${name}\n\n可用 Skill: ${
              listSkills()
                .map((s) => s.meta.name)
                .join(', ') || '无'
            }`,
          },
        ],
        isError: true,
      };
    }

    const lines: string[] = [];
    lines.push(`# ${skill.meta.icon} Skill 已激活: ${skill.meta.name}`);
    lines.push('');
    lines.push(`> ${skill.meta.description} (v${skill.meta.version})`);
    lines.push('');
    lines.push(skill.content);
    lines.push('');
    lines.push('---');
    lines.push(`> Skill \`${name}\` 已加载。请以该角色身份开始工作。`);

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  }

  /**
   * add_skill: 创建新 skill
   */
  private async handleAddSkill(args: any) {
    const name = typeof args?.name === 'string' ? args.name : '';
    const icon = typeof args?.icon === 'string' ? args.icon : '🎯';
    const description = typeof args?.description === 'string' ? args.description : '';
    const identity = typeof args?.identity === 'string' ? args.identity : '';
    const guidelines = typeof args?.guidelines === 'string' ? args.guidelines : '';

    if (!name || !description || !identity || !guidelines) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ 缺少必填参数。需要：name, description, identity, guidelines。',
          },
        ],
        isError: true,
      };
    }

    const result = addSkill(name, { icon, description, identity, guidelines });
    if (result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ Skill \`${name}\` 已创建。\n\n${icon} ${description}\n\n使用 \`select_skill "${name}"\` 来激活。`,
          },
        ],
      };
    } else {
      return {
        content: [{ type: 'text', text: `❌ 创建 Skill 失败: ${result.error}` }],
        isError: true,
      };
    }
  }

  /**
   * update_skill: 自我优化 skill
   */
  private async handleUpdateSkill(args: any) {
    const name = typeof args?.name === 'string' ? args.name : '';
    const learnings = typeof args?.learnings === 'string' ? args.learnings : undefined;
    const guidelineChanges =
      typeof args?.guidelineChanges === 'string' ? args.guidelineChanges : undefined;
    const description = typeof args?.description === 'string' ? args.description : undefined;

    if (!name) {
      return {
        content: [{ type: 'text', text: '❌ "name" 是必填参数。' }],
        isError: true,
      };
    }

    if (!learnings && !guidelineChanges && !description) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ 请至少提供一个更新项：learnings / guidelineChanges / description。',
          },
        ],
        isError: true,
      };
    }

    const result = updateSkill(name, { learnings, guidelineChanges, description });
    if (result.success) {
      const parts: string[] = [];
      if (learnings) parts.push('学习记录已追加');
      if (guidelineChanges) parts.push('开发规范已更新');
      if (description) parts.push('描述已更新');

      return {
        content: [{ type: 'text', text: `✅ Skill \`${name}\` 已更新。\n\n${parts.join('；')}` }],
      };
    } else {
      return {
        content: [{ type: 'text', text: `❌ 更新 Skill 失败: ${result.error}` }],
        isError: true,
      };
    }
  }

  /**
   * scan_tools: 工具能力扫描
   */
  private async handleScanTools(args: any) {
    const projectRoot = typeof args?.projectRoot === 'string' ? args.projectRoot : undefined;

    try {
      const result = scanAll(projectRoot);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ 工具扫描失败: ${msg}` }],
        isError: true,
      };
    }
  }

  /**
   * recommend_tools: 场景推荐工具
   */
  private async handleRecommendTools(args: any) {
    const sceneInput = typeof args?.scene === 'string' ? args.scene : '';
    const userInput = typeof args?.input === 'string' ? args.input : '';

    // 优先使用指定场景，否则从用户输入自动检测
    const scene = sceneInput || detectScene(userInput);

    if (!scene) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ 无法确定场景。请指定 scene 参数（coding/testing/debugging/reviewing/refactoring/deploying/documenting/exploring/planning）或提供 input 文本。',
          },
        ],
        isError: true,
      };
    }

    const result = recommendTools(scene);
    return {
      content: [{ type: 'text', text: result }],
    };
  }

  /**
   * list_scenes: 列出所有场景
   */
  private async handleListScenes() {
    const result = listScenes();
    return {
      content: [{ type: 'text', text: result }],
    };
  }

  private async handleAuditSecrets(args: any) {
    const projectRoot = typeof args?.projectRoot === 'string' ? args.projectRoot : undefined;
    try {
      const result = scanSecrets(projectRoot);
      return {
        content: [{ type: 'text', text: result.summary }],
        isError: !result.success,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ 隐私审计失败: ${msg}` }],
        isError: true,
      };
    }
  }

  private async handleSafePublish(args: any) {
    const root = getProjectRoot();
    const options = {
      npmToken: typeof args?.npmToken === 'string' ? args.npmToken : undefined,
      bump: typeof args?.bump === 'string' ? (args.bump as any) : undefined,
      version: typeof args?.version === 'string' ? args.version : undefined,
      message: typeof args?.message === 'string' ? args.message : undefined,
      skipAudit: args?.skipAudit === true,
    };

    try {
      const result = publish(root, options);
      return {
        content: [{ type: 'text', text: formatPublishResult(result) }],
        isError: !result.success,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `❌ 发布失败: ${msg}` }],
        isError: true,
      };
    }
  }

  // ─── Run ────────────────────────────────────────────────────────

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Prompts MCP Server running on stdio');
    console.error(`Project root: ${getProjectRoot()}`);
  }
}

const server = new PromptsMcpServer();
server.run().catch(console.error);
