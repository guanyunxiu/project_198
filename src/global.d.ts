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
} from './types'

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
  }

  shell: {
    openExternal: (url: string) => Promise<boolean>
    showInFolder: (path: string) => Promise<boolean>
  }
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}

export {}
