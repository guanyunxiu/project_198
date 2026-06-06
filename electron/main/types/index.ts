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
  summary: string
  tags: string
  detectedAuthor: string
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
  theme: 'light' | 'dark' | 'eye' | 'custom'
  readMode: 'scroll' | 'page'
  pageChars: number
  highlightColor: string
  backgroundImage: string | null
  customFont: string | null
  customFontPath: string | null
  pageLayout: 'single' | 'double'
  orientation: 'portrait' | 'landscape'
  opacity: number
  autoFlipEnabled: boolean
  autoFlipSpeed: number
  autoFlipInterval: number
  themeTemplate: string
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
  toggleAutoFlip: string
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
  wordCount?: number
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

export interface ThemeTemplate {
  id: string
  name: string
  bgColor: string
  textColor: string
  accentColor: string
  secondaryBg: string
  borderColor: string
  preview: string
}

export interface ReadingStats {
  id?: number
  bookId: number
  date: string
  readTime: number
  readPages: number
  readCharacters: number
  readingSpeed: number
  createdAt: number
}

export interface ReadingGoal {
  id: number
  dailyTarget: number
  targetUnit: 'pages' | 'minutes' | 'characters'
  startDate: number
  endDate: number
  isActive: number
  createdAt: number
}

export interface DailyReadingRecord {
  date: string
  readTime: number
  readPages: number
  readCharacters: number
  targetReached: number
}

export interface ReadingGoalProgress {
  goal: ReadingGoal
  current: number
  target: number
  percentage: number
  streak: number
  records: DailyReadingRecord[]
}

export interface TextCleanupOptions {
  removeDuplicateChapters: boolean
  removeEmptyLines: boolean
  fixGarbledText: boolean
  normalizePunctuation: boolean
  removeExtraSpaces: boolean
}

export interface SmartChapterOptions {
  enableSmartSegmentation: boolean
  minChapterLength: number
  mergeShortChapters: boolean
  autoDetectTitlePatterns: boolean
}

export interface BookMetadata {
  title: string
  author: string
  summary: string
  tags: string[]
  wordCount: number
  chapterCount: number
}
