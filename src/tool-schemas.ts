/**
 * tool-schemas.ts
 *
 * MCP Tool schema definitions.
 * Separated from index.ts for readability and maintainability.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'init_prompts',
    description:
      '【初始化】扫描目标项目，自动生成 prompts 体系（context.md / todos.md / modules/）。已有文件不会覆盖。',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: '目标项目根目录路径。不传则使用 PROJECT_ROOT 环境变量或当前目录。',
        },
      },
    },
  },
  {
    name: 'bootstrap',
    description:
      '【一键启动】自动读取项目上下文（context.md + todos + 模块记录）。智能体启动时第一步调用。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'confirm_direction',
    description:
      '【方向确认】AI 追问澄清后，用户确认方向时调用。保存目标、约束、验收标准到 direction.md。对话式追问由 AI 自然完成，此工具只负责持久化确认结果。',
    inputSchema: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: '一句话目标描述',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: '关键约束列表（可选）',
        },
        acceptance: {
          type: 'string',
          description: '验收标准，一句话说明怎么算完成（可选）',
        },
        context: {
          type: 'string',
          description: '补充说明（可选）',
        },
      },
      required: ['goal'],
    },
  },
  {
    name: 'log_dialog',
    description: '【记录日志】记录对话日志，追加待办到 todos.md。',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '对话简明标题',
        },
        request: {
          type: 'string',
          description: '清洗后的用户需求',
        },
        changes: {
          type: 'array',
          items: { type: 'string' },
          description: '代码变更文件列表',
        },
        decisions: {
          type: 'array',
          items: { type: 'string' },
          description: '本次技术决策',
        },
        todos: {
          type: 'array',
          items: { type: 'string' },
          description: '遗留待办项',
        },
      },
      required: ['title', 'request'],
    },
  },
  {
    name: 'log_module',
    description:
      '【模块记录】按模块记录一次修改（目录式）。修改功能前先 read_module，修改后调用此工具。',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: {
          type: 'string',
          description: '模块名称（如 auth、rag-upload、frontend）',
        },
        change: {
          type: 'string',
          description: '变更内容描述',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: '涉及的文件列表',
        },
        decisions: {
          type: 'array',
          items: { type: 'string' },
          description: '本次决策',
        },
      },
      required: ['moduleName', 'change'],
    },
  },
  {
    name: 'read_module',
    description: '【读取模块记录】修改功能前调用，读取对应模块的历史修改记录。',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: {
          type: 'string',
          description: '模块名称',
        },
      },
      required: ['moduleName'],
    },
  },
  {
    name: 'update_todos',
    description: '【更新待办】更新 todos.md 中的待办事项。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '操作类型: add（添加）/ complete（完成）/ remove（删除）',
          enum: ['add', 'complete', 'remove'],
        },
        todo: {
          type: 'string',
          description: '待办事项内容',
        },
      },
      required: ['action', 'todo'],
    },
  },
  {
    name: 'auto_start',
    description:
      '【自动启动】会话开始时第一个调用。一键加载全部上下文（context + todos + 用户规则 + 模块记录）。每次新对话开始时必须调用此工具。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_rule',
    description:
      '【添加规则】添加一条项目规范规则。规则会持久化存储，在每次会话启动时自动加载。',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '规则名称（如 commit-style、naming-convention）',
        },
        content: {
          type: 'string',
          description: '规则内容',
        },
        category: {
          type: 'string',
          description: '分类（如 frontend / backend / general / testing）',
        },
      },
      required: ['name', 'content'],
    },
  },
  {
    name: 'list_rules',
    description: '【列出规则】列出所有已添加的项目规范规则。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'remove_rule',
    description: '【删除规则】删除一条项目规范规则。',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '要删除的规则名称',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'commit_dialog',
    description:
      '【手动提交】手动触发一次 git commit。可指定要提交的文件，不指定则提交所有变更。',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: '提交信息',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: '要提交的文件列表（不指定则提交所有变更）',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'list_skills',
    description:
      '【技能列表】列出所有可用的角色技能（Skill）。会话启动时自动展示，也可手动调用。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'select_skill',
    description:
      '【选择技能】选择一个 Skill 作为当前身份角色。返回该 Skill 的完整 prompt（身份 + 开发规范 + 学习记录）。会话开始时应询问用户选择哪个 Skill。',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Skill 名称（如 architect、backend、frontend、review）',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_skill',
    description:
      '【技能自优化】会话结束时调用，总结本次开发经验并更新 Skill。可追加学习记录、修改开发规范、更新描述。智能体应主动在每次开发后调用此工具自我进化。',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '要更新的 Skill 名称',
        },
        learnings: {
          type: 'string',
          description: '本次会话学到的经验教训（会追加到学习记录）',
        },
        guidelineChanges: {
          type: 'string',
          description: '开发规范的修改（会替换现有规范内容）',
        },
        description: {
          type: 'string',
          description: '更新 Skill 描述',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_skill',
    description: '【创建技能】创建一个新的角色技能。可自定义身份、开发规范等。',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Skill 名称（如 devops、data-engineer）',
        },
        icon: {
          type: 'string',
          description: '图标 emoji（默认 🎯）',
        },
        description: {
          type: 'string',
          description: 'Skill 一句话描述',
        },
        identity: {
          type: 'string',
          description: '身份描述：这个角色是谁，职责是什么',
        },
        guidelines: {
          type: 'string',
          description: '开发规范：这个角色应遵循的规则和最佳实践',
        },
      },
      required: ['name', 'description', 'identity', 'guidelines'],
    },
  },
  {
    name: 'scan_tools',
    description:
      '【工具扫描】扫描项目已安装的工具（npm 依赖、MCP Server），输出能力清单和使用建议。帮助用户快速了解可用工具。',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: '项目根目录（可选，不传则使用当前项目）',
        },
      },
    },
  },
  {
    name: 'recommend_tools',
    description:
      '【场景推荐】根据当前开发场景（coding/testing/debugging/reviewing 等），推荐应使用的工具和操作建议。也可自动检测场景。',
    inputSchema: {
      type: 'object',
      properties: {
        scene: {
          type: 'string',
          description:
            '开发场景：coding/testing/debugging/reviewing/refactoring/deploying/documenting/exploring/planning',
        },
        input: {
          type: 'string',
          description: '用户输入文本（可选，用于自动检测场景）',
        },
      },
    },
  },
  {
    name: 'list_scenes',
    description: '【场景列表】列出所有可用的开发场景及推荐工具。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'onboard_tool',
    description:
      '【工具引导】为指定工具生成 3 步快速上手引导（是什么 → 用一次 → 验证效果）。',
    inputSchema: {
      type: 'object',
      properties: {
        toolName: {
          type: 'string',
          description: '工具名称（如 codegraph、eslint、vitest）',
        },
      },
      required: ['toolName'],
    },
  },
  {
    name: 'onboard_all',
    description: '【全部引导】为所有已安装工具生成引导手册概览。',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: '项目根目录（可选）',
        },
      },
    },
  },
  {
    name: 'audit_secrets',
    description:
      '【隐私审计】扫描代码中的密钥、Token、密码等隐私信息。发布前必须调用，有 critical/high 发现时拦截发布。',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: '项目根目录（可选）',
        },
      },
    },
  },
  {
    name: 'safe_publish',
    description:
      '【安全发布】一键完成隐私审计 + 版本 bump + npm publish + git push + npm link + README 更新。',
    inputSchema: {
      type: 'object',
      properties: {
        npmToken: { type: 'string', description: 'npm Access Token' },
        bump: { type: 'string', description: '版本号类型: patch/minor/major（默认 patch）' },
        version: { type: 'string', description: '指定版本号（覆盖 bump）' },
        message: { type: 'string', description: 'git commit message' },
        skipAudit: { type: 'boolean', description: '跳过隐私审计（不推荐）' },
      },
    },
  },
];
