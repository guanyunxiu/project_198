import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Book, Category } from '@/types'

export const useBooksStore = defineStore('books', () => {
  const books = ref<Book[]>([])
  const categories = ref<Category[]>([])
  const selectedCategory = ref<number | null>(null)
  const isLoading = ref(false)

  const filteredBooks = computed(() => {
    if (selectedCategory.value === null) {
      return books.value
    }
    return books.value.filter(book => book.categoryId === selectedCategory.value)
  })

  const pinnedBooks = computed(() =>
    filteredBooks.value.filter(book => book.isPinned === 1)
  )

  const unpinnedBooks = computed(() =>
    filteredBooks.value.filter(book => book.isPinned === 0)
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

  async function deleteBook(id: number) {
    await window.electronAPI.book.delete(id)
    await loadBooks()
  }

  async function togglePin(id: number) {
    await window.electronAPI.book.togglePin(id)
    await loadBooks()
  }

  async function updateBook(id: number, updates: Partial<Book>) {
    await window.electronAPI.book.update(id, updates)
    await loadBooks()
  }

  async function addCategory(name: string) {
    await window.electronAPI.category.create(name)
    await loadCategories()
  }

  async function deleteCategory(id: number) {
    await window.electronAPI.category.delete(id)
    await loadCategories()
  }

  function getBookById(id: number): Book | undefined {
    return books.value.find(b => b.id === id)
  }

  return {
    books,
    categories,
    selectedCategory,
    isLoading,
    filteredBooks,
    pinnedBooks,
    unpinnedBooks,
    loadBooks,
    loadCategories,
    addBooks,
    deleteBook,
    togglePin,
    updateBook,
    addCategory,
    deleteCategory,
    getBookById
  }
})
