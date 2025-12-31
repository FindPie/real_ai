# Real AI - 智能对话助手

基于 Vue 3 构建的 AI 对话应用，通过 OpenRouter API 接入多种大语言模型，支持联网搜索和对话导出。

## 功能特性

- **多模型支持**：GPT-5.2、Claude Opus 4.5、Gemini 3、DeepSeek V3.2 等主流模型
- **联网搜索**：一键开启联网模式，AI 可获取最新网络信息
- **流式响应**：实时显示 AI 回复，打字机效果
- **Markdown 渲染**：支持代码高亮、表格、列表等格式
- **导出 Word**：一键将对话导出为 Word 文档
- **移动端适配**：完美支持手机端使用
- **配置持久化**：自动保存模型选择和联网状态

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

复制环境变量示例文件并填入你的 OpenRouter API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

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
├── .env                    # 环境变量（API Key，不提交到 Git）
├── .env.example            # 环境变量示例
└── src/
    ├── main.js             # 应用入口
    ├── App.vue             # 根组件
    ├── assets/
    │   └── style.css       # 全局样式
    ├── components/
    │   ├── ChatBox.vue     # 聊天主组件
    │   └── ModelSelector.vue # 模型选择器
    ├── services/
    │   └── api.js          # OpenRouter API 服务
    └── utils/
        └── exportWord.js   # Word 导出工具
```

## 支持的模型

| 厂商 | 模型 |
|------|------|
| OpenAI | GPT-5.2, GPT-4o, GPT-4o Mini, GPT-4 Turbo |
| Anthropic | Claude Opus 4.5, Claude 3.5 Sonnet, Claude 3 Haiku |
| Google | Gemini 3 Pro, Gemini 3 Flash, Gemini Pro 1.5, Gemini Flash 1.5 |
| Meta | Llama 3.1 70B, Llama 3.1 8B |
| DeepSeek | DeepSeek V3.2, DeepSeek Chat |
| Alibaba | Qwen 2.5 72B |

## 功能说明

### 联网搜索

点击「联网: 关」按钮切换为「联网: 开」，AI 将能够搜索互联网获取最新信息。适用于：
- 查询最新新闻和事件
- 获取实时数据和统计
- 搜索最新技术文档

### 导出 Word

点击「导出 Word」按钮，将当前对话保存为 `.docx` 文件，包含：
- 对话完整记录
- 模型名称和导出时间
- 格式化的 Markdown 内容

## 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

## 技术栈

- Vue 3 + Composition API
- Vite 5
- Marked (Markdown 渲染)
- docx + file-saver (Word 导出)
- OpenRouter API

## License

MIT
