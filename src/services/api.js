// OpenRouter API 服务
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

// 模型能力类型
// type: 'chat' - 纯文本对话
// type: 'vision' - 支持图片理解
// type: 'image-gen' - 支持图片生成

// 可选模型列表
export const AVAILABLE_MODELS = [
  { id: 'openai/gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', type: 'chat' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', type: 'vision' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', type: 'vision' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', type: 'vision' },
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'Anthropic', type: 'vision' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', type: 'vision' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'Google', type: 'vision' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google', type: 'vision' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta', type: 'chat' },
  { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'Meta', type: 'chat' },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', type: 'chat' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'Alibaba', type: 'chat' },
  { id: 'qwen/qwen3-vl-235b-a22b-instruct', name: 'Qwen3 VL 235B [视觉]', provider: 'Alibaba', type: 'vision' },
]

/**
 * 发送消息到 OpenRouter API
 * @param {Array} messages - 消息历史
 * @param {string} model - 模型 ID
 * @param {string} apiKey - OpenRouter API Key
 * @returns {Promise<string>} AI 回复内容
 */
export async function sendMessage(messages, model, apiKey) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Real AI'
    },
    body: JSON.stringify({
      model: model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `API 请求失败: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || '无响应内容'
}

/**
 * 流式发送消息到 OpenRouter API
 * @param {Array} messages - 消息历史
 * @param {string} model - 模型 ID
 * @param {string} apiKey - OpenRouter API Key
 * @param {Function} onChunk - 接收每个文本块的回调
 * @param {Object} options - 可选参数
 * @param {boolean} options.webSearch - 是否启用联网搜索
 * @param {Function} options.onImage - 接收图片数据的回调
 * @returns {Promise<{content: string, images: Array}>} 完整的 AI 回复内容和图片
 */
export async function sendMessageStream(messages, model, apiKey, onChunk, options = {}) {
  const { webSearch = false, onImage } = options

  const requestBody = {
    model: model,
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    stream: true
  }

  // 启用联网搜索
  if (webSearch) {
    requestBody.plugins = [
      { id: 'web' }
    ]
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Real AI'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `API 请求失败: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  let images = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

    for (const line of lines) {
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices[0]?.delta

        // 处理文本内容
        const content = delta?.content || ''
        if (content) {
          fullContent += content
          onChunk(content)
        }

        // 处理图片内容
        const deltaImages = delta?.images
        if (deltaImages && Array.isArray(deltaImages)) {
          for (const img of deltaImages) {
            const imageUrl = img?.image_url?.url || img?.url || img
            if (imageUrl && typeof imageUrl === 'string') {
              images.push(imageUrl)
              if (onImage) {
                onImage(imageUrl)
              }
            }
          }
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  }

  return { content: fullContent, images }
}
