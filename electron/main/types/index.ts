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
  totalReadingTime: number
  notes: string
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
  highlightColor: string
}

export interface ShortcutConfig {
  nextPage: string
  prevPage: string
  addBookmark: string
  goBack: string
  toggleFullscreen: string
  toggleTheme: string
  toggleAlwaysOnTop: string
  search: string
  toggleSidebar: string
}

export interface SearchResult {
  page: number
  position: number
  chapterTitle: string
  content: string
  matchIndex: number
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
  isAlwaysOnTop: boolean
  rememberWindowSize: boolean
  rememberWindowPosition: boolean
  startFullscreen: boolean
  startMinimized: boolean
  shortcuts: ShortcutConfig
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

export interface SplitVolumeOption {
  volumeSize: number
  unit: 'chars' | 'chapters'
}

export interface ExportBookData {
  book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>
  bookmarks: Omit<Bookmark, 'id' | 'createdAt'>[]
  progress: ReadingProgress[]
}
