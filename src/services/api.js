// OpenRouter API 服务
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

// 模型能力类型
// type: 'chat' - 纯文本对话
// type: 'vision' - 支持图片理解
// type: 'image-gen' - 支持图片生成
// type: 'reasoning' - 支持深度推理（会自动启用 reasoning 参数，模型会先进行思考再回答，适合数学、逻辑、编程等复杂问题）

// 可选模型列表
export const AVAILABLE_MODELS = [
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro（贵）', provider: 'Google', type: 'vision' },
  { id: 'google/gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image（贵）', provider: 'Google', type: 'image-gen' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google', type: 'vision' },
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'Google', type: 'vision' },
  { id: 'openai/gpt-5.2', name: 'GPT-5.2（贵）', provider: 'OpenAI', type: 'chat' },
  { id: 'openai/gpt-5.2-chat', name: 'GPT-5.2 Chat（贵）', provider: 'OpenAI', type: 'vision' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', type: 'vision' },
  { id: 'openai/gpt-5-image-mini', name: 'GPT-5 Image Mini', provider: 'OpenAI', type: 'image-gen' },
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5（贵）', provider: 'Anthropic', type: 'vision' },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'Anthropic', type: 'vision' },
  { id: 'qwen/qwen3-235b-a22b-thinking-2507', name: 'Qwen3 235B Thinking', provider: 'Alibaba', type: 'chat' },
  { id: 'qwen/qwen3-vl-235b-a22b-instruct', name: 'Qwen3 VL 235B [视觉]', provider: 'Alibaba', type: 'vision' },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', type: 'chat' },
  { id: 'x-ai/grok-4.1-fast', name: 'Grok 4.1 Fast', provider: 'xAI', type: 'reasoning' },
  { id: 'z-ai/glm-4.7', name: 'GLM-4.7', provider: 'Zhipu', type: 'reasoning' },
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

  // 文生图模型需要添加 modalities 参数
  const modelInfo = AVAILABLE_MODELS.find(m => m.id === model)
  if (modelInfo?.type === 'image-gen') {
    requestBody.modalities = ['image', 'text']
  }

  // 推理模型需要添加 reasoning 参数
  if (modelInfo?.type === 'reasoning') {
    requestBody.reasoning = { enabled: true }
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
  let imageBuffers = {} // 用于存储流式传输的图片数据 { index: base64String }
  let buffer = '' // 用于处理跨 chunk 的数据

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // 保留最后一个可能不完整的行
    buffer = lines.pop() || ''
    const dataLines = lines.filter(line => line.startsWith('data: '))

    for (const line of dataLines) {
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices[0]?.delta
        const choice = parsed.choices[0]

        // 处理文本内容
        const content = delta?.content
        if (content) {
          // content 可能是字符串或数组
          if (typeof content === 'string') {
            fullContent += content
            onChunk(content)
          } else if (Array.isArray(content)) {
            // 处理多模态内容数组
            for (const part of content) {
              if (part.type === 'text' && part.text) {
                fullContent += part.text
                onChunk(part.text)
              } else if (part.type === 'image_url' && part.image_url?.url) {
                images.push(part.image_url.url)
                if (onImage) {
                  onImage(part.image_url.url)
                }
              } else if (part.type === 'image' && part.source?.data) {
                // 处理 base64 图片格式
                const mediaType = part.source.media_type || 'image/png'
                const base64Url = `data:${mediaType};base64,${part.source.data}`
                images.push(base64Url)
                if (onImage) {
                  onImage(base64Url)
                }
              }
            }
          }
        }

        // 处理 delta.images 格式 (流式图片)
        const deltaImages = delta?.images
        if (deltaImages && Array.isArray(deltaImages)) {
          for (const img of deltaImages) {
            const imgIndex = img?.index ?? 0
            let imageUrl = null

            // 处理 { type: "image_url", image_url: { url: "..." } } 格式
            if (img?.type === 'image_url' && img?.image_url?.url) {
              const url = img.image_url.url
              // 累积流式 base64 数据
              if (!imageBuffers[imgIndex]) {
                imageBuffers[imgIndex] = ''
              }
              // 如果是完整的 data URL，追加 base64 部分
              if (url.startsWith('data:')) {
                const base64Part = url.split(',')[1] || ''
                imageBuffers[imgIndex] += base64Part
              } else {
                imageBuffers[imgIndex] += url
              }
            }
            // 处理其他格式
            else {
              imageUrl = img?.image_url?.url || img?.url || img?.b64_json || img
              if (img?.b64_json && typeof imageUrl === 'string' && !imageUrl.startsWith('data:')) {
                imageUrl = `data:image/png;base64,${img.b64_json}`
              }
              if (imageUrl && typeof imageUrl === 'string' && !images.includes(imageUrl)) {
                images.push(imageUrl)
                if (onImage) {
                  onImage(imageUrl)
                }
              }
            }
          }
        }

        // 处理 OpenAI 图片生成格式 (data 数组)
        const dataArray = parsed.data
        if (dataArray && Array.isArray(dataArray)) {
          for (const item of dataArray) {
            let imageUrl = item?.url || item?.b64_json
            if (item?.b64_json && !item?.url) {
              imageUrl = `data:image/png;base64,${item.b64_json}`
            }
            if (imageUrl && typeof imageUrl === 'string' && !images.includes(imageUrl)) {
              images.push(imageUrl)
              if (onImage) {
                onImage(imageUrl)
              }
            }
          }
        }

        // 处理完整消息中的图片 (非流式或最终消息)
        const message = choice?.message
        if (message?.content && Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === 'image_url' && part.image_url?.url) {
              if (!images.includes(part.image_url.url)) {
                images.push(part.image_url.url)
                if (onImage) {
                  onImage(part.image_url.url)
                }
              }
            } else if (part.type === 'image' && part.source?.data) {
              const mediaType = part.source.media_type || 'image/png'
              const base64Url = `data:${mediaType};base64,${part.source.data}`
              if (!images.includes(base64Url)) {
                images.push(base64Url)
                if (onImage) {
                  onImage(base64Url)
                }
              }
            }
          }
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  }

  // 处理累积的流式图片数据
  for (const [, base64Data] of Object.entries(imageBuffers)) {
    if (base64Data) {
      const imageUrl = `data:image/png;base64,${base64Data}`
      if (!images.includes(imageUrl)) {
        images.push(imageUrl)
        if (onImage) {
          onImage(imageUrl)
        }
      }
    }
  }

  return { content: fullContent, images }
}
