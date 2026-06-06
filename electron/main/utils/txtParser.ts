import { readFileSync } from 'fs'
import type { Chapter, PageContent, TextCleanResult, BookSmartInfo } from '../types'
import { readTextFile, detectEncoding } from './file'

const CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千零\d]+[章节卷部][\s、．。：:].*$/m,
  /^Chapter\s+\d+.*$/im,
  /^\d+\s*[.、]\s*.+$/m,
  /^[【\[].*[】\]]\s*$/m,
  /^楔子|^序章|^序言|^前言|^后记|^番外|^引子|^尾声/m,
  /^[正外前后序末]篇.*$/m,
  /^第[一二三四五六七八九十百千零\d]+卷.*$/m,
  /^BOOK\s*\d+.*$/im,
  /^VOLUME\s*\d+.*$/im,
  /^Act\s*\d+.*$/im,
  /^Scene\s*\d+.*$/im,
  /^Episode\s*\d+.*$/im,
  /^\([一二三四五六七八九十\d]+\).*$/m,
  /^[一二三四五六七八九十百千]+、.*$/m
]

const GARBLED_PATTERNS = [
  { pattern: /[^\u4e00-\u9fa5\u0000-\u007f\u3000-\u303f\uff00-\uffef\r\n\t]/g, replace: '' },
  { pattern: /\u0000+/g, replace: '' },
  { pattern: /\uFFFD+/g, replace: '' },
  { pattern: /[�]+/g, replace: '' },
  { pattern: /\r{2,}/g, replace: '\r' },
  { pattern: / {4,}/g, replace: '  ' }
]

const AUTHOR_PATTERNS = [
  /作者[：:]\s*([^\n\r]+)/i,
  /作\s*者[：:]\s*([^\n\r]+)/i,
  /[【\[]作者[】\]]\s*([^\n\r]+)/i,
  /Author[：:]\s*([^\n\r]+)/i,
  /著[：:]\s*([^\n\r]+)/i,
  /^([^\n\r]{2,20})\s*著$/im
]

const TAG_KEYWORDS = [
  '玄幻', '奇幻', '仙侠', '武侠', '都市', '言情', '历史', '军事',
  '科幻', '悬疑', '恐怖', '灵异', '游戏', '竞技', '同人', '耽美',
  '百合', '穿越', '重生', '系统', '快穿', '无限流', '种田', '基建',
  '爽文', '甜文', '虐文', '治愈', '搞笑', '轻松', '正剧', '悲剧',
  '总裁', '豪门', '校园', '职场', '娱乐圈', '网游', '末世', '星际',
  '修真', '修仙', '魔法', '斗气', '洪荒', '封神', '西游', '三国'
]

export interface TxtParseResult {
  content: string
  encoding: string
  chapters: Chapter[]
  totalCharacters: number
  smartInfo?: BookSmartInfo
}

export interface TxtPaginationResult {
  pages: PageContent[]
  totalPages: number
}

export function cleanText(content: string, options: {
  removeEmptyLines?: boolean
  fixGarbled?: boolean
  removeDuplicates?: boolean
} = {}): TextCleanResult {
  const { removeEmptyLines = true, fixGarbled = true, removeDuplicates = true } = options
  let cleaned = content
  let emptyLinesRemoved = 0
  let garbledFixed = 0
  const originalLength = content.length

  if (fixGarbled) {
    for (const { pattern, replace } of GARBLED_PATTERNS) {
      const matches = cleaned.match(pattern)
      if (matches) {
        garbledFixed += matches.length
        cleaned = cleaned.replace(pattern, replace)
      }
    }
  }

  if (removeEmptyLines) {
    const lines = cleaned.split('\n')
    const nonEmptyLines: string[] = []
    let consecutiveEmpty = 0
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === '') {
        consecutiveEmpty++
        if (consecutiveEmpty <= 1) {
          nonEmptyLines.push(line)
        } else {
          emptyLinesRemoved++
        }
      } else {
        consecutiveEmpty = 0
        nonEmptyLines.push(line)
      }
    }
    cleaned = nonEmptyLines.join('\n')
  }

  const duplicateChapters: number[] = []
  if (removeDuplicates) {
    const chapters = extractChapters(cleaned)
    const seenTitles = new Map<string, number>()
    
    for (let i = 0; i < chapters.length; i++) {
      const title = chapters[i].title
      if (seenTitles.has(title)) {
        duplicateChapters.push(i)
      } else {
        seenTitles.set(title, i)
      }
    }

    if (duplicateChapters.length > 0) {
      for (let i = duplicateChapters.length - 1; i >= 0; i--) {
        const idx = duplicateChapters[i]
        const chapter = chapters[idx]
        const nextChapter = chapters[idx + 1]
        if (nextChapter) {
          cleaned = cleaned.slice(0, chapter.startPosition) + cleaned.slice(nextChapter.startPosition)
        }
      }
    }
  }

  return {
    originalLength,
    cleanedLength: cleaned.length,
    emptyLinesRemoved,
    duplicateChapters,
    garbledFixed,
    content: cleaned
  }
}

export function smartExtractChapters(content: string): Chapter[] {
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

    if (line.length > 0 && line.length < 150) {
      let isChapter = false
      let matchedPattern: RegExp | null = null

      for (const pattern of CHAPTER_PATTERNS) {
        if (pattern.test(line)) {
          isChapter = true
          matchedPattern = pattern
          break
        }
      }

      if (!isChapter) {
        const prevLine = i > 0 ? lines[i - 1].trim() : ''
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : ''
        const isIsolated = prevLine === '' && nextLine === ''
        const hasChapterKeyword = /(章|节|卷|部|回|话|篇)/.test(line)
        
        if (isIsolated && hasChapterKeyword && line.length < 50) {
          isChapter = true
        }
      }

      if (isChapter) {
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
      }
    }

    currentPosition += lines[i].length + 1
  }

  if (chapters.length > 0) {
    chapters[chapters.length - 1].endPosition = content.length
  }

  return chapters
}

export function extractBookSmartInfo(content: string, title: string): BookSmartInfo {
  let author = '未知'
  const tags: string[] = []
  const first3000Chars = content.slice(0, 3000)
  const last3000Chars = content.slice(-3000)
  const fullSample = first3000Chars + '\n' + last3000Chars

  for (const pattern of AUTHOR_PATTERNS) {
    const match = fullSample.match(pattern)
    if (match && match[1]) {
      author = match[1].trim()
      if (author.length > 30) {
        author = author.slice(0, 30)
      }
      break
    }
  }

  for (const keyword of TAG_KEYWORDS) {
    const regex = new RegExp(keyword, 'gi')
    if (regex.test(fullSample)) {
      tags.push(keyword)
      if (tags.length >= 5) break
    }
  }

  const chapters = extractChapters(content)
  const chineseChars = content.match(/[\u4e00-\u9fa5]/g) || []
  const englishChars = content.match(/[a-zA-Z]/g) || []
  const detectedLanguage = chineseChars.length > englishChars.length ? 'zh' : 'en'

  const summary = generateSummary(content, chapters, title)

  return {
    summary,
    author,
    tags,
    estimatedChapters: chapters.length,
    wordCount: content.length,
    detectedLanguage
  }
}

function generateSummary(content: string, chapters: Chapter[], title: string): string {
  const firstChapterContent = chapters.length > 1
    ? content.slice(chapters[1].startPosition, chapters[1].startPosition + 1000)
    : content.slice(0, 1000)

  let summary = firstChapterContent
    .replace(/\s+/g, ' ')
    .replace(/[，。！？、；：]/g, '，')
    .split('，')
    .slice(0, 5)
    .join('，')
    .trim()

  if (summary.length > 200) {
    summary = summary.slice(0, 200) + '...'
  }

  if (summary.length < 50) {
    summary = `《${title}》共${chapters.length}章，${(content.length / 10000).toFixed(1)}万字。`
  }

  return summary
}

export function parseTxtFile(
  filePath: string,
  encoding?: string,
  options: {
    smartDetection?: boolean
    autoClean?: boolean
  } = {}
): TxtParseResult {
  const { smartDetection = true, autoClean = true } = options
  const buffer = readFileSync(filePath)

  if (!encoding) {
    encoding = detectEncoding(buffer)
  }

  let content = readTextFile(filePath, encoding)
  
  if (autoClean) {
    const cleanResult = cleanText(content, {
      removeEmptyLines: true,
      fixGarbled: true,
      removeDuplicates: true
    })
    content = cleanResult.content
  }

  const chapters = smartDetection ? smartExtractChapters(content) : extractChapters(content)
  
  const result: TxtParseResult = {
    content,
    encoding,
    chapters,
    totalCharacters: content.length
  }

  if (smartDetection) {
    const fileName = filePath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || '未知书籍'
    result.smartInfo = extractBookSmartInfo(content, fileName)
  }

  return result
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
