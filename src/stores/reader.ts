import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Book, BookCache, Chapter, PageContent, Bookmark, SearchResult, SearchState, ReadingStats, ReadingGoal, BookSmartInfo } from '@/types'

export const useReaderStore = defineStore('reader', () => {
  const book = ref<Book | null>(null)
  const cache = ref<BookCache | null>(null)
  const currentPage = ref(1)
  const currentPosition = ref(0)
  const currentChapter = ref<Chapter | null>(null)
  const currentContent = ref<PageContent | null>(null)
  const nextPageContent = ref<PageContent | null>(null)
  const fullContent = ref<{ content: string; chapters: Chapter[]; isLargeFile?: boolean } | null>(null)
  const bookmarks = ref<Bookmark[]>([])
  const isLoading = ref(false)
  const showSidebar = ref(false)
  const sidebarTab = ref<'chapters' | 'bookmarks' | 'search' | 'stats'>('chapters')
  const isLargeFile = ref(false)
  const autoTurnEnabled = ref(false)
  const autoTurnSpeed = ref(30)
  const autoTurnTimer = ref<number | null>(null)
  const readingStartTime = ref(0)
  const pagesReadInSession = ref(0)
  const smartInfo = ref<BookSmartInfo | null>(null)
  const readingStats = ref<ReadingStats[]>([])
  const dailyGoal = ref<ReadingGoal | null>(null)
  const isDraggingProgress = ref(false)
  
  const searchState = ref<SearchState>({
    keyword: '',
    results: [],
    currentIndex: -1,
    isSearching: false
  })

  const totalPages = computed(() => cache.value?.totalPages || 0)
  const chapters = computed(() => cache.value?.chapters || [])
  const progress = computed(() => {
    if (totalPages.value === 0) return 0
    return Math.round((currentPage.value / totalPages.value) * 100)
  })
  const searchResultsCount = computed(() => searchState.value.results.length)

  async function openBook(bookId: number, pageChars: number = 800) {
    try {
      isLoading.value = true
      currentPage.value = 1
      currentPosition.value = 0
      currentChapter.value = null
      currentContent.value = null
      fullContent.value = null
      isLargeFile.value = false
      resetSearch()

      const bookData = await window.electronAPI.book.getById(bookId)
      if (!bookData) throw new Error('书籍不存在')

      book.value = bookData

      const cacheData = await window.electronAPI.reader.openBook(bookId, pageChars)
      cache.value = cacheData as BookCache
      isLargeFile.value = cacheData.isLargeFile || false

      if (bookData.lastReadPage > 0 && bookData.lastReadPage <= cacheData.totalPages) {
        currentPage.value = bookData.lastReadPage
      }

      await loadBookmarks(bookId)
      await loadFullContent(bookId)
      await loadPage(currentPage.value)
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

    const content = await window.electronAPI.reader.getPage(book.value.id, page)
    if (content) {
      if (currentContent.value && page !== currentPage.value) {
        pagesReadInSession.value++
        await recordReadingStats(1, content.endPosition - content.startPosition)
      }

      currentContent.value = content
      currentPage.value = page
      currentPosition.value = content.startPosition

      const chapter = chapters.value.find(c =>
        content.startPosition >= c.startPosition && content.startPosition < c.endPosition
      )
      currentChapter.value = chapter || chapters.value[0] || null

      await window.electronAPI.book.updateProgress(book.value.id, page, content.startPosition)

      if (currentPage.value < totalPages.value) {
        nextPageContent.value = await window.electronAPI.reader.getPage(book.value.id, page + 1)
      }
    }
  }

  async function loadNextPageForDouble() {
    if (!book.value) return
    if (currentPage.value + 1 <= totalPages.value) {
      nextPageContent.value = await window.electronAPI.reader.getPage(book.value.id, currentPage.value + 1)
    } else {
      nextPageContent.value = null
    }
  }

  async function nextPage() {
    if (currentPage.value < totalPages.value) {
      await loadPage(currentPage.value + 1)
    }
  }

  async function prevPage() {
    if (currentPage.value > 1) {
      await loadPage(currentPage.value - 1)
    }
  }

  async function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      await loadPage(page)
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

  async function goToPercent(percent: number) {
    if (!book.value) return
    const content = await window.electronAPI.reader.goToPercent(book.value.id, percent)
    if (content) {
      await loadPage(content.page)
    }
  }

  async function recordReadingStats(pages: number, characters: number) {
    if (!book.value) return
    const now = Date.now()
    const elapsed = readingStartTime.value > 0 ? Math.floor((now - readingStartTime.value) / 1000) : 0
    if (elapsed > 0) {
      await window.electronAPI.stats.addReading(book.value.id, pages, characters, elapsed)
    }
  }

  async function loadReadingStats() {
    if (!book.value) return
    readingStats.value = await window.electronAPI.stats.getByBookId(book.value.id, 30)
  }

  async function loadSmartInfo() {
    if (!book.value) return
    try {
      smartInfo.value = await window.electronAPI.reader.getSmartInfo(book.value.id)
    } catch (err) {
      console.error('Load smart info error:', err)
    }
  }

  function startAutoTurn(speed?: number) {
    if (speed !== undefined) {
      autoTurnSpeed.value = speed
    }
    autoTurnEnabled.value = true
    readingStartTime.value = Date.now()
    
    if (autoTurnTimer.value) {
      clearInterval(autoTurnTimer.value)
    }
    
    autoTurnTimer.value = window.setInterval(async () => {
      if (currentPage.value < totalPages.value) {
        await nextPage()
      } else {
        stopAutoTurn()
      }
    }, autoTurnSpeed.value * 1000)
  }

  function stopAutoTurn() {
    autoTurnEnabled.value = false
    if (autoTurnTimer.value) {
      clearInterval(autoTurnTimer.value)
      autoTurnTimer.value = null
    }
  }

  function setAutoTurnSpeed(speed: number) {
    autoTurnSpeed.value = speed
    if (autoTurnEnabled.value) {
      startAutoTurn()
    }
  }

  async function toggleAutoTurn() {
    if (autoTurnEnabled.value) {
      stopAutoTurn()
    } else {
      startAutoTurn()
    }
  }

  async function cleanText(options?: any) {
    if (!book.value || !fullContent.value) return null
    const result = await window.electronAPI.reader.cleanText(fullContent.value.content, options)
    return result
  }

  async function reparseChapters() {
    if (!book.value || !fullContent.value) return
    const newChapters = await window.electronAPI.reader.smartGenerateToc(fullContent.value.content)
    if (cache.value) {
      cache.value.chapters = newChapters
    }
  }

  async function checkInDaily() {
    const result = await window.electronAPI.goals.checkIn('daily')
    return result
  }

  function closeBook() {
    if (book.value) {
      if (readingStartTime.value > 0) {
        recordReadingStats(pagesReadInSession.value, 0)
      }
      window.electronAPI.reader.closeBook(book.value.id)
    }
    stopAutoTurn()
    book.value = null
    cache.value = null
    currentPage.value = 1
    currentPosition.value = 0
    currentChapter.value = null
    currentContent.value = null
    nextPageContent.value = null
    fullContent.value = null
    bookmarks.value = []
    isLargeFile.value = false
    pagesReadInSession.value = 0
    readingStartTime.value = 0
    smartInfo.value = null
    readingStats.value = []
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
    nextPageContent,
    fullContent,
    bookmarks,
    isLoading,
    showSidebar,
    sidebarTab,
    isLargeFile,
    autoTurnEnabled,
    autoTurnSpeed,
    pagesReadInSession,
    smartInfo,
    readingStats,
    dailyGoal,
    isDraggingProgress,
    searchState,
    totalPages,
    chapters,
    progress,
    searchResultsCount,
    openBook,
    loadFullContent,
    loadPage,
    loadNextPageForDouble,
    nextPage,
    prevPage,
    goToPage,
    goToChapter,
    goToPercent,
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
    startAutoTurn,
    stopAutoTurn,
    setAutoTurnSpeed,
    toggleAutoTurn,
    loadReadingStats,
    loadSmartInfo,
    cleanText,
    reparseChapters,
    checkInDaily,
    closeBook,
    toggleSidebar
  }
})
