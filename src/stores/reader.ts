import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Book, BookCache, Chapter, PageContent, Bookmark } from '@/types'

export const useReaderStore = defineStore('reader', () => {
  const book = ref<Book | null>(null)
  const cache = ref<BookCache | null>(null)
  const currentPage = ref(1)
  const currentPosition = ref(0)
  const currentChapter = ref<Chapter | null>(null)
  const currentContent = ref<PageContent | null>(null)
  const fullContent = ref<{ content: string; chapters: Chapter[] } | null>(null)
  const bookmarks = ref<Bookmark[]>([])
  const isLoading = ref(false)
  const showSidebar = ref(false)
  const sidebarTab = ref<'chapters' | 'bookmarks'>('chapters')

  const totalPages = computed(() => cache.value?.totalPages || 0)
  const chapters = computed(() => cache.value?.chapters || [])
  const progress = computed(() => {
    if (totalPages.value === 0) return 0
    return Math.round((currentPage.value / totalPages.value) * 100)
  })

  async function openBook(bookId: number, pageChars: number = 800) {
    try {
      isLoading.value = true
      currentPage.value = 1
      currentPosition.value = 0
      currentChapter.value = null
      currentContent.value = null
      fullContent.value = null

      const bookData = await window.electronAPI.book.getById(bookId)
      if (!bookData) throw new Error('书籍不存在')

      book.value = bookData

      const cacheData = await window.electronAPI.reader.openBook(bookId, pageChars)
      cache.value = cacheData

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
      currentContent.value = content
      currentPage.value = page
      currentPosition.value = content.startPosition

      const chapter = chapters.value.find(c =>
        content.startPosition >= c.startPosition && content.startPosition < c.endPosition
      )
      currentChapter.value = chapter || chapters.value[0] || null

      await window.electronAPI.book.updateProgress(book.value.id, page, content.startPosition)
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

  function closeBook() {
    if (book.value) {
      window.electronAPI.reader.closeBook(book.value.id)
    }
    book.value = null
    cache.value = null
    currentPage.value = 1
    currentPosition.value = 0
    currentChapter.value = null
    currentContent.value = null
    bookmarks.value = []
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
    totalPages,
    chapters,
    progress,
    openBook,
    loadFullContent,
    loadPage,
    nextPage,
    prevPage,
    goToPage,
    goToChapter,
    loadBookmarks,
    addBookmark,
    deleteBookmark,
    closeBook,
    toggleSidebar
  }
})
