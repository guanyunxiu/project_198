import { contextBridge, ipcRenderer } from 'electron'
import type {
  Book,
  Category,
  Bookmark,
  ReadingProgress,
  AppConfig,
  ReadingConfig,
  FileInfo,
  PageContent
} from '../main/types'

export interface IElectronAPI {
  app: {
    getConfig: () => Promise<AppConfig>
    getReadingConfig: () => Promise<ReadingConfig>
    updateConfig: (updates: Partial<AppConfig>) => Promise<AppConfig>
    updateReadingConfig: (updates: Partial<ReadingConfig>) => Promise<ReadingConfig>
    addScanPath: (path: string) => Promise<AppConfig>
    removeScanPath: (path: string) => Promise<AppConfig>
    addFavoritePath: (path: string) => Promise<AppConfig>
    removeFavoritePath: (path: string) => Promise<AppConfig>
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
    }>
    getPage: (bookId: number, page: number, pageChars?: number) => Promise<PageContent | null>
    closeBook: (bookId: number) => Promise<boolean>
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
    updateConfig: (updates) => ipcRenderer.invoke('app:updateConfig', updates),
    updateReadingConfig: (updates) => ipcRenderer.invoke('app:updateReadingConfig', updates),
    addScanPath: (path) => ipcRenderer.invoke('app:addScanPath', path),
    removeScanPath: (path) => ipcRenderer.invoke('app:removeScanPath', path),
    addFavoritePath: (path) => ipcRenderer.invoke('app:addFavoritePath', path),
    removeFavoritePath: (path) => ipcRenderer.invoke('app:removeFavoritePath', path)
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
      ipcRenderer.invoke('book:updateProgress', bookId, page, position)
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
    readText: (filePath, encoding) => ipcRenderer.invoke('file:readText', filePath, encoding)
  },

  reader: {
    openBook: (bookId, pageChars = 800) =>
      ipcRenderer.invoke('reader:openBook', bookId, pageChars),
    getPage: (bookId, page, pageChars = 800) =>
      ipcRenderer.invoke('reader:getPage', bookId, page, pageChars),
    closeBook: (bookId) => ipcRenderer.invoke('reader:closeBook', bookId)
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
