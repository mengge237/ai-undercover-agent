// setup-project.js - 在项目根目录运行 node setup-project.js
const fs = require('fs');
const path = require('path');

const structure = {
  'src': {
    'agent': {
      'index.js': `// Agent核心类
export class UndercoverAgent {
    constructor() {
        this.llm = null;
        this.gameState = null;
    }
    
    async generateWords(category) {
        // AI生成卧底词逻辑
        return { civilian: '鸡', undercover: '鸭' };
    }
}`,
      'llm-service.js': `// LLM服务封装
export class LLMService {
    async callAPI(prompt) {
        // 调用OpenAI/Claude等API
    }
}`,
      'prompt-templates.js': `// 提示词模板
export const PROMPTS = {
    GENERATE_WORDS: '请生成一对相似但不同的词语...',
    ANALYZE_PLAYER: '分析玩家发言特征...'
}`,
      'game-engine.js': `// 游戏逻辑引擎
export class GameEngine {
    constructor(players, words) {
        this.players = players;
        this.words = words;
    }
    
    start() {
        // 游戏开始逻辑
    }
}`
    },
    'pages': {
      'game-setup': {
        'index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>游戏设置 - AI谁是卧底</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="game-container">
        <!-- 您之前实现的完整HTML内容 -->
        <h1>AI谁是卧底大乱斗</h1>
    </div>
    <script type="module" src="script.js"></script>
</body>
</html>`,
        'style.css': `/* 您之前实现的完整CSS样式 */`,
        'script.js': `// 您之前实现的完整JavaScript逻辑
import { UndercoverAgent } from '../../agent/index.js';

const agent = new UndercoverAgent();

async function init() {
    // 初始化游戏设置页面
    console.log('游戏设置页面已加载');
}

init();`,
        'README.md': '# 游戏设置模块\n\n游戏设置页面功能说明'
      },
      'game-play': {
        'index.html': '<h1>游戏进行中</h1>',
        'style.css': '/* 游戏主玩法样式 */',
        'script.js': '// 游戏主逻辑'
      },
      'game-result': {
        'index.html': '<h1>游戏结果</h1>',
        'style.css': '/* 结果页样式 */',
        'script.js': '// 结果统计逻辑'
      }
    },
    'components': {
      'header.js': '// 头部组件',
      'loading.js': `// 加载组件
export function showLoading(text) {
    const loading = document.createElement('div');
    loading.className = 'loading-overlay';
    loading.innerHTML = \`<div class="spinner"></div><p>\${text}</p>\`;
    document.body.appendChild(loading);
}`,
      'modal.js': '// 弹窗组件',
      'toast.js': '// 提示组件'
    },
    'utils': {
      'validator.js': `// 表单校验工具
export function validatePlayers(players) {
    return players.every(p => p.trim() !== '');
}

export function validateWords(civilian, undercover) {
    return civilian && undercover && civilian !== undercover;
}`,
      'storage.js': '// 本地存储封装',
      'api.js': '// API请求封装',
      'helpers.js': '// 通用辅助函数'
    },
    'config': {
      'game-config.js': `// 游戏配置
export const GAME_CONFIG = {
    MAX_PLAYERS: 6,
    MIN_PLAYERS: 4,
    DEFAULT_WORD_CATEGORY: '家禽'
};`,
      'api-config.js': `// API配置
export const API_CONFIG = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    API_BASE_URL: 'https://api.openai.com/v1'
};`,
      'constants.js': '// 常量定义'
    },
    'assets': {
      'images': {
        'icons': {},
        'backgrounds': {}
      },
      'audio': {}
    }
  },
  'index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI智能体平台 - 谁是卧底大乱斗</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        iframe {
            width: 100%;
            height: 80vh;
            border: none;
        }
        .header {
            background: #1a1a2e;
            color: white;
            padding: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>[AI] MPOSTOR · 谁是卧底大乱斗</h1>
            <p>智能决策 | 实时分析 | 趣味推理</p>
        </div>
        <iframe src="src/pages/game-setup/index.html"></iframe>
    </div>
</body>
</html>`,
  'package.json': `{
  "name": "mpostor",
  "version": "2.0.0",
  "description": "MPOSTOR - AI 谁是卧底游戏平台 · 工业终端风",
  "main": "src/main.js",
  "scripts": {
    "dev": "npx live-server --port=3000 --entry-file=index.html",
    "setup": "node setup-project.js"
  },
  "keywords": ["AI", "game", "undercover", "agent"],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "live-server": "^1.2.2"
  }
}`,
  '.gitignore': `node_modules/
.DS_Store
*.log
.env
dist/
.vscode/`,
  'README.md': `# AI谁是卧底大乱斗 - Agent智能体

## 项目结构
\`\`\`
ai-undercover-agent/
├── src/           # 源代码
├── index.html     # 主入口
└── package.json   # 依赖配置
\`\`\`

## 快速开始
\`\`\`bash
npm install
npm run dev
\`\`\``
};

// 递归创建文件和文件夹
function createStructure(basePath, structure) {
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = path.join(basePath, name);
    
    if (typeof content === 'object' && !content.includes?.('<!DOCTYPE')) {
      // 是文件夹
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`[DIR] 创建文件夹: ${fullPath}`);
      }
      createStructure(fullPath, content);
    } else {
      // 是文件
      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, content);
        console.log(`[FILE] 创建文件: ${fullPath}`);
      } else {
        console.log(`[!]  文件已存在: ${fullPath}`);
      }
    }
  }
}

// 执行创建
console.log('[BOOT] 开始创建项目结构...\n');
createStructure(process.cwd(), structure);
console.log('\n✓ 项目结构创建完成！');
console.log('\n[DATA] 下一步：');
console.log('1. npm install');
console.log('2. npm run dev');
console.log('3. 访问 http://localhost:3000');