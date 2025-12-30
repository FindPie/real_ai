# Real AI - 智能对话助手

基于 Vue 3 构建的 AI 对话应用，通过 OpenRouter API 接入多种大语言模型。

## 功能特性

- 多模型支持：GPT-5.2、Claude Opus 4.5、Gemini 3 Pro/Flash 等
- 流式响应：实时显示 AI 回复
- Markdown 渲染：支持代码块、表格、列表等格式
- 模型切换：可在对话中随时切换不同模型
- 配置持久化：自动保存模型选择

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

编辑 `.env` 文件，填入你的 OpenRouter API Key：

```
VITE_OPENROUTER_API_KEY=your_api_key_here
```

API Key 可从 https://openrouter.ai/keys 获取。

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 开始对话。

## 项目结构

```
real_ai/
├── index.html              # 入口 HTML
├── package.json            # 项目配置
├── vite.config.js          # Vite 构建配置
├── .env                    # 环境变量（API Key）
├── .env.example            # 环境变量示例
└── src/
    ├── main.js             # 应用入口
    ├── App.vue             # 根组件
    ├── assets/
    │   └── style.css       # 全局样式
    ├── components/
    │   ├── ChatBox.vue     # 聊天主组件
    │   └── ModelSelector.vue # 模型选择器
    └── services/
        └── api.js          # OpenRouter API 服务
```

## 支持的模型

| 厂商 | 模型 |
|------|------|
| OpenAI | GPT-5.2, GPT-4o, GPT-4o Mini, GPT-4 Turbo |
| Anthropic | Claude Opus 4.5, Claude 3.5 Sonnet, Claude 3 Haiku |
| Google | Gemini 3 Pro, Gemini 3 Flash, Gemini Pro 1.5, Gemini Flash 1.5 |
| Meta | Llama 3.1 70B, Llama 3.1 8B |
| DeepSeek | DeepSeek Chat |
| Alibaba | Qwen 2.5 72B |

## 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

## 技术栈

- Vue 3 + Composition API
- Vite 5
- Marked (Markdown 渲染)
- OpenRouter API
