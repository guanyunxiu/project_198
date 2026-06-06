import { ipcMain, dialog, shell, app } from 'electron'
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
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
  removeFavoritePath
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
import { parseTxtFile, paginateContent, getPageContent, extractChapters, cleanText, smartExtractChapters, extractBookSmartInfo } from '../utils/txtParser'
import { parseEpubFile, paginateEpubContent, getEpubPageContent } from '../utils/epubParser'
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
  ReadingStats,
  ReadingGoal,
  ThemeConfig,
  BookSmartInfo,
  TextCleanResult
} from '../types'

const bookCache = new Map<number, {
  content: string
  chapters: any[]
  totalPages: number
  pages: PageContent[]
  isLargeFile: boolean
}>()

const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024

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
          
          const bookId = bookDb.create(item.book)
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
    let tags = ''

    try {
      if (fileType === 'txt') {
        const result = parseTxtFile(filePath, undefined, { smartDetection: true, autoClean: true })
        encoding = result.encoding
        totalCharacters = result.totalCharacters
        if (result.smartInfo) {
          author = result.smartInfo.author || author
          title = result.smartInfo.estimatedChapters > 1 ? title : getFileNameWithoutExtension(filePath)
          summary = result.smartInfo.summary || ''
          tags = result.smartInfo.tags.join(',') || ''
        }
      } else if (fileType === 'epub') {
        const result = parseEpubFile(filePath)
        title = result.title || title
        author = result.author || author
        coverPath = result.coverPath
        totalCharacters = result.totalCharacters
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
      tags
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

  ipcMain.handle('reader:openBook', (_e, bookId, pageChars = 800) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')

    setReadingStart(bookId)

    const cached = bookCache.get(bookId)
    if (cached) {
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
      isLargeFile
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
    saveReadingTime()
    bookCache.delete(bookId)
    return true
  })

  ipcMain.handle('reader:generateToc', (_e, content) => {
    return extractChapters(content)
  })

  ipcMain.handle('reader:smartGenerateToc', (_e, content) => {
    return smartExtractChapters(content)
  })

  ipcMain.handle('reader:cleanText', (_e, content, options) => {
    return cleanText(content, options)
  })

  ipcMain.handle('reader:getSmartInfo', (_e, bookId) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')

    const cache = bookCache.get(bookId)
    if (!cache) throw new Error('书籍未加载')

    return extractBookSmartInfo(cache.content, book.title)
  })

  ipcMain.handle('reader:goToPercent', (_e, bookId, percent) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')

    const cache = bookCache.get(bookId)
    if (!cache) throw new Error('书籍未加载')

    const targetPage = Math.max(1, Math.min(cache.totalPages, Math.floor(cache.totalPages * percent / 100)))
    return cache.pages.find(p => p.page === targetPage) || null
  })

  ipcMain.handle('stats:getByDate', (_e, date) => statsDb.getByDate(date))
  ipcMain.handle('stats:getByBookId', (_e, bookId, limit) => statsDb.getByBookId(bookId, limit))
  ipcMain.handle('stats:getDateRange', (_e, startDate, endDate) => statsDb.getDateRange(startDate, endDate))
  ipcMain.handle('stats:addReading', (_e, bookId, pagesRead, charactersRead, readingTime) => {
    return statsDb.addReading(bookId, pagesRead, charactersRead, readingTime)
  })
  ipcMain.handle('stats:getDailyAverage', (_e, days) => statsDb.getDailyAverage(days))
  ipcMain.handle('stats:getPagesPerMinute', (_e, bookId) => statsDb.getPagesPerMinute(bookId))

  ipcMain.handle('goals:getAll', () => goalDb.getAll())
  ipcMain.handle('goals:getActive', () => goalDb.getActive())
  ipcMain.handle('goals:create', (_e, goal) => goalDb.create(goal))
  ipcMain.handle('goals:updateProgress', (_e, id, increment) => goalDb.updateProgress(id, increment))
  ipcMain.handle('goals:checkIn', (_e, type) => goalDb.checkIn(type))
  ipcMain.handle('goals:delete', (_e, id) => goalDb.delete(id))

  ipcMain.handle('theme:getPresetThemes', () => {
    return [
      {
        name: 'light',
        displayName: '日间',
        bgPrimary: '#ffffff',
        bgSecondary: '#f5f5f5',
        bgTertiary: '#fafafa',
        textPrimary: '#333333',
        textSecondary: '#666666',
        textTertiary: '#999999',
        borderColor: '#e5e5e5',
        accentColor: '#409eff',
        readerBg: '#fdfbf7',
        readerText: '#333333',
        bgPrimaryRgb: '255, 255, 255'
      },
      {
        name: 'dark',
        displayName: '夜间',
        bgPrimary: '#1a1a2e',
        bgSecondary: '#16213e',
        bgTertiary: '#0f0f1a',
        textPrimary: '#e5e5e5',
        textSecondary: '#a0a0a0',
        textTertiary: '#666666',
        borderColor: '#2d2d44',
        accentColor: '#66b1ff',
        readerBg: '#1a1a2e',
        readerText: '#c0c0c0',
        bgPrimaryRgb: '26, 26, 46'
      },
      {
        name: 'eye',
        displayName: '护眼',
        bgPrimary: '#c7edcc',
        bgSecondary: '#b8e8c2',
        bgTertiary: '#d4f0d9',
        textPrimary: '#2f4f4f',
        textSecondary: '#3d5c5c',
        textTertiary: '#5a7a7a',
        borderColor: '#a0d4a8',
        accentColor: '#2e8b57',
        readerBg: '#c7edcc',
        readerText: '#2f4f4f',
        bgPrimaryRgb: '199, 237, 204'
      },
      {
        name: 'sepia',
        displayName: '羊皮纸',
        bgPrimary: '#f4ecd8',
        bgSecondary: '#e8dcc8',
        bgTertiary: '#f0e6d0',
        textPrimary: '#5b4636',
        textSecondary: '#7a6555',
        textTertiary: '#998877',
        borderColor: '#d4c4a8',
        accentColor: '#8b7355',
        readerBg: '#f4ecd8',
        readerText: '#5b4636',
        bgPrimaryRgb: '244, 236, 216'
      },
      {
        name: 'gray',
        displayName: '灰调',
        bgPrimary: '#f0f0f0',
        bgSecondary: '#e0e0e0',
        bgTertiary: '#e8e8e8',
        textPrimary: '#333333',
        textSecondary: '#666666',
        textTertiary: '#999999',
        borderColor: '#d0d0d0',
        accentColor: '#666666',
        readerBg: '#f0f0f0',
        readerText: '#333333',
        bgPrimaryRgb: '240, 240, 240'
      },
      {
        name: 'blue',
        displayName: '深蓝',
        bgPrimary: '#0a192f',
        bgSecondary: '#112240',
        bgTertiary: '#0d1a2d',
        textPrimary: '#e6f1ff',
        textSecondary: '#a8b2d1',
        textTertiary: '#8892b0',
        borderColor: '#233554',
        accentColor: '#64ffda',
        readerBg: '#0a192f',
        readerText: '#e6f1ff',
        bgPrimaryRgb: '10, 25, 47'
      }
    ]
  })

  ipcMain.handle('file:uploadBackground', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const userDataPath = app.getPath('userData')
      const backgroundsDir = join(userDataPath, 'backgrounds')
      if (!existsSync(backgroundsDir)) {
        mkdirSync(backgroundsDir, { recursive: true })
      }

      const originalPath = result.filePaths[0]
      const fileName = `bg_${Date.now()}${extname(originalPath)}`
      const newPath = join(backgroundsDir, fileName)
      copyFileSync(originalPath, newPath)
      return newPath
    }
    return null
  })

  ipcMain.handle('file:uploadFont', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '字体文件', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const userDataPath = app.getPath('userData')
      const fontsDir = join(userDataPath, 'fonts')
      if (!existsSync(fontsDir)) {
        mkdirSync(fontsDir, { recursive: true })
      }

      const originalPath = result.filePaths[0]
      const fileName = `font_${Date.now()}${extname(originalPath)}`
      const newPath = join(fontsDir, fileName)
      copyFileSync(originalPath, newPath)
      return { path: newPath, name: basename(originalPath, extname(originalPath)) }
    }
    return null
  })

  ipcMain.handle('book:updateSmartInfo', (_e, bookId, updates) => {
    bookDb.update(bookId, updates)
    return bookDb.getById(bookId)
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
