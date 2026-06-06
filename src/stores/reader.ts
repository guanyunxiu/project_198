import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Book, BookCache, Chapter, PageContent, Bookmark, SearchResult, SearchState, ReadingStats, ReadingGoalProgress, TextCleanupOptions, SmartChapterOptions, BookMetadata } from '@/types'
import { useConfigStore } from './config'

export const useReaderStore = defineStore('reader', () => {
  const configStore = useConfigStore()
  
  const book = ref<Book | null>(null)
  const cache = ref<BookCache | null>(null)
  const currentPage = ref(1)
  const currentPosition = ref(0)
  const currentChapter = ref<Chapter | null>(null)
  const currentContent = ref<PageContent | null>(null)
  const fullContent = ref<{ content: string; chapters: Chapter[]; isLargeFile?: boolean } | null>(null)
  const bookmarks = ref<Bookmark[]>([])
  const isLoading = ref(false)
  const showSidebar = ref(false)
  const sidebarTab = ref<'chapters' | 'bookmarks' | 'search' | 'stats'>('chapters')
  const isLargeFile = ref(false)
  
  const searchState = ref<SearchState>({
    keyword: '',
    results: [],
    currentIndex: -1,
    isSearching: false
  })
  
  const autoFlipTimer = ref<number | null>(null)
  const readingSessionStart = ref<number>(0)
  const pagesReadThisSession = ref(0)
  const readingStats = ref<ReadingStats[]>([])
  const goalProgress = ref<ReadingGoalProgress | null>(null)
  const bookMetadata = ref<BookMetadata | null>(null)
  const showStatsPanel = ref(false)
  const isDraggingProgress = ref(false)
  const dragProgressValue = ref(0)
  const gotoPercentageInput = ref('')
  const showGotoPercentage = ref(false)
  
  let pagesReadAtStart = 0

  const totalPages = computed(() => cache.value?.totalPages || 0)
  const chapters = computed(() => cache.value?.chapters || [])
  const progress = computed(() => {
    if (totalPages.value === 0) return 0
    return Math.round((currentPage.value / totalPages.value) * 100)
  })
  const searchResultsCount = computed(() => searchState.value.results.length)
  
  const readingSpeed = computed(() => {
    if (readingSessionStart.value === 0) return 0
    const elapsedMinutes = (Date.now() - readingSessionStart.value) / 60000
    if (elapsedMinutes < 1) return 0
    return Math.round(pagesReadThisSession.value / elapsedMinutes)
  })
  
  const currentReadingTime = computed(() => {
    if (readingSessionStart.value === 0) return 0
    return Math.floor((Date.now() - readingSessionStart.value) / 1000)
  })
  
  const isDoublePage = computed(() => configStore.isDoublePage)
  const isLandscape = computed(() => configStore.isLandscape)
  const autoFlipEnabled = computed(() => configStore.autoFlipActive && configStore.readingConfig?.autoFlipEnabled)
  const autoFlipSpeed = computed(() => configStore.readingConfig?.autoFlipSpeed || 3)
  const autoFlipInterval = computed(() => configStore.readingConfig?.autoFlipInterval || 5000)

  async function openBook(bookId: number, pageChars: number = 800) {
    try {
      isLoading.value = true
      currentPage.value = 1
      currentPosition.value = 0
      currentChapter.value = null
      currentContent.value = null
      fullContent.value = null
      isLargeFile.value = false
      pagesReadThisSession.value = 0
      resetSearch()

      const bookData = await window.electronAPI.book.getById(bookId)
      if (!bookData) throw new Error('书籍不存在')

      book.value = bookData
      pagesReadAtStart = bookData.lastReadPage || 0

      const cacheData = await window.electronAPI.reader.openBook(bookId, pageChars)
      cache.value = cacheData as BookCache
      isLargeFile.value = cacheData.isLargeFile || false

      if (bookData.lastReadPage > 0 && bookData.lastReadPage <= cacheData.totalPages) {
        currentPage.value = bookData.lastReadPage
      }

      readingSessionStart.value = Date.now()

      await loadBookmarks(bookId)
      await loadFullContent(bookId)
      await loadPage(currentPage.value)
      await loadReadingStats(bookId)
      await loadGoalProgress()
      await loadBookMetadata(bookId)
    } finally {
      isLoading.value = false
    }
  }

  async function loadFullContent(bookId: number) {
    try {
      fullContent.value = await window.electronAPI.reader.getFullContent(bookId)
    } catch (err) {
      console.error('Load full content error:', err)
    }
  }

  async function loadPage(page: number) {
    if (!book.value) return

    const oldPage = currentPage.value
    const content = await window.electronAPI.reader.getPage(book.value.id, page)
    if (content) {
      currentContent.value = content
      currentPage.value = page
      currentPosition.value = content.startPosition

      if (page > oldPage) {
        pagesReadThisSession.value += page - oldPage
      }

      const chapter = chapters.value.find(c =>
        content.startPosition >= c.startPosition && content.startPosition < c.endPosition
      )
      currentChapter.value = chapter || chapters.value[0] || null

      await window.electronAPI.book.updateProgress(book.value.id, page, content.startPosition)
    }
  }

  async function nextPage() {
    const step = isDoublePage.value ? 2 : 1
    if (currentPage.value + step <= totalPages.value) {
      await loadPage(currentPage.value + step)
    } else if (currentPage.value < totalPages.value) {
      await loadPage(totalPages.value)
    }
    resetAutoFlipTimer()
  }

  async function prevPage() {
    const step = isDoublePage.value ? 2 : 1
    if (currentPage.value - step >= 1) {
      await loadPage(currentPage.value - step)
    } else if (currentPage.value > 1) {
      await loadPage(1)
    }
    resetAutoFlipTimer()
  }

  async function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      await loadPage(page)
    }
    resetAutoFlipTimer()
  }

  async function goToPercentage(percentage: number) {
    if (percentage < 0) percentage = 0
    if (percentage > 100) percentage = 100
    const page = Math.max(1, Math.round((percentage / 100) * totalPages.value))
    await goToPage(page)
  }

  async function goToPercentageViaIPC(percentage: number) {
    if (!book.value) return
    const result = await window.electronAPI.reader.goToPercentage(book.value.id, percentage)
    if (result && result.page) {
      await loadPage(result.page)
    }
  }

  function startAutoFlip() {
    stopAutoFlip()
    if (autoFlipEnabled.value) {
      autoFlipTimer.value = window.setInterval(() => {
        if (currentPage.value < totalPages.value) {
          nextPage()
        } else {
          stopAutoFlip()
        }
      }, autoFlipInterval.value)
    }
  }

  function stopAutoFlip() {
    if (autoFlipTimer.value) {
      clearInterval(autoFlipTimer.value)
      autoFlipTimer.value = null
    }
  }

  function resetAutoFlipTimer() {
    if (autoFlipEnabled.value && autoFlipTimer.value) {
      startAutoFlip()
    }
  }

  async function toggleAutoFlip() {
    const enabled = await configStore.toggleAutoFlip()
    if (enabled) {
      startAutoFlip()
    } else {
      stopAutoFlip()
    }
    return enabled
  }

  async function loadReadingStats(bookId: number) {
    try {
      readingStats.value = await window.electronAPI.stats.getByBookId(bookId)
    } catch (err) {
      console.error('Load reading stats error:', err)
    }
  }

  async function loadGoalProgress() {
    try {
      goalProgress.value = await window.electronAPI.goal.getGoalProgress()
    } catch (err) {
      console.error('Load goal progress error:', err)
    }
  }

  async function loadBookMetadata(bookId: number) {
    try {
      bookMetadata.value = await window.electronAPI.book.getMetadata(bookId)
    } catch (err) {
      console.error('Load book metadata error:', err)
    }
  }

  async function extractMetadata() {
    if (!book.value) return null
    try {
      isLoading.value = true
      const metadata = await window.electronAPI.reader.extractMetadata(book.value.id)
      if (metadata) {
        bookMetadata.value = metadata
        if (book.value) {
          book.value = { ...book.value, ...metadata }
        }
      }
      return metadata
    } finally {
      isLoading.value = false
    }
  }

  async function cleanText(options: TextCleanupOptions) {
    if (!book.value) return null
    try {
      isLoading.value = true
      const result = await window.electronAPI.reader.cleanText(book.value.id, options)
      if (result?.success && book.value) {
        const savedPage = currentPage.value
        const bookId = book.value.id
        closeBook()
        await openBook(bookId, configStore.readingConfig?.pageChars || 800)
        await goToPage(savedPage)
      }
      return result
    } finally {
      isLoading.value = false
    }
  }

  async function analyzeTextQuality() {
    if (!book.value) return null
    try {
      isLoading.value = true
      return await window.electronAPI.reader.analyzeQuality(book.value.id)
    } finally {
      isLoading.value = false
    }
  }

  async function smartRechapters(options: SmartChapterOptions) {
    if (!book.value || book.value.fileType !== 'txt') return null
    try {
      isLoading.value = true
      const result = await window.electronAPI.reader.smartRechapters(book.value.id, options)
      if (result?.success && book.value) {
        const savedPage = currentPage.value
        const bookId = book.value.id
        closeBook()
        await openBook(bookId, configStore.readingConfig?.pageChars || 800)
        await goToPage(savedPage)
      }
      return result
    } finally {
      isLoading.value = false
    }
  }

  async function updateBookMetadata(metadata: Partial<BookMetadata>) {
    if (!book.value) return
    try {
      const updated = await window.electronAPI.book.updateMetadata(book.value.id, metadata)
      if (updated) {
        book.value = { ...book.value, ...updated }
        bookMetadata.value = { ...bookMetadata.value, ...updated } as BookMetadata
      }
      return updated
    } catch (err) {
      console.error('Update metadata error:', err)
    }
  }

  async function goToChapter(chapterIndex: number) {
    const chapter = chapters.value.find(c => c.index === chapterIndex)
    if (chapter && chapter.startPage > 0) {
      await loadPage(chapter.startPage)
    }
  }

  async function loadBookmarks(bookId: number) {
    bookmarks.value = await window.electronAPI.bookmark.getByBookId(bookId)
  }

  async function addBookmark(content: PageContent) {
    if (!book.value) return

    const id = await window.electronAPI.bookmark.add({
      bookId: book.value.id,
      page: content.page,
      position: content.startPosition,
      content: content.content.slice(0, 100),
      chapterTitle: content.chapterTitle
    })

    await loadBookmarks(book.value.id)
    return id
  }

  async function deleteBookmark(id: number) {
    await window.electronAPI.bookmark.delete(id)
    if (book.value) {
      await loadBookmarks(book.value.id)
    }
  }

  async function search(keyword: string) {
    if (!book.value || !keyword.trim()) {
      resetSearch()
      return
    }

    try {
      searchState.value.isSearching = true
      searchState.value.keyword = keyword
      searchState.value.results = await window.electronAPI.reader.search(book.value.id, keyword)
      searchState.value.currentIndex = searchState.value.results.length > 0 ? 0 : -1
    } finally {
      searchState.value.isSearching = false
    }
  }

  function resetSearch() {
    searchState.value = {
      keyword: '',
      results: [],
      currentIndex: -1,
      isSearching: false
    }
  }

  async function goToSearchResult(index: number) {
    if (index < 0 || index >= searchState.value.results.length) return
    
    const result = searchState.value.results[index]
    searchState.value.currentIndex = index
    await goToPage(result.page)
  }

  async function nextSearchResult() {
    if (searchState.value.results.length === 0) return
    
    const nextIndex = (searchState.value.currentIndex + 1) % searchState.value.results.length
    await goToSearchResult(nextIndex)
  }

  async function prevSearchResult() {
    if (searchState.value.results.length === 0) return
    
    const prevIndex = searchState.value.currentIndex <= 0 
      ? searchState.value.results.length - 1 
      : searchState.value.currentIndex - 1
    await goToSearchResult(prevIndex)
  }

  async function splitVolume(options: { volumeSize: number; unit: 'chars' | 'chapters' }) {
    if (!book.value) return null
    return await window.electronAPI.reader.splitVolume(book.value.id, options)
  }

  function highlightKeyword(content: string, keyword: string): string {
    if (!keyword.trim()) return content
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return content.replace(regex, '<mark class="search-highlight">$1</mark>')
  }

  async function closeBook() {
    if (book.value && readingSessionStart.value > 0) {
      stopAutoFlip()
      
      const sessionDuration = Math.floor((Date.now() - readingSessionStart.value) / 1000)
      const pagesRead = Math.max(0, currentPage.value - pagesReadAtStart)
      const charsRead = pagesRead * (configStore.readingConfig?.pageChars || 800)
      
      if (sessionDuration > 10 && pagesRead > 0) {
        try {
          await window.electronAPI.stats.recordSession({
            bookId: book.value.id,
            duration: sessionDuration,
            pagesRead,
            charactersRead: charsRead,
            startTime: readingSessionStart.value,
            endTime: Date.now()
          })
          await loadGoalProgress()
        } catch (err) {
          console.error('Record reading session error:', err)
        }
      }
      
      window.electronAPI.reader.closeBook(book.value.id)
    }
    
    book.value = null
    cache.value = null
    currentPage.value = 1
    currentPosition.value = 0
    currentChapter.value = null
    currentContent.value = null
    fullContent.value = null
    bookmarks.value = []
    isLargeFile.value = false
    readingSessionStart.value = 0
    pagesReadThisSession.value = 0
    readingStats.value = []
    goalProgress.value = null
    bookMetadata.value = null
    resetSearch()
  }

  function toggleSidebar() {
    showSidebar.value = !showSidebar.value
  }

  return {
    book,
    cache,
    currentPage,
    currentPosition,
    currentChapter,
    currentContent,
    fullContent,
    bookmarks,
    isLoading,
    showSidebar,
    sidebarTab,
    isLargeFile,
    searchState,
    totalPages,
    chapters,
    progress,
    searchResultsCount,
    autoFlipTimer,
    readingSessionStart,
    pagesReadThisSession,
    readingStats,
    goalProgress,
    bookMetadata,
    showStatsPanel,
    isDraggingProgress,
    dragProgressValue,
    gotoPercentageInput,
    showGotoPercentage,
    readingSpeed,
    currentReadingTime,
    isDoublePage,
    isLandscape,
    autoFlipEnabled,
    autoFlipSpeed,
    autoFlipInterval,
    openBook,
    loadFullContent,
    loadPage,
    nextPage,
    prevPage,
    goToPage,
    goToPercentage,
    goToPercentageViaIPC,
    goToChapter,
    startAutoFlip,
    stopAutoFlip,
    toggleAutoFlip,
    loadReadingStats,
    loadGoalProgress,
    loadBookMetadata,
    extractMetadata,
    cleanText,
    analyzeTextQuality,
    smartRechapters,
    updateBookMetadata,
    loadBookmarks,
    addBookmark,
    deleteBookmark,
    search,
    resetSearch,
    goToSearchResult,
    nextSearchResult,
    prevSearchResult,
    splitVolume,
    highlightKeyword,
    closeBook,
    toggleSidebar
  }
})
