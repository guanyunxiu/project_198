import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { Chapter, PageContent } from '../types'

export interface EpubParseResult {
  title: string
  author: string
  coverPath: string | null
  chapters: Chapter[]
  content: string
  totalCharacters: number
}

export interface EpubPaginationResult {
  pages: PageContent[]
  totalPages: number
}

export function parseEpubFile(filePath: string): EpubParseResult {
  const cacheDir = join(app.getPath('userData'), 'cache', 'epub')
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

  const result = extractEpubContent(filePath)

  try {
    writeFileSync(cachePath, JSON.stringify(result), 'utf-8')
  } catch {
    // Ignore cache write errors
  }

  return result
}

function extractEpubContent(filePath: string): EpubParseResult {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  const chapters: Chapter[] = []
  let fullText = ''
  let currentPosition = 0
  let chapterIndex = 0

  chapters.push({
    index: 0,
    title: '引言',
    startPosition: 0,
    endPosition: 0,
    startPage: 0
  })

  for (const line of lines) {
    const trimmed = line.trim()

    if (isChapterHeading(trimmed)) {
      if (chapters.length > 0) {
        chapters[chapters.length - 1].endPosition = currentPosition
      }

      chapterIndex++
      chapters.push({
        index: chapterIndex,
        title: trimmed,
        startPosition: currentPosition,
        endPosition: 0,
        startPage: 0
      })
    }

    fullText += line + '\n'
    currentPosition += line.length + 1
  }

  if (chapters.length > 0) {
    chapters[chapters.length - 1].endPosition = fullText.length
  }

  return {
    title: extractTitle(filePath, content),
    author: extractAuthor(content) || '未知',
    coverPath: null,
    chapters,
    content: fullText,
    totalCharacters: fullText.length
  }
}

function isChapterHeading(line: string): boolean {
  if (line.length === 0 || line.length > 100) return false

  const patterns = [
    /^第[一二三四五六七八九十百千零\d]+[章节卷部][\s、．。：:].*$/i,
    /^Chapter\s+\d+.*$/i,
    /^[一二三四五六七八九十百千]+、.*/,
    /^\d+\s*[.、]\s*.+$/
  ]

  return patterns.some(p => p.test(line))
}

function extractTitle(filePath: string, content: string): string {
  const nameMatch = content.match(/<dc:title>([^<]+)<\/dc:title>/i)
  if (nameMatch && nameMatch[1]) {
    return nameMatch[1].trim()
  }

  const fileName = filePath.split(/[/\\]/).pop() || '未知'
  return fileName.replace(/\.[^/.]+$/, '')
}

function extractAuthor(content: string): string | null {
  const authorMatch = content.match(/<dc:creator>([^<]+)<\/dc:creator>/i)
  if (authorMatch && authorMatch[1]) {
    return authorMatch[1].trim()
  }
  return null
}

export function paginateEpubContent(
  content: string,
  chapters: Chapter[],
  pageChars: number = 800
): EpubPaginationResult {
  const pages: PageContent[] = []
  let currentPage = 1

  for (const chapter of chapters) {
    chapter.startPage = currentPage

    const chapterContent = content.slice(chapter.startPosition, chapter.endPosition)
    const result = paginateChapter(chapterContent, chapter, currentPage, pageChars)

    pages.push(...result.pages)
    currentPage += result.totalPages
  }

  return {
    pages,
    totalPages: pages.length
  }
}

function paginateChapter(
  content: string,
  chapter: Chapter,
  startPage: number,
  pageChars: number
): EpubPaginationResult {
  const pages: PageContent[] = []
  let currentPos = 0
  let pageNum = startPage

  while (currentPos < content.length) {
    let endPos = currentPos + pageChars

    if (endPos < content.length) {
      const breakPoints = [
        content.lastIndexOf('\n\n', endPos),
        content.lastIndexOf('\n', endPos),
        content.lastIndexOf('。', endPos),
        content.lastIndexOf('！', endPos),
        content.lastIndexOf('？', endPos),
        content.lastIndexOf('. ', endPos)
      ]

      const validBreakPoint = breakPoints.find(p => p > currentPos + pageChars * 0.5)
      if (validBreakPoint !== undefined) {
        endPos = validBreakPoint + (content.charAt(validBreakPoint) === '\n' ? 2 : 1)
      }
    } else {
      endPos = content.length
    }

    const pageContent = content.slice(currentPos, endPos).trim()

    if (pageContent.length > 0) {
      pages.push({
        page: pageNum,
        content: pageContent,
        chapterTitle: chapter.title,
        chapterIndex: chapter.index,
        startPosition: chapter.startPosition + currentPos,
        endPosition: chapter.startPosition + endPos
      })
      pageNum++
    }

    currentPos = endPos
  }

  return {
    pages,
    totalPages: pages.length
  }
}

export function getEpubPageContent(
  content: string,
  chapters: Chapter[],
  page: number,
  pageChars: number = 800
): PageContent | null {
  const { pages } = paginateEpubContent(content, chapters, pageChars)
  return pages.find(p => p.page === page) || null
}
