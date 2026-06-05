<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReaderStore } from '@/stores/reader'
import { useConfigStore } from '@/stores/config'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  List,
  Star,
  Sunny,
  MoonNight,
  CaretBottom,
  Plus,
  Minus,
  Back,
  FullScreen,
  Setting,
  Menu as MenuIcon,
  Grid
} from '@element-plus/icons-vue'
import type { Bookmark as BookmarkType } from '@/types'

const route = useRoute()
const router = useRouter()
const readerStore = useReaderStore()
const configStore = useConfigStore()

const showSettingsPanel = ref(false)
const showFullscreen = ref(false)
const showChapterInput = ref(false)
const gotoPageInput = ref('')

const readingConfig = computed(() => configStore.readingConfig!)
const contentStyle = computed(() => {
  if (!readingConfig.value) return {}
  return {
    fontSize: readingConfig.value.fontSize + 'px',
    lineHeight: readingConfig.value.lineHeight,
    letterSpacing: readingConfig.value.letterSpacing + 'px',
    padding: readingConfig.value.pageMargin + 'px'
  }
})

onMounted(async () => {
  const bookId = Number(route.params.bookId)
  if (bookId) {
    try {
      const pageChars = readingConfig.value?.pageChars || 800
      await readerStore.openBook(bookId, pageChars)
      document.addEventListener('keydown', handleKeydown)
    } catch (err) {
      console.error('Open book error:', err)
      ElMessage.error('打开书籍失败')
      router.push('/')
    }
  }

  nextTick(() => {
    window.addEventListener('wheel', handleWheel, { passive: false })
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('wheel', handleWheel)
  readerStore.closeBook()
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault()
    readerStore.nextPage()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    readerStore.prevPage()
  } else if (e.key === 'Escape') {
    router.push('/')
  } else if (e.key === 'b' || e.key === 'B') {
    handleAddBookmark()
  }
}

let wheelLock = false
function handleWheel(e: WheelEvent) {
  if (readingConfig.value?.readMode !== 'page') return

  if (wheelLock) return

  if (Math.abs(e.deltaY) > 30) {
    wheelLock = true
    if (e.deltaY > 0) {
      readerStore.nextPage()
    } else {
      readerStore.prevPage()
    }
    setTimeout(() => {
      wheelLock = false
    }, 300)
  }
}

async function handlePrevPage() {
  await readerStore.prevPage()
}

async function handleNextPage() {
  await readerStore.nextPage()
}

async function handleGotoPage() {
  const page = parseInt(gotoPageInput.value)
  if (page >= 1 && page <= readerStore.totalPages) {
    await readerStore.goToPage(page)
    showChapterInput.value = false
  } else {
    ElMessage.error(`请输入1-${readerStore.totalPages}之间的页码`)
  }
}

async function handleChapterClick(chapterIndex: number) {
  await readerStore.goToChapter(chapterIndex)
  readerStore.showSidebar = false
}

async function handleAddBookmark() {
  if (!readerStore.currentContent) return
  await readerStore.addBookmark(readerStore.currentContent)
  ElMessage.success('已添加书签')
}

async function handleDeleteBookmark(bookmark: BookmarkType) {
  try {
    await ElMessageBox.confirm('确定要删除这个书签吗？', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await readerStore.deleteBookmark(bookmark.id)
    ElMessage.success('删除成功')
  } catch {
    // User cancelled
  }
}

async function handleGotoBookmark(bookmark: BookmarkType) {
  await readerStore.goToPage(bookmark.page)
  readerStore.showSidebar = false
}

function goBack() {
  router.push('/')
}

function toggleTheme() {
  if (!readingConfig.value) return
  const themes: Array<'light' | 'dark' | 'eye'> = ['light', 'dark', 'eye']
  const currentIndex = themes.indexOf(readingConfig.value.theme)
  const nextTheme = themes[(currentIndex + 1) % themes.length]
  configStore.updateReadingConfig({ theme: nextTheme })
}

function toggleReadMode() {
  if (!readingConfig.value) return
  const nextMode = readingConfig.value.readMode === 'scroll' ? 'page' : 'scroll'
  configStore.updateReadingConfig({ readMode: nextMode })
}

function adjustFontSize(delta: number) {
  if (!readingConfig.value) return
  const newSize = Math.min(48, Math.max(12, readingConfig.value.fontSize + delta))
  configStore.updateReadingConfig({ fontSize: newSize })
}

function adjustLineHeight(delta: number) {
  if (!readingConfig.value) return
  const newHeight = Math.min(4, Math.max(1.2, readingConfig.value.lineHeight + delta))
  configStore.updateReadingConfig({ lineHeight: newHeight })
}

function adjustPageMargin(delta: number) {
  if (!readingConfig.value) return
  const newMargin = Math.min(200, Math.max(10, readingConfig.value.pageMargin + delta))
  configStore.updateReadingConfig({ pageMargin: newMargin })
}

function formatReadTime(timestamp: number): string {
  if (!timestamp) return '暂无阅读记录'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

watch(
  () => readingConfig.value?.pageChars,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && readerStore.book && newVal) {
      const currentPage = readerStore.currentPage
      readerStore.closeBook()
      await readerStore.openBook(readerStore.book.id, newVal)
    }
  }
)
</script>

<template>
  <div class="reader-page" v-loading="readerStore.isLoading">
    <div class="reader-container" :class="`theme-${readingConfig?.theme}`">
      <header class="reader-header glass-effect">
        <div class="header-left">
          <el-button circle :icon="Back" @click="goBack" />
          <div class="book-info">
            <h2 class="book-title">{{ readerStore.book?.title }}</h2>
            <p class="chapter-title">{{ readerStore.currentChapter?.title }}</p>
          </div>
        </div>

        <div class="header-center">
          <div class="page-nav" @click="showChapterInput = !showChapterInput">
            <span class="current-page">{{ readerStore.currentPage }}</span>
            <span class="divider">/</span>
            <span class="total-pages">{{ readerStore.totalPages }}</span>
            <el-icon><CaretBottom /></el-icon>
          </div>
          <div v-if="showChapterInput" class="goto-page-popover">
            <el-input
              v-model="gotoPageInput"
              placeholder="输入页码"
              @keyup.enter="handleGotoPage"
            />
            <el-button type="primary" @click="handleGotoPage">跳转</el-button>
          </div>
        </div>

        <div class="header-right">
          <el-button circle :icon="List" @click="readerStore.showSidebar = !readerStore.showSidebar" />
          <el-button circle :icon="Star" @click="handleAddBookmark" />
          <el-button circle :icon="readingConfig?.theme === 'dark' ? Sunny : MoonNight" @click="toggleTheme" />
          <el-button circle :icon="Setting" @click="showSettingsPanel = !showSettingsPanel" />
        </div>
      </header>

      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: readerStore.progress + '%' }" />
        <span class="progress-text">{{ readerStore.progress }}%</span>
      </div>

      <main class="reader-content-area">
        <div
          v-if="readingConfig?.readMode === 'scroll'"
          class="reader-scroll-mode"
        >
          <div class="reader-content" :style="contentStyle">
            <template v-if="readerStore.fullContent">
              <template v-for="chapter in readerStore.fullContent.chapters" :key="chapter.index">
                <h3 class="chapter-heading" :id="'chapter-' + chapter.index">
                  {{ chapter.title }}
                </h3>
                <p
                  v-for="(para, idx) in readerStore.fullContent.content.slice(chapter.startPosition, chapter.endPosition).split('\n')"
                  :key="idx"
                  class="paragraph"
                >
                  {{ para }}
                </p>
              </template>
            </template>
            <template v-else-if="readerStore.currentContent">
              <h3 class="chapter-heading">{{ readerStore.currentContent.chapterTitle }}</h3>
              <p
                v-for="(para, idx) in readerStore.currentContent.content.split('\n')"
                :key="idx"
                class="paragraph"
              >
                {{ para }}
              </p>
            </template>
          </div>
        </div>

        <div
          v-else
          class="reader-page-mode"
          @click.self="handleNextPage"
        >
          <div class="reader-content page-content" :style="contentStyle">
            <div v-if="readerStore.currentContent">
              <h3 class="chapter-heading">{{ readerStore.currentContent.chapterTitle }}</h3>
              <p
                v-for="(para, idx) in readerStore.currentContent.content.split('\n')"
                :key="idx"
                class="paragraph"
              >
                {{ para }}
              </p>
            </div>
          </div>
        </div>
      </main>

      <div v-if="readingConfig?.readMode === 'page'" class="reader-footer glass-effect">
        <el-button
          :icon="ArrowLeft"
          @click="handlePrevPage"
          :disabled="readerStore.currentPage <= 1"
        >
          上一页
        </el-button>

        <span class="page-info">
          第 {{ readerStore.currentPage }} 页 / 共 {{ readerStore.totalPages }} 页
        </span>

        <el-button
          :icon="ArrowRight"
          @click="handleNextPage"
          :disabled="readerStore.currentPage >= readerStore.totalPages"
        >
          下一页
        </el-button>
      </div>

      <el-drawer
        v-model="readerStore.showSidebar"
        direction="ltr"
        size="320px"
        :with-header="false"
      >
        <div class="sidebar-drawer">
          <div class="drawer-header">
            <el-tabs v-model="readerStore.sidebarTab" class="full-width">
              <el-tab-pane label="章节目录" name="chapters">
                <el-icon><List /></el-icon>
              </el-tab-pane>
              <el-tab-pane label="书签" name="bookmarks">
                <el-icon><Star /></el-icon>
              </el-tab-pane>
            </el-tabs>
          </div>

          <div class="drawer-content">
            <div v-if="readerStore.sidebarTab === 'chapters'" class="chapter-list">
              <div
                v-for="chapter in readerStore.chapters"
                :key="chapter.index"
                class="chapter-item"
                :class="{
                  active: readerStore.currentChapter?.index === chapter.index
                }"
                @click="handleChapterClick(chapter.index)"
              >
                <span class="chapter-name">{{ chapter.title }}</span>
              </div>
            </div>

            <div v-else class="bookmark-list">
              <div v-if="readerStore.bookmarks.length === 0" class="empty-bookmarks">
                <div class="empty-icon">🔖</div>
                <p>暂无书签</p>
                <p class="hint">按 B 键快速添加书签</p>
              </div>
              <div
                v-for="bookmark in readerStore.bookmarks"
                :key="bookmark.id"
                class="bookmark-item"
              >
                <div class="bookmark-info" @click="handleGotoBookmark(bookmark)">
                  <div class="bookmark-title">{{ bookmark.chapterTitle }}</div>
                  <div class="bookmark-preview">{{ bookmark.content }}</div>
                  <div class="bookmark-meta">
                    <span>第 {{ bookmark.page }} 页</span>
                    <span>{{ formatReadTime(bookmark.createdAt) }}</span>
                  </div>
                </div>
                <el-button
                  circle
                  size="small"
                  type="danger"
                  :icon="Minus"
                  @click.stop="handleDeleteBookmark(bookmark)"
                />
              </div>
            </div>
          </div>
        </div>
      </el-drawer>

      <el-drawer
        v-model="showSettingsPanel"
        direction="rtl"
        size="300px"
        title="阅读设置"
      >
        <div class="settings-panel">
          <div class="setting-group">
            <h4 class="group-title">主题</h4>
            <div class="theme-options">
              <div
                class="theme-option"
                :class="{ active: readingConfig?.theme === 'light' }"
                @click="configStore.updateReadingConfig({ theme: 'light' })"
              >
                <div class="theme-preview theme-light-preview" />
                <span>日间</span>
              </div>
              <div
                class="theme-option"
                :class="{ active: readingConfig?.theme === 'dark' }"
                @click="configStore.updateReadingConfig({ theme: 'dark' })"
              >
                <div class="theme-preview theme-dark-preview" />
                <span>夜间</span>
              </div>
              <div
                class="theme-option"
                :class="{ active: readingConfig?.theme === 'eye' }"
                @click="configStore.updateReadingConfig({ theme: 'eye' })"
              >
                <div class="theme-preview theme-eye-preview" />
                <span>护眼</span>
              </div>
            </div>
          </div>

          <div class="setting-group">
            <h4 class="group-title">阅读模式</h4>
            <div class="mode-options">
              <el-radio-group
                v-model="readingConfig.readMode"
                @change="toggleReadMode"
              >
                <el-radio-button value="scroll">
                  <el-icon><Grid /></el-icon>
                  滚动模式
                </el-radio-button>
                <el-radio-button value="page">
                  <el-icon><FullScreen /></el-icon>
                  翻页模式
                </el-radio-button>
              </el-radio-group>
            </div>
          </div>

          <div class="setting-group">
            <h4 class="group-title">
              字号
              <span class="current-value">{{ readingConfig?.fontSize }}px</span>
            </h4>
            <div class="control-row">
              <el-button circle :icon="Minus" @click="adjustFontSize(-2)" />
              <el-slider
                v-model="readingConfig.fontSize"
                :min="12"
                :max="48"
                :step="2"
                @change="(val) => configStore.updateReadingConfig({ fontSize: val })"
              />
              <el-button circle :icon="Plus" @click="adjustFontSize(2)" />
            </div>
          </div>

          <div class="setting-group">
            <h4 class="group-title">
              行间距
              <span class="current-value">{{ readingConfig?.lineHeight.toFixed(1) }}</span>
            </h4>
            <div class="control-row">
              <el-button circle :icon="Minus" @click="adjustLineHeight(-0.2)" />
              <el-slider
                v-model="readingConfig.lineHeight"
                :min="1.2"
                :max="4"
                :step="0.2"
                @change="(val) => configStore.updateReadingConfig({ lineHeight: val })"
              />
              <el-button circle :icon="Plus" @click="adjustLineHeight(0.2)" />
            </div>
          </div>

          <div class="setting-group">
            <h4 class="group-title">
              页边距
              <span class="current-value">{{ readingConfig?.pageMargin }}px</span>
            </h4>
            <div class="control-row">
              <el-button circle :icon="Minus" @click="adjustPageMargin(-10)" />
              <el-slider
                v-model="readingConfig.pageMargin"
                :min="10"
                :max="200"
                :step="10"
                @change="(val) => configStore.updateReadingConfig({ pageMargin: val })"
              />
              <el-button circle :icon="Plus" @click="adjustPageMargin(10)" />
            </div>
          </div>

          <div class="setting-group">
            <h4 class="group-title">
              每页字数
              <span class="current-value">{{ readingConfig?.pageChars }}</span>
            </h4>
            <el-slider
              v-model="readingConfig.pageChars"
              :min="200"
              :max="2000"
              :step="100"
              :marks="{ 200: '200', 800: '800', 1400: '1400', 2000: '2000' }"
              @change="(val) => configStore.updateReadingConfig({ pageChars: val })"
            />
          </div>

          <div class="setting-group">
            <h4 class="group-title">快捷键</h4>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <span>翻到下一页</span>
                <kbd>→</kbd>
                <kbd>空格</kbd>
              </div>
              <div class="shortcut-item">
                <span>翻到上一页</span>
                <kbd>←</kbd>
              </div>
              <div class="shortcut-item">
                <span>添加书签</span>
                <kbd>B</kbd>
              </div>
              <div class="shortcut-item">
                <span>返回书架</span>
                <kbd>Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      </el-drawer>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.reader-page {
  width: 100%;
  height: 100%;
  background: var(--reader-bg);
}

.reader-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.reader-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  z-index: 100;
  position: relative;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .book-info {
      .book-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        color: var(--text-primary);
      }

      .chapter-title {
        font-size: 12px;
        color: var(--text-secondary);
        margin: 2px 0 0;
      }
    }
  }

  .header-center {
    position: relative;

    .page-nav {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: var(--bg-secondary);
      border-radius: 20px;
      cursor: pointer;
      color: var(--text-primary);

      .current-page {
        font-weight: 600;
        color: var(--accent-color);
      }

      .divider {
        color: var(--text-tertiary);
      }

      .total-pages {
        color: var(--text-secondary);
      }
    }

    .goto-page-popover {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
      padding: 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-top: 8px;
    }
  }

  .header-right {
    display: flex;
    gap: 8px;
  }
}

.progress-bar {
  position: relative;
  height: 3px;
  background: var(--bg-secondary);

  .progress-fill {
    height: 100%;
    background: var(--accent-color);
    transition: width 0.3s ease;
  }

  .progress-text {
    position: absolute;
    right: 20px;
    top: -24px;
    font-size: 12px;
    color: var(--text-tertiary);
  }
}

.reader-content-area {
  flex: 1;
  overflow: hidden;
  background: var(--reader-bg);
}

.reader-scroll-mode {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.reader-page-mode {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
}

.reader-content {
  color: var(--reader-text);
  background: var(--reader-bg);
  transition: all 0.3s ease;
  max-width: 800px;
  margin: 0 auto;

  .chapter-heading {
    text-align: center;
    font-size: 1.2em;
    font-weight: 600;
    margin-bottom: 1.5em;
    color: var(--text-primary);
  }

  .paragraph {
    margin-bottom: 1em;
    text-indent: 2em;
    text-align: justify;
    line-height: inherit;
  }
}

.page-content {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.reader-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);

  .page-info {
    font-size: 14px;
    color: var(--text-secondary);
  }
}

.sidebar-drawer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);

  .drawer-header {
    padding: 16px 16px 0;
    border-bottom: 1px solid var(--border-color);

    :deep(.el-tabs__header) {
      margin-bottom: 0;
    }
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .chapter-list {
    .chapter-item {
      padding: 12px 20px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-color);
      transition: all 0.2s;
      color: var(--text-primary);

      &:hover {
        background: var(--bg-secondary);
      }

      &.active {
        background: var(--accent-color);
        color: white;
      }

      .chapter-name {
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }

  .bookmark-list {
    .empty-bookmarks {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-secondary);

      .empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
      }

      .hint {
        font-size: 12px;
        color: var(--text-tertiary);
        margin-top: 8px;
      }
    }

    .bookmark-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;

      &:hover {
        background: var(--bg-secondary);
      }

      .bookmark-info {
        flex: 1;
        min-width: 0;

        .bookmark-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .bookmark-preview {
          font-size: 12px;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          margin-bottom: 4px;
        }

        .bookmark-meta {
          display: flex;
          gap: 12px;
          font-size: 11px;
          color: var(--text-tertiary);
        }
      }
    }
  }
}

.settings-panel {
  padding: 8px 0;

  .setting-group {
    margin-bottom: 24px;

    .group-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;

      .current-value {
        font-size: 12px;
        font-weight: normal;
        color: var(--accent-color);
      }
    }

    .control-row {
      display: flex;
      align-items: center;
      gap: 12px;

      .el-slider {
        flex: 1;
      }
    }
  }

  .theme-options {
    display: flex;
    gap: 16px;

    .theme-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      border: 2px solid transparent;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-secondary);
      }

      &.active {
        border-color: var(--accent-color);
      }

      .theme-preview {
        width: 48px;
        height: 64px;
        border-radius: 4px;
        border: 1px solid var(--border-color);
      }

      .theme-light-preview {
        background: #fdfbf7;
      }

      .theme-dark-preview {
        background: #1a1a2e;
      }

      .theme-eye-preview {
        background: #c7edcc;
      }

      span {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }
  }

  .shortcut-list {
    .shortcut-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      font-size: 13px;
      color: var(--text-secondary);

      span:first-child {
        flex: 1;
      }

      kbd {
        display: inline-block;
        padding: 2px 8px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        color: var(--text-primary);
      }
    }
  }
}
</style>
