// 文件解析工具
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

// 设置 worker 路径
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * 解析 PDF 文件
 * @param {File} file - PDF 文件
 * @returns {Promise<string>} 提取的文本内容
 */
export async function parsePDF(file) {
  const arrayBuffer = await file.arrayBuffer()

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer
  }).promise

  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ')
    fullText += pageText + '\n\n'
  }

  return fullText.trim()
}

/**
 * 解析 Word 文件 (.docx)
 * @param {File} file - Word 文件
 * @returns {Promise<string>} 提取的文本内容
 */
export async function parseWord(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value.trim()
}

/**
 * 解析文本文件
 * @param {File} file - 文本文件
 * @returns {Promise<string>} 文件内容
 */
export async function parseText(file) {
  return await file.text()
}

/**
 * 根据文件类型解析文件
 * @param {File} file - 要解析的文件
 * @returns {Promise<{content: string, type: string, name: string}>} 解析结果
 */
export async function parseFile(file) {
  const fileName = file.name
  const fileType = file.type
  const extension = fileName.split('.').pop()?.toLowerCase()

  let content = ''
  let type = ''

  try {
    if (fileType === 'application/pdf' || extension === 'pdf') {
      content = await parsePDF(file)
      type = 'PDF'
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      extension === 'docx'
    ) {
      content = await parseWord(file)
      type = 'Word'
    } else if (
      fileType === 'text/plain' ||
      extension === 'txt' ||
      extension === 'md' ||
      extension === 'json' ||
      extension === 'js' ||
      extension === 'ts' ||
      extension === 'css' ||
      extension === 'html'
    ) {
      content = await parseText(file)
      type = '文本'
    } else {
      throw new Error(`不支持的文件格式: ${extension || fileType}`)
    }

    return {
      content,
      type,
      name: fileName
    }
  } catch (error) {
    throw new Error(`解析文件失败: ${error.message}`)
  }
}

/**
 * 支持的文件类型
 */
export const SUPPORTED_FILE_TYPES = '.pdf,.docx,.txt,.md,.json,.js,.ts,.css,.html'

/**
 * 获取文件大小的可读格式
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 可读的文件大小
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
