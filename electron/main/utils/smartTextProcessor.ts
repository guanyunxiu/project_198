import type { Chapter, TextCleanupOptions, SmartChapterOptions, BookMetadata } from '../types'

const GARBLED_PATTERNS = [
  /[亜唖娃阿哀愛挨姶葵逢穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭]/,
  /[\uFFFD\u0080-\u009F]/,
  /[?]{3,}/
]

const AUTHOR_PATTERNS = [
  /(?:作者|著|作|書|撰)[：:]\s*([^\n\r]+)/i,
  /(?:作者|著者|作者：|作者:)\s*([^\n\r，。、；\n]+)/i,
  /^([^\n\r]{2,20})\s*[著|作|編]$/m,
  /(?:by|作者)\s+([A-Za-z\u4e00-\u9fa5]{2,30})/i
]

const TAG_KEYWORDS = {
  玄幻: ['玄幻', '奇幻', '魔法', '斗气', '修真', '修仙', '仙俠', '武俠', '武道'],
  都市: ['都市', '現代', '職場', '商業', '娛樂', '明星', '醫生', '老師'],
  言情: ['言情', '愛情', '戀愛', '婚寵', '總裁', '甜寵', '虐戀', '青春'],
  科幻: ['科幻', '未來', '星際', '太空', '機甲', '末世', '賽博', '蒸汽'],
  歷史: ['歷史', '古代', '穿越', '重生', '明朝', '唐朝', '三國', '抗戰'],
  懸疑: ['懸疑', '推理', '偵探', '恐怖', '靈異', '鬼', '殭屍', '盜墓'],
  遊戲: ['遊戲', '電競', '網遊', '虛擬', '吃雞', '王者', '聯盟'],
  體育: ['體育', '籃球', '足球', '網球', '田徑', '奧運', '競技']
}

const COMMON_GARBLED_CHARS: Record<string, string> = {
  '鈥': '“',
  '樎': '”',
  '鈥檚': '\'s',
  '鈥檙': '’',
  '鈥楾': '‘',
  '鈥旀': '–',
  '鈥斺': '—',
  '鈥橽': '…',
  '锘': '',
  'Ã©': 'é',
  'Ã¨': 'è',
  'Ã ': 'à',
  'Â': ''
}

export function cleanText(content: string, options: TextCleanupOptions): string {
  let cleaned = content

  if (options.fixGarbledText) {
    cleaned = fixGarbledText(cleaned)
  }

  if (options.removeEmptyLines) {
    cleaned = removeEmptyLines(cleaned)
  }

  if (options.removeExtraSpaces) {
    cleaned = removeExtraSpaces(cleaned)
  }

  if (options.normalizePunctuation) {
    cleaned = normalizePunctuation(cleaned)
  }

  return cleaned
}

export function fixGarbledText(content: string): string {
  let fixed = content

  for (const [garbled, correct] of Object.entries(COMMON_GARBLED_CHARS)) {
    fixed = fixed.replace(new RegExp(garbled, 'g'), correct)
  }

  fixed = fixed.replace(/[\uFFFD]/g, '')
  fixed = fixed.replace(/[?]{2,}/g, '?')
  fixed = fixed.replace(/[!]{2,}/g, '!')

  return fixed
}

export function removeEmptyLines(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+$/gm, '')
    .replace(/^\n+|\n+$/g, '')
}

export function removeExtraSpaces(content: string): string {
  return content
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
}

export function normalizePunctuation(content: string): string {
  return content
    .replace(/，/g, '，')
    .replace(/。/g, '。')
    .replace(/！/g, '！')
    .replace(/？/g, '？')
    .replace(/：/g, '：')
    .replace(/；/g, '；')
    .replace(/（/g, '（')
    .replace(/）/g, '）')
    .replace(/【/g, '【')
    .replace(/】/g, '】')
}

export function detectDuplicateChapters(chapters: Chapter[]): number[] {
  const duplicates: number[] = []
  const titleMap = new Map<string, number[]>()

  chapters.forEach((chapter, index) => {
    const normalizedTitle = normalizeTitle(chapter.title)
    if (titleMap.has(normalizedTitle)) {
      titleMap.get(normalizedTitle)!.push(index)
    } else {
      titleMap.set(normalizedTitle, [index])
    }
  })

  titleMap.forEach((indices) => {
    if (indices.length > 1) {
      duplicates.push(...indices.slice(1))
    }
  })

  return duplicates.sort((a, b) => b - a)
}

export function removeDuplicateChapters(content: string, chapters: Chapter[]): { content: string; chapters: Chapter[] } {
  const duplicateIndices = detectDuplicateChapters(chapters)
  
  if (duplicateIndices.length === 0) {
    return { content, chapters }
  }

  let newContent = content
  const newChapters = [...chapters]

  for (const index of duplicateIndices) {
    const chapter = newChapters[index]
    const chapterContent = newContent.slice(chapter.startPosition, chapter.endPosition)
    newContent = newContent.replace(chapterContent, '')
    
    const lengthDiff = chapter.endPosition - chapter.startPosition
    for (let i = index + 1; i < newChapters.length; i++) {
      newChapters[i].startPosition -= lengthDiff
      newChapters[i].endPosition -= lengthDiff
    }
    
    newChapters.splice(index, 1)
  }

  newChapters.forEach((chapter, index) => {
    chapter.index = index
  })

  return { content: newContent, chapters: newChapters }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s\-_【\[\]（）()《》<>""''`]/g, '')
    .replace(/第[一二三四五六七八九十百千零\d]+/g, '第N')
    .replace(/chapter\s*\d+/gi, 'chapterN')
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '')
}

const SMART_CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千零\d]+[章节卷部篇回][\s、．。：:].*$/m,
  /^Chapter\s+\d+.*$/im,
  /^CH\.?\s*\d+.*$/im,
  /^\d+\s*[.、\-)\]】]\s*.+$/m,
  /^[【\[（(]\s*第?[一二三四五六七八九十百千零\d]+\s*[章节卷部篇回]?\s*[】\]）)].*$/m,
  /^楔子|^序章|^序言|^前言|^後記|^番外|^引子|^尾聲|^附錄|^完結|^結局/m,
  /^(?:上|下|前|後|正|續)篇.*$/m,
  /^[一二三四五六七八九十]+[、.\s].*$/m,
  /^VOL\.?\s*\d+.*$/im,
  /^BOOK\s+\d+.*$/im,
  /^ACT\s+\d+.*$/im,
  /^SCENE\s+\d+.*$/im
]

const SENTENCE_END_PATTERNS = [
  /[。！？!?…]/g,
  /[.?!]\s+/g,
  /\n{2,}/g
]

export function smartExtractChapters(
  content: string,
  options: SmartChapterOptions
): Chapter[] {
  const chapters: Chapter[] = []
  let chapterIndex = 0

  const introContent = findIntroContent(content)
  if (introContent.length > 0) {
    chapters.push({
      index: 0,
      title: '引言',
      startPosition: 0,
      endPosition: introContent.length,
      startPage: 0,
      wordCount: introContent.length
    })
    chapterIndex = 1
  }

  const matches = findAllChapterMatches(content)
  
  let lastEndPos = chapters.length > 0 ? chapters[0].endPosition : 0
  
  matches.forEach((match) => {
    if (match.position < lastEndPos) return
    
    if (chapters.length > 0) {
      chapters[chapters.length - 1].endPosition = match.position
      chapters[chapters.length - 1].wordCount = 
        chapters[chapters.length - 1].endPosition - 
        chapters[chapters.length - 1].startPosition
    }

    const title = cleanChapterTitle(match.title)
    if (title.length === 0) return

    chapters.push({
      index: chapterIndex++,
      title,
      startPosition: match.position,
      endPosition: content.length,
      startPage: 0,
      wordCount: 0
    })

    lastEndPos = match.position
  })

  if (chapters.length > 0) {
    chapters[chapters.length - 1].endPosition = content.length
    chapters[chapters.length - 1].wordCount = 
      chapters[chapters.length - 1].endPosition - 
      chapters[chapters.length - 1].startPosition
  }

  if (options.mergeShortChapters) {
    return mergeShortChapters(chapters, options.minChapterLength || 500)
  }

  return chapters
}

function findIntroContent(content: string): string {
  const firstMatch = findFirstChapterMatch(content)
  if (firstMatch === -1) return ''
  
  const intro = content.slice(0, firstMatch).trim()
  return intro.length < 5000 ? intro : ''
}

function findFirstChapterMatch(content: string): number {
  let earliestPos = Infinity
  
  for (const pattern of SMART_CHAPTER_PATTERNS) {
    const match = content.match(pattern)
    if (match && match.index !== undefined && match.index < earliestPos) {
      earliestPos = match.index
    }
  }
  
  return earliestPos === Infinity ? -1 : earliestPos
}

function findAllChapterMatches(content: string): Array<{ title: string; position: number }> {
  const matches: Array<{ title: string; position: number }> = []
  const foundPositions = new Set<number>()

  for (const pattern of SMART_CHAPTER_PATTERNS) {
    const regex = new RegExp(pattern.source, 'gm')
    let match
    
    while ((match = regex.exec(content)) !== null) {
      const pos = match.index
      const title = match[0].trim()
      
      if (!foundPositions.has(pos) && isValidChapterTitle(title, content, pos)) {
        foundPositions.add(pos)
        matches.push({ title, position: pos })
      }
    }
  }

  return matches.sort((a, b) => a.position - b.position)
}

function isValidChapterTitle(title: string, content: string, position: number): boolean {
  if (title.length > 100 || title.length < 2) return false
  
  if (position > 0) {
    const prevChar = content[position - 1]
    if (prevChar && prevChar !== '\n' && prevChar !== '\r' && prevChar !== ' ' && prevChar !== '\t') {
      return false
    }
  }
  
  const lineStart = content.lastIndexOf('\n', position) + 1
  const lineEnd = content.indexOf('\n', position)
  const lineContent = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim()
  
  if (lineContent !== title) return false
  
  const lowerTitle = title.toLowerCase()
  if (lowerTitle.includes('第') && lowerTitle.includes('章')) {
    return true
  }
  if (/^chapter\s+\d+/i.test(title)) {
    return true
  }
  if (/^\d+\s*[.、]/.test(title)) {
    return true
  }
  if (/^[【\[（(]/.test(title)) {
    return true
  }
  
  return false
}

function cleanChapterTitle(title: string): string {
  return title
    .replace(/^[\s\u3000]+|[\s\u3000]+$/g, '')
    .replace(/[\r\n]+/g, '')
    .replace(/\s{2,}/g, ' ')
}

function mergeShortChapters(chapters: Chapter[], minLength: number): Chapter[] {
  if (chapters.length <= 1) return chapters

  const merged: Chapter[] = []
  let i = 0

  while (i < chapters.length) {
    let current = { ...chapters[i] }
    
    while (
      i + 1 < chapters.length && 
      current.wordCount! < minLength && 
      chapters[i + 1].wordCount! < minLength
    ) {
      const next = chapters[i + 1]
      current.title = `${current.title} · ${next.title}`
      current.endPosition = next.endPosition
      current.wordCount = current.endPosition - current.startPosition
      i++
    }
    
    merged.push(current)
    i++
  }

  merged.forEach((chapter, index) => {
    chapter.index = index
  })

  return merged
}

export function extractSentences(content: string): string[] {
  const sentences: string[] = []
  let lastIndex = 0

  const combinedPattern = new RegExp(
    SENTENCE_END_PATTERNS.map(p => p.source).join('|'),
    'g'
  )

  let match
  while ((match = combinedPattern.exec(content)) !== null) {
    const sentence = content.slice(lastIndex, match.index + match[0].length).trim()
    if (sentence.length > 0) {
      sentences.push(sentence)
    }
    lastIndex = match.index + match[0].length
  }

  const remaining = content.slice(lastIndex).trim()
  if (remaining.length > 0) {
    sentences.push(remaining)
  }

  return sentences
}

export function extractMetadata(content: string, title: string): BookMetadata {
  const first2000Chars = content.slice(0, 2000)
  const last1000Chars = content.slice(-1000)

  const author = detectAuthor(first2000Chars) || detectAuthor(last1000Chars) || '未知'
  const summary = generateSummary(content, title)
  const tags = detectTags(content, title)
  
  const chapterMatches = content.match(/第[一二三四五六七八九十百千零\d]+章/g) || []
  const chapterCount = Math.max(
    chapterMatches.length,
    (content.match(/^第[一二三四五六七八九十百千零\d]+章/gm) || []).length
  )

  return {
    title,
    author,
    summary,
    tags,
    wordCount: content.length,
    chapterCount
  }
}

function detectAuthor(text: string): string | null {
  for (const pattern of AUTHOR_PATTERNS) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const author = match[1].trim()
        .replace(/[作者|著|作|：:]/g, '')
        .trim()
      if (author.length >= 2 && author.length <= 30) {
        return author
      }
    }
  }
  return null
}

function generateSummary(content: string, title: string): string {
  const sentences = extractSentences(content.slice(0, 5000))
  let summary = ''

  for (const sentence of sentences) {
    if (sentence.length > 10 && sentence.length < 200) {
      summary += sentence + ' '
      if (summary.length >= 300) break
    }
  }

  if (summary.length < 50) {
    const firstParagraph = content.split('\n\n')[0] || content.split('\n')[0]
    summary = firstParagraph.slice(0, 300)
  }

  return summary.trim().slice(0, 300)
}

function detectTags(content: string, title: string): string[] {
  const tags: string[] = []
  const combinedText = (content.slice(0, 10000) + ' ' + title).toLowerCase()

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        tags.push(tag)
        break
      }
    }
  }

  if (tags.length === 0) {
    tags.push('其他')
  }

  return tags.slice(0, 5)
}

export function getThemeTemplates(): Array<{
  id: string
  name: string
  bgColor: string
  textColor: string
  accentColor: string
  secondaryBg: string
  borderColor: string
  preview: string
}> {
  return [
    {
      id: 'light',
      name: '日间模式',
      bgColor: '#fdfbf7',
      textColor: '#333333',
      accentColor: '#409eff',
      secondaryBg: '#f5f5f5',
      borderColor: '#e4e7ed',
      preview: '#fdfbf7'
    },
    {
      id: 'dark',
      name: '夜间模式',
      bgColor: '#1a1a2e',
      textColor: '#e0e0e0',
      accentColor: '#409eff',
      secondaryBg: '#2d2d44',
      borderColor: '#3d3d5c',
      preview: '#1a1a2e'
    },
    {
      id: 'eye',
      name: '护眼模式',
      bgColor: '#c7edcc',
      textColor: '#333333',
      accentColor: '#52c41a',
      secondaryBg: '#d4f0d8',
      borderColor: '#b3dcc0',
      preview: '#c7edcc'
    },
    {
      id: 'paper',
      name: '羊皮纸',
      bgColor: '#f4e4bc',
      textColor: '#5c4033',
      accentColor: '#8b4513',
      secondaryBg: '#efe0b5',
      borderColor: '#d4c4a0',
      preview: '#f4e4bc'
    },
    {
      id: 'ocean',
      name: '海洋蓝',
      bgColor: '#e6f3ff',
      textColor: '#1e3a5f',
      accentColor: '#1890ff',
      secondaryBg: '#d6e8fa',
      borderColor: '#91caff',
      preview: '#e6f3ff'
    },
    {
      id: 'forest',
      name: '森林绿',
      bgColor: '#e8f5e9',
      textColor: '#1b5e20',
      accentColor: '#4caf50',
      secondaryBg: '#c8e6c9',
      borderColor: '#a5d6a7',
      preview: '#e8f5e9'
    },
    {
      id: 'sunset',
      name: '日落橙',
      bgColor: '#fff3e0',
      textColor: '#bf360c',
      accentColor: '#ff9800',
      secondaryBg: '#ffe0b2',
      borderColor: '#ffcc80',
      preview: '#fff3e0'
    },
    {
      id: 'lavender',
      name: '薰衣草',
      bgColor: '#f3e5f5',
      textColor: '#4a148c',
      accentColor: '#9c27b0',
      secondaryBg: '#e1bee7',
      borderColor: '#ce93d8',
      preview: '#f3e5f5'
    }
  ]
}

export function hasGarbledText(content: string): boolean {
  let garbledCount = 0
  for (const pattern of GARBLED_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      garbledCount += matches.length
    }
  }
  return garbledCount > 5
}

export function analyzeTextQuality(content: string): {
  hasGarbled: boolean
  garbledCount: number
  emptyLineRatio: number
  avgLineLength: number
  totalLines: number
} {
  const lines = content.split('\n')
  const emptyLines = lines.filter(l => l.trim().length === 0).length
  const nonEmptyLines = lines.filter(l => l.trim().length > 0)
  const avgLineLength = nonEmptyLines.length > 0
    ? nonEmptyLines.reduce((sum, l) => sum + l.length, 0) / nonEmptyLines.length
    : 0

  let garbledCount = 0
  for (const pattern of GARBLED_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      garbledCount += matches.length
    }
  }

  return {
    hasGarbled: garbledCount > 5,
    garbledCount,
    emptyLineRatio: lines.length > 0 ? emptyLines / lines.length : 0,
    avgLineLength,
    totalLines: lines.length
  }
}
