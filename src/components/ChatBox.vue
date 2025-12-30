<template>
  <div class="chat-container">
    <!-- 设置栏 -->
    <div class="settings-bar">
      <ModelSelector v-model="selectedModel" />
      <button
        @click="handleExportWord"
        :disabled="messages.length <= 1"
        class="export-button"
        title="导出为 Word 文档"
      >
        导出 Word
      </button>
    </div>

    <!-- 消息列表 -->
    <div class="messages-container" ref="messagesContainer">
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="['message', message.role]"
      >
        <div
          v-if="message.role === 'assistant'"
          class="message-content markdown-body"
          v-html="renderMarkdown(message.content)"
        ></div>
        <div v-else class="message-content">
          {{ message.content }}
        </div>
      </div>
      <div v-if="loading" class="message assistant">
        <div
          v-if="streamingContent"
          class="message-content markdown-body"
          v-html="renderMarkdown(streamingContent)"
        ></div>
        <div class="message-content loading" v-else>
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
      <button @click="error = ''" class="close-error">×</button>
    </div>

    <!-- 输入区域 -->
    <div class="input-container">
      <input
        v-model="inputText"
        @keyup.enter="handleSend"
        placeholder="输入你的消息..."
        :disabled="loading"
        class="message-input"
      />
      <button
        @click="handleSend"
        :disabled="loading || !inputText.trim()"
        class="send-button"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, computed } from 'vue'
import { marked } from 'marked'
import ModelSelector from './ModelSelector.vue'
import { sendMessageStream, AVAILABLE_MODELS } from '../services/api.js'
import { exportToWord } from '../utils/exportWord.js'

// 从环境变量获取 API Key
const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || ''

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
})

// 渲染 Markdown
const renderMarkdown = (content) => {
  if (!content) return ''
  return marked.parse(content)
}

// 状态
const messages = ref([
  { role: 'assistant', content: '你好！我是 Real AI，选择模型开始对话吧。' }
])
const inputText = ref('')
const loading = ref(false)
const error = ref('')
const streamingContent = ref('')
const messagesContainer = ref(null)

// 配置
const selectedModel = ref(localStorage.getItem('selected_model') || AVAILABLE_MODELS[0].id)

// 获取当前模型名称
const currentModelName = computed(() => {
  const model = AVAILABLE_MODELS.find(m => m.id === selectedModel.value)
  return model ? model.name : 'AI'
})

// 保存配置到 localStorage
watch(selectedModel, (val) => {
  localStorage.setItem('selected_model', val)
})

// 导出为 Word
const handleExportWord = async () => {
  try {
    await exportToWord(messages.value, currentModelName.value)
  } catch (err) {
    error.value = '导出失败: ' + err.message
    console.error('Export Error:', err)
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const handleSend = async () => {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  if (!apiKey) {
    error.value = '请在 .env 文件中配置 VITE_OPENROUTER_API_KEY'
    return
  }

  // 添加用户消息
  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  loading.value = true
  error.value = ''
  streamingContent.value = ''
  scrollToBottom()

  try {
    // 构建消息历史（排除系统欢迎消息）
    const chatHistory = messages.value.slice(1).map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // 流式调用 API
    const fullContent = await sendMessageStream(
      chatHistory,
      selectedModel.value,
      apiKey,
      (chunk) => {
        streamingContent.value += chunk
        scrollToBottom()
      }
    )

    // 添加完整的 AI 回复
    messages.value.push({
      role: 'assistant',
      content: fullContent
    })
  } catch (err) {
    error.value = err.message || '请求失败，请检查 API Key 和网络'
    console.error('API Error:', err)
  } finally {
    loading.value = false
    streamingContent.value = ''
    scrollToBottom()
  }
}
</script>

<style scoped>
.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  min-height: 0; /* 重要：允许flex子项收缩 */
}

.settings-bar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #fafafa;
  border-bottom: 1px solid #eee;
  flex-wrap: wrap;
  flex-shrink: 0;
  align-items: center;
}

.export-button {
  padding: 6px 12px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.export-button:hover:not(:disabled) {
  background: #218838;
}

.export-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  -webkit-overflow-scrolling: touch; /* iOS 平滑滚动 */
}

.message {
  max-width: 85%;
  animation: fadeIn 0.3s ease;
}

.message.user {
  align-self: flex-end;
}

.message.assistant {
  align-self: flex-start;
}

.message-content {
  padding: 10px 14px;
  border-radius: 16px;
  line-height: 1.6;
  word-break: break-word;
  font-size: 15px;
}

.message.user .message-content {
  background: #007bff;
  color: white;
  border-bottom-right-radius: 4px;
  white-space: pre-wrap;
}

.message.assistant .message-content {
  background: #f0f0f0;
  color: #333;
  border-bottom-left-radius: 4px;
}

/* Markdown 样式 */
.markdown-body :deep(p) {
  margin: 0 0 0.5em 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(pre) {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}

.markdown-body :deep(code) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.markdown-body :deep(p code),
.markdown-body :deep(li code) {
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 4px;
  color: #c7254e;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(blockquote) {
  border-left: 4px solid #ddd;
  margin: 8px 0;
  padding-left: 16px;
  color: #666;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 16px 0 8px 0;
  font-weight: 600;
}

.markdown-body :deep(h1) { font-size: 1.5em; }
.markdown-body :deep(h2) { font-size: 1.3em; }
.markdown-body :deep(h3) { font-size: 1.1em; }

.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #f5f5f5;
  font-weight: 600;
}

.markdown-body :deep(a) {
  color: #007bff;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #ddd;
  margin: 16px 0;
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #fee;
  color: #c00;
  font-size: 14px;
}

.close-error {
  background: none;
  border: none;
  color: #c00;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.input-container {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
  background: white;
}

.message-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 24px;
  font-size: 16px; /* 防止 iOS 自动缩放 */
  outline: none;
  transition: border-color 0.2s;
  min-width: 0; /* 允许收缩 */
}

.message-input:focus {
  border-color: #007bff;
}

.send-button {
  padding: 10px 18px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
  white-space: nowrap;
}

.send-button:hover:not(:disabled) {
  background: #0056b3;
}

.send-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .chat-container {
    border-radius: 8px;
  }

  .settings-bar {
    padding: 6px 10px;
  }

  .export-button {
    padding: 5px 10px;
    font-size: 12px;
  }

  .messages-container {
    padding: 10px;
    gap: 8px;
  }

  .message {
    max-width: 90%;
  }

  .message-content {
    padding: 8px 12px;
    font-size: 14px;
  }

  .input-container {
    padding: 8px 10px;
    gap: 6px;
  }

  .message-input {
    padding: 8px 12px;
  }

  .send-button {
    padding: 8px 14px;
    font-size: 13px;
  }

  .markdown-body :deep(pre) {
    padding: 8px;
    font-size: 12px;
  }

  .markdown-body :deep(code) {
    font-size: 12px;
  }
}

/* Loading animation */
.loading {
  display: flex;
  gap: 4px;
  padding: 16px !important;
}

.dot {
  width: 8px;
  height: 8px;
  background: #666;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
