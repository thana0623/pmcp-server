/**
 * tool-scanner.ts
 *
 * 工具能力扫描。
 *
 * 核心原则：
 * 1. 扫描项目已安装的工具（npm 依赖、MCP Server 配置）
 * 2. 为每个工具生成能力卡片（是什么、解决什么、关键命令、适用场景）
 * 3. 输出结构化的 ScanResult，供 AI 引导用户使用
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getProjectRoot } from './config.js';

// ─── 数据类型 ────────────────────────────────────────────────────────

export type ToolSource = 'npm' | 'mcp';

export interface ToolInfo {
  /** 包名或工具名 */
  name: string;
  /** 来源：npm 依赖 或 MCP Server */
  source: ToolSource;
  /** 版本号 */
  version?: string;
  /** 一句话描述 */
  description?: string;
  /** 关键命令或 API */
  commands?: string[];
  /** 适用场景 */
  useCases?: string[];
}

export interface ScanResult {
  tools: ToolInfo[];
  summary: string;
}

// ─── 已知工具能力库 ──────────────────────────────────────────────────

interface ToolCapability {
  description: string;
  commands: string[];
  useCases: string[];
  onboarding?: {
    step1: string; // 是什么
    step2: string; // 用一次
    step3: string; // 验证效果
  };
}

const KNOWN_TOOLS: Record<string, ToolCapability> = {
  codegraph: {
    description: 'AST 解析的代码知识图谱，提供结构化代码查询',
    commands: [
      'codegraph_search',
      'codegraph_context',
      'codegraph_callers',
      'codegraph_callees',
      'codegraph_impact',
      'codegraph_trace',
    ],
    useCases: ['查找符号定义', '追踪调用链', '分析变更影响', '代码架构理解'],
  },
  eslint: {
    description: 'JavaScript/TypeScript 代码静态分析和格式检查',
    commands: ['eslint .', 'eslint --fix .', 'eslint --init'],
    useCases: ['代码质量检查', '自动修复格式问题', '团队规范统一'],
  },
  prettier: {
    description: '代码格式化工具，统一代码风格',
    commands: ['prettier --write .', 'prettier --check .'],
    useCases: ['代码格式化', '保存时自动格式化', 'CI 格式检查'],
  },
  vitest: {
    description: 'Vite 原生单元测试框架',
    commands: ['vitest', 'vitest run', 'vitest --coverage', 'vitest --watch'],
    useCases: ['单元测试', '代码覆盖率', 'TDD 开发'],
  },
  jest: {
    description: 'JavaScript 测试框架',
    commands: ['jest', 'jest --watch', 'jest --coverage'],
    useCases: ['单元测试', '快照测试', '代码覆盖率'],
  },
  typescript: {
    description: 'JavaScript 的超集，添加静态类型',
    commands: ['tsc', 'tsc --noEmit', 'tsc --watch'],
    useCases: ['类型检查', '代码重构安全', 'IDE 智能提示'],
  },
  webpack: {
    description: '模块打包工具',
    commands: ['webpack', 'webpack serve', 'webpack --mode production'],
    useCases: ['项目打包', '开发服务器', '代码分割'],
  },
  vite: {
    description: '下一代前端构建工具',
    commands: ['vite', 'vite build', 'vite preview'],
    useCases: ['开发服务器', '生产构建', 'HMR 热更新'],
  },
  next: {
    description: 'React 全栈框架',
    commands: ['next dev', 'next build', 'next start'],
    useCases: ['SSR/SSG 应用', 'API 路由', '全栈开发'],
  },
  tailwindcss: {
    description: '原子化 CSS 框架',
    commands: ['tailwindcss init', 'npx tailwindcss -i ./src/input.css -o ./dist/output.css'],
    useCases: ['快速 UI 开发', '响应式设计', '主题定制'],
  },
  docker: {
    description: '容器化工具',
    commands: ['docker build', 'docker run', 'docker compose up'],
    useCases: ['环境一致性', '部署容器化', '本地开发环境'],
  },
  pmcp: {
    description: 'Prompts MCP Server — 项目上下文管理和 AI 工作流引导',
    commands: ['pmcp start', 'pmcp setup', 'pmcp bootstrap', 'pmcp tools', 'pmcp skill list'],
    useCases: ['项目上下文加载', 'AI 对话日志', '模块记录', 'Skill 管理'],
  },
  'pmcp-server': {
    description: 'Prompts MCP Server — 项目上下文管理和 AI 工作流引导',
    commands: ['pmcp start', 'pmcp setup', 'pmcp bootstrap', 'pmcp tools', 'pmcp skill list'],
    useCases: ['项目上下文加载', 'AI 对话日志', '模块记录', 'Skill 管理'],
  },
};

// ─── 引导流程模板 ────────────────────────────────────────────────────

interface OnboardingStep {
  title: string;
  content: string;
  command?: string;
  verify?: string;
}

const ONBOARDING_TEMPLATES: Record<string, OnboardingStep[]> = {
  codegraph: [
    {
      title: '是什么',
      content:
        'CodeGraph 是代码知识图谱，用 AST 解析每个函数/类/接口，建立调用关系。比 grep 快且准确。',
    },
    {
      title: '用一次',
      content: '搜索一个你知道的函数名，看看它返回什么。',
      command: 'codegraph_search <函数名>',
    },
    {
      title: '验证效果',
      content: '查看一个模块的完整上下文（调用者、被调用者、签名）。',
      verify: '确认返回了函数签名、文件位置、调用链信息',
    },
  ],
  eslint: [
    { title: '是什么', content: 'ESLint 静态分析代码，发现潜在 bug、风格问题和安全漏洞。' },
    { title: '用一次', content: '扫描当前项目。', command: 'npx eslint .' },
    {
      title: '验证效果',
      content: '自动修复可修复的问题。',
      command: 'npx eslint --fix .',
      verify: '确认修复数量 > 0 或无错误',
    },
  ],
  prettier: [
    { title: '是什么', content: 'Prettier 自动格式化代码，统一缩进、引号、分号等风格。' },
    { title: '用一次', content: '查看哪些文件需要格式化。', command: 'npx prettier --check .' },
    {
      title: '验证效果',
      content: '格式化后用 git diff 确认变更。',
      command: 'npx prettier --write .',
      verify: '确认格式化了文件数量',
    },
  ],
  vitest: [
    {
      title: '是什么',
      content: 'Vitest 是 Vite 生态的测试框架，速度快、配置简单、兼容 Jest API。',
    },
    { title: '用一次', content: '执行一次测试。', command: 'npx vitest run' },
    {
      title: '验证效果',
      content: '查看覆盖率报告。',
      command: 'npx vitest --coverage',
      verify: '确认测试通过且覆盖率 > 0',
    },
  ],
  jest: [
    { title: '是什么', content: 'Jest 是最流行的 JavaScript 测试框架，内置断言、Mock、快照。' },
    { title: '用一次', content: '执行一次测试。', command: 'npx jest' },
    {
      title: '验证效果',
      content: '查看覆盖率报告。',
      command: 'npx jest --coverage',
      verify: '确认测试通过且覆盖率 > 0',
    },
  ],
  typescript: [
    {
      title: '是什么',
      content: 'TypeScript 在 JavaScript 基础上添加类型系统，编译时捕获类型错误。',
    },
    { title: '用一次', content: '检查当前项目的类型错误。', command: 'npx tsc --noEmit' },
    { title: '验证效果', content: '确认输出 Found 0 errors。', verify: 'tsc 输出无错误' },
  ],
  webpack: [
    { title: '是什么', content: 'Webpack 是模块打包工具，将多个文件打包成浏览器可运行的 bundle。' },
    { title: '用一次', content: '启动开发服务器。', command: 'npx webpack serve' },
    {
      title: '验证效果',
      content: '浏览器访问 localhost:8080 确认页面加载。',
      verify: '页面正常渲染，无控制台错误',
    },
  ],
  vite: [
    {
      title: '是什么',
      content: 'Vite 是下一代前端构建工具，开发服务器极快（原生 ESM），生产构建用 Rollup。',
    },
    { title: '用一次', content: '启动开发服务器。', command: 'npx vite' },
    {
      title: '验证效果',
      content: '浏览器访问输出的 URL 确认页面加载。',
      verify: '页面正常渲染，HMR 热更新生效',
    },
  ],
  next: [
    {
      title: '是什么',
      content: 'Next.js 是 React 全栈框架，支持 SSR/SSG、API 路由、文件系统路由。',
    },
    { title: '用一次', content: '启动开发服务器。', command: 'npx next dev' },
    {
      title: '验证效果',
      content: '浏览器访问 localhost:3000 确认页面加载。',
      verify: '页面正常渲染，路由切换正常',
    },
  ],
  tailwindcss: [
    {
      title: '是什么',
      content: 'Tailwind CSS 是原子化 CSS 框架，用 class 名直接写样式，不用写 CSS 文件。',
    },
    {
      title: '用一次',
      content: '在 HTML/JSX 中添加 Tailwind class。',
      command: '<div class="text-3xl font-bold text-blue-500">Hello</div>',
    },
    {
      title: '验证效果',
      content: '确认样式生效（文字变大、加粗、蓝色）。',
      verify: '页面显示正确样式',
    },
  ],
  docker: [
    { title: '是什么', content: 'Docker 是容器化工具，将应用打包成容器，保证环境一致性。' },
    {
      title: '用一次',
      content: '构建并运行一个容器。',
      command: 'docker build -t myapp . && docker run -p 3000:3000 myapp',
    },
    {
      title: '验证效果',
      content: '确认容器运行且端口可访问。',
      verify: 'docker ps 显示容器运行中',
    },
  ],
  pmcp: [
    {
      title: '是什么',
      content: 'PMCP 是项目上下文管理工具，自动加载项目信息、记录对话、管理 Skill。',
    },
    { title: '用一次', content: '扫描项目已安装工具。', command: 'pmcp tools' },
    { title: '验证效果', content: '确认输出了工具清单。', verify: '输出包含已安装工具列表' },
  ],
  'pmcp-server': [
    {
      title: '是什么',
      content: 'PMCP Server 是 MCP 协议的服务端，为 AI 提供项目上下文和工具能力。',
    },
    { title: '用一次', content: '加载项目上下文。', command: 'pmcp bootstrap' },
    {
      title: '验证效果',
      content: '确认输出了项目上下文。',
      verify: '输出包含 context.md、recent-5.md 等内容',
    },
  ],
};

// ─── npm 扫描 ────────────────────────────────────────────────────────

/**
 * 从 package.json 读取依赖列表
 */
export function readPackageJson(projectRoot: string): Record<string, string> | null {
  const pkgPath = path.join(projectRoot, 'package.json');
  try {
    const content = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    return {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
  } catch {
    return null;
  }
}

/**
 * 扫描 npm 依赖，匹配已知工具
 */
export function scanNpmTools(projectRoot: string): ToolInfo[] {
  const deps = readPackageJson(projectRoot);
  if (!deps) return [];

  const tools: ToolInfo[] = [];

  for (const [name, version] of Object.entries(deps)) {
    // 尝试匹配已知工具（包名可能带 scope，取最后一段）
    const basename = name.replace(/^@[^/]+\//, '');
    const capability = KNOWN_TOOLS[basename] || KNOWN_TOOLS[name];

    if (capability) {
      tools.push({
        name,
        source: 'npm',
        version,
        description: capability.description,
        commands: capability.commands,
        useCases: capability.useCases,
      });
    }
  }

  return tools;
}

// ─── MCP Server 扫描 ─────────────────────────────────────────────────

/**
 * 读取 Claude Code settings.json 中的 MCP server 配置
 */
export function readMcpSettings(): Record<string, any> | null {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const settingsPath = path.join(homeDir, '.claude', 'settings.json');

  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    return settings.mcpServers || null;
  } catch {
    return null;
  }
}

/**
 * 扫描 MCP Server 配置
 */
export function scanMcpServers(): ToolInfo[] {
  const servers = readMcpSettings();
  if (!servers) return [];

  const tools: ToolInfo[] = [];

  for (const [name, config] of Object.entries(servers)) {
    const serverConfig = config as any;
    const capability = KNOWN_TOOLS[name];

    tools.push({
      name,
      source: 'mcp',
      description: capability?.description || serverConfig.description || `MCP Server: ${name}`,
      commands: capability?.commands || [`使用 ${name} 相关工具`],
      useCases: capability?.useCases || ['通过 MCP 协议提供工具能力'],
    });
  }

  return tools;
}

// ─── 汇总 ────────────────────────────────────────────────────────────

/**
 * 为单个工具生成 markdown 能力卡片
 */
export function generateToolCard(tool: ToolInfo): string {
  const lines: string[] = [];
  const sourceLabel = tool.source === 'npm' ? '📦 npm' : '🔌 MCP';

  lines.push(`### ${tool.name}`);
  lines.push(`- **来源**: ${sourceLabel}${tool.version ? ` (v${tool.version})` : ''}`);
  lines.push(`- **作用**: ${tool.description || '未知'}`);

  if (tool.commands && tool.commands.length > 0) {
    lines.push(`- **关键命令**: \`${tool.commands.join('` / `')}\``);
  }

  if (tool.useCases && tool.useCases.length > 0) {
    lines.push(`- **适用场景**: ${tool.useCases.join('、')}`);
  }

  return lines.join('\n');
}

/**
 * 汇总所有扫描结果
 */
export function scanAll(projectRoot?: string): ScanResult {
  const root = projectRoot || getProjectRoot();

  const npmTools = scanNpmTools(root);
  const mcpTools = scanMcpServers();

  const allTools = [...npmTools, ...mcpTools];

  // 去重（同名工具只保留第一个）
  const seen = new Set<string>();
  const uniqueTools = allTools.filter((t) => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });

  // 生成汇总
  const lines: string[] = [];
  lines.push('# 🔧 工具能力清单');
  lines.push('');
  lines.push(`扫描时间: ${new Date().toISOString()}`);
  lines.push(`项目路径: ${root}`);
  lines.push('');

  if (uniqueTools.length === 0) {
    lines.push('**未检测到已知工具。**');
    lines.push('');
    lines.push('可能原因：');
    lines.push('1. 项目没有 package.json');
    lines.push('2. 依赖中没有已知工具');
    lines.push('3. MCP Server 配置不存在');
    lines.push('');
    lines.push('提示：运行 `pmcp setup` 初始化项目。');
  } else {
    lines.push(`共检测到 **${uniqueTools.length}** 个工具：`);
    lines.push('');

    // npm 工具
    const npmOnly = uniqueTools.filter((t) => t.source === 'npm');
    const mcpOnly = uniqueTools.filter((t) => t.source === 'mcp');

    if (npmOnly.length > 0) {
      lines.push('## 📦 npm 依赖');
      lines.push('');
      for (const tool of npmOnly) {
        lines.push(generateToolCard(tool));
        lines.push('');
      }
    }

    if (mcpOnly.length > 0) {
      lines.push('## 🔌 MCP Server');
      lines.push('');
      for (const tool of mcpOnly) {
        lines.push(generateToolCard(tool));
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('## 💡 下一步');
    lines.push('');
    lines.push('AI 应根据用户当前任务，主动推荐相关工具。');
    lines.push('例如：用户要查代码 → 推荐 codegraph；用户要写测试 → 推荐 vitest。');
  }

  return {
    tools: uniqueTools,
    summary: lines.join('\n'),
  };
}

// ─── 场景-工具映射 ──────────────────────────────────────────────────

export type DevScene =
  | 'coding' // 写代码
  | 'testing' // 写测试
  | 'debugging' // 调试
  | 'reviewing' // 代码审查
  | 'refactoring' // 重构
  | 'deploying' // 部署
  | 'documenting' // 写文档
  | 'exploring' // 理解代码
  | 'planning'; // 需求规划

interface SceneDefinition {
  name: string;
  description: string;
  keywords: string[];
  toolNames: string[];
  tips: string[];
}

const SCENE_DEFINITIONS: Record<DevScene, SceneDefinition> = {
  coding: {
    name: '写代码',
    description: '正在实现功能或修复 bug',
    keywords: ['实现', '开发', '写', '加功能', '修复', 'fix', 'feat', 'implement'],
    toolNames: ['typescript', 'eslint', 'prettier'],
    tips: [
      '写代码前先用 `pmcp bootstrap` 加载项目上下文',
      '修改模块前先用 `read_module` 查看历史记录',
      '写完后用 `tsc --noEmit` 检查类型',
    ],
  },
  testing: {
    name: '写测试',
    description: '编写或运行测试',
    keywords: ['测试', 'test', '单测', '覆盖率', 'coverage', 'tdd'],
    toolNames: ['vitest', 'jest'],
    tips: [
      '先写测试（RED），再实现（GREEN），最后重构（IMPROVE）',
      '用 `vitest --watch` 做 TDD 开发',
      '目标覆盖率 80%+',
    ],
  },
  debugging: {
    name: '调试',
    description: '排查问题和 bug',
    keywords: ['调试', 'debug', '排查', '报错', 'error', 'bug', '问题'],
    toolNames: ['typescript', 'codegraph'],
    tips: [
      '用 `codegraph_trace` 追踪调用链定位问题',
      '用 `tsc --noEmit` 排除类型错误',
      '查看 `recent-5.md` 了解最近的变更历史',
    ],
  },
  reviewing: {
    name: '代码审查',
    description: '审查代码质量、安全性和可维护性',
    keywords: ['审查', 'review', '检查', '安全', 'quality'],
    toolNames: ['eslint', 'typescript', 'codegraph'],
    tips: [
      '用 `codegraph_impact` 分析变更影响范围',
      '用 `eslint` 检查代码规范',
      '用 `tsc --noEmit` 验证类型安全',
    ],
  },
  refactoring: {
    name: '重构',
    description: '改善代码结构而不改变行为',
    keywords: ['重构', 'refactor', '优化', '清理', 'clean', '提取'],
    toolNames: ['typescript', 'eslint', 'codegraph', 'vitest'],
    tips: [
      '重构前先确保测试通过',
      '用 `codegraph_impact` 分析改动影响',
      '用 `codegraph_callers` 找到所有调用者',
      '重构后立即跑测试验证',
    ],
  },
  deploying: {
    name: '部署',
    description: '构建、打包和部署',
    keywords: ['部署', 'deploy', '发布', 'publish', 'build', '构建', '打包'],
    toolNames: ['typescript', 'docker'],
    tips: ['用 `npm run build` 验证构建', '检查 `.env` 配置是否正确', '确认测试通过后再部署'],
  },
  documenting: {
    name: '写文档',
    description: '编写或更新文档',
    keywords: ['文档', 'doc', 'readme', '注释', 'comment', '说明'],
    toolNames: [],
    tips: [
      '用 `pmcp log` 记录本次变更',
      '更新 README 时保持示例代码可运行',
      '模块变更后更新 `module-log`',
    ],
  },
  exploring: {
    name: '理解代码',
    description: '阅读和理解现有代码',
    keywords: ['理解', '了解', '看看', '分析', '架构', '代码结构', '调用链'],
    toolNames: ['codegraph', 'typescript'],
    tips: [
      '用 `codegraph_context` 快速了解一个模块',
      '用 `codegraph_trace` 追踪函数调用链',
      '用 `codegraph_files` 查看项目结构',
    ],
  },
  planning: {
    name: '需求规划',
    description: '分析需求、制定计划',
    keywords: ['规划', 'plan', '需求', 'prd', '设计', 'design', '方案'],
    toolNames: ['pmcp'],
    tips: [
      '用 `pmcp confirm` 保存确认的方向',
      '用 `/plan-prd` 生成 PRD',
      '用 `/plan` 生成实施计划',
    ],
  },
};

/**
 * 推荐当前场景下应使用的工具
 */
export function recommendTools(scene: DevScene, projectRoot?: string): string {
  const def = SCENE_DEFINITIONS[scene];
  if (!def) return `❌ 未知场景: ${scene}`;

  const root = projectRoot || getProjectRoot();
  const installed = scanAll(root);
  const installedNames = new Set(installed.tools.map((t) => t.name.replace(/^@[^/]+\//, '')));

  // 匹配已安装的工具
  const recommended = def.toolNames.filter((name) => installedNames.has(name));
  const missing = def.toolNames.filter((name) => !installedNames.has(name));

  const lines: string[] = [];
  lines.push(`# 🎯 场景: ${def.name}`);
  lines.push('');
  lines.push(`> ${def.description}`);
  lines.push('');

  if (recommended.length > 0) {
    lines.push('## ✅ 推荐工具（已安装）');
    lines.push('');
    for (const name of recommended) {
      const tool = installed.tools.find((t) => t.name.replace(/^@[^/]+\//, '') === name);
      if (tool) {
        lines.push(`- **${tool.name}**: ${tool.description || ''}`);
        if (tool.commands && tool.commands.length > 0) {
          lines.push(`  命令: \`${tool.commands.slice(0, 3).join('` / `')}\``);
        }
      }
    }
    lines.push('');
  }

  if (missing.length > 0) {
    lines.push('## ⚠️ 建议安装');
    lines.push('');
    for (const name of missing) {
      lines.push(`- \`${name}\` — 未安装，可提升${def.name}效率`);
    }
    lines.push('');
  }

  if (def.tips.length > 0) {
    lines.push('## 💡 操作建议');
    lines.push('');
    for (const tip of def.tips) {
      lines.push(`- ${tip}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 列出所有可用场景
 */
export function listScenes(): string {
  const lines: string[] = [];
  lines.push('# 🎬 开发场景');
  lines.push('');
  lines.push('| 场景 | 说明 | 推荐工具 |');
  lines.push('|------|------|----------|');

  for (const [key, def] of Object.entries(SCENE_DEFINITIONS)) {
    lines.push(`| ${key} | ${def.name} | ${def.toolNames.join(', ') || '无'} |`);
  }

  lines.push('');
  lines.push('使用 `recommend_tools` 工具并指定场景，获取具体建议。');

  return lines.join('\n');
}

/**
 * 根据用户输入自动匹配场景
 */
export function detectScene(input: string): DevScene | null {
  const lower = input.toLowerCase();

  for (const [scene, def] of Object.entries(SCENE_DEFINITIONS)) {
    for (const keyword of def.keywords) {
      if (lower.includes(keyword)) {
        return scene as DevScene;
      }
    }
  }

  return null;
}

// ─── 引导流程生成 ────────────────────────────────────────────────────

/**
 * 为指定工具生成 3 步引导流程
 */
export function generateOnboarding(toolName: string): string {
  const basename = toolName.replace(/^@[^/]+\//, '');
  const steps = ONBOARDING_TEMPLATES[basename] || ONBOARDING_TEMPLATES[toolName];

  if (!steps) {
    return `❌ 工具 \`${toolName}\` 暂无引导模板。`;
  }

  const lines: string[] = [];
  lines.push(`# 🚀 快速上手: ${toolName}`);
  lines.push('');

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const num = i + 1;
    lines.push(`## Step ${num}: ${step.title}`);
    lines.push('');
    lines.push(step.content);
    if (step.command) {
      lines.push('');
      lines.push('```bash');
      lines.push(step.command);
      lines.push('```');
    }
    if (step.verify) {
      lines.push('');
      lines.push(`✅ 验证: ${step.verify}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 为所有已安装工具生成引导流程
 */
export function generateAllOnboarding(projectRoot?: string): string {
  const root = projectRoot || getProjectRoot();
  const result = scanAll(root);

  if (result.tools.length === 0) {
    return '未检测到已安装工具。运行 `pmcp tools` 查看详情。';
  }

  const lines: string[] = [];
  lines.push('# 📚 工具引导手册');
  lines.push('');
  lines.push(`共 ${result.tools.length} 个工具：`);
  lines.push('');

  for (const tool of result.tools) {
    const basename = tool.name.replace(/^@[^/]+\//, '');
    const hasTemplate = !!ONBOARDING_TEMPLATES[basename] || !!ONBOARDING_TEMPLATES[tool.name];

    if (hasTemplate) {
      lines.push(`- ✅ ${tool.name} — 有引导`);
    } else {
      lines.push(`- ⚠️ ${tool.name} — 暂无引导`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('使用 `onboard_tool` 工具并指定工具名，获取具体引导流程。');

  return lines.join('\n');
}
