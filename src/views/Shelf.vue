<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useConfigStore } from '@/stores/config'
import { ElMessage, ElMessageBox, ElDropdown } from 'element-plus'
import {
  Plus,
  FolderOpened,
  Search,
  Setting,
  Top,
  Delete,
  Edit,
  MoreFilled,
  Files,
  Sort,
  Star,
  Clock,
  Folder,
  Loading,
  Check,
  Close,
  Download,
  Upload,
  Select,
  Document,
  Notebook,
  Timer
} from '@element-plus/icons-vue'
import type { Book, Category } from '@/types'

const router = useRouter()
const booksStore = useBooksStore()
const configStore = useConfigStore()

const searchKeyword = ref('')
const showAddMenu = ref(false)
const isScanning = ref(false)
const showEditBookDialog = ref(false)
const showEditCategoryDialog = ref(false)
const showAddCategoryDialog = ref(false)
const editingBook = ref<Book | null>(null)
const editingCategory = ref<Category | null>(null)
const newCategoryName = ref('')
const editBookForm = ref({
  title: '',
  author: '',
  notes: '',
  categoryId: null as number | null
})

const filteredBooks = computed(() => {
  let books = booksStore.filteredBooks
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    books = books.filter(
      book =>
        book.title.toLowerCase().includes(keyword) ||
        book.author.toLowerCase().includes(keyword)
    )
  }
  return books
})

const pinnedBooks = computed(() =>
  filteredBooks.value.filter(book => book.isPinned === 1)
)

const unpinnedBooks = computed(() =>
  filteredBooks.value.filter(book => book.isPinned === 0)
)

const selectedCount = computed(() => booksStore.selectedBooks.size)

onMounted(async () => {
  await booksStore.loadBooks()
  await booksStore.loadCategories()
})

async function handleAddFiles() {
  try {
    const bookIds = await window.electronAPI.file.openDialog()
    if (bookIds.length > 0) {
      ElMessage.success(`成功添加 ${bookIds.length} 本书籍`)
      await booksStore.loadBooks()
    }
  } catch (err) {
    ElMessage.error('添加书籍失败')
  }
}

async function handleScanFolder() {
  const folderPath = await window.electronAPI.file.openFolderDialog()
  if (!folderPath) return

  isScanning.value = true
  try {
    const bookIds = await window.electronAPI.file.scanBooks([folderPath])
    ElMessage.success(`扫描完成，找到 ${bookIds.length} 本书籍`)
    await configStore.addScanPath(folderPath)
    await booksStore.loadBooks()
  } finally {
    isScanning.value = false
  }
}

async function handleContinueRead(book: Book) {
  if (booksStore.isBatchMode) {
    booksStore.toggleBookSelection(book.id)
  } else {
    router.push(`/reader/${book.id}`)
  }
}

async function handleTogglePin(book: Book) {
  await booksStore.togglePin(book.id)
  ElMessage.success(book.isPinned ? '已取消置顶' : '已置顶')
}

async function handleDeleteBook(book: Book) {
  try {
    await ElMessageBox.confirm(
      `确定要删除《${book.title}》吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await booksStore.deleteBook(book.id)
    ElMessage.success('删除成功')
  } catch {
    // User cancelled
  }
}

function handleEditBook(book: Book) {
  editingBook.value = book
  editBookForm.value = {
    title: book.title,
    author: book.author,
    notes: book.notes || '',
    categoryId: book.categoryId
  }
  showEditBookDialog.value = true
}

async function saveEditBook() {
  if (!editingBook.value) return
  if (!editBookForm.value.title.trim()) {
    ElMessage.warning('书名不能为空')
    return
  }
  try {
    await booksStore.updateBook(editingBook.value.id, {
      title: editBookForm.value.title.trim(),
      author: editBookForm.value.author.trim(),
      notes: editBookForm.value.notes,
      categoryId: editBookForm.value.categoryId
    })
    ElMessage.success('保存成功')
    showEditBookDialog.value = false
    editingBook.value = null
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

function openSettings() {
  router.push('/settings')
}

function openExplorer() {
  router.push('/explorer')
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN')
}

function getFileIcon(type: string) {
  const icons: Record<string, string> = {
    txt: '📄',
    epub: '📖',
    pdf: '📕',
    chm: '📚'
  }
  return icons[type] || '📖'
}

function getProgressPercent(book: Book): number {
  if (book.totalPages === 0) return 0
  return Math.round((book.lastReadPage / book.totalPages) * 100)
}

function handleAddCategory() {
  newCategoryName.value = ''
  showAddCategoryDialog.value = true
}

async function saveAddCategory() {
  if (!newCategoryName.value.trim()) {
    ElMessage.warning('分类名称不能为空')
    return
  }
  try {
    await booksStore.addCategory(newCategoryName.value.trim())
    ElMessage.success('分类添加成功')
    showAddCategoryDialog.value = false
  } catch (err) {
    ElMessage.error('添加失败')
  }
}

function handleEditCategory(category: Category) {
  editingCategory.value = category
  newCategoryName.value = category.name
  showEditCategoryDialog.value = true
}

async function saveEditCategory() {
  if (!editingCategory.value || !newCategoryName.value.trim()) {
    ElMessage.warning('分类名称不能为空')
    return
  }
  try {
    await booksStore.updateCategory(editingCategory.value.id, newCategoryName.value.trim())
    ElMessage.success('分类更新成功')
    showEditCategoryDialog.value = false
    editingCategory.value = null
  } catch (err) {
    ElMessage.error('更新失败')
  }
}

async function handleDeleteCategory(category: Category) {
  try {
    await ElMessageBox.confirm(
      `确定要删除分类「${category.name}」吗？该分类下的书籍将移动到「全部」分类。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await booksStore.deleteCategory(category.id)
    ElMessage.success('删除成功')
  } catch {
    // User cancelled
  }
}

function toggleBatchMode() {
  booksStore.toggleBatchMode()
}

function handleSelect() {
  if (selectedCount.value === filteredBooks.value.length) {
    booksStore.clearSelection()
  } else {
    booksStore.selectAllBooks()
  }
}

async function handleBatchDelete() {
  if (selectedCount.value === 0) {
    ElMessage.warning('请先选择要删除的书籍')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedCount.value} 本书籍吗？`,
      '批量删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await booksStore.batchDeleteSelected()
    ElMessage.success('批量删除成功')
    booksStore.toggleBatchMode()
  } catch {
    // User cancelled
  }
}

async function handleBatchCategory(categoryId: number | null) {
  if (selectedCount.value === 0) {
    ElMessage.warning('请先选择要移动的书籍')
    return
  }
  await booksStore.batchUpdateCategory(categoryId)
  const categoryName = categoryId === null ? '全部' : booksStore.categories.find(c => c.id === categoryId)?.name || '全部'
  ElMessage.success(`已将 ${selectedCount.value} 本书籍移动到「${categoryName}」`)
}

async function handleExportJson() {
  if (selectedCount.value === 0) {
    ElMessage.warning('请先选择要导出的书籍')
    return
  }
  try {
    const bookIds = Array.from(booksStore.selectedBooks)
    const data = await booksStore.batchExport(bookIds)
    const success = await booksStore.exportToJson(data)
    if (success) {
      ElMessage.success(`成功导出 ${data.length} 本书籍数据`)
    }
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

async function handleImportJson() {
  try {
    const result = await booksStore.importFromJson()
    if (result.success) {
      ElMessage.success(`成功导入 ${result.importedIds?.length || 0} 本书籍`)
    } else {
      ElMessage.error(result.error || '导入失败')
    }
  } catch (err) {
    ElMessage.error('导入失败')
  }
}
</script>

<template>
  <div class="shelf-page">
    <header class="shelf-header">
      <div class="header-left">
        <h1 class="title">
          <span class="logo">📚</span>
          我的书架
        </h1>
      </div>

      <div class="header-center">
        <div class="search-box">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索书籍名称或作者..."
            :prefix-icon="Search"
            clearable
          />
        </div>
      </div>

      <div class="header-right">
        <template v-if="booksStore.isBatchMode">
          <span class="batch-info">已选择 {{ selectedCount }} 本</span>
          <el-button @click="handleSelect" :icon="Select">
            {{ selectedCount === filteredBooks.length ? '取消全选' : '全选' }}
          </el-button>
          <el-dropdown trigger="click">
            <el-button :icon="Folder">
              移动分类
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleBatchCategory(null)">
                  全部
                </el-dropdown-item>
                <el-dropdown-item
                  v-for="cat in booksStore.categories"
                  :key="cat.id"
                  @click="handleBatchCategory(cat.id)"
                >
                  {{ cat.name }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button type="danger" :icon="Delete" @click="handleBatchDelete">
            批量删除
          </el-button>
          <el-button :icon="Download" @click="handleExportJson">
            导出JSON
          </el-button>
          <el-button :icon="Close" @click="toggleBatchMode">
            取消
          </el-button>
        </template>
        <template v-else>
          <el-button @click="openExplorer" :icon="FolderOpened">
            文件浏览
          </el-button>
          <el-button :icon="Upload" @click="handleImportJson">
            导入JSON
          </el-button>
          <el-button :icon="Select" @click="toggleBatchMode">
            批量管理
          </el-button>
          <el-dropdown trigger="click">
            <el-button type="primary" :icon="Plus">
              添加书籍
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleAddFiles">
                  <el-icon><Files /></el-icon>
                  从文件添加
                </el-dropdown-item>
                <el-dropdown-item @click="handleScanFolder">
                  <el-icon><Folder /></el-icon>
                  扫描文件夹
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button circle :icon="Setting" @click="openSettings" />
        </template>
      </div>
    </header>

    <div class="shelf-content">
      <aside class="sidebar">
        <div class="sidebar-section">
          <h3 class="section-title">
            <el-icon><Folder /></el-icon>
            分类
            <el-button class="add-category-btn" link :icon="Plus" size="small" @click="handleAddCategory" />
          </h3>
          <div class="category-list">
            <div
              class="category-item"
              :class="{ active: booksStore.selectedCategory === null }"
              @click="booksStore.selectedCategory = null"
            >
              <span class="category-name">全部</span>
              <span class="category-count">{{ booksStore.books.length }}</span>
            </div>
            <div
              v-for="cat in booksStore.categories"
              :key="cat.id"
              class="category-item"
              :class="{ active: booksStore.selectedCategory === cat.id }"
              @click="booksStore.selectedCategory = cat.id"
            >
              <span class="category-name">{{ cat.name }}</span>
              <span class="category-count">
                {{ booksStore.books.filter(b => b.categoryId === cat.id).length }}
              </span>
              <div class="category-actions" @click.stop>
                <el-button link size="small" :icon="Edit" @click="handleEditCategory(cat)" />
                <el-button link size="small" :icon="Delete" @click="handleDeleteCategory(cat)" />
              </div>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <h3 class="section-title">
            <el-icon><Sort /></el-icon>
            快捷操作
          </h3>
          <div class="quick-actions">
            <div class="action-item" @click="handleAddFiles">
              <el-icon><Plus /></el-icon>
              <span>添加书籍</span>
            </div>
            <div class="action-item" @click="handleScanFolder">
              <el-icon><Search /></el-icon>
              <span>扫描全盘</span>
            </div>
            <div class="action-item" @click="openSettings">
              <el-icon><Setting /></el-icon>
              <span>阅读设置</span>
            </div>
            <div class="action-item" @click="toggleBatchMode">
              <el-icon><Select /></el-icon>
              <span>批量管理</span>
            </div>
            <div class="action-item" @click="handleImportJson">
              <el-icon><Upload /></el-icon>
              <span>导入数据</span>
            </div>
            <div class="action-item" @click="handleExportJson" v-if="filteredBooks.length > 0">
              <el-icon><Download /></el-icon>
              <span>导出数据</span>
            </div>
          </div>
        </div>
      </aside>

      <main class="books-area">
        <div v-if="isScanning" class="scanning-overlay">
          <el-icon class="loading-icon" :size="48"><Loading /></el-icon>
          <p>正在扫描书籍...</p>
        </div>

        <template v-else>
          <div v-if="pinnedBooks.length > 0" class="books-section">
            <h2 class="section-header">
              <el-icon><Star /></el-icon>
              置顶书籍
            </h2>
            <div class="books-grid">
              <div
                v-for="book in pinnedBooks"
                :key="book.id"
                class="book-card"
                :class="{ selected: booksStore.selectedBooks.has(book.id) }"
                @click="handleContinueRead(book)"
              >
                <div class="book-cover">
                  <span class="cover-icon">{{ getFileIcon(book.fileType) }}</span>
                  <div class="book-badge pinned">
                    <el-icon :size="12"><Top /></el-icon>
                  </div>
                  <div v-if="booksStore.isBatchMode" class="book-select" @click.stop="booksStore.toggleBookSelection(book.id)">
                    <el-icon v-if="booksStore.selectedBooks.has(book.id)" :size="16"><Check /></el-icon>
                  </div>
                </div>
                <div class="book-info">
                  <h3 class="book-title" :title="book.title">{{ book.title }}</h3>
                  <p class="book-author">{{ book.author }}</p>
                  <div class="book-meta">
                    <div class="meta-item" :title="'阅读时长：' + booksStore.formatReadingTime(book.totalReadingTime)">
                      <el-icon :size="12"><Timer /></el-icon>
                      <span>{{ booksStore.formatReadingTime(book.totalReadingTime) }}</span>
                    </div>
                    <div v-if="book.notes" class="meta-item notes-badge" :title="book.notes">
                      <el-icon :size="12"><Notebook /></el-icon>
                      <span>有备注</span>
                    </div>
                  </div>
                  <div class="book-progress">
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        :style="{ width: getProgressPercent(book) + '%' }"
                      />
                    </div>
                    <span class="progress-text">{{ getProgressPercent(book) }}%</span>
                  </div>
                </div>
                <div class="book-actions" @click.stop>
                  <el-dropdown trigger="click">
                    <el-button circle size="small" :icon="MoreFilled" />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="handleTogglePin(book)">
                          <el-icon><Top /></el-icon>
                          取消置顶
                        </el-dropdown-item>
                        <el-dropdown-item @click="handleEditBook(book)">
                          <el-icon><Edit /></el-icon>
                          编辑信息
                        </el-dropdown-item>
                        <el-dropdown-item divided @click="handleDeleteBook(book)">
                          <el-icon><Delete /></el-icon>
                          删除
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </div>

          <div class="books-section">
            <h2 class="section-header">
              <el-icon><Clock /></el-icon>
              全部书籍
            </h2>
            <div v-if="unpinnedBooks.length === 0 && pinnedBooks.length === 0" class="empty-state">
              <div class="empty-icon">📖</div>
              <h3>书架空空如也</h3>
              <p>点击"添加书籍"开始你的阅读之旅</p>
              <el-button type="primary" :icon="Plus" @click="handleAddFiles">
                添加书籍
              </el-button>
            </div>
            <div v-else class="books-grid">
              <div
                v-for="book in unpinnedBooks"
                :key="book.id"
                class="book-card"
                :class="{ selected: booksStore.selectedBooks.has(book.id) }"
                @click="handleContinueRead(book)"
              >
                <div class="book-cover">
                  <span class="cover-icon">{{ getFileIcon(book.fileType) }}</span>
                  <div v-if="booksStore.isBatchMode" class="book-select" @click.stop="booksStore.toggleBookSelection(book.id)">
                    <el-icon v-if="booksStore.selectedBooks.has(book.id)" :size="16"><Check /></el-icon>
                  </div>
                </div>
                <div class="book-info">
                  <h3 class="book-title" :title="book.title">{{ book.title }}</h3>
                  <p class="book-author">{{ book.author }}</p>
                  <div class="book-meta">
                    <div class="meta-item" :title="'阅读时长：' + booksStore.formatReadingTime(book.totalReadingTime)">
                      <el-icon :size="12"><Timer /></el-icon>
                      <span>{{ booksStore.formatReadingTime(book.totalReadingTime) }}</span>
                    </div>
                    <div v-if="book.notes" class="meta-item notes-badge" :title="book.notes">
                      <el-icon :size="12"><Notebook /></el-icon>
                      <span>有备注</span>
                    </div>
                  </div>
                  <div class="book-progress">
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        :style="{ width: getProgressPercent(book) + '%' }"
                      />
                    </div>
                    <span class="progress-text">{{ getProgressPercent(book) }}%</span>
                  </div>
                </div>
                <div class="book-actions" @click.stop>
                  <el-dropdown trigger="click">
                    <el-button circle size="small" :icon="MoreFilled" />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="handleTogglePin(book)">
                          <el-icon><Top /></el-icon>
                          置顶
                        </el-dropdown-item>
                        <el-dropdown-item @click="handleEditBook(book)">
                          <el-icon><Edit /></el-icon>
                          编辑信息
                        </el-dropdown-item>
                        <el-dropdown-item divided @click="handleDeleteBook(book)">
                          <el-icon><Delete /></el-icon>
                          删除
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>

    <el-dialog
      v-model="showEditBookDialog"
      title="编辑书籍信息"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="editBookForm" label-width="80px">
        <el-form-item label="书名">
          <el-input v-model="editBookForm.title" placeholder="请输入书名" />
        </el-form-item>
        <el-form-item label="作者">
          <el-input v-model="editBookForm.author" placeholder="请输入作者" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editBookForm.categoryId" placeholder="选择分类" style="width: 100%">
            <el-option :value="null" label="全部" />
            <el-option
              v-for="cat in booksStore.categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="editBookForm.notes"
            type="textarea"
            :rows="4"
            placeholder="添加阅读笔记或备注..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditBookDialog = false">取消</el-button>
        <el-button type="primary" @click="saveEditBook">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showAddCategoryDialog"
      title="添加分类"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="分类名称">
          <el-input v-model="newCategoryName" placeholder="请输入分类名称" @keyup.enter="saveAddCategory" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddCategoryDialog = false">取消</el-button>
        <el-button type="primary" @click="saveAddCategory">添加</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showEditCategoryDialog"
      title="编辑分类"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="分类名称">
          <el-input v-model="newCategoryName" placeholder="请输入分类名称" @keyup.enter="saveEditCategory" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditCategoryDialog = false">取消</el-button>
        <el-button type="primary" @click="saveEditCategory">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.shelf-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.shelf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);

  .header-left {
    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 24px;
      font-weight: 600;
      margin: 0;
      color: var(--text-primary);

      .logo {
        font-size: 28px;
      }
    }
  }

  .header-center {
    flex: 1;
    max-width: 500px;
    margin: 0 24px;

    .search-box {
      width: 100%;
    }
  }

  .header-right {
    display: flex;
    gap: 12px;
    align-items: center;

    .batch-info {
      color: var(--text-secondary);
      font-size: 14px;
      margin-right: 8px;
    }
  }
}

.shelf-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 240px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  padding: 16px 0;

  .sidebar-section {
    margin-bottom: 24px;

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 16px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 8px;

      .add-category-btn {
        padding: 0;
      }
    }
  }

  .category-list {
    .category-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;

      &:hover {
        background: var(--bg-secondary);

        .category-actions {
          opacity: 1;
        }
      }

      &.active {
        background: var(--accent-color);
        color: white;

        .category-count {
          background: rgba(255, 255, 255, 0.3);
          color: white;
        }
      }

      .category-name {
        font-size: 14px;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .category-count {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 10px;
        background: var(--bg-secondary);
        color: var(--text-tertiary);
        min-width: 24px;
        text-align: center;
      }

      .category-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s;
        margin-left: 8px;
      }
    }
  }

  .quick-actions {
    .action-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-primary);

      &:hover {
        background: var(--bg-secondary);
        color: var(--accent-color);
      }

      el-icon {
        font-size: 18px;
      }

      span {
        font-size: 14px;
      }
    }
  }
}

.books-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  position: relative;

  .scanning-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    z-index: 10;

    .loading-icon {
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .books-section {
    margin-bottom: 32px;

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
    }
  }

  .books-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 20px;
  }

  .book-card {
    background: var(--bg-primary);
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
    position: relative;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      border-color: var(--accent-color);
    }

    &.selected {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.3);
    }

    .book-cover {
      aspect-ratio: 3 / 4;
      background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;

      .cover-icon {
        font-size: 64px;
      }

      .book-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--accent-color);

        &.pinned {
          background: #ffd700;
          color: #8b6914;
        }
      }

      .book-select {
        position: absolute;
        top: 8px;
        left: 8px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--accent-color);
        border: 2px solid var(--accent-color);
        cursor: pointer;
      }
    }

    .book-info {
      padding: 12px;

      .book-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .book-author {
        font-size: 12px;
        color: var(--text-tertiary);
        margin: 0 0 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .book-meta {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
        flex-wrap: wrap;

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-tertiary);
          background: var(--bg-secondary);
          padding: 2px 6px;
          border-radius: 4px;

          &.notes-badge {
            color: var(--accent-color);
          }
        }
      }

      .book-progress {
        display: flex;
        align-items: center;
        gap: 8px;

        .progress-bar {
          flex: 1;
          height: 4px;
          background: var(--bg-secondary);
          border-radius: 2px;
          overflow: hidden;

          .progress-fill {
            height: 100%;
            background: var(--accent-color);
            border-radius: 2px;
            transition: width 0.3s;
          }
        }

        .progress-text {
          font-size: 11px;
          color: var(--text-tertiary);
          min-width: 32px;
          text-align: right;
        }
      }
    }

    .book-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    &:hover .book-actions {
      opacity: 1;
    }
  }

  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--text-secondary);

    .empty-icon {
      font-size: 80px;
      margin-bottom: 16px;
    }

    h3 {
      font-size: 20px;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    p {
      margin-bottom: 24px;
    }
  }
}
</style>
