export interface Book {
  id: number
  title: string
  author: string
  filePath: string
  fileType: 'txt' | 'epub' | 'pdf' | 'chm'
  coverPath: string | null
  encoding: string
  totalPages: number
  totalCharacters: number
  categoryId: number | null
  isPinned: number
  lastReadPage: number
  lastReadPosition: number
  lastReadTime: number
  createdAt: number
  updatedAt: number
}

export interface Category {
  id: number
  name: string
  createdAt: number
}

export interface Bookmark {
  id: number
  bookId: number
  page: number
  position: number
  content: string
  chapterTitle: string
  createdAt: number
}

export interface ReadingProgress {
  id: number
  bookId: number
  page: number
  position: number
  chapterIndex: number
  readTime: number
  createdAt: number
}

export interface ReadingConfig {
  fontSize: number
  lineHeight: number
  letterSpacing: number
  pageMargin: number
  theme: 'light' | 'dark' | 'eye'
  readMode: 'scroll' | 'page'
  pageChars: number
}

export interface AppConfig {
  defaultEncoding: string
  autoDetectEncoding: boolean
  scanPaths: string[]
  favoritePaths: string[]
  windowWidth: number
  windowHeight: number
  windowX: number | null
  windowY: number | null
  isMaximized: boolean
  readingConfig: ReadingConfig
}

export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  extension: string
  createdAt: number
  updatedAt: number
}

export interface Chapter {
  index: number
  title: string
  startPosition: number
  endPosition: number
  startPage: number
}

export interface PageContent {
  page: number
  content: string
  chapterTitle: string
  chapterIndex: number
  startPosition: number
  endPosition: number
}
