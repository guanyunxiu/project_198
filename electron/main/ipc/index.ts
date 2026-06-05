import { ipcMain, dialog, shell } from 'electron'
import { existsSync, statSync } from 'fs'
import { bookDb, categoryDb, bookmarkDb, progressDb } from '../db'
import {
  getConfig,
  getReadingConfig,
  updateConfig,
  updateReadingConfig,
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
import { parseTxtFile, paginateContent, getPageContent } from '../utils/txtParser'
import { parseEpubFile, paginateEpubContent, getEpubPageContent } from '../utils/epubParser'
import type { Book, Category, Bookmark, ReadingConfig, FileInfo, PageContent } from '../types'

const bookCache = new Map<number, { content: string; chapters: any[]; totalPages: number }>()

export function registerIpcHandlers(): void {
  ipcMain.handle('app:getConfig', () => getConfig())
  ipcMain.handle('app:getReadingConfig', () => getReadingConfig())
  ipcMain.handle('app:updateConfig', (_e, updates) => {
    updateConfig(updates)
    return getConfig()
  })
  ipcMain.handle('app:updateReadingConfig', (_e, updates) => {
    updateReadingConfig(updates)
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

  ipcMain.handle('book:add', async (_e, filePath) => {
    if (!existsSync(filePath) || !isSupportedFile(filePath)) {
      throw new Error('不支持的文件格式')
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

    try {
      if (fileType === 'txt') {
        const result = parseTxtFile(filePath)
        encoding = result.encoding
        totalCharacters = result.totalCharacters
      } else if (fileType === 'epub') {
        const result = parseEpubFile(filePath)
        title = result.title || title
        author = result.author || author
        coverPath = result.coverPath
        totalCharacters = result.totalCharacters
      }
    } catch (err) {
      console.error('Parse file error:', err)
    }

    const stats = statSync(filePath)
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
      lastReadTime: Date.now()
    })

    return bookId
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

    try {
      if (fileType === 'txt') {
        const result = parseTxtFile(filePath)
        encoding = result.encoding
        totalCharacters = result.totalCharacters
      } else if (fileType === 'epub') {
        const result = parseEpubFile(filePath)
        title = result.title || title
        author = result.author || author
        coverPath = result.coverPath
        totalCharacters = result.totalCharacters
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
      lastReadTime: Date.now()
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

    if (bookCache.has(bookId)) {
      return bookCache.get(bookId)
    }

    let content = ''
    let chapters: any[] = []

    try {
      if (book.fileType === 'txt') {
        const result = parseTxtFile(book.filePath, book.encoding)
        content = result.content
        chapters = result.chapters
      } else if (book.fileType === 'epub') {
        const result = parseEpubFile(book.filePath)
        content = result.content
        chapters = result.chapters
      }
    } catch (err) {
      console.error('Open book error:', err)
      throw new Error('解析书籍失败')
    }

    const pagination = book.fileType === 'epub'
      ? paginateEpubContent(content, chapters, pageChars)
      : paginateContent(content, chapters, pageChars)

    const cacheData = {
      content,
      chapters,
      totalPages: pagination.totalPages
    }

    bookCache.set(bookId, cacheData)

    bookDb.update(bookId, { totalPages: pagination.totalPages })

    return cacheData
  })

  ipcMain.handle('reader:getPage', (_e, bookId, page, pageChars = 800) => {
    const book = bookDb.getById(bookId)
    if (!book) throw new Error('书籍不存在')

    const cache = bookCache.get(bookId)
    if (!cache) throw new Error('书籍未加载')

    const pageContent = book.fileType === 'epub'
      ? getEpubPageContent(cache.content, cache.chapters, page, pageChars)
      : getPageContent(cache.content, cache.chapters, page, pageChars)

    return pageContent
  })

  ipcMain.handle('reader:closeBook', (_e, bookId) => {
    bookCache.delete(bookId)
    return true
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
