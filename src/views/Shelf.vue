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
  Loading
} from '@element-plus/icons-vue'
import type { Book } from '@/types'

const router = useRouter()
const booksStore = useBooksStore()
const configStore = useConfigStore()

const searchKeyword = ref('')
const showAddMenu = ref(false)
const isScanning = ref(false)

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

onMounted(async () => {
  await booksStore.loadBooks()
  await booksStore.loadCategories()
})

async function handleAddFiles() {
  try {
    const bookIds = await window.electronAPI.file.openDialog()
    if (bookIds.length > 0) {
      ElMessage.success(`成功添加 ${bookIds.length} 本书籍`)
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
  } finally {
    isScanning.value = false
  }
}

async function handleContinueRead(book: Book) {
  router.push(`/reader/${book.id}`)
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
  ElMessage.info('编辑功能开发中')
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
        <el-button @click="openExplorer" :icon="FolderOpened">
          文件浏览
        </el-button>
        <el-dropdown trigger="click" @command="handleAddFiles">
          <el-button type="primary" :icon="Plus">
            添加书籍
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="files">
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
      </div>
    </header>

    <div class="shelf-content">
      <aside class="sidebar">
        <div class="sidebar-section">
          <h3 class="section-title">
            <el-icon><Folder /></el-icon>
            分类
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
                @click="handleContinueRead(book)"
              >
                <div class="book-cover">
                  <span class="cover-icon">{{ getFileIcon(book.fileType) }}</span>
                  <div class="book-badge pinned">
                    <el-icon :size="12"><Top /></el-icon>
                  </div>
                </div>
                <div class="book-info">
                  <h3 class="book-title" :title="book.title">{{ book.title }}</h3>
                  <p class="book-author">{{ book.author }}</p>
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
                @click="handleContinueRead(book)"
              >
                <div class="book-cover">
                  <span class="cover-icon">{{ getFileIcon(book.fileType) }}</span>
                </div>
                <div class="book-info">
                  <h3 class="book-title" :title="book.title">{{ book.title }}</h3>
                  <p class="book-author">{{ book.author }}</p>
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
      gap: 8px;
      padding: 0 16px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 8px;
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

      &:hover {
        background: var(--bg-secondary);
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
      }

      .category-count {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 10px;
        background: var(--bg-secondary);
        color: var(--text-tertiary);
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
    border: 1px solid var(--border-color);
    position: relative;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      border-color: var(--accent-color);
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
      left: 8px;
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
