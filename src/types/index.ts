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
  summary?: string
  tags?: string
  createdAt: number
  updatedAt: number
}

export interface ReadingStats {
  id: number
  bookId: number
  date: string
  pagesRead: number
  charactersRead: number
  readingTime: number
  createdAt: number
}

export interface ReadingGoal {
  id: number
  type: 'daily' | 'weekly' | 'monthly'
  target: number
  targetType: 'pages' | 'minutes' | 'chapters'
  current: number
  periodStart: number
  periodEnd: number
  isCompleted: number
  createdAt: number
}

export interface BookSmartInfo {
  summary: string
  author: string
  tags: string[]
  estimatedChapters: number
  wordCount: number
  detectedLanguage: string
}

export interface TextCleanResult {
  originalLength: number
  cleanedLength: number
  emptyLinesRemoved: number
  duplicateChapters: number[]
  garbledFixed: number
  content: string
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

export interface ThemeConfig {
  name: string
  displayName: string
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  borderColor: string
  accentColor: string
  readerBg: string
  readerText: string
  bgPrimaryRgb: string
}

export interface ReadingConfig {
  fontSize: number
  lineHeight: number
  letterSpacing: number
  pageMargin: number
  theme: 'light' | 'dark' | 'eye' | string
  readMode: 'scroll' | 'page'
  pageChars: number
  highlightColor: string
  customTheme?: string
  customBackground?: string
  backgroundOpacity: number
  customFont?: string
  fontFamily: string
  pageLayout: 'single' | 'double'
  orientation: 'portrait' | 'landscape'
  autoTurnSpeed: number
  autoTurnEnabled: boolean
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

export interface SearchState {
  keyword: string
  results: SearchResult[]
  currentIndex: number
  isSearching: boolean
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
  customThemes: ThemeConfig[]
  customFonts: string[]
  dailyReadingGoal: number
  weeklyReadingGoal: number
  enableSmartChapterDetection: boolean
  enableAutoCleanText: boolean
  enableGarbledFix: boolean
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

export interface BookCache {
  content: string
  chapters: Chapter[]
  totalPages: number
}

export interface ReaderState {
  book: Book | null
  cache: BookCache | null
  currentPage: number
  currentPosition: number
  currentChapter: Chapter | null
  bookmarks: Bookmark[]
  isLoading: boolean
}
