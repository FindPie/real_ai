import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'

/**
 * 将消息内容转换为 Word 段落
 * @param {string} content - 消息内容
 * @param {boolean} isUser - 是否为用户消息
 * @returns {Paragraph[]} Word 段落数组
 */
function contentToParagraphs(content, isUser) {
  const paragraphs = []
  const lines = content.split('\n')

  for (const line of lines) {
    // 处理标题
    if (line.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        text: line.slice(4),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 }
      }))
    } else if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        text: line.slice(3),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 }
      }))
    } else if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        text: line.slice(2),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 140 }
      }))
    }
    // 处理代码块（简化处理）
    else if (line.startsWith('```')) {
      // 跳过代码块标记
    }
    // 处理列表
    else if (line.match(/^[-*]\s/)) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({
            text: '• ' + line.slice(2),
            size: 22
          })
        ],
        spacing: { before: 60, after: 60 },
        indent: { left: 360 }
      }))
    }
    // 处理有序列表
    else if (line.match(/^\d+\.\s/)) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({
            text: line,
            size: 22
          })
        ],
        spacing: { before: 60, after: 60 },
        indent: { left: 360 }
      }))
    }
    // 普通段落
    else if (line.trim()) {
      // 处理行内代码和加粗
      const runs = parseInlineFormatting(line)
      paragraphs.push(new Paragraph({
        children: runs,
        spacing: { before: 100, after: 100 }
      }))
    }
    // 空行
    else {
      paragraphs.push(new Paragraph({ text: '' }))
    }
  }

  return paragraphs
}

/**
 * 解析行内格式（加粗、代码等）
 * @param {string} text - 文本内容
 * @returns {TextRun[]} TextRun 数组
 */
function parseInlineFormatting(text) {
  const runs = []
  // 简化处理：移除 markdown 标记
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, '$1') // 移除加粗
    .replace(/`(.*?)`/g, '$1') // 移除行内代码

  runs.push(new TextRun({
    text: cleanText,
    size: 22
  }))

  return runs
}

/**
 * 导出对话为 Word 文档
 * @param {Array} messages - 消息数组
 * @param {string} modelName - 模型名称
 */
export async function exportToWord(messages, modelName = 'AI') {
  const children = []

  // 标题
  children.push(new Paragraph({
    children: [
      new TextRun({
        text: 'Real AI 对话记录',
        bold: true,
        size: 36
      })
    ],
    heading: HeadingLevel.TITLE,
    spacing: { after: 200 }
  }))

  // 元信息
  children.push(new Paragraph({
    children: [
      new TextRun({
        text: `模型: ${modelName}`,
        size: 20,
        color: '666666'
      }),
      new TextRun({
        text: `    导出时间: ${new Date().toLocaleString('zh-CN')}`,
        size: 20,
        color: '666666'
      })
    ],
    spacing: { after: 400 }
  }))

  // 分隔线
  children.push(new Paragraph({
    children: [
      new TextRun({
        text: '─'.repeat(50),
        color: 'CCCCCC'
      })
    ],
    spacing: { after: 300 }
  }))

  // 对话内容
  for (const msg of messages) {
    const isUser = msg.role === 'user'
    const roleLabel = isUser ? '用户' : 'AI'

    // 角色标签
    children.push(new Paragraph({
      children: [
        new TextRun({
          text: `【${roleLabel}】`,
          bold: true,
          size: 24,
          color: isUser ? '007BFF' : '28A745'
        })
      ],
      spacing: { before: 200, after: 100 }
    }))

    // 消息内容
    const contentParagraphs = contentToParagraphs(msg.content, isUser)
    children.push(...contentParagraphs)

    // 消息分隔
    children.push(new Paragraph({
      text: '',
      spacing: { after: 200 }
    }))
  }

  // 创建文档
  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  })

  // 生成并下载
  const blob = await Packer.toBlob(doc)
  const filename = `Real_AI_对话_${new Date().toISOString().slice(0, 10)}.docx`
  saveAs(blob, filename)
}
