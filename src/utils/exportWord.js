import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'
import { saveAs } from 'file-saver'

/**
 * 检测 Markdown 表格并转换为 Word Table
 * @param {string[]} lines - 文本行数组
 * @param {number} startIndex - 起始行索引
 * @returns {{ table: Table|null, endIndex: number }} 表格对象和结束索引
 */
function parseMarkdownTable(lines, startIndex) {
  const tableLines = []
  let i = startIndex

  // 收集表格行（直到遇到非表格行）
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    tableLines.push(lines[i])
    i++
  }

  if (tableLines.length < 2) {
    return { table: null, endIndex: startIndex }
  }

  // 解析表格
  const rows = []

  for (let rowIndex = 0; rowIndex < tableLines.length; rowIndex++) {
    const line = tableLines[rowIndex].trim()

    // 检测分隔符行（如 |---|---|）
    if (line.match(/^\|[\s:-]+\|/)) {
      continue
    }

    // 解析单元格
    const cells = line
      .split('|')
      .filter(cell => cell.trim())
      .map(cell => cell.trim())

    if (cells.length === 0) continue

    // 创建表格行
    const isHeader = rowIndex === 0 && tableLines[1] && tableLines[1].match(/^\|[\s:-]+\|/)

    const tableCells = cells.map(cellText => {
      return new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: cellText,
                bold: isHeader,
                size: 20
              })
            ]
          })
        ],
        shading: isHeader ? {
          fill: 'F5F5F5'
        } : undefined,
        margins: {
          top: 100,
          bottom: 100,
          left: 100,
          right: 100
        }
      })
    })

    rows.push(new TableRow({
      children: tableCells
    }))
  }

  if (rows.length === 0) {
    return { table: null, endIndex: startIndex }
  }

  // 创建表格
  const table = new Table({
    rows: rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' }
    }
  })

  return { table, endIndex: i }
}

/**
 * 将消息内容转换为 Word 段落
 * @param {string} content - 消息内容
 * @param {boolean} isUser - 是否为用户消息
 * @returns {Array} Word 段落和表格数组
 */
function contentToParagraphs(content, isUser) {
  const paragraphs = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 检测表格
    if (line.trim().startsWith('|')) {
      const { table, endIndex } = parseMarkdownTable(lines, i)
      if (table) {
        paragraphs.push(table)
        i = endIndex - 1 // -1 因为 for 循环会 i++
        continue
      }
    }

    // 原有的其他格式处理
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
 * 将 base64 图片转换为 ArrayBuffer
 * @param {string} base64 - base64 图片数据
 * @returns {Uint8Array} 图片数据
 */
function base64ToUint8Array(base64) {
  // 移除 data:image/xxx;base64, 前缀
  const base64Data = base64.split(',')[1]
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * 创建图片段落
 * @param {string} imageBase64 - base64 图片数据
 * @param {number} index - 图片索引
 * @returns {Paragraph|null} 包含图片的段落
 */
function createImageParagraph(imageBase64, index) {
  try {
    const imageData = base64ToUint8Array(imageBase64)

    return new Paragraph({
      children: [
        new ImageRun({
          data: imageData,
          transformation: {
            width: 300,
            height: 300
          },
          type: 'png'
        })
      ],
      spacing: { before: 100, after: 100 }
    })
  } catch (err) {
    console.error('导出图片失败:', err)
    // 如果图片处理失败，返回提示文字
    return new Paragraph({
      children: [
        new TextRun({
          text: `[图片 ${index + 1}]`,
          italics: true,
          color: '999999',
          size: 20
        })
      ],
      spacing: { before: 100, after: 100 }
    })
  }
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

    // 处理图片
    if (msg.images && msg.images.length > 0) {
      for (let i = 0; i < msg.images.length; i++) {
        const imgParagraph = createImageParagraph(msg.images[i], i)
        if (imgParagraph) {
          children.push(imgParagraph)
        }
      }
    }

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
  // 确保使用正确的 MIME 类型
  const wordBlob = new Blob([blob], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })
  const filename = `Real_AI_对话_${new Date().toISOString().slice(0, 10)}.docx`
  saveAs(wordBlob, filename)
}
