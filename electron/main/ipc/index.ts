import { ipcMain, dialog, shell, app } from 'electron'
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname, basename, extname } from 'path'
import { bookDb, categoryDb, bookmarkDb, progressDb, statsDb, goalDb } from '../db'
import {
  getConfig,
  getReadingConfig,
  getShortcuts,
  updateConfig,
  updateReadingConfig,
  updateShortcuts,
  addScanPath,
  removeScanPath,
  addFavoritePath,
  removeFavoritePath,
  getThemeTemplatesList,
  applyThemeTemplate
} from '../config'
import {
  listDirectory,
  scanMultiplePaths,
  isSupportedFile,
  getFileType,
  getFileNameWithoutExtension,
  detectEncoding,
  readTextFile
} from '../utils/file'
import { parseTxtFile, paginateContent, getPageContent, extractChapters } from '../utils/txtParser'
import { parseEpubFile, paginateEpubContent, getEpubPageContent } from '../utils/epubParser'
import {
  smartExtractChapters,
  cleanText,
  removeDuplicateChapters,
  detectDuplicateChapters,
  extractMetadata,
  analyzeTextQuality,
  hasGarbledText,
  getThemeTemplates
} from '../utils/smartTextProcessor'
import {
  toggleFullscreen,
  toggleAlwaysOnTop,
  isAlwaysOnTop,
  isFullscreen,
  setReadingStart,
  saveReadingTime,
  resetReadingTime
} from '../window'
import type {
  Book,
  Category,
  Bookmark,
  ReadingConfig,
  FileInfo,
  PageContent,
  SearchResult,
  SplitVolumeOption,
  ExportBookData,
  TextCleanupOptions,
  SmartChapterOptions,
  BookMetadata,
  ReadingStats,
  ReadingGoal,
  ReadingGoalProgress,
  ThemeTemplate
} from '../types'

const bookCache = new Map<number, {
  content: string
  chapters: any[]
  totalPages: number
  pages: PageContent[]
  isLargeFile: boolean
  readingSessionStart?: number
  readingSessionPages?: number
  readingSessionChars?: number
}>()

const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024

const DEFAULT_CLEANUP_OPTIONS: TextCleanupOptions = {
  removeDuplicateChapters: true,
  removeEmptyLines: true,
  fixGarbledText: true,
  normalizePunctuation: true,
  removeExtraSpaces: true
}

const DEFAULT_SMART_CHAPTER_OPTIONS: SmartChapterOptions = {
  enableSmartSegmentation: true,
  minChapterLength: 500,
  mergeShortChapters: true,
  autoDetectTitlePatterns: true
}

export function registerIpcHandlers(): void {
  ipcMain.handle('app:getConfig', () => getConfig())
  ipcMain.handle('app:getReadingConfig', () => getReadingConfig())
  ipcMain.handle('app:getShortcuts', () => getShortcuts())
  ipcMain.handle('app:getSystemInfo', () => ({
    platform: process.platform,
    homedir: require('os').homedir(),
    user: process.env.USER || process.env.USERNAME || ''
  }))
  ipcMain.handle('app:updateConfig', (_e, updates) => {
    updateConfig(updates)
    return getConfig()
  })
  ipcMain.handle('app:updateReadingConfig', (_e, updates) => {
    updateReadingConfig(updates)
    return getReadingConfig()
  })
  ipcMain.handle('app:updateShortcuts', (_e, updates) => {
    updateShortcuts(updates)
    return getShortcuts()
  })
  ipcMain.handle('app:getThemeTemplates', () => getThemeTemplatesList())
  ipcMain.handle('app:applyThemeTemplate', (_e, templateId) => {
    applyThemeTemplate(templateId)
    return getReadingConfig()
  })

  ipcMain.handle('app:addScanPath', (_e, path) => {
    addScanPath(path)
    return getConfig()
  })
  ipcMain.handle('app:removeScanPath', (_e, path) => {
    removeScanPath(path)
    return getConfig()
  })
  ipcMain.handle('app:addFavoritePath', (_e, path) => {
    addFavoritePath(path)
    return getConfig()
  })
  ipcMain.handle('app:removeFavoritePath', (_e, path) => {
    removeFavoritePath(path)
    return getConfig()
  })

  ipcMain.handle('window:toggleFullscreen', () => toggleFullscreen())
  ipcMain.handle('window:toggleAlwaysOnTop', () => toggleAlwaysOnTop())
  ipcMain.handle('window:isAlwaysOnTop', () => isAlwaysOnTop())
  ipcMain.handle('window:isFullscreen', () => isFullscreen())

  ipcMain.handle('category:getAll', () => categoryDb.getAll())
  ipcMain.handle('category:create', (_e, name) => categoryDb.create(name))
  ipcMain.handle('category:update', (_e, id, name) => {
    categoryDb.update(id, name)
    return true
  })
  ipcMain.handle('category:delete', (_e, id) => {
    categoryDb.delete(id)
    return true
  })

  ipcMain.handle('book:getAll', () => bookDb.getAll())
  ipcMain.handle('book:getById', (_e, id) => bookDb.getById(id))
  ipcMain.handle('book:getByPath', (_e, path) => bookDb.getByPath(path))
  ipcMain.handle('book:addReadingTime', (_e, bookId, duration) => {
    bookDb.addReadingTime(bookId, duration)
    return true
  })
  ipcMain.handle('book:updateMetadata', (_e, bookId, metadata) => {
    bookDb.updateMetadata(bookId, metadata)
    return true
  })
  ipcMain.handle('book:getMetadata', (_e, bookId) => {
    const book = bookDb.getById(bookId)
    if (!book) return null
    
    const tags = book.tags ? JSON.parse(book.tags) : []
    return {
      title: book.title,
      author: book.author,
      summary: book.summary,
      tags,
      detectedAuthor: book.detectedAuthor,
      wordCount: book.totalCharacters,
      totalPages: book.totalPages
    }
  })

  ipcMain.handle('book:add', async (_e, filePath) => {
    if (!existsSync(filePath) || !isSupportedFile(filePath)) {
      throw new Error('不支持的文件格式')
    }

    const existing = bookDb.getByPath(filePath)
    if (existing) {
      return existing.id
    }

    return addBookInternal(filePath)
  })

  ipcMain.handle('book:update', (_e, id, updates) => {
    bookDb.update(id, updates)
    return bookDb.getById(id)
  })

  ipcMain.handle('book:togglePin', (_e, id) => {
    bookDb.togglePin(id)
    return true
  })

  ipcMain.handle('book:delete', (_e, id) => {
    bookCache.delete(id)
    bookDb.delete(id)
    return true
  })

  ipcMain.handle('book:updateProgress', (_e, bookId, page, position) => {
    bookDb.updateReadingProgress(bookId, page, position)
    return true
  })

  ipcMain.handle('book:batchImport', async (_e, filePaths) => {
    const results: { success: number[]; failed: string[] } = { success: [], failed: [] }
    
    for (const filePath of filePaths) {
      try {
        const existing = bookDb.getByPath(filePath)
        if (existing) {
          results.success.push(existing.id)
        } else {
          const id = await addBookInternal(filePath)
          if (id) results.success.push(id)
          else results.failed.push(filePath)
        }
      } catch (err) {
        results.failed.push(filePath)
      }
    }
    
    return results
  })

  ipcMain.handle('book:batchExport', async (_e, bookIds) => {
    const exportData: ExportBookData[] = []
    
    for (const bookId of bookIds) {
      const book = bookDb.getById(bookId)
      if (!book) continue
      
      const bookmarks = bookmarkDb.getByBookId(bookId)
      const progress = progressDb.getByBookId(bookId, 1000)
      
      const { id, createdAt, updatedAt, ...bookData } = book
      const bookmarkData = bookmarks.map(({ id, createdAt, ...rest }) => rest)
      const progressData = progress.map(({ id, createdAt, ...rest }) => rest)
      
      exportData.push({
        book: bookData,
        bookmarks: bookmarkData,
        progress: progressData
      })
    }
    
    return exportData
  })

  ipcMain.handle('book:exportJson', async (_e, exportData) => {
    const result = await dialog.showSaveDialog({
      title: '导出书架数据',
      defaultPath: `bookshelf_${Date.now()}.json`,
      filters: [{ name: 'JSON文件', extensions: ['json'] }]
    })
    
    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
      return true
    }
    return false
  })

  ipcMain.handle('book:importJson', async () => {
    const result = await dialog.showOpenDialog({
      title: '导入书架数据',
      properties: ['openFile'],
      filters: [{ name: 'JSON文件', extensions: ['json'] }]
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      try {
        const data = JSON.parse(readFileSync(result.filePaths[0], 'utf-8')) as ExportBookData[]
        const importedIds: number[] = []
        
        for (const item of data) {
          const existing = bookDb.getByPath(item.book.filePath)
          if (existing) {
            importedIds.push(existing.id)
            continue
          }
          
          const bookId = bookDb.create(item.book as any)
          importedIds.push(bookId)
          
          for (const bookmark of item.bookmarks) {
            bookmarkDb.create({ ...bookmark, bookId })
          }
          
          for (const progress of item.progress) {
            progressDb.create({ ...progress, bookId })
          }
        }
        
        return { success: true, importedIds }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
    return { success: false, error: '用户取消' }
  })

  ipcMain.handle('bookmark:getByBookId', (_e, bookId) => bookmarkDb.getByBookId(bookId))
  ipcMain.handle('bookmark:add', (_e, bookmark) => bookmarkDb.create(bookmark))
  ipcMain.handle('bookmark:delete', (_e, id) => {
    bookmarkDb.delete(id)
    return true
  })

  ipcMain.handle('progress:getByBookId', (_e, bookId, limit) => progressDb.getByBookId(bookId, limit))
  ipcMain.handle('progress:add', (_e, progress) => progressDb.create(progress))

  ipcMain.handle('stats:getByBookId', (_e, bookId, startDate, endDate) => 
    statsDb.getByBookId(bookId, startDate, endDate))
  ipcMain.handle('stats:getByDateRange', (_e, startDate, endDate) => 
    statsDb.getByDateRange(startDate, endDate))
  ipcMain.handle('stats:getDailyStats', (_e, date) => statsDb.getDailyStats(date))
  ipcMain.handle('stats:getDailyTotal', (_e, date) => statsDb.getDailyTotal(date))
  ipcMain.handle('stats:getDailyAverages', (_e, days) => statsDb.getDailyAverages(days))
  ipcMain.handle('stats:getAverageSpeed', (_e, bookId) => statsDb.getAverageReadingSpeed(bookId))
  ipcMain.handle('stats:getReadingStreak', () => statsDb.getReadingStreak())
  ipcMain.handle('stats:recordSession', (_e, bookId, readTime, readPages, readChars) => {
    statsDb.recordReadingSession(bookId, readTime, readPages, readChars)
    return true
  })

  ipcMain.handle('goal:getActiveGoal', () => goalDb.getActiveGoal())
  ipcMain.handle('goal:getAllGoals', () => goalDb.getAllGoals())
  ipcMain.handle('goal:getGoalProgress', () => goalDb.getGoalProgress())
  ipcMain.handle('goal:getDailyRecords', (_e, days) => goalDb.getDailyRecords(days))
  ipcMain.handle('goal:create', (_e, goal) => goalDb.create(goal))
  ipcMain.handle('goal:update', (_e, id, updates) => {
    goalDb.update(id, updates)
    return true
  })
  ipcMain.handle('goal:delete', (_e, id) => {
    goalDb.delete(id)
    return true
  })

  ipcMain.handle('file:listDirectory', (_e, dirPath) => listDirectory(dirPath))

  async function addBookInternal(filePath: string): Promise<number | null> {
    if (!existsSync(filePath) || !isSupportedFile(filePath)) {
      return null
    }

    const existing = bookDb.getByPath(filePath)
    if (existing) {
      return existing.id
    }

    const fileType = getFileType(filePath)
    const defaultCategory = categoryDb.getAll().find(c => c.name === '未分类')

    let title = getFileNameWithoutExtension(filePath)
    let author = '未知'
    let encoding = 'utf-8'
    let totalCharacters = 0
    let coverPath: string | null = null
    let summary = ''
    let tags: string[] = []
    let detectedAuthor = ''

    try {
      if (fileType === 'txt') {
        const result = parseTxtFile(filePath)
        encoding = result.encoding
        totalCharacters = result.totalCharacters

        const metadata = extractMetadata(result.content, title)
        author = metadata.author
        detectedAuthor = metadata.author
        summary = metadata.summary
        tags = metadata.tags

        const quality = analyzeTextQuality(result.content)
        if (quality.hasGarbled || quality.emptyLineRatio > 0.3) {
          console.log(`Text quality issues detected for ${filePath}:`, quality)
        }
      } else if (fileType === 'epub') {
        const result = parseEpubFile(filePath)
        title = result.title || title
        author = result.author || author
        coverPath = result.coverPath
        totalCharacters = result.totalCharacters
        summary = result.content.slice(0, 300)
        detectedAuthor = author
      } else if (fileType === 'pdf' || fileType === 'chm') {
        const stats = statSync(filePath)
        totalCharacters = stats.size
      }
    } catch (err) {
      console.error('Parse file error:', err)
    }

    const bookId = bookDb.create({
      title,
      author,
      filePath,
      fileType,
      coverPath,
      encoding,
      totalPages: 0,
      totalCharacters,
      categoryId: defaultCategory?.id || null,
      isPinned: 0,
      lastReadPage: 1,
      lastReadPosition: 0,
      lastReadTime: Date.now(),
      totalReadingTime: 0,
      notes: '',
      summary,
      tags: JSON.stringify(tags),
      detectedAuthor,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    return bookId
  }

  ipcMain.handle('file:scanBooks', async (_e, paths) => {
    const books = scanMultiplePaths(paths, true)
    const results: number[] = []

    for (const filePath of books) {
      try {
        const existing = bookDb.getByPath(filePath)
        if (existing) {
          results.push(existing.id)
        } else {
          const bookId = await addBookInternal(filePath)
          if (bookId) results.push(bookId)
        }
      } catch (err) {
        console.error('Scan book error:', err)
      }
    }

    return results
  })

  ipcMain.handle('file:openDialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '电子书', extensions: ['txt', 'epub', 'pdf', 'chm'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (!result.canceled) {
      const bookIds: number[] = []
      for (const filePath of result.filePaths) {
        try {
          const existing = bookDb.getByPath(filePath)
          if (existing) {
            bookIds.push(existing.id)
          } else {
            const bookId = await addBookInternal(filePath)
            if (bookId) bookIds.push(bookId)
          }
        } catch (err) {
          console.error('Add book error:', err)
        }
      }
      return bookIds
    }
    return []
  })

  ipcMain.handle('file:openFolderDialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('file:detectEncoding', (_e, filePath) => {
    const buffer = require('fs').readFileSync(filePath)
    return detectEncoding(buffer)
  })

  ipcMain.handle('file:readText', (_e, filePath, encoding) => {
    return readTextFile(filePath, encoding)
  })

  ipcMain.handle('file:selectImage', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('file:selectFont', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '字体文件', extensions: ['ttf', 'otf', 'woff', 'woff2'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('reader:openBook', (_e, bookId, pageChars = 800) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')

    setReadingStart(bookId)

    const cached = bookCache.get(bookId)
    if (cached) {
      cached.readingSessionStart = Date.now()
      cached.readingSessionPages = 0
      cached.readingSessionChars = 0
      return {
        content: cached.isLargeFile ? '' : cached.content,
        chapters: cached.chapters,
        totalPages: cached.totalPages,
        isLargeFile: cached.isLargeFile
      }
    }

    let content = ''
    let chapters: any[] = []
    const isLargeFile = book.totalCharacters > LARGE_FILE_THRESHOLD

    try {
      if (book.fileType === 'txt') {
        const result = parseTxtFile(book.filePath, book.encoding)
        content = result.content
        chapters = result.chapters

        const quality = analyzeTextQuality(content)
        if (quality.hasGarbled || quality.emptyLineRatio > 0.3 || detectDuplicateChapters(chapters).length > 0) {
          const cleanedContent = cleanText(content, DEFAULT_CLEANUP_OPTIONS)
          const smartChapters = smartExtractChapters(cleanedContent, DEFAULT_SMART_CHAPTER_OPTIONS)
          const dedupResult = removeDuplicateChapters(cleanedContent, smartChapters)
          content = dedupResult.content
          chapters = dedupResult.chapters
        }
      } else if (book.fileType === 'epub') {
        const result = parseEpubFile(book.filePath)
        content = result.content
        chapters = result.chapters
      } else if (book.fileType === 'pdf' || book.fileType === 'chm') {
        content = `这是一本${book.fileType.toUpperCase()}格式的电子书，当前仅支持简易阅读模式。\n\n书名：${book.title}\n作者：${book.author}\n\n由于格式限制，部分功能可能不可用。`
        chapters = [{
          index: 0,
          title: '全文',
          startPosition: 0,
          endPosition: content.length,
          startPage: 1
        }]
      }
    } catch (err) {
      console.error('Open book error:', err)
      throw new Error('解析书籍失败')
    }

    const pagination = book.fileType === 'epub' || book.fileType === 'pdf' || book.fileType === 'chm'
      ? paginateEpubContent(content, chapters, pageChars)
      : paginateContent(content, chapters, pageChars)

    const cacheData = {
      content,
      chapters,
      totalPages: pagination.totalPages,
      pages: pagination.pages,
      isLargeFile,
      readingSessionStart: Date.now(),
      readingSessionPages: 0,
      readingSessionChars: 0
    }

    bookCache.set(bookId, cacheData)

    bookDb.update(bookId, { totalPages: pagination.totalPages })

    return {
      content: isLargeFile ? '' : content,
      chapters,
      totalPages: pagination.totalPages,
      isLargeFile
    }
  })

  ipcMain.handle('reader:getPage', (_e, bookId, page) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')

    const cache = bookCache.get(bookId)
    if (!cache) throw new Error('书籍未加载')

    if (cache.readingSessionStart) {
      const pageContent = cache.pages.find(p => p.page === page)
      if (pageContent) {
        cache.readingSessionPages = (cache.readingSessionPages || 0) + 1
        cache.readingSessionChars = (cache.readingSessionChars || 0) + 
          (pageContent.endPosition - pageContent.startPosition)
      }
    }

    return cache.pages.find(p => p.page === page) || null
  })

  ipcMain.handle('reader:getFullContent', (_e, bookId) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')

    const cache = bookCache.get(bookId)
    if (!cache) throw new Error('书籍未加载')

    if (cache.isLargeFile) {
      return {
        content: '',
        chapters: cache.chapters,
        isLargeFile: true
      }
    }

    return {
      content: cache.content,
      chapters: cache.chapters,
      isLargeFile: false
    }
  })

  ipcMain.handle('reader:getChapterContent', (_e, bookId, chapterIndex) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')

    const cache = bookCache.get(bookId)
    if (!cache) throw new Error('书籍未加载')

    const chapter = cache.chapters.find(c => c.index === chapterIndex)
    if (!chapter) return null

    const content = cache.content.slice(chapter.startPosition, chapter.endPosition)
    return {
      chapter,
      content,
      pages: cache.pages.filter(p => p.chapterIndex === chapterIndex)
    }
  })

  ipcMain.handle('reader:search', (_e, bookId, keyword) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')
    if (!keyword || keyword.trim().length === 0) return []

    const cache = bookCache.get(bookId)
    if (!cache) throw new Error('书籍未加载')

    const results: SearchResult[] = []
    const searchKeyword = keyword.toLowerCase()
    const contextLength = 50

    let matchIndex = 0
    for (const page of cache.pages) {
      const contentLower = page.content.toLowerCase()
      let pos = contentLower.indexOf(searchKeyword)
      
      while (pos !== -1) {
        const actualPos = page.startPosition + pos
        const startContext = Math.max(0, pos - contextLength)
        const endContext = Math.min(page.content.length, pos + keyword.length + contextLength)
        const context = page.content.slice(startContext, endContext)
        
        results.push({
          page: page.page,
          position: actualPos,
          chapterTitle: page.chapterTitle,
          content: context,
          matchIndex: matchIndex++
        })
        
        pos = contentLower.indexOf(searchKeyword, pos + 1)
      }
    }

    return results
  })

  ipcMain.handle('reader:splitVolume', async (_e, bookId, options: SplitVolumeOption) => {
    const book = bookDb.getById(bookId)
    if (!book || book.fileType !== 'txt') {
      throw new Error('仅支持TXT文件分卷')
    }

    const cache = bookCache.get(bookId)
    if (!cache) throw new Error('书籍未加载')

    const volumes: { title: string; content: string; startChapter: number; endChapter: number }[] = []
    
    if (options.unit === 'chapters') {
      const chaptersPerVolume = options.volumeSize
      for (let i = 0; i < cache.chapters.length; i += chaptersPerVolume) {
        const volumeChapters = cache.chapters.slice(i, i + chaptersPerVolume)
        const startChapter = volumeChapters[0].index
        const endChapter = volumeChapters[volumeChapters.length - 1].index
        const startPos = volumeChapters[0].startPosition
        const endPos = volumeChapters[volumeChapters.length - 1].endPosition
        
        let volumeContent = ''
        for (const chapter of volumeChapters) {
          const chapterContent = cache.content.slice(chapter.startPosition, chapter.endPosition)
          volumeContent += chapterContent + '\n\n'
        }
        
        volumes.push({
          title: `${book.title}_第${Math.floor(i / chaptersPerVolume) + 1}卷`,
          content: volumeContent,
          startChapter,
          endChapter
        })
      }
    } else {
      const charsPerVolume = options.volumeSize * 10000
      let currentPos = 0
      let volumeIndex = 1
      
      while (currentPos < cache.content.length) {
        let endPos = Math.min(currentPos + charsPerVolume, cache.content.length)
        
        if (endPos < cache.content.length) {
          const breakPoints = [
            cache.content.lastIndexOf('\n\n', endPos),
            cache.content.lastIndexOf('\n', endPos),
            cache.content.lastIndexOf('。', endPos)
          ]
          const validBreak = breakPoints.find(p => p > currentPos + charsPerVolume * 0.8)
          if (validBreak !== undefined) {
            endPos = validBreak + 1
          }
        }
        
        volumes.push({
          title: `${book.title}_第${volumeIndex}卷`,
          content: cache.content.slice(currentPos, endPos),
          startChapter: 0,
          endChapter: 0
        })
        
        currentPos = endPos
        volumeIndex++
      }
    }

    const result = await dialog.showOpenDialog({
      title: '选择保存目录',
      properties: ['openDirectory']
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      const saveDir = result.filePaths[0]
      for (let i = 0; i < volumes.length; i++) {
        const volume = volumes[i]
        const fileName = `${volume.title}.txt`
        const filePath = join(saveDir, fileName)
        writeFileSync(filePath, volume.content, book.encoding as BufferEncoding || 'utf-8')
      }
      return { success: true, count: volumes.length, saveDir }
    }
    
    return { success: false, count: 0, saveDir: '' }
  })

  ipcMain.handle('reader:getChapters', (_e, bookId) => {
    const cache = bookCache.get(bookId)
    if (!cache) return []
    return cache.chapters
  })

  ipcMain.handle('reader:closeBook', (_e, bookId) => {
    const cache = bookCache.get(bookId)
    if (cache && cache.readingSessionStart) {
      const readTime = Math.floor((Date.now() - cache.readingSessionStart) / 1000)
      if (readTime > 10) {
        statsDb.recordReadingSession(
          bookId,
          readTime,
          cache.readingSessionPages || 0,
          cache.readingSessionChars || 0
        )
        bookDb.addReadingTime(bookId, readTime)
      }
    }

    saveReadingTime()
    bookCache.delete(bookId)
    return true
  })

  ipcMain.handle('reader:generateToc', (_e, content) => {
    return smartExtractChapters(content, DEFAULT_SMART_CHAPTER_OPTIONS)
  })

  ipcMain.handle('reader:cleanText', (_e, content, options) => {
    return cleanText(content, options || DEFAULT_CLEANUP_OPTIONS)
  })

  ipcMain.handle('reader:analyzeQuality', (_e, content) => {
    return analyzeTextQuality(content)
  })

  ipcMain.handle('reader:extractMetadata', (_e, content, title) => {
    return extractMetadata(content, title)
  })

  ipcMain.handle('reader:smartRechapters', (_e, bookId, options) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')

    const cache = bookCache.get(bookId)
    if (!cache) throw new Error('书籍未加载')

    const smartOptions = options || DEFAULT_SMART_CHAPTER_OPTIONS
    const newChapters = smartExtractChapters(cache.content, smartOptions)
    const dedupResult = removeDuplicateChapters(cache.content, newChapters)
    
    cache.chapters = dedupResult.chapters
    cache.content = dedupResult.content

    const pageChars = getReadingConfig().pageChars
    const pagination = paginateContent(cache.content, cache.chapters, pageChars)
    cache.pages = pagination.pages
    cache.totalPages = pagination.totalPages

    bookDb.update(bookId, { totalPages: pagination.totalPages })

    return {
      chapters: cache.chapters,
      totalPages: cache.totalPages
    }
  })

  ipcMain.handle('reader:goToPercentage', (_e, bookId, percentage) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')

    const cache = bookCache.get(bookId)
    if (!cache) throw new Error('书籍未加载')

    const targetPos = Math.floor((percentage / 100) * cache.content.length)
    const page = cache.pages.find(p => targetPos >= p.startPosition && targetPos < p.endPosition)
    
    return page ? page.page : 1
  })

  ipcMain.handle('shell:openExternal', (_e, url) => {
    shell.openExternal(url)
    return true
  })

  ipcMain.handle('shell:showInFolder', (_e, path) => {
    shell.showItemInFolder(path)
    return true
  })
}
