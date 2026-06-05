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
  Grid,
  Search,
  Close,
  Scissor,
  Upload,
  Download,
  Top,
  Bottom,
  Lock,
  Unlock,
  Edit,
  Clock,
  Files,
  Loading
} from '@element-plus/icons-vue'
import type { Bookmark as BookmarkType, SearchResult } from '@/types'

const route = useRoute()
const router = useRouter()
const readerStore = useReaderStore()
const configStore = useConfigStore()

const showSettingsPanel = ref(false)
const showToolsPanel = ref(false)
const showSearchBar = ref(false)
const showFullscreen = ref(false)
const showChapterInput = ref(false)
const showSplitDialog = ref(false)
const gotoPageInput = ref('')
const searchInput = ref('')
const splitVolumeSize = ref(10)
const splitVolumeUnit = ref<'chars' | 'chapters'>('chapters')

const readingConfig = computed(() => configStore.readingConfig!)
const shortcuts = computed(() => configStore.shortcuts!)
const searchResults = computed(() => readerStore.searchState.results)
const currentSearchIndex = computed(() => readerStore.searchState.currentIndex)
const isSearching = computed(() => readerStore.searchState.isSearching)
const searchKeyword = computed(() => readerStore.searchState.keyword)

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
  if (showSearchBar.value && e.key === 'Escape') {
    hideSearchBar()
    return
  }

  if (configStore.matchShortcut(e, 'nextPage')) {
    e.preventDefault()
    readerStore.nextPage()
  } else if (configStore.matchShortcut(e, 'prevPage')) {
    e.preventDefault()
    readerStore.prevPage()
  } else if (configStore.matchShortcut(e, 'goBack')) {
    e.preventDefault()
    router.push('/')
  } else if (configStore.matchShortcut(e, 'addBookmark')) {
    e.preventDefault()
    handleAddBookmark()
  } else if (configStore.matchShortcut(e, 'toggleFullscreen')) {
    e.preventDefault()
    handleToggleFullscreen()
  } else if (configStore.matchShortcut(e, 'toggleTheme')) {
    e.preventDefault()
    toggleTheme()
  } else if (configStore.matchShortcut(e, 'toggleAlwaysOnTop')) {
    e.preventDefault()
    handleToggleAlwaysOnTop()
  } else if (configStore.matchShortcut(e, 'search')) {
    e.preventDefault()
    showSearchBar.value = true
    nextTick(() => {
      document.getElementById('search-input')?.focus()
    })
  } else if (configStore.matchShortcut(e, 'toggleSidebar')) {
    e.preventDefault()
    readerStore.showSidebar = !readerStore.showSidebar
  } else if (showSearchBar.value && e.key === 'Enter') {
    e.preventDefault()
    handleSearch()
  } else if (searchResults.value.length > 0) {
    if (e.key === 'F3' || (e.ctrlKey && e.key === 'g')) {
      e.preventDefault()
      if (e.shiftKey) {
        readerStore.prevSearchResult()
      } else {
        readerStore.nextSearchResult()
      }
    }
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

async function handleToggleFullscreen() {
  const isFullscreen = await configStore.toggleFullscreen()
  ElMessage.info(isFullscreen ? '已进入全屏模式' : '已退出全屏模式')
}

async function handleToggleAlwaysOnTop() {
  const isOnTop = await configStore.toggleAlwaysOnTop()
  ElMessage.info(isOnTop ? '窗口已置顶' : '已取消窗口置顶')
}

function formatReadTime(timestamp: number): string {
  if (!timestamp) return '暂无阅读记录'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

function formatTotalReadingTime(seconds: number): string {
  if (!seconds) return '0分钟'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

function handleSearch() {
  if (!searchInput.value.trim()) {
    readerStore.resetSearch()
    return
  }
  readerStore.search(searchInput.value.trim())
}

function hideSearchBar() {
  showSearchBar.value = false
  searchInput.value = ''
  readerStore.resetSearch()
}

async function handleGotoSearchResult(result: SearchResult) {
  await readerStore.goToSearchResult(result.matchIndex)
}

async function handleSplitVolume() {
  if (!readerStore.book || readerStore.book.fileType !== 'txt') {
    ElMessage.warning('仅支持TXT文件分卷')
    return
  }

  try {
    const result = await readerStore.splitVolume({
      volumeSize: splitVolumeSize.value,
      unit: splitVolumeUnit.value
    })
    
    if (result?.success) {
      ElMessage.success(`成功拆分为 ${result.count} 个文件，已保存到 ${result.saveDir}`)
      showSplitDialog.value = false
    } else {
      ElMessage.warning('已取消分卷操作')
    }
  } catch (err) {
    ElMessage.error('分卷失败')
  }
}

function highlightContent(content: string): string {
  if (!searchKeyword.value) return content
  return readerStore.highlightKeyword(content, searchKeyword.value)
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
      <div v-if="readerStore.isLargeFile" class="large-file-warning">
        <el-icon><Files /></el-icon>
        <span>这是一个大文件，已启用优化模式以提升性能</span>
      </div>

      <div v-if="showSearchBar" class="search-bar glass-effect">
        <div class="search-input-wrapper">
          <el-icon><Search /></el-icon>
          <input
            id="search-input"
            v-model="searchInput"
            type="text"
            placeholder="搜索关键词..."
            @keyup.enter="handleSearch"
          />
          <el-button v-if="isSearching" circle size="small" :icon="Loading" :loading="true" />
          <el-button v-else circle size="small" :icon="Search" @click="handleSearch" />
          <el-button circle size="small" :icon="Close" @click="hideSearchBar" />
        </div>
        <div v-if="searchResults.length > 0" class="search-navigation">
          <el-button size="small" @click="readerStore.prevSearchResult()">上一个</el-button>
          <span class="search-counter">{{ currentSearchIndex + 1 }} / {{ searchResults.length }}</span>
          <el-button size="small" @click="readerStore.nextSearchResult()">下一个</el-button>
        </div>
      </div>

      <header class="reader-header glass-effect">
        <div class="header-left">
          <el-button circle :icon="Back" @click="goBack" />
          <div class="book-info">
            <h2 class="book-title">{{ readerStore.book?.title }}</h2>
            <div class="book-meta">
              <span class="chapter-title">{{ readerStore.currentChapter?.title }}</span>
              <span class="reading-time">
                <el-icon><Clock /></el-icon>
                已阅读 {{ formatTotalReadingTime(readerStore.book?.totalReadingTime || 0) }}
              </span>
            </div>
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
          <el-button circle :icon="Search" @click="showSearchBar = true; nextTick(() => document.getElementById('search-input')?.focus())" />
          <el-button circle :icon="MenuIcon" @click="showToolsPanel = !showToolsPanel" />
          <el-button circle :icon="List" @click="readerStore.showSidebar = !readerStore.showSidebar" />
          <el-button circle :icon="Star" @click="handleAddBookmark" />
          <el-button
            circle
            :icon="configStore.isAlwaysOnTop ? Lock : Unlock"
            @click="handleToggleAlwaysOnTop"
            :class="{ active: configStore.isAlwaysOnTop }"
          />
          <el-button
            circle
            :icon="FullScreen"
            @click="handleToggleFullscreen"
            :class="{ active: configStore.isFullscreen }"
          />
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
            <template v-if="readerStore.fullContent && !readerStore.isLargeFile">
              <template v-for="chapter in readerStore.fullContent.chapters" :key="chapter.index">
                <h3 class="chapter-heading" :id="'chapter-' + chapter.index">
                  {{ chapter.title }}
                </h3>
                <p
                  v-for="(para, idx) in readerStore.fullContent.content.slice(chapter.startPosition, chapter.endPosition).split('\n')"
                  :key="idx"
                  class="paragraph"
                  v-html="highlightContent(para)"
                >
                </p>
              </template>
            </template>
            <template v-else-if="readerStore.currentContent">
              <h3 class="chapter-heading">{{ readerStore.currentContent.chapterTitle }}</h3>
              <p
                v-for="(para, idx) in readerStore.currentContent.content.split('\n')"
                :key="idx"
                class="paragraph"
                v-html="highlightContent(para)"
              >
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
                v-html="highlightContent(para)"
              >
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
              <el-tab-pane label="搜索结果" name="search">
                <el-icon><Search /></el-icon>
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
                <span class="chapter-page">第{{ chapter.startPage }}页</span>
              </div>
            </div>

            <div v-else-if="readerStore.sidebarTab === 'bookmarks'" class="bookmark-list">
              <div v-if="readerStore.bookmarks.length === 0" class="empty-bookmarks">
                <div class="empty-icon">🔖</div>
                <p>暂无书签</p>
                <p class="hint">按 {{ shortcuts?.addBookmark }} 键快速添加书签</p>
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

            <div v-else class="search-results-list">
              <div v-if="searchResults.length === 0" class="empty-bookmarks">
                <div class="empty-icon">🔍</div>
                <p>暂无搜索结果</p>
                <p class="hint">在搜索框输入关键词开始搜索</p>
              </div>
              <div
                v-for="result in searchResults"
                :key="result.matchIndex"
                class="search-result-item"
                :class="{ active: currentSearchIndex === result.matchIndex }"
                @click="handleGotoSearchResult(result)"
              >
                <div class="result-chapter">{{ result.chapterTitle }}</div>
                <div class="result-content" v-html="highlightContent(result.content)"></div>
                <div class="result-page">第 {{ result.page }} 页</div>
              </div>
            </div>
          </div>
        </div>
      </el-drawer>

      <el-drawer
        v-model="showToolsPanel"
        direction="rtl"
        size="280px"
        title="文本工具箱"
      >
        <div class="tools-panel">
          <div class="tool-section">
            <h4 class="section-title">搜索与导航</h4>
            <div class="tool-item" @click="showSearchBar = true">
              <el-icon><Search /></el-icon>
              <span>全文搜索</span>
              <span class="tool-shortcut">{{ shortcuts?.search }}</span>
            </div>
            <div class="tool-item" @click="readerStore.showSidebar = true; readerStore.sidebarTab = 'chapters'">
              <el-icon><List /></el-icon>
              <span>章节目录</span>
            </div>
            <div class="tool-item" @click="readerStore.goToPage(1)">
              <el-icon><Top /></el-icon>
              <span>跳转到开头</span>
            </div>
            <div class="tool-item" @click="readerStore.goToPage(readerStore.totalPages)">
              <el-icon><Bottom /></el-icon>
              <span>跳转到末尾</span>
            </div>
          </div>

          <div class="tool-section">
            <h4 class="section-title">阅读辅助</h4>
            <div class="tool-item" @click="toggleReadMode">
              <el-icon><Grid /></el-icon>
              <span>{{ readingConfig?.readMode === 'scroll' ? '切换到翻页模式' : '切换到滚动模式' }}</span>
            </div>
            <div class="tool-item" @click="handleToggleFullscreen">
              <el-icon><FullScreen /></el-icon>
              <span>{{ configStore.isFullscreen ? '退出全屏' : '全屏阅读' }}</span>
            </div>
            <div class="tool-item" @click="handleToggleAlwaysOnTop">
              <el-icon>{{ configStore.isAlwaysOnTop ? Lock : Unlock }}</el-icon>
              <span>{{ configStore.isAlwaysOnTop ? '取消置顶' : '窗口置顶' }}</span>
            </div>
          </div>

          <div v-if="readerStore.book?.fileType === 'txt'" class="tool-section">
            <h4 class="section-title">TXT工具</h4>
            <div class="tool-item" @click="showSplitDialog = true">
              <el-icon><Scissor /></el-icon>
              <span>分卷拆分</span>
            </div>
          </div>

          <div class="tool-section">
            <h4 class="section-title">快捷操作</h4>
            <div class="tool-item" @click="handleAddBookmark">
              <el-icon><Star /></el-icon>
              <span>添加书签</span>
              <span class="tool-shortcut">{{ shortcuts?.addBookmark }}</span>
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
            <h4 class="group-title">
              搜索高亮颜色
            </h4>
            <div class="highlight-colors">
              <div
                v-for="color in ['#ffe066', '#ff8787', '#69db7c', '#74c0fc', '#da77f2']"
                :key="color"
                class="color-option"
                :class="{ active: readingConfig?.highlightColor === color }"
                :style="{ backgroundColor: color }"
                @click="configStore.updateReadingConfig({ highlightColor: color })"
              />
            </div>
          </div>

          <div class="setting-group">
            <h4 class="group-title">快捷键</h4>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <span>翻到下一页</span>
                <kbd>{{ shortcuts?.nextPage }}</kbd>
              </div>
              <div class="shortcut-item">
                <span>翻到上一页</span>
                <kbd>{{ shortcuts?.prevPage }}</kbd>
              </div>
              <div class="shortcut-item">
                <span>添加书签</span>
                <kbd>{{ shortcuts?.addBookmark }}</kbd>
              </div>
              <div class="shortcut-item">
                <span>全文搜索</span>
                <kbd>{{ shortcuts?.search }}</kbd>
              </div>
              <div class="shortcut-item">
                <span>切换主题</span>
                <kbd>{{ shortcuts?.toggleTheme }}</kbd>
              </div>
              <div class="shortcut-item">
                <span>切换置顶</span>
                <kbd>{{ shortcuts?.toggleAlwaysOnTop }}</kbd>
              </div>
              <div class="shortcut-item">
                <span>全屏</span>
                <kbd>{{ shortcuts?.toggleFullscreen }}</kbd>
              </div>
              <div class="shortcut-item">
                <span>显示侧边栏</span>
                <kbd>{{ shortcuts?.toggleSidebar }}</kbd>
              </div>
              <div class="shortcut-item">
                <span>返回书架</span>
                <kbd>{{ shortcuts?.goBack }}</kbd>
              </div>
            </div>
            <p class="shortcut-hint">在设置页面可自定义快捷键</p>
          </div>
        </div>
      </el-drawer>

      <el-dialog
        v-model="showSplitDialog"
        title="TXT分卷拆分"
        width="400px"
      >
        <div class="split-dialog">
          <p class="split-tip">将大文件拆分为多个小文件，方便在其他设备上阅读</p>
          
          <div class="form-item">
            <label>拆分方式</label>
            <el-radio-group v-model="splitVolumeUnit">
              <el-radio value="chapters">按章节拆分</el-radio>
              <el-radio value="chars">按字数拆分</el-radio>
            </el-radio-group>
          </div>

          <div class="form-item">
            <label>{{ splitVolumeUnit === 'chapters' ? '每卷章节数' : '每卷字数（万字）' }}</label>
            <el-input-number
              v-model="splitVolumeSize"
              :min="1"
              :max="splitVolumeUnit === 'chapters' ? 100 : 1000"
              :step="splitVolumeUnit === 'chapters' ? 1 : 5"
            />
          </div>

          <p class="split-info">
            预计拆分为约 {{ splitVolumeUnit === 'chapters' 
              ? Math.ceil(readerStore.chapters.length / splitVolumeSize)
              : Math.ceil((readerStore.book?.totalCharacters || 0) / (splitVolumeSize * 10000))
            }} 个文件
          </p>
        </div>
        <template #footer>
          <el-button @click="showSplitDialog = false">取消</el-button>
          <el-button type="primary" @click="handleSplitVolume">开始拆分</el-button>
        </template>
      </el-dialog>
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
  position: relative;
}

.large-file-warning {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #fff3cd;
  color: #856404;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  z-index: 1000;
  border-bottom: 1px solid #ffeeba;
}

.search-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  z-index: 200;
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
  background: rgba(var(--bg-primary-rgb), 0.95);

  .search-input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-secondary);
    padding: 8px 12px;
    border-radius: 20px;

    el-icon {
      color: var(--text-tertiary);
    }

    input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 14px;
      color: var(--text-primary);
    }
  }

  .search-navigation {
    display: flex;
    align-items: center;
    gap: 8px;

    .search-counter {
      font-size: 13px;
      color: var(--text-secondary);
      min-width: 60px;
      text-align: center;
    }
  }
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

      .book-meta {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-top: 2px;

        .chapter-title {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .reading-time {
          font-size: 12px;
          color: var(--text-tertiary);
          display: flex;
          align-items: center;
          gap: 4px;
        }
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

    .el-button.active {
      background: var(--accent-color);
      color: white;
    }
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

  :deep(.search-highlight) {
    background: v-bind('readingConfig?.highlightColor || "#ffe066"');
    padding: 0 2px;
    border-radius: 2px;
    font-weight: 500;
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
      display: flex;
      justify-content: space-between;
      align-items: center;
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
        flex: 1;
      }

      .chapter-page {
        font-size: 11px;
        opacity: 0.7;
        margin-left: 8px;
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

  .search-results-list {
    .search-result-item {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-secondary);
      }

      &.active {
        background: var(--accent-color);
        color: white;

        .result-chapter,
        .result-page {
          color: rgba(255, 255, 255, 0.8);
        }

        :deep(.search-highlight) {
          background: rgba(255, 255, 255, 0.3);
        }
      }

      .result-chapter {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      .result-content {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.5;
        margin-bottom: 4px;

        :deep(.search-highlight) {
          background: var(--accent-color);
          color: white;
          padding: 0 2px;
          border-radius: 2px;
        }
      }

      .result-page {
        font-size: 11px;
        color: var(--text-tertiary);
      }
    }
  }
}

.tools-panel {
  padding: 8px 0;

  .tool-section {
    margin-bottom: 24px;

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      padding: 0 16px;
      margin-bottom: 8px;
    }

    .tool-item {
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
        flex: 1;
        font-size: 14px;
      }

      .tool-shortcut {
        font-size: 11px;
        color: var(--text-tertiary);
        background: var(--bg-secondary);
        padding: 2px 6px;
        border-radius: 4px;
        flex: none;
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

  .highlight-colors {
    display: flex;
    gap: 12px;

    .color-option {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      border: 3px solid transparent;
      transition: all 0.2s;

      &:hover {
        transform: scale(1.1);
      }

      &.active {
        border-color: var(--accent-color);
      }
    }
  }

  .shortcut-list {
    .shortcut-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
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

  .shortcut-hint {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 8px;
    text-align: center;
  }
}

.split-dialog {
  .split-tip {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 16px;
  }

  .form-item {
    margin-bottom: 16px;

    label {
      display: block;
      font-size: 13px;
      color: var(--text-primary);
      margin-bottom: 8px;
      font-weight: 500;
    }
  }

  .split-info {
    font-size: 13px;
    color: var(--accent-color);
    margin-top: 8px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 4px;
  }
}
</style>
