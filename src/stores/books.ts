import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Book, Category, ExportBookData } from '@/types'

export const useBooksStore = defineStore('books', () => {
  const books = ref<Book[]>([])
  const categories = ref<Category[]>([])
  const selectedCategory = ref<number | null>(null)
  const selectedBooks = ref<Set<number>>(new Set())
  const isLoading = ref(false)
  const isBatchMode = ref(false)

  const filteredBooks = computed(() => {
    let booksList = books.value
    if (selectedCategory.value !== null) {
      booksList = booksList.filter(book => book.categoryId === selectedCategory.value)
    }
    return booksList
  })

  const pinnedBooks = computed(() =>
    filteredBooks.value.filter(book => book.isPinned === 1)
  )

  const unpinnedBooks = computed(() =>
    filteredBooks.value.filter(book => book.isPinned === 0)
  )

  const selectedBooksList = computed(() =>
    books.value.filter(book => selectedBooks.value.has(book.id))
  )

  async function loadBooks() {
    try {
      isLoading.value = true
      books.value = await window.electronAPI.book.getAll()
    } finally {
      isLoading.value = false
    }
  }

  async function loadCategories() {
    categories.value = await window.electronAPI.category.getAll()
  }

  async function addBooks(filePaths: string[]): Promise<number[]> {
    const ids: number[] = []
    for (const filePath of filePaths) {
      try {
        const id = await window.electronAPI.book.add(filePath)
        ids.push(id)
      } catch (err) {
        console.error('Add book failed:', err)
      }
    }
    await loadBooks()
    return ids
  }

  async function batchImport(filePaths: string[]) {
    const result = await window.electronAPI.book.batchImport(filePaths)
    await loadBooks()
    return result
  }

  async function batchExport(bookIds: number[]): Promise<ExportBookData[]> {
    return await window.electronAPI.book.batchExport(bookIds)
  }

  async function exportToJson(data: ExportBookData[]): Promise<boolean> {
    return await window.electronAPI.book.exportJson(data)
  }

  async function importFromJson(): Promise<{ success: boolean; importedIds?: number[]; error?: string }> {
    const result = await window.electronAPI.book.importJson()
    if (result.success) {
      await loadBooks()
    }
    return result
  }

  async function deleteBook(id: number) {
    await window.electronAPI.book.delete(id)
    selectedBooks.value.delete(id)
    await loadBooks()
  }

  async function togglePin(id: number) {
    await window.electronAPI.book.togglePin(id)
    await loadBooks()
  }

  async function updateBook(id: number, updates: Partial<Book>) {
    const result = await window.electronAPI.book.update(id, updates)
    await loadBooks()
    return result
  }

  async function updateBookNotes(id: number, notes: string) {
    return await updateBook(id, { notes })
  }

  async function updateBookCategory(id: number, categoryId: number | null) {
    return await updateBook(id, { categoryId })
  }

  async function addCategory(name: string) {
    await window.electronAPI.category.create(name)
    await loadCategories()
  }

  async function updateCategory(id: number, name: string) {
    await window.electronAPI.category.update(id, name)
    await loadCategories()
  }

  async function deleteCategory(id: number) {
    await window.electronAPI.category.delete(id)
    if (selectedCategory.value === id) {
      selectedCategory.value = null
    }
    await loadCategories()
    await loadBooks()
  }

  function toggleBookSelection(id: number) {
    if (selectedBooks.value.has(id)) {
      selectedBooks.value.delete(id)
    } else {
      selectedBooks.value.add(id)
    }
    selectedBooks.value = new Set(selectedBooks.value)
  }

  function selectAllBooks() {
    filteredBooks.value.forEach(book => selectedBooks.value.add(book.id))
    selectedBooks.value = new Set(selectedBooks.value)
  }

  function clearSelection() {
    selectedBooks.value.clear()
    selectedBooks.value = new Set()
  }

  function toggleBatchMode() {
    isBatchMode.value = !isBatchMode.value
    if (!isBatchMode.value) {
      clearSelection()
    }
  }

  async function batchDeleteSelected() {
    const ids = Array.from(selectedBooks.value)
    for (const id of ids) {
      await window.electronAPI.book.delete(id)
    }
    clearSelection()
    await loadBooks()
  }

  async function batchUpdateCategory(categoryId: number | null) {
    const ids = Array.from(selectedBooks.value)
    for (const id of ids) {
      await window.electronAPI.book.update(id, { categoryId })
    }
    await loadBooks()
  }

  function formatReadingTime(seconds: number): string {
    if (!seconds) return '0分钟'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    }
    return `${minutes}分钟`
  }

  function getBookById(id: number): Book | undefined {
    return books.value.find(b => b.id === id)
  }

  return {
    books,
    categories,
    selectedCategory,
    selectedBooks,
    isLoading,
    isBatchMode,
    filteredBooks,
    pinnedBooks,
    unpinnedBooks,
    selectedBooksList,
    loadBooks,
    loadCategories,
    addBooks,
    batchImport,
    batchExport,
    exportToJson,
    importFromJson,
    deleteBook,
    togglePin,
    updateBook,
    updateBookNotes,
    updateBookCategory,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleBookSelection,
    selectAllBooks,
    clearSelection,
    toggleBatchMode,
    batchDeleteSelected,
    batchUpdateCategory,
    formatReadingTime,
    getBookById
  }
})
