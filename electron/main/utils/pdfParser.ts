import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import * as pdfjsLib from 'pdfjs-dist'
import type { Chapter, PageContent } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.min.js')

export interface PdfParseResult {
  title: string
  author: string
  chapters: Chapter[]
  content: string
  totalCharacters: number
  totalPages: number
}

export interface PdfPaginationResult {
  pages: PageContent[]
  totalPages: number
}

export async function parsePdfFile(filePath: string): Promise<PdfParseResult> {
  const cacheDir = join(app.getPath('userData'), 'cache', 'pdf')
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true })
  }

  const cacheKey = Buffer.from(filePath).toString('base64').replace(/[^a-zA-Z0-9]/g, '')
  const cachePath = join(cacheDir, `${cacheKey}.json`)

  if (existsSync(cachePath)) {
    try {
      return JSON.parse(readFileSync(cachePath, 'utf-8'))
    } catch {
      // Fall through to re-parse
    }
  }

  const result = await extractPdfContent(filePath)

  try {
    writeFileSync(cachePath, JSON.stringify(result), 'utf-8')
  } catch {
    // Ignore cache write errors
  }

  return result
}

async function extractPdfContent(filePath: string): Promise<PdfParseResult> {
  const data = new Uint8Array(readFileSync(filePath))
  const pdf = await pdfjsLib.getDocument({ data }).promise

  const numPages = pdf.numPages
  let fullText = ''
  const pageTexts: string[] = []

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    let pageText = ''
    
    let lastY: number | null = null
    for (const item of textContent.items) {
      if ('str' in item) {
        const currentY = item.transform[5]
        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          pageText += '\n'
        }
        pageText += item.str + ' '
        lastY = currentY
      }
    }
    
    pageText = pageText.trim()
    pageTexts.push(pageText)
    fullText += pageText + '\n\n'
  }

  const metadata = await pdf.getMetadata().catch(() => null)
  const info = metadata?.info as any

  const chapters = extractChaptersFromPdf(pageTexts, fullText)

  return {
    title: info?.Title || extractFileName(filePath) || '未知标题',
    author: info?.Author || '未知作者',
    chapters,
    content: fullText,
    totalCharacters: fullText.length,
    totalPages: numPages
  }
}

function extractChaptersFromPdf(pageTexts: string[], fullText: string): Chapter[] {
  const chapters: Chapter[] = []
  const chapterPatterns = [
    /^第[一二三四五六七八九十百千零\d]+[章节卷部篇回][\s、．。：:].*$/m,
    /^Chapter\s+\d+.*$/im,
    /^CH\.?\s*\d+.*$/im,
    /^第\d+章.*$/m,
    /^第\d+节.*$/m,
    /^\d+\s+[A-Z][A-Za-z\s]+$/m
  ]

  let currentPosition = 0
  let chapterIndex = 0

  chapters.push({
    index: 0,
    title: '前言',
    startPosition: 0,
    endPosition: 0,
    startPage: 1
  })

  for (let pageIdx = 0; pageIdx < pageTexts.length; pageIdx++) {
    const pageText = pageTexts[pageIdx]
    const lines = pageText.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed.length > 0 && trimmed.length < 100) {
        for (const pattern of chapterPatterns) {
          if (pattern.test(trimmed)) {
            if (chapters.length > 0) {
              chapters[chapters.length - 1].endPosition = currentPosition
            }

            chapterIndex++
            chapters.push({
              index: chapterIndex,
              title: trimmed,
              startPosition: currentPosition,
              endPosition: 0,
              startPage: pageIdx + 1
            })
            break
          }
        }
      }
      currentPosition += line.length + 1
    }
    currentPosition += 1
  }

  if (chapters.length > 0) {
    chapters[chapters.length - 1].endPosition = fullText.length
  }

  return chapters
}

export function paginatePdfContent(content: string, chapters: Chapter[], pageChars: number = 800): PdfPaginationResult {
  const pages: PageContent[] = []
  
  const chapterContentMap = new Map<number, string>()
  for (const chapter of chapters) {
    const chapterContent = content.slice(chapter.startPosition, chapter.endPosition)
    chapterContentMap.set(chapter.index, chapterContent)
  }

  let currentPage = 1
  for (const chapter of chapters) {
    const chapterContent = chapterContentMap.get(chapter.index) || ''
    const paragraphs = chapterContent.split('\n').filter(p => p.trim().length > 0)
    
    let currentContent = ''
    let currentParagraphs: string[] = []

    for (const paragraph of paragraphs) {
      if (currentContent.length + paragraph.length > pageChars && currentContent.length > 0) {
        pages.push({
          page: currentPage,
          chapterIndex: chapter.index,
          chapterTitle: chapter.title,
          content: currentContent.trim(),
          paragraphs: [...currentParagraphs]
        })
        currentPage++
        currentContent = ''
        currentParagraphs = []
      }
      
      currentContent += paragraph + '\n'
      currentParagraphs.push(paragraph)
    }

    if (currentContent.trim().length > 0) {
      pages.push({
        page: currentPage,
        chapterIndex: chapter.index,
        chapterTitle: chapter.title,
        content: currentContent.trim(),
        paragraphs: [...currentParagraphs]
      })
      currentPage++
    }
  }

  return {
    pages,
    totalPages: pages.length
  }
}

export function getPdfPageContent(pages: PageContent[], pageNumber: number): PageContent | null {
  return pages.find(p => p.page === pageNumber) || null
}

function extractFileName(filePath: string): string {
  const name = filePath.split('/').pop() || filePath.split('\\').pop() || ''
  return name.replace(/\.[^/.]+$/, '')
}
