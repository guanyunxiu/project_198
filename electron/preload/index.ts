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
  ExportBookData,
  ThemeTemplate,
  TextCleanupOptions,
  SmartChapterOptions,
  BookMetadata,
  ReadingStats,
  ReadingGoal,
  ReadingGoalProgress
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
    getThemeTemplates: () => Promise<ThemeTemplate[]>
    applyThemeTemplate: (templateId: string) => Promise<ReadingConfig>
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
    updateMetadata: (bookId: number, metadata: { summary?: string; tags?: string; detectedAuthor?: string }) => Promise<boolean>
    getMetadata: (bookId: number) => Promise<BookMetadata | null>
    batchImport: (filePaths: string[]) => Promise<{ success: number[]; failed: string[] }>
    batchExport: (bookIds: number[]) => Promise<ExportBookData[]>
    exportJson: (data: ExportBookData[]) => Promise<boolean>
    importJson: () => Promise<{ success: boolean; importedIds?: number[]; error?: string }>
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

  stats: {
    getByBookId: (bookId: number, startDate?: string, endDate?: string) => Promise<ReadingStats[]>
    getByDateRange: (startDate: string, endDate: string) => Promise<ReadingStats[]>
    getDailyStats: (date: string) => Promise<ReadingStats[]>
    getDailyTotal: (date: string) => Promise<{ readTime: number; readPages: number; readCharacters: number }>
    getDailyAverages: (days?: number) => Promise<{ avgReadTime: number; avgReadPages: number; avgReadCharacters: number }>
    getAverageSpeed: (bookId?: number) => Promise<number>
    getReadingStreak: () => Promise<number>
    recordSession: (bookId: number, readTime: number, readPages: number, readChars: number) => Promise<boolean>
  }

  goal: {
    getActiveGoal: () => Promise<ReadingGoal | undefined>
    getAllGoals: () => Promise<ReadingGoal[]>
    getGoalProgress: () => Promise<ReadingGoalProgress | null>
    getDailyRecords: (days?: number) => Promise<any[]>
    create: (goal: Omit<ReadingGoal, 'id' | 'createdAt'>) => Promise<number>
    update: (id: number, updates: Partial<ReadingGoal>) => Promise<boolean>
    delete: (id: number) => Promise<boolean>
  }

  file: {
    listDirectory: (dirPath: string) => Promise<FileInfo[]>
    scanBooks: (paths: string[]) => Promise<number[]>
    openDialog: () => Promise<number[]>
    openFolderDialog: () => Promise<string | null>
    detectEncoding: (filePath: string) => Promise<string>
    readText: (filePath: string, encoding?: string) => Promise<string>
    selectImage: () => Promise<string | null>
    selectFont: () => Promise<string | null>
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
    closeBook: (bookId: number) => Promise<boolean>
    cleanText: (content: string, options?: TextCleanupOptions) => Promise<string>
    analyzeQuality: (content: string) => Promise<{
      hasGarbled: boolean
      garbledCount: number
      emptyLineRatio: number
      avgLineLength: number
      totalLines: number
    }>
    extractMetadata: (content: string, title: string) => Promise<BookMetadata>
    smartRechapters: (bookId: number, options?: SmartChapterOptions) => Promise<{
      chapters: any[]
      totalPages: number
    }>
    goToPercentage: (bookId: number, percentage: number) => Promise<number>
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
    removeFavoritePath: (path) => ipcRenderer.invoke('app:removeFavoritePath', path),
    getThemeTemplates: () => ipcRenderer.invoke('app:getThemeTemplates'),
    applyThemeTemplate: (templateId) => ipcRenderer.invoke('app:applyThemeTemplate', templateId)
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
    updateMetadata: (bookId, metadata) =>
      ipcRenderer.invoke('book:updateMetadata', bookId, metadata),
    getMetadata: (bookId) => ipcRenderer.invoke('book:getMetadata', bookId),
    batchImport: (filePaths) => ipcRenderer.invoke('book:batchImport', filePaths),
    batchExport: (bookIds) => ipcRenderer.invoke('book:batchExport', bookIds),
    exportJson: (data) => ipcRenderer.invoke('book:exportJson', data),
    importJson: () => ipcRenderer.invoke('book:importJson')
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

  stats: {
    getByBookId: (bookId, startDate, endDate) =>
      ipcRenderer.invoke('stats:getByBookId', bookId, startDate, endDate),
    getByDateRange: (startDate, endDate) =>
      ipcRenderer.invoke('stats:getByDateRange', startDate, endDate),
    getDailyStats: (date) => ipcRenderer.invoke('stats:getDailyStats', date),
    getDailyTotal: (date) => ipcRenderer.invoke('stats:getDailyTotal', date),
    getDailyAverages: (days = 7) => ipcRenderer.invoke('stats:getDailyAverages', days),
    getAverageSpeed: (bookId) => ipcRenderer.invoke('stats:getAverageSpeed', bookId),
    getReadingStreak: () => ipcRenderer.invoke('stats:getReadingStreak'),
    recordSession: (bookId, readTime, readPages, readChars) =>
      ipcRenderer.invoke('stats:recordSession', bookId, readTime, readPages, readChars)
  },

  goal: {
    getActiveGoal: () => ipcRenderer.invoke('goal:getActiveGoal'),
    getAllGoals: () => ipcRenderer.invoke('goal:getAllGoals'),
    getGoalProgress: () => ipcRenderer.invoke('goal:getGoalProgress'),
    getDailyRecords: (days = 7) => ipcRenderer.invoke('goal:getDailyRecords', days),
    create: (goal) => ipcRenderer.invoke('goal:create', goal),
    update: (id, updates) => ipcRenderer.invoke('goal:update', id, updates),
    delete: (id) => ipcRenderer.invoke('goal:delete', id)
  },

  file: {
    listDirectory: (dirPath) => ipcRenderer.invoke('file:listDirectory', dirPath),
    scanBooks: (paths) => ipcRenderer.invoke('file:scanBooks', paths),
    openDialog: () => ipcRenderer.invoke('file:openDialog'),
    openFolderDialog: () => ipcRenderer.invoke('file:openFolderDialog'),
    detectEncoding: (filePath) => ipcRenderer.invoke('file:detectEncoding', filePath),
    readText: (filePath, encoding) => ipcRenderer.invoke('file:readText', filePath, encoding),
    selectImage: () => ipcRenderer.invoke('file:selectImage'),
    selectFont: () => ipcRenderer.invoke('file:selectFont')
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
    closeBook: (bookId) => ipcRenderer.invoke('reader:closeBook', bookId),
    cleanText: (content, options) =>
      ipcRenderer.invoke('reader:cleanText', content, options),
    analyzeQuality: (content) =>
      ipcRenderer.invoke('reader:analyzeQuality', content),
    extractMetadata: (content, title) =>
      ipcRenderer.invoke('reader:extractMetadata', content, title),
    smartRechapters: (bookId, options) =>
      ipcRenderer.invoke('reader:smartRechapters', bookId, options),
    goToPercentage: (bookId, percentage) =>
      ipcRenderer.invoke('reader:goToPercentage', bookId, percentage)
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
