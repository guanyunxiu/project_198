import { contextBridge, ipcRenderer } from 'electron'
import type {
  Book,
  Category,
  Bookmark,
  ReadingProgress,
  AppConfig,
  ReadingConfig,
  FileInfo,
  PageContent,
  SearchResult,
  ShortcutConfig,
  SplitVolumeOption,
  ExportBookData
} from '../main/types'

export interface IElectronAPI {
  app: {
    getConfig: () => Promise<AppConfig>
    getReadingConfig: () => Promise<ReadingConfig>
    getShortcuts: () => Promise<ShortcutConfig>
    getSystemInfo: () => Promise<{
      platform: string
      homedir: string
      user: string
    }>
    updateConfig: (updates: Partial<AppConfig>) => Promise<AppConfig>
    updateReadingConfig: (updates: Partial<ReadingConfig>) => Promise<ReadingConfig>
    updateShortcuts: (updates: Partial<ShortcutConfig>) => Promise<ShortcutConfig>
    addScanPath: (path: string) => Promise<AppConfig>
    removeScanPath: (path: string) => Promise<AppConfig>
    addFavoritePath: (path: string) => Promise<AppConfig>
    removeFavoritePath: (path: string) => Promise<AppConfig>
  }

  window: {
    toggleFullscreen: () => Promise<boolean>
    toggleAlwaysOnTop: () => Promise<boolean>
    isAlwaysOnTop: () => Promise<boolean>
    isFullscreen: () => Promise<boolean>
  }

  category: {
    getAll: () => Promise<Category[]>
    create: (name: string) => Promise<number>
    update: (id: number, name: string) => Promise<boolean>
    delete: (id: number) => Promise<boolean>
  }

  book: {
    getAll: () => Promise<Book[]>
    getById: (id: number) => Promise<Book | undefined>
    getByPath: (path: string) => Promise<Book | undefined>
    add: (filePath: string) => Promise<number>
    update: (id: number, updates: Partial<Book>) => Promise<Book | undefined>
    togglePin: (id: number) => Promise<boolean>
    delete: (id: number) => Promise<boolean>
    updateProgress: (bookId: number, page: number, position: number) => Promise<boolean>
    addReadingTime: (bookId: number, duration: number) => Promise<boolean>
    batchImport: (filePaths: string[]) => Promise<{ success: number[]; failed: string[] }>
    batchExport: (bookIds: number[]) => Promise<ExportBookData[]>
    exportJson: (data: ExportBookData[]) => Promise<boolean>
    importJson: () => Promise<{ success: boolean; importedIds?: number[]; error?: string }>
    updateSmartInfo: (bookId: number, updates: Partial<Book>) => Promise<Book | undefined>
  }

  bookmark: {
    getByBookId: (bookId: number) => Promise<Bookmark[]>
    add: (bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => Promise<number>
    delete: (id: number) => Promise<boolean>
  }

  progress: {
    getByBookId: (bookId: number, limit?: number) => Promise<ReadingProgress[]>
    add: (progress: Omit<ReadingProgress, 'id' | 'createdAt'>) => Promise<number>
  }

  file: {
    listDirectory: (dirPath: string) => Promise<FileInfo[]>
    scanBooks: (paths: string[]) => Promise<number[]>
    openDialog: () => Promise<number[]>
    openFolderDialog: () => Promise<string | null>
    detectEncoding: (filePath: string) => Promise<string>
    readText: (filePath: string, encoding?: string) => Promise<string>
    uploadBackground: () => Promise<string | null>
    uploadFont: () => Promise<{ path: string; name: string } | null>
  }

  reader: {
    openBook: (bookId: number, pageChars?: number) => Promise<{
      content: string
      chapters: any[]
      totalPages: number
      isLargeFile?: boolean
    }>
    getPage: (bookId: number, page: number) => Promise<PageContent | null>
    getFullContent: (bookId: number) => Promise<{
      content: string
      chapters: any[]
      isLargeFile?: boolean
    }>
    getChapterContent: (bookId: number, chapterIndex: number) => Promise<any>
    getChapters: (bookId: number) => Promise<any[]>
    search: (bookId: number, keyword: string) => Promise<SearchResult[]>
    splitVolume: (bookId: number, options: SplitVolumeOption) => Promise<{
      success: boolean
      count: number
      saveDir: string
    }>
    generateToc: (content: string) => Promise<any[]>
    smartGenerateToc: (content: string) => Promise<any[]>
    cleanText: (content: string, options?: any) => Promise<any>
    getSmartInfo: (bookId: number) => Promise<any>
    goToPercent: (bookId: number, percent: number) => Promise<PageContent | null>
    closeBook: (bookId: number) => Promise<boolean>
  }

  stats: {
    getByDate: (date: string) => Promise<any[]>
    getByBookId: (bookId: number, limit?: number) => Promise<any[]>
    getDateRange: (startDate: string, endDate: string) => Promise<any[]>
    addReading: (bookId: number, pagesRead: number, charactersRead: number, readingTime: number) => Promise<number>
    getDailyAverage: (days?: number) => Promise<number>
    getPagesPerMinute: (bookId: number) => Promise<number>
  }

  goals: {
    getAll: () => Promise<any[]>
    getActive: () => Promise<any | null>
    create: (goal: any) => Promise<number>
    updateProgress: (id: number, increment: number) => Promise<number>
    checkIn: (type: string) => Promise<{ success: boolean; streak: number }>
    delete: (id: number) => Promise<boolean>
  }

  theme: {
    getPresetThemes: () => Promise<any[]>
  }

  shell: {
    openExternal: (url: string) => Promise<boolean>
    showInFolder: (path: string) => Promise<boolean>
  }
}

const electronAPI: IElectronAPI = {
  app: {
    getConfig: () => ipcRenderer.invoke('app:getConfig'),
    getReadingConfig: () => ipcRenderer.invoke('app:getReadingConfig'),
    getShortcuts: () => ipcRenderer.invoke('app:getShortcuts'),
    getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),
    updateConfig: (updates) => ipcRenderer.invoke('app:updateConfig', updates),
    updateReadingConfig: (updates) => ipcRenderer.invoke('app:updateReadingConfig', updates),
    updateShortcuts: (updates) => ipcRenderer.invoke('app:updateShortcuts', updates),
    addScanPath: (path) => ipcRenderer.invoke('app:addScanPath', path),
    removeScanPath: (path) => ipcRenderer.invoke('app:removeScanPath', path),
    addFavoritePath: (path) => ipcRenderer.invoke('app:addFavoritePath', path),
    removeFavoritePath: (path) => ipcRenderer.invoke('app:removeFavoritePath', path)
  },

  window: {
    toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:isAlwaysOnTop'),
    isFullscreen: () => ipcRenderer.invoke('window:isFullscreen')
  },

  category: {
    getAll: () => ipcRenderer.invoke('category:getAll'),
    create: (name) => ipcRenderer.invoke('category:create', name),
    update: (id, name) => ipcRenderer.invoke('category:update', id, name),
    delete: (id) => ipcRenderer.invoke('category:delete', id)
  },

  book: {
    getAll: () => ipcRenderer.invoke('book:getAll'),
    getById: (id) => ipcRenderer.invoke('book:getById', id),
    getByPath: (path) => ipcRenderer.invoke('book:getByPath', path),
    add: (filePath) => ipcRenderer.invoke('book:add', filePath),
    update: (id, updates) => ipcRenderer.invoke('book:update', id, updates),
    togglePin: (id) => ipcRenderer.invoke('book:togglePin', id),
    delete: (id) => ipcRenderer.invoke('book:delete', id),
    updateProgress: (bookId, page, position) =>
      ipcRenderer.invoke('book:updateProgress', bookId, page, position),
    addReadingTime: (bookId, duration) =>
      ipcRenderer.invoke('book:addReadingTime', bookId, duration),
    batchImport: (filePaths) => ipcRenderer.invoke('book:batchImport', filePaths),
    batchExport: (bookIds) => ipcRenderer.invoke('book:batchExport', bookIds),
    exportJson: (data) => ipcRenderer.invoke('book:exportJson', data),
    importJson: () => ipcRenderer.invoke('book:importJson'),
    updateSmartInfo: (bookId, updates) => ipcRenderer.invoke('book:updateSmartInfo', bookId, updates)
  },

  bookmark: {
    getByBookId: (bookId) => ipcRenderer.invoke('bookmark:getByBookId', bookId),
    add: (bookmark) => ipcRenderer.invoke('bookmark:add', bookmark),
    delete: (id) => ipcRenderer.invoke('bookmark:delete', id)
  },

  progress: {
    getByBookId: (bookId, limit = 100) =>
      ipcRenderer.invoke('progress:getByBookId', bookId, limit),
    add: (progress) => ipcRenderer.invoke('progress:add', progress)
  },

  file: {
    listDirectory: (dirPath) => ipcRenderer.invoke('file:listDirectory', dirPath),
    scanBooks: (paths) => ipcRenderer.invoke('file:scanBooks', paths),
    openDialog: () => ipcRenderer.invoke('file:openDialog'),
    openFolderDialog: () => ipcRenderer.invoke('file:openFolderDialog'),
    detectEncoding: (filePath) => ipcRenderer.invoke('file:detectEncoding', filePath),
    readText: (filePath, encoding) => ipcRenderer.invoke('file:readText', filePath, encoding),
    uploadBackground: () => ipcRenderer.invoke('file:uploadBackground'),
    uploadFont: () => ipcRenderer.invoke('file:uploadFont')
  },

  reader: {
    openBook: (bookId, pageChars = 800) =>
      ipcRenderer.invoke('reader:openBook', bookId, pageChars),
    getPage: (bookId, page) =>
      ipcRenderer.invoke('reader:getPage', bookId, page),
    getFullContent: (bookId) =>
      ipcRenderer.invoke('reader:getFullContent', bookId),
    getChapterContent: (bookId, chapterIndex) =>
      ipcRenderer.invoke('reader:getChapterContent', bookId, chapterIndex),
    getChapters: (bookId) =>
      ipcRenderer.invoke('reader:getChapters', bookId),
    search: (bookId, keyword) =>
      ipcRenderer.invoke('reader:search', bookId, keyword),
    splitVolume: (bookId, options) =>
      ipcRenderer.invoke('reader:splitVolume', bookId, options),
    generateToc: (content) =>
      ipcRenderer.invoke('reader:generateToc', content),
    smartGenerateToc: (content) =>
      ipcRenderer.invoke('reader:smartGenerateToc', content),
    cleanText: (content, options) =>
      ipcRenderer.invoke('reader:cleanText', content, options),
    getSmartInfo: (bookId) =>
      ipcRenderer.invoke('reader:getSmartInfo', bookId),
    goToPercent: (bookId, percent) =>
      ipcRenderer.invoke('reader:goToPercent', bookId, percent),
    closeBook: (bookId) => ipcRenderer.invoke('reader:closeBook', bookId)
  },

  stats: {
    getByDate: (date) => ipcRenderer.invoke('stats:getByDate', date),
    getByBookId: (bookId, limit = 30) => ipcRenderer.invoke('stats:getByBookId', bookId, limit),
    getDateRange: (startDate, endDate) => ipcRenderer.invoke('stats:getDateRange', startDate, endDate),
    addReading: (bookId, pagesRead, charactersRead, readingTime) =>
      ipcRenderer.invoke('stats:addReading', bookId, pagesRead, charactersRead, readingTime),
    getDailyAverage: (days = 7) => ipcRenderer.invoke('stats:getDailyAverage', days),
    getPagesPerMinute: (bookId) => ipcRenderer.invoke('stats:getPagesPerMinute', bookId)
  },

  goals: {
    getAll: () => ipcRenderer.invoke('goals:getAll'),
    getActive: () => ipcRenderer.invoke('goals:getActive'),
    create: (goal) => ipcRenderer.invoke('goals:create', goal),
    updateProgress: (id, increment) => ipcRenderer.invoke('goals:updateProgress', id, increment),
    checkIn: (type) => ipcRenderer.invoke('goals:checkIn', type),
    delete: (id) => ipcRenderer.invoke('goals:delete', id)
  },

  theme: {
    getPresetThemes: () => ipcRenderer.invoke('theme:getPresetThemes')
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    showInFolder: (path) => ipcRenderer.invoke('shell:showInFolder', path)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
