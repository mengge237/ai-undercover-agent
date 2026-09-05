# MPOSTOR · 谁是卧底 AI 联机游戏前端

![lang](https://img.shields.io/badge/lang-JavaScript-informational) ![status](https://img.shields.io/badge/status-maintained-brightgreen)


「谁是卧底」联机游戏平台的**纯前端**实现，工业终端风 UI，配合 [ai-agent-platform](https://github.com/mengge237/ai-agent-platform) 后端使用。

##  功能特性

-  **谁是卧底核心玩法**：登录门禁  游戏大厅  准备/开始  游戏对局  结果结算
-  **多玩法入口**：谁是卧底、拆弹小队（Number Bomb）、成语接龙、海龟汤、趣味问答
-  **AI 接入**：LLM 多模型对话（后端代理），TTS 语音输入支持
-  **工业终端风 UI**：登录页、大厅 5 选项卡、对战房间
-  **纯 JS 实现**：无框架依赖，原生 HTML/CSS/JS 多页面结构

##  技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 HTML5 / CSS3 / JavaScript（ES6+） |
| 通信 | RESTful API + WebSocket（与后端联机） |
| 风格 | 工业终端风（MPOSTOR 主题） |
| 工具 | live-server（本地开发） |

##  项目结构

```
├── index.html / index.js / index.css   # 入口页
├── src/
│   ├── pages/          # 多页面：login/game-hall/game-play/game-result 等
│   ├── agent/          # AI 代理逻辑（game-engine/llm-service/prompt-templates）
│   ├── components/     # 通用组件（header/loading/modal/toast）
│   ├── config/         # 配置（api/game/constants）
│   ├── utils/          # 工具（api/validator/storage/ErrorHandler）
│   └── styles/         # 主题样式
└── package.json
```

##  快速开始

```bash
# 1. 安装依赖（live-server）
npm install

# 2. 启动本地服务
npm start
# 或 npx live-server

# 3. 打开 http://localhost:8080
```

> 需配合后端 [ai-agent-platform](https://github.com/mengge237/ai-agent-platform) 运行，联机与 AI 功能才可用。

##  配套后端

- [ai-agent-platform](https://github.com/mengge237/ai-agent-platform)（Spring Boot + WebSocket + LLM 联机服务）
