<template>
  <div class="chat-container">
    <!-- 设置栏 -->
    <div class="settings-bar">
      <ModelSelector v-model="selectedModel" />
      <button
        @click="webSearchEnabled = !webSearchEnabled"
        :class="['search-toggle', { active: webSearchEnabled }]"
        :title="webSearchEnabled ? '关闭联网搜索' : '开启联网搜索'"
      >
        {{ webSearchEnabled ? '联网: 开' : '联网: 关' }}
      </button>
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
        <div class="message-wrapper">
          <div
            v-if="message.role === 'assistant'"
            class="message-content markdown-body"
            v-html="renderMarkdown(message.content)"
          ></div>
          <div v-else class="message-content">
            {{ message.content }}
          </div>
          <!-- 图片展示区域 -->
          <div v-if="message.images && message.images.length > 0" class="message-images">
            <div
              v-for="(img, imgIndex) in message.images"
              :key="imgIndex"
              class="image-wrapper"
            >
              <img
                :src="img"
                :alt="'AI 生成的图片 ' + (imgIndex + 1)"
                class="generated-image"
                @click="openImagePreview(img)"
              />
            </div>
          </div>
          <button
            class="copy-button"
            @click="copyMessage(message.content, index)"
            :title="copiedIndex === index ? '已复制' : '复制'"
          >
            {{ copiedIndex === index ? '✓' : '复制' }}
          </button>
        </div>
      </div>
      <div v-if="loading" class="message assistant">
        <div
          v-if="streamingContent"
          class="message-content markdown-body"
          v-html="renderMarkdown(streamingContent)"
        ></div>
        <div class="message-content loading" v-else-if="streamingImages.length === 0">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <!-- 流式加载时的图片展示 -->
        <div v-if="streamingImages.length > 0" class="message-images">
          <div
            v-for="(img, imgIndex) in streamingImages"
            :key="imgIndex"
            class="image-wrapper"
          >
            <img
              :src="img"
              :alt="'AI 生成的图片 ' + (imgIndex + 1)"
              class="generated-image"
              @click="openImagePreview(img)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
      <button @click="error = ''" class="close-error">×</button>
    </div>

    <!-- 图片预览模态框 -->
    <div v-if="previewImage" class="image-preview-overlay" @click="closeImagePreview">
      <div class="image-preview-container">
        <img :src="previewImage" alt="预览图片" class="preview-image" />
        <button class="close-preview" @click.stop="closeImagePreview">×</button>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <!-- 上传图片预览 -->
      <div v-if="uploadedImages.length > 0" class="uploaded-images-preview">
        <div
          v-for="(img, index) in uploadedImages"
          :key="index"
          class="uploaded-image-item"
        >
          <img :src="img.preview" :alt="'上传图片 ' + (index + 1)" />
          <button class="remove-image" @click="removeUploadedImage(index)">×</button>
        </div>
      </div>
      <div class="input-container">
        <input
          type="file"
          ref="fileInputRef"
          accept="image/*"
          multiple
          @change="handleFileSelect"
          style="display: none"
        />
        <button
          class="upload-button"
          @click="triggerFileInput"
          :disabled="loading"
          :title="isVisionModel ? '上传图片' : '当前模型不支持图片理解'"
          :class="{ disabled: !isVisionModel }"
        >
          📷
        </button>
        <textarea
          v-model="inputText"
          @keydown.enter.exact.prevent="handleSend"
          :placeholder="uploadedImages.length > 0 ? '描述图片或提问...' : '输入你的消息... (Shift+Enter 换行)'"
          :disabled="loading"
          class="message-input"
          rows="1"
        ></textarea>
        <button
          @click="handleSend"
          :disabled="loading || (!inputText.trim() && uploadedImages.length === 0)"
          class="send-button"
        >
          发送
        </button>
      </div>
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
  { role: 'assistant', content: '你好！我是 Real AI，选择模型开始对话吧（带 👁️ 标记的模型可以上传图片进行图片识别）。', images: [] }
])
const inputText = ref('')
const loading = ref(false)
const error = ref('')
const streamingContent = ref('')
const streamingImages = ref([])
const messagesContainer = ref(null)
const copiedIndex = ref(-1)
const previewImage = ref('')
const fileInputRef = ref(null)
const uploadedImages = ref([]) // { file, preview, base64 }

// 配置
const selectedModel = ref(localStorage.getItem('selected_model') || AVAILABLE_MODELS[0].id)
const webSearchEnabled = ref(localStorage.getItem('web_search_enabled') === 'true')

// 获取当前模型名称
const currentModelName = computed(() => {
  const model = AVAILABLE_MODELS.find(m => m.id === selectedModel.value)
  return model ? model.name : 'AI'
})

// 判断当前模型是否支持视觉
const isVisionModel = computed(() => {
  const model = AVAILABLE_MODELS.find(m => m.id === selectedModel.value)
  return model?.type === 'vision'
})

// 保存配置到 localStorage
watch(selectedModel, (val) => {
  localStorage.setItem('selected_model', val)
})

watch(webSearchEnabled, (val) => {
  localStorage.setItem('web_search_enabled', val.toString())
})

// 打开图片预览
const openImagePreview = (imageUrl) => {
  previewImage.value = imageUrl
}

// 关闭图片预览
const closeImagePreview = () => {
  previewImage.value = ''
}

// 触发文件选择
const triggerFileInput = () => {
  if (!isVisionModel.value) {
    error.value = '当前模型不支持图片理解，请选择带 👁️ 标记的视觉模型'
    return
  }
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileSelect = async (event) => {
  const files = event.target.files
  if (!files || files.length === 0) return

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue

    // 创建预览 URL
    const preview = URL.createObjectURL(file)

    // 转换为 base64
    const base64 = await fileToBase64(file)

    uploadedImages.value.push({
      file,
      preview,
      base64,
      type: file.type
    })
  }

  // 清空 input 以便再次选择相同文件
  event.target.value = ''
}

// 文件转 base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 移除已上传的图片
const removeUploadedImage = (index) => {
  const img = uploadedImages.value[index]
  if (img?.preview) {
    URL.revokeObjectURL(img.preview)
  }
  uploadedImages.value.splice(index, 1)
}

// 清空所有上传的图片
const clearUploadedImages = () => {
  uploadedImages.value.forEach(img => {
    if (img.preview) URL.revokeObjectURL(img.preview)
  })
  uploadedImages.value = []
}

// 复制消息
const copyMessage = async (content, index) => {
  try {
    await navigator.clipboard.writeText(content)
    copiedIndex.value = index
    setTimeout(() => {
      copiedIndex.value = -1
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

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
  const hasImages = uploadedImages.value.length > 0

  // 至少需要文字或图片
  if ((!text && !hasImages) || loading.value) return

  if (!apiKey) {
    error.value = '请在 .env 文件中配置 VITE_OPENROUTER_API_KEY'
    return
  }

  // 保存当前上传的图片用于显示（使用 base64，因为 preview URL 会被释放）
  const currentImages = uploadedImages.value.map(img => img.base64)
  const imageDataList = uploadedImages.value.map(img => ({
    base64: img.base64,
    type: img.type
  }))

  // 添加用户消息（包含图片预览）
  messages.value.push({
    role: 'user',
    content: text || '(图片)',
    images: currentImages
  })

  inputText.value = ''
  clearUploadedImages()
  loading.value = true
  error.value = ''
  streamingContent.value = ''
  streamingImages.value = []
  scrollToBottom()

  try {
    // 构建消息历史（排除系统欢迎消息）
    const chatHistory = messages.value.slice(1).map((msg, idx) => {
      // 最后一条消息（刚添加的用户消息）需要包含图片
      if (idx === messages.value.length - 2 && imageDataList.length > 0) {
        return {
          role: msg.role,
          content: buildMultimodalContent(msg.content === '(图片)' ? '' : msg.content, imageDataList)
        }
      }
      return {
        role: msg.role,
        content: msg.content
      }
    })

    // 流式调用 API
    const result = await sendMessageStream(
      chatHistory,
      selectedModel.value,
      apiKey,
      (chunk) => {
        streamingContent.value += chunk
        scrollToBottom()
      },
      {
        webSearch: webSearchEnabled.value,
        onImage: (imageUrl) => {
          streamingImages.value.push(imageUrl)
          scrollToBottom()
        }
      }
    )

    // 添加完整的 AI 回复
    messages.value.push({
      role: 'assistant',
      content: result.content,
      images: result.images || []
    })
  } catch (err) {
    error.value = err.message || '请求失败，请检查 API Key 和网络'
    console.error('API Error:', err)
  } finally {
    loading.value = false
    streamingContent.value = ''
    streamingImages.value = []
    scrollToBottom()
  }
}

// 构建多模态消息内容
const buildMultimodalContent = (text, images) => {
  const content = []

  // 添加文本
  if (text) {
    content.push({
      type: 'text',
      text: text
    })
  }

  // 添加图片
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: img.base64
      }
    })
  }

  return content
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

.search-toggle {
  padding: 6px 12px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.search-toggle:hover {
  background: #5a6268;
}

.search-toggle.active {
  background: #17a2b8;
}

.search-toggle.active:hover {
  background: #138496;
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

.message-wrapper {
  position: relative;
  padding-bottom: 20px;
}

.copy-button {
  position: absolute;
  bottom: 0;
  right: 0;
  padding: 2px 8px;
  background: transparent;
  color: #999;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s;
}

.copy-button:hover {
  color: #007bff;
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

/* 图片展示样式 */
.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.image-wrapper {
  position: relative;
  max-width: 300px;
}

.generated-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  object-fit: contain;
  background: #f5f5f5;
}

.generated-image:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 图片预览模态框 */
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.image-preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.preview-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
}

.close-preview {
  position: absolute;
  top: -40px;
  right: 0;
  background: transparent;
  border: none;
  color: white;
  font-size: 32px;
  cursor: pointer;
  padding: 4px 12px;
  transition: color 0.2s;
}

.close-preview:hover {
  color: #ff6b6b;
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

/* 输入区域 */
.input-area {
  flex-shrink: 0;
  background: white;
  border-top: 1px solid #eee;
}

.uploaded-images-preview {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  overflow-x: auto;
  background: #fafafa;
}

.uploaded-image-item {
  position: relative;
  flex-shrink: 0;
}

.uploaded-image-item img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.remove-image {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ff4444;
  color: white;
  border: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-image:hover {
  background: #cc0000;
}

.input-container {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  align-items: flex-end;
}

.upload-button {
  width: 40px;
  height: 40px;
  border: 1px solid #ddd;
  border-radius: 50%;
  background: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.upload-button:hover:not(:disabled) {
  border-color: #007bff;
  background: #f0f7ff;
}

.upload-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-button.disabled {
  opacity: 0.4;
}

.message-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 18px;
  font-size: 16px; /* 防止 iOS 自动缩放 */
  outline: none;
  transition: border-color 0.2s;
  min-width: 0; /* 允许收缩 */
  resize: none; /* 禁用手动调整大小 */
  min-height: 40px;
  max-height: 150px;
  overflow-y: auto;
  line-height: 1.4;
  font-family: inherit;
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

  .search-toggle,
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

  .copy-button {
    font-size: 11px;
  }

  .input-container {
    padding: 8px 10px;
    gap: 6px;
  }

  .message-input {
    padding: 8px 12px;
    min-height: 36px;
    max-height: 120px;
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

  .image-wrapper {
    max-width: 200px;
  }

  .generated-image {
    max-height: 200px;
  }

  .close-preview {
    top: -35px;
    font-size: 28px;
  }

  .uploaded-images-preview {
    padding: 6px 10px;
  }

  .uploaded-image-item img {
    width: 50px;
    height: 50px;
  }

  .upload-button {
    width: 36px;
    height: 36px;
    font-size: 16px;
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
