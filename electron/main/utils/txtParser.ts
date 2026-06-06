import { readFileSync } from 'fs'
import type { Chapter, PageContent } from '../types'
import { readTextFile, detectEncoding } from './file'

const CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千零\d]+[章节卷部][\s、．。：:].*$/m,
  /^Chapter\s+\d+.*$/im,
  /^\d+\s*[.、]\s*.+$/m,
  /^[【\[].*[】\]]\s*$/m,
  /^楔子|^序章|^序言|^前言|^后记|^番外|^引子|^尾声/m
]

export interface TxtParseResult {
  content: string
  encoding: string
  chapters: Chapter[]
  totalCharacters: number
}

export interface TxtPaginationResult {
  pages: PageContent[]
  totalPages: number
}

export function parseTxtFile(
  filePath: string,
  encoding?: string
): TxtParseResult {
  const buffer = readFileSync(filePath)

  if (!encoding) {
    encoding = detectEncoding(buffer)
  }

  const content = readTextFile(filePath, encoding)
  const chapters = extractChapters(content)

  return {
    content,
    encoding,
    chapters,
    totalCharacters: content.length
  }
}

export function extractChapters(content: string): Chapter[] {
  const chapters: Chapter[] = []
  const lines = content.split('\n')
  let currentPosition = 0
  let chapterIndex = 0

  const introChapter: Chapter = {
    index: 0,
    title: '引言',
    startPosition: 0,
    endPosition: 0,
    startPage: 0
  }
  chapters.push(introChapter)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.length > 0 && line.length < 100) {
      for (const pattern of CHAPTER_PATTERNS) {
        if (pattern.test(line)) {
          if (chapters.length > 0) {
            chapters[chapters.length - 1].endPosition = currentPosition
          }

          chapterIndex++
          chapters.push({
            index: chapterIndex,
            title: line.replace(/[\s\r\n]+$/, ''),
            startPosition: currentPosition,
            endPosition: 0,
            startPage: 0
          })
          break
        }
      }
    }

    currentPosition += lines[i].length + 1
  }

  if (chapters.length > 0) {
    chapters[chapters.length - 1].endPosition = content.length
  }

  return chapters
}

export function paginateContent(
  content: string,
  chapters: Chapter[],
  pageChars: number = 800
): TxtPaginationResult {
  const pages: PageContent[] = []
  let currentPage = 1
  let currentChapterIndex = 0

  let chapterStartPage = 1
  for (const chapter of chapters) {
    chapter.startPage = chapterStartPage

    const chapterContent = content.slice(chapter.startPosition, chapter.endPosition)
    const chapterPages = paginateChapter(chapterContent, chapter, currentPage, pageChars)

    pages.push(...chapterPages.pages)
    currentPage += chapterPages.totalPages
    chapterStartPage += chapterPages.totalPages
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
): TxtPaginationResult {
  const pages: PageContent[] = []
  let currentPos = 0
  let pageNum = startPage

  while (currentPos < content.length) {
    let endPos = currentPos + pageChars

    if (endPos < content.length) {
      const breakPoints = [
        content.lastIndexOf('\n', endPos),
        content.lastIndexOf('。', endPos),
        content.lastIndexOf('！', endPos),
        content.lastIndexOf('？', endPos),
        content.lastIndexOf('…', endPos),
        content.lastIndexOf('. ', endPos),
        content.lastIndexOf('! ', endPos),
        content.lastIndexOf('? ', endPos)
      ]

      const validBreakPoint = breakPoints.find(p => p > currentPos + pageChars * 0.5)
      if (validBreakPoint !== undefined) {
        endPos = validBreakPoint + 1
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

export function getPageContent(
  content: string,
  chapters: Chapter[],
  page: number,
  pageChars: number = 800
): PageContent | null {
  const { pages } = paginateContent(content, chapters, pageChars)
  return pages.find(p => p.page === page) || null
}

export function getChapterByPosition(
  chapters: Chapter[],
  position: number
): Chapter | null {
  for (const chapter of chapters) {
    if (position >= chapter.startPosition && position < chapter.endPosition) {
      return chapter
    }
  }
  return chapters[chapters.length - 1] || null
}

export function getPageByPosition(
  content: string,
  chapters: Chapter[],
  position: number,
  pageChars: number = 800
): number {
  const { pages } = paginateContent(content, chapters, pageChars)

  for (let i = 0; i < pages.length; i++) {
    if (position >= pages[i].startPosition && position < pages[i].endPosition) {
      return pages[i].page
    }
  }

  return pages.length
}
