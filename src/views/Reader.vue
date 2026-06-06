<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReaderStore } from '@/stores/reader'
import { useConfigStore } from '@/stores/config'
import { ElMessage, ElMessageBox, ElSlider } from 'element-plus'
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
  Loading,
  VideoPlay,
  VideoPause,
  DataLine,
  Picture,
  EditPen,
  MagicStick,
  RefreshRight,
  Document,
  Aim,
  Timer,
  Calendar,
  TrendCharts,
  Collection,
  SwitchButton,
  Open,
  Select,
  Cherry,
  Food,
  Apple,
  Coffee
} from '@element-plus/icons-vue'
import type { Bookmark as BookmarkType, SearchResult, TextCleanupOptions, SmartChapterOptions, ThemeTemplate } from '@/types'

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
const showSmartRechaptersDialog = ref(false)
const showCleanTextDialog = ref(false)
const showReadingGoalDialog = ref(false)
const showMetadataPanel = ref(false)
const gotoPageInput = ref('')
const gotoPercentageInput = ref('')
const searchInput = ref('')
const splitVolumeSize = ref(10)
const splitVolumeUnit = ref<'chars' | 'chapters'>('chapters')
const autoFlipSpeedLocal = ref(3)
const readingGoalTarget = ref(30)
const readingGoalUnit = ref<'pages' | 'minutes' | 'characters'>('pages')
const cleanupOptions = ref<TextCleanupOptions>({
  removeEmptyLines: true,
  fixGarbledText: true,
  normalizePunctuation: true,
  removeDuplicateChapters: true
})
const smartChapterOptions = ref<SmartChapterOptions>({
  detectChineseChapters: true,
  detectEnglishChapters: true,
  detectVolumeTitles: true,
  mergeSmallChapters: true,
  minChapterLength: 500
})
const showProgressTooltip = ref(false)
const progressTooltipX = ref(0)
const currentReadingTimeDisplay = ref(0)
let readingTimeTimer: number | null = null

const readingConfig = computed(() => configStore.readingConfig!)
const shortcuts = computed(() => configStore.shortcuts!)
const searchResults = computed(() => readerStore.searchState.results)
const currentSearchIndex = computed(() => readerStore.searchState.currentIndex)
const isSearching = computed(() => readerStore.searchState.isSearching)
const searchKeyword = computed(() => readerStore.searchState.keyword)
const themeTemplates = computed(() => configStore.themeTemplates)
const goalProgress = computed(() => readerStore.goalProgress)
const isDoublePage = computed(() => readerStore.isDoublePage)
const isLandscape = computed(() => readerStore.isLandscape)
const autoFlipEnabled = computed(() => readerStore.autoFlipEnabled)

const contentStyle = computed(() => {
  if (!readingConfig.value) return {}
  const style: Record<string, string> = {
    fontSize: readingConfig.value.fontSize + 'px',
    lineHeight: readingConfig.value.lineHeight,
    letterSpacing: readingConfig.value.letterSpacing + 'px',
    padding: readingConfig.value.pageMargin + 'px'
  }
  if (configStore.readerStyle.fontFamily) {
    style.fontFamily = configStore.readerStyle.fontFamily
  }
  if (configStore.readerStyle.opacity) {
    style.opacity = configStore.readerStyle.opacity
  }
  return style
})

const readerContainerStyle = computed(() => {
  const style: Record<string, string> = {}
  if (configStore.backgroundImage) {
    style.backgroundImage = `url(${configStore.backgroundImage})`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
    style.backgroundRepeat = 'no-repeat'
  }
  if (readingConfig.value?.opacity !== undefined && readingConfig.value.opacity < 100) {
    style.opacity = `${readingConfig.value.opacity / 100}`
  }
  return style
})

const pageLayoutClass = computed(() => {
  return [
    isDoublePage.value ? 'layout-double' : 'layout-single',
    isLandscape.value ? 'orientation-landscape' : 'orientation-portrait'
  ]
})

const formatReadingTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  if (minutes > 0) {
    return `${minutes}分${secs}秒`
  }
  return `${secs}秒`
}

onMounted(async () => {
  const bookId = Number(route.params.bookId)
  if (bookId) {
    try {
      const pageChars = readingConfig.value?.pageChars || 800
      await readerStore.openBook(bookId, pageChars)
      document.addEventListener('keydown', handleKeydown)
      startReadingTimeTimer()
    } catch (err) {
      console.error('Open book error:', err)
      ElMessage.error('打开书籍失败')
      router.push('/')
    }
  }

  nextTick(() => {
    window.addEventListener('wheel', handleWheel, { passive: false })
  })
  
  if (readingConfig.value?.autoFlipEnabled) {
    autoFlipSpeedLocal.value = readingConfig.value.autoFlipSpeed || 3
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('wheel', handleWheel)
  stopReadingTimeTimer()
  readerStore.closeBook()
})

function startReadingTimeTimer() {
  stopReadingTimeTimer()
  readingTimeTimer = window.setInterval(() => {
    currentReadingTimeDisplay.value = readerStore.currentReadingTime
  }, 1000)
}

function stopReadingTimeTimer() {
  if (readingTimeTimer) {
    clearInterval(readingTimeTimer)
    readingTimeTimer = null
  }
}

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
  } else if (configStore.matchShortcut(e, 'toggleAutoFlip')) {
    e.preventDefault()
    handleToggleAutoFlip()
  } else if (e.key === 'a' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault()
    handleToggleAutoFlip()
  } else if (e.key === 'd' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault()
    togglePageLayout()
  } else if (e.key === 'l' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault()
    toggleOrientation()
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

async function handleToggleAutoFlip() {
  const enabled = await readerStore.toggleAutoFlip()
  ElMessage.info(enabled ? '自动翻页已开启' : '自动翻页已关闭')
}

function adjustAutoFlipSpeed(delta: number) {
  autoFlipSpeedLocal.value = Math.max(1, Math.min(10, autoFlipSpeedLocal.value + delta))
  configStore.updateReadingConfig({
    autoFlipSpeed: autoFlipSpeedLocal.value,
    autoFlipInterval: 60000 / autoFlipSpeedLocal.value
  })
  if (autoFlipEnabled.value) {
    readerStore.startAutoFlip()
  }
}

function togglePageLayout() {
  const newLayout = isDoublePage.value ? 'single' : 'double'
  configStore.updateReadingConfig({ pageLayout: newLayout })
  ElMessage.info(isDoublePage.value ? '已切换到双页模式' : '已切换到单页模式')
}

function toggleOrientation() {
  const newOrientation = isLandscape.value ? 'portrait' : 'landscape'
  configStore.updateReadingConfig({ orientation: newOrientation })
  ElMessage.info(isLandscape.value ? '已切换到横屏模式' : '已切换到竖屏模式')
}

async function handleGotoPercentage() {
  const percentage = parseFloat(gotoPercentageInput.value)
  if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
    await readerStore.goToPercentage(percentage)
    readerStore.showGotoPercentage = false
    gotoPercentageInput.value = ''
  } else {
    ElMessage.error('请输入0-100之间的百分比')
  }
}

function handleProgressDrag(e: Event) {
  if (!e.target) return
  const slider = e.target as HTMLInputElement
  const percentage = parseInt(slider.value)
  readerStore.dragProgressValue = percentage
}

async function handleProgressChange(percentage: number) {
  await readerStore.goToPercentage(percentage)
  readerStore.isDraggingProgress = false
}

function handleProgressMouseMove(e: MouseEvent) {
  const progressBar = e.currentTarget as HTMLElement
  const rect = progressBar.getBoundingClientRect()
  const percentage = Math.round(((e.clientX - rect.left) / rect.width) * 100)
  progressTooltipX.value = e.clientX - rect.left
  readerStore.dragProgressValue = Math.max(0, Math.min(100, percentage))
  showProgressTooltip.value = true
}

function handleProgressMouseLeave() {
  showProgressTooltip.value = false
}

async function handleProgressClick(e: MouseEvent) {
  const progressBar = e.currentTarget as HTMLElement
  const rect = progressBar.getBoundingClientRect()
  const percentage = Math.round(((e.clientX - rect.left) / rect.width) * 100)
  await readerStore.goToPercentage(Math.max(0, Math.min(100, percentage)))
}

async function handleSelectBackgroundImage() {
  const path = await configStore.selectBackgroundImage()
  if (path) {
    ElMessage.success('背景图已设置')
  }
}

async function handleClearBackgroundImage() {
  await configStore.clearBackgroundImage()
  ElMessage.info('背景图已清除')
}

async function handleSelectCustomFont() {
  const path = await configStore.selectCustomFont()
  if (path) {
    ElMessage.success('字体已导入')
  }
}

async function handleClearCustomFont() {
  await configStore.clearCustomFont()
  ElMessage.info('自定义字体已清除')
}

async function handleApplyThemeTemplate(templateId: string) {
  await configStore.applyThemeTemplate(templateId)
  ElMessage.success('主题已应用')
}

function adjustOpacity(delta: number) {
  if (!readingConfig.value) return
  const newOpacity = Math.min(100, Math.max(30, (readingConfig.value.opacity || 100) + delta))
  configStore.updateReadingConfig({ opacity: newOpacity })
}

async function handleExtractMetadata() {
  try {
    const metadata = await readerStore.extractMetadata()
    if (metadata) {
      ElMessage.success('元数据提取完成')
      showMetadataPanel.value = true
    }
  } catch (err) {
    ElMessage.error('元数据提取失败')
  }
}

async function handleCleanText() {
  try {
    const result = await readerStore.cleanText(cleanupOptions.value)
    if (result?.success) {
      ElMessage.success(`文本清理完成：${result.message}`)
      showCleanTextDialog.value = false
    }
  } catch (err) {
    ElMessage.error('文本清理失败')
  }
}

async function handleAnalyzeQuality() {
  try {
    const result = await readerStore.analyzeTextQuality()
    if (result) {
      await ElMessageBox.alert(
        `文本质量分析结果：\n\n` +
        `总字数：${result.totalCharacters}\n` +
        `章节数：${result.chapterCount}\n` +
        `空行数：${result.emptyLineCount}\n` +
        `乱码检测：${result.hasGarbledText ? '发现乱码' : '未发现乱码'}\n` +
        `重复章节：${result.duplicateCount}个\n` +
        `总体评分：${result.qualityScore}/100`,
        '文本质量报告',
        { confirmButtonText: '确定' }
      )
    }
  } catch (err) {
    ElMessage.error('质量分析失败')
  }
}

async function handleSmartRechapters() {
  if (readerStore.book?.fileType !== 'txt') {
    ElMessage.warning('仅支持TXT文件智能分章')
    return
  }
  try {
    const result = await readerStore.smartRechapters(smartChapterOptions.value)
    if (result?.success) {
      ElMessage.success(`智能分章完成：共识别 ${result.chapterCount} 个章节`)
      showSmartRechaptersDialog.value = false
    }
  } catch (err) {
    ElMessage.error('智能分章失败')
  }
}

async function handleSetReadingGoal() {
  try {
    await configStore.setReadingGoal(readingGoalTarget.value, readingGoalUnit.value)
    await readerStore.loadGoalProgress()
    ElMessage.success('阅读目标已设置')
    showReadingGoalDialog.value = false
  } catch (err) {
    ElMessage.error('设置失败')
  }
}

function formatUnitLabel(unit: string): string {
  const labels: Record<string, string> = {
    pages: '页',
    minutes: '分钟',
    characters: '字'
  }
  return labels[unit] || unit
}

watch(
  () => readingConfig.value?.pageChars,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && readerStore.book && newVal) {
      const currentPage = readerStore.currentPage
      await readerStore.closeBook()
      await readerStore.openBook(readerStore.book!.id, newVal)
      await readerStore.goToPage(currentPage)
    }
  }
)

watch(
  () => configStore.autoFlipActive,
  (active) => {
    if (active) {
      readerStore.startAutoFlip()
    } else {
      readerStore.stopAutoFlip()
    }
  }
)
</script>

<template>
  <div class="reader-page" v-loading="readerStore.isLoading">
    <div class="reader-container" :class="[`theme-${configStore.themeClass.replace('theme-', '')}`, pageLayoutClass]" :style="readerContainerStyle">
      <div v-if="readerStore.isLargeFile" class="large-file-warning">
        <el-icon><Files /></el-icon>
        <span>这是一个大文件，已启用优化模式以提升性能</span>
      </div>

      <div v-if="autoFlipEnabled" class="auto-flip-indicator glass-effect">
        <el-icon><VideoPlay /></el-icon>
        <span>自动翻页中 · {{ autoFlipSpeedLocal }}页/分钟</span>
        <el-button circle size="small" :icon="Close" @click="handleToggleAutoFlip" />
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
              <span class="session-time" v-if="currentReadingTimeDisplay > 0">
                <el-icon><Timer /></el-icon>
                本次阅读 {{ formatReadingTime(currentReadingTimeDisplay) }}
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
            <div class="goto-tabs">
              <span :class="{ active: !readerStore.showGotoPercentage }" @click.stop="readerStore.showGotoPercentage = false">页码</span>
              <span :class="{ active: readerStore.showGotoPercentage }" @click.stop="readerStore.showGotoPercentage = true">百分比</span>
            </div>
            <div v-if="!readerStore.showGotoPercentage" class="goto-input-group">
              <el-input
                v-model="gotoPageInput"
                placeholder="输入页码"
                @keyup.enter="handleGotoPage"
              />
              <el-button type="primary" @click="handleGotoPage">跳转</el-button>
            </div>
            <div v-else class="goto-input-group">
              <el-input
                v-model="gotoPercentageInput"
                placeholder="输入百分比 0-100"
                @keyup.enter="handleGotoPercentage"
                suffix="%"
              />
              <el-button type="primary" @click="handleGotoPercentage">跳转</el-button>
            </div>
          </div>
        </div>

        <div class="header-right">
          <el-button
            circle
            :icon="autoFlipEnabled ? VideoPause : VideoPlay"
            @click="handleToggleAutoFlip"
            :class="{ active: autoFlipEnabled }"
            title="自动翻页 (A)"
          />
          <el-button circle :icon="DataLine" @click="readerStore.showSidebar = true; readerStore.sidebarTab = 'stats'" title="阅读统计" />
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
          <el-button circle :icon="configStore.themeClass.includes('dark') ? Sunny : MoonNight" @click="toggleTheme" />
          <el-button circle :icon="Setting" @click="showSettingsPanel = !showSettingsPanel" />
        </div>
      </header>

      <div 
        class="progress-bar"
        @mousemove="handleProgressMouseMove"
        @mouseleave="handleProgressMouseLeave"
        @click="handleProgressClick"
      >
        <div class="progress-fill" :style="{ width: readerStore.progress + '%' }" />
        <input
          type="range"
          class="progress-slider"
          :value="readerStore.progress"
          min="0"
          max="100"
          step="0.1"
          @input="handleProgressDrag"
          @change="(e) => handleProgressChange(parseInt((e.target as HTMLInputElement).value))"
          @mousedown="readerStore.isDraggingProgress = true"
        />
        <div v-if="showProgressTooltip || readerStore.isDraggingProgress" class="progress-tooltip" :style="{ left: progressTooltipX + 'px' }">
          {{ readerStore.isDraggingProgress ? readerStore.dragProgressValue : readerStore.dragProgressValue }}%
        </div>
        <span class="progress-text">{{ readerStore.progress }}%</span>
      </div>

      <div v-if="goalProgress" class="goal-progress-bar glass-effect">
        <div class="goal-info">
          <el-icon><TrendCharts /></el-icon>
          <span>今日目标：{{ goalProgress.dailyTarget }} {{ formatUnitLabel(goalProgress.targetUnit) }}</span>
          <span class="goal-completed">
            已完成 {{ goalProgress.todayCompleted }} {{ formatUnitLabel(goalProgress.targetUnit) }}
            ({{ goalProgress.completionPercentage }}%)
          </span>
          <span class="goal-streak" v-if="goalProgress.streakDays > 0">
            <el-icon><Calendar /></el-icon>
            连续打卡 {{ goalProgress.streakDays }} 天
          </span>
        </div>
        <div class="goal-progress-track">
          <div class="goal-progress-fill" :style="{ width: Math.min(100, goalProgress.completionPercentage) + '%' }" />
        </div>
      </div>

      <main class="reader-content-area" :class="pageLayoutClass">
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
          :class="{ 'double-page': isDoublePage }"
          @click.self="handleNextPage"
        >
          <template v-if="isDoublePage">
            <div class="reader-content page-content left-page" :style="contentStyle">
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
            <div class="reader-content page-content right-page" :style="contentStyle" v-if="readerStore.currentPage < readerStore.totalPages">
              <div v-if="readerStore.currentContent">
                <p
                  v-for="(para, idx) in (readerStore.currentContent.content || '').split('\n')"
                  :key="'right-' + idx"
                  class="paragraph"
                  v-html="highlightContent(para)"
                >
                </p>
              </div>
            </div>
          </template>
          <template v-else>
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
          </template>
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
        size="360px"
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
              <el-tab-pane label="阅读统计" name="stats">
                <el-icon><DataLine /></el-icon>
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

            <div v-else-if="readerStore.sidebarTab === 'search'" class="search-results-list">
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

            <div v-else-if="readerStore.sidebarTab === 'stats'" class="stats-panel">
              <div class="stats-header">
                <el-icon :size="32"><DataLine /></el-icon>
                <div>
                  <h3>阅读统计</h3>
                  <p class="stats-subtitle">追踪您的阅读进度</p>
                </div>
              </div>

              <div class="stats-cards">
                <div class="stat-card">
                  <div class="stat-icon blue"><Timer /></div>
                  <div class="stat-content">
                    <div class="stat-value">{{ formatReadingTime(currentReadingTimeDisplay) }}</div>
                    <div class="stat-label">本次阅读</div>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon green"><Document /></div>
                  <div class="stat-content">
                    <div class="stat-value">{{ readerStore.pagesReadThisSession }}</div>
                    <div class="stat-label">已读页数</div>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon orange"><TrendCharts /></div>
                  <div class="stat-content">
                    <div class="stat-value">{{ readerStore.readingSpeed }}</div>
                    <div class="stat-label">阅读速度(页/小时)</div>
                  </div>
                </div>
              </div>

              <div v-if="goalProgress" class="goal-section">
                <div class="section-header">
                  <h4>今日阅读目标</h4>
                  <el-button size="small" @click="showReadingGoalDialog = true">
                    <el-icon><Edit /></el-icon>
                    设置
                  </el-button>
                </div>
                <div class="goal-card">
                  <div class="goal-info">
                    <span class="goal-target">{{ goalProgress.dailyTarget }} {{ formatUnitLabel(goalProgress.targetUnit) }}</span>
                    <span class="goal-percent">{{ goalProgress.completionPercentage }}%</span>
                  </div>
                  <div class="goal-bar">
                    <div class="goal-fill" :style="{ width: Math.min(100, goalProgress.completionPercentage) + '%' }"></div>
                  </div>
                  <div class="goal-details">
                    <span>已完成 {{ goalProgress.todayCompleted }} {{ formatUnitLabel(goalProgress.targetUnit) }}</span>
                    <span v-if="goalProgress.streakDays > 0" class="streak-badge">
                      🔥 连续 {{ goalProgress.streakDays }} 天
                    </span>
                  </div>
                </div>
              </div>

              <div class="stats-section">
                <h4>近期阅读记录</h4>
                <div v-if="readerStore.readingStats.length === 0" class="empty-stats">
                  <p>暂无阅读记录</p>
                  <p class="hint">开始阅读后这里会显示您的阅读数据</p>
                </div>
                <div v-else class="stats-list">
                  <div v-for="(stat, index) in readerStore.readingStats.slice(0, 10)" :key="index" class="stats-item">
                    <div class="stats-date">{{ formatReadTime(stat.startTime) }}</div>
                    <div class="stats-details">
                      <span><el-icon><Timer /></el-icon> {{ formatReadingTime(stat.duration) }}</span>
                      <span><el-icon><Document /></el-icon> {{ stat.pagesRead }}页</span>
                      <span><el-icon><Collection /></el-icon> {{ Math.round(stat.charactersRead / 1000) }}千字</span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="readerStore.bookMetadata" class="metadata-section">
                <div class="section-header">
                  <h4>书籍信息</h4>
                  <el-button size="small" @click="handleExtractMetadata">
                    <el-icon><RefreshRight /></el-icon>
                    提取
                  </el-button>
                </div>
                <div class="metadata-card">
                  <div v-if="readerStore.bookMetadata.summary" class="metadata-item">
                    <span class="metadata-label">摘要</span>
                    <p class="metadata-value summary">{{ readerStore.bookMetadata.summary }}</p>
                  </div>
                  <div v-if="readerStore.bookMetadata.detectedAuthor" class="metadata-item">
                    <span class="metadata-label">识别作者</span>
                    <span class="metadata-value">{{ readerStore.bookMetadata.detectedAuthor }}</span>
                  </div>
                  <div v-if="readerStore.bookMetadata.tags && readerStore.bookMetadata.tags.length > 0" class="metadata-item">
                    <span class="metadata-label">标签</span>
                    <div class="tag-list">
                      <span v-for="(tag, idx) in readerStore.bookMetadata.tags" :key="idx" class="tag-item">
                        {{ tag }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-drawer>

      <el-drawer
        v-model="showToolsPanel"
        direction="rtl"
        size="320px"
        title="工具箱"
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
            <div class="tool-item" @click="readerStore.showSidebar = true; readerStore.sidebarTab = 'stats'">
              <el-icon><DataLine /></el-icon>
              <span>阅读统计</span>
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
            <div class="tool-item" @click="handleToggleAutoFlip">
              <el-icon>{{ autoFlipEnabled ? VideoPause : VideoPlay }}</el-icon>
              <span>{{ autoFlipEnabled ? '停止自动翻页' : '开启自动翻页' }}</span>
              <span class="tool-shortcut">A</span>
            </div>
            <div class="tool-item" @click="togglePageLayout">
              <el-icon><SwitchButton /></el-icon>
              <span>{{ isDoublePage ? '切换到单页模式' : '切换到双页模式' }}</span>
              <span class="tool-shortcut">D</span>
            </div>
            <div class="tool-item" @click="toggleOrientation">
              <el-icon><Open /></el-icon>
              <span>{{ isLandscape ? '切换到竖屏模式' : '切换到横屏模式' }}</span>
              <span class="tool-shortcut">L</span>
            </div>
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
            <h4 class="section-title">智能文本处理</h4>
            <div class="tool-item" @click="showSmartRechaptersDialog = true">
              <el-icon><MagicStick /></el-icon>
              <span>智能分章</span>
            </div>
            <div class="tool-item" @click="showCleanTextDialog = true">
              <el-icon><RefreshRight /></el-icon>
              <span>文本清理</span>
            </div>
            <div class="tool-item" @click="handleAnalyzeQuality">
              <el-icon><Aim /></el-icon>
              <span>质量分析</span>
            </div>
            <div class="tool-item" @click="handleExtractMetadata">
              <el-icon><Document /></el-icon>
              <span>提取元数据</span>
            </div>
            <div class="tool-item" @click="showSplitDialog = true">
              <el-icon><Scissor /></el-icon>
              <span>分卷拆分</span>
            </div>
          </div>

          <div class="tool-section">
            <h4 class="section-title">阅读目标</h4>
            <div class="tool-item" @click="showReadingGoalDialog = true">
              <el-icon><TrendCharts /></el-icon>
              <span>设置阅读目标</span>
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
        size="340px"
        title="阅读设置"
      >
        <div class="settings-panel">
          <div class="setting-group">
            <h4 class="group-title">主题模板</h4>
            <div class="theme-templates-grid">
              <div
                v-for="template in themeTemplates"
                :key="template.id"
                class="theme-template-item"
                :class="{ active: configStore.themeClass === `theme-${template.id}` || (template.id === 'light' && !configStore.themeClass) }"
                @click="handleApplyThemeTemplate(template.id)"
              >
                <div class="theme-template-preview" :style="{ backgroundColor: template.bgColor, borderColor: template.borderColor }">
                  <div class="preview-text" :style="{ color: template.textColor }">文</div>
                  <div class="preview-accent" :style="{ backgroundColor: template.accentColor }"></div>
                </div>
                <span class="template-name">{{ template.name }}</span>
              </div>
            </div>
          </div>

          <div class="setting-group">
            <h4 class="group-title">个性化</h4>
            <div class="customization-item">
              <div class="customization-label">
                <el-icon><Picture /></el-icon>
                <span>背景图</span>
              </div>
              <div class="customization-actions">
                <el-button size="small" @click="handleSelectBackgroundImage">选择图片</el-button>
                <el-button v-if="configStore.backgroundImage" size="small" type="danger" plain @click="handleClearBackgroundImage">清除</el-button>
              </div>
            </div>
            <div class="customization-item">
              <div class="customization-label">
                <el-icon><EditPen /></el-icon>
                <span>自定义字体</span>
              </div>
              <div class="customization-actions">
                <el-button size="small" @click="handleSelectCustomFont">导入字体</el-button>
                <el-button v-if="configStore.customFont" size="small" type="danger" plain @click="handleClearCustomFont">清除</el-button>
              </div>
            </div>
            <div v-if="configStore.customFont" class="current-font">
              当前字体：{{ configStore.customFont }}
            </div>
          </div>

          <div class="setting-group">
            <h4 class="group-title">
              透明度
              <span class="current-value">{{ readingConfig?.opacity ?? 100 }}%</span>
            </h4>
            <div class="control-row">
              <el-button circle :icon="Minus" @click="adjustOpacity(-5)" />
              <el-slider
                v-model="readingConfig.opacity"
                :min="30"
                :max="100"
                :step="5"
                @change="(val) => configStore.updateReadingConfig({ opacity: val })"
              />
              <el-button circle :icon="Plus" @click="adjustOpacity(5)" />
            </div>
          </div>

          <div class="setting-group">
            <h4 class="group-title">页面布局</h4>
            <div class="layout-options">
              <div class="layout-option" :class="{ active: !isDoublePage }" @click="togglePageLayout">
                <el-icon><Document /></el-icon>
                <span>单页</span>
              </div>
              <div class="layout-option" :class="{ active: isDoublePage }" @click="togglePageLayout">
                <el-icon><Collection /></el-icon>
                <span>双页</span>
              </div>
              <div class="layout-option" :class="{ active: !isLandscape }" @click="toggleOrientation">
                <el-icon><Cherry /></el-icon>
                <span>竖屏</span>
              </div>
              <div class="layout-option" :class="{ active: isLandscape }" @click="toggleOrientation">
                <el-icon><Food /></el-icon>
                <span>横屏</span>
              </div>
            </div>
          </div>

          <div class="setting-group">
            <h4 class="group-title">自动翻页</h4>
            <div class="auto-flip-controls">
              <el-switch
                v-model="readingConfig.autoFlipEnabled"
                @change="(val) => configStore.updateReadingConfig({ autoFlipEnabled: val })"
              />
              <div v-if="readingConfig.autoFlipEnabled" class="flip-speed-control">
                <span class="speed-label">速度：{{ autoFlipSpeedLocal }}页/分钟</span>
                <div class="control-row">
                  <el-button circle size="small" :icon="Minus" @click="adjustAutoFlipSpeed(-1)" />
                  <el-slider
                    v-model="autoFlipSpeedLocal"
                    :min="1"
                    :max="10"
                    :step="1"
                    @change="adjustAutoFlipSpeed(0)"
                    style="flex: 1;"
                  />
                  <el-button circle size="small" :icon="Plus" @click="adjustAutoFlipSpeed(1)" />
                </div>
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
                <span>自动翻页</span>
                <kbd>A</kbd>
              </div>
              <div class="shortcut-item">
                <span>双页模式</span>
                <kbd>D</kbd>
              </div>
              <div class="shortcut-item">
                <span>横屏模式</span>
                <kbd>L</kbd>
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

      <el-dialog
        v-model="showSmartRechaptersDialog"
        title="智能分章"
        width="450px"
      >
        <div class="smart-rechapters-dialog">
          <p class="dialog-tip">自动识别TXT文件中的章节标题，重新组织章节目录</p>
          
          <div class="form-item">
            <label>识别选项</label>
            <div class="checkbox-group">
              <el-checkbox v-model="smartChapterOptions.detectChineseChapters">
                识别中文章节（第一章、第1章等）
              </el-checkbox>
              <el-checkbox v-model="smartChapterOptions.detectEnglishChapters">
                识别英文章节（Chapter 1等）
              </el-checkbox>
              <el-checkbox v-model="smartChapterOptions.detectVolumeTitles">
                识别卷/部标题（第一卷、Volume 1等）
              </el-checkbox>
              <el-checkbox v-model="smartChapterOptions.mergeSmallChapters">
                合并过短章节
              </el-checkbox>
            </div>
          </div>

          <div class="form-item" v-if="smartChapterOptions.mergeSmallChapters">
            <label>最小章节字数</label>
            <el-input-number
              v-model="smartChapterOptions.minChapterLength"
              :min="100"
              :max="5000"
              :step="100"
            />
          </div>

          <div class="dialog-info">
            <el-icon><MagicStick /></el-icon>
            <span>当前已识别 {{ readerStore.chapters.length }} 个章节</span>
          </div>
        </div>
        <template #footer>
          <el-button @click="showSmartRechaptersDialog = false">取消</el-button>
          <el-button type="primary" @click="handleSmartRechapters">开始分章</el-button>
        </template>
      </el-dialog>

      <el-dialog
        v-model="showCleanTextDialog"
        title="文本清理"
        width="450px"
      >
        <div class="clean-text-dialog">
          <p class="dialog-tip">自动清理文本中的空行、乱码、重复内容等问题</p>
          
          <div class="form-item">
            <label>清理选项</label>
            <div class="checkbox-group">
              <el-checkbox v-model="cleanupOptions.removeEmptyLines">
                清理多余空行
              </el-checkbox>
              <el-checkbox v-model="cleanupOptions.fixGarbledText">
                修复乱码字符
              </el-checkbox>
              <el-checkbox v-model="cleanupOptions.normalizePunctuation">
                规范化标点符号
              </el-checkbox>
              <el-checkbox v-model="cleanupOptions.removeDuplicateChapters">
                检测并移除重复章节
              </el-checkbox>
            </div>
          </div>

          <div class="dialog-warning">
            <el-icon><Warning /></el-icon>
            <span>此操作将修改原文件内容，建议先备份</span>
          </div>
        </div>
        <template #footer>
          <el-button @click="showCleanTextDialog = false">取消</el-button>
          <el-button type="primary" @click="handleCleanText">开始清理</el-button>
        </template>
      </el-dialog>

      <el-dialog
        v-model="showReadingGoalDialog"
        title="设置阅读目标"
        width="400px"
      >
        <div class="reading-goal-dialog">
          <p class="dialog-tip">设置每日阅读目标，培养阅读习惯</p>
          
          <div class="form-item">
            <label>目标单位</label>
            <el-radio-group v-model="readingGoalUnit">
              <el-radio value="pages">页</el-radio>
              <el-radio value="minutes">分钟</el-radio>
              <el-radio value="characters">字</el-radio>
            </el-radio-group>
          </div>

          <div class="form-item">
            <label>每日目标</label>
            <el-input-number
              v-model="readingGoalTarget"
              :min="1"
              :max="readingGoalUnit === 'minutes' ? 1440 : (readingGoalUnit === 'pages' ? 1000 : 100000)"
              :step="readingGoalUnit === 'minutes' ? 5 : (readingGoalUnit === 'pages' ? 1 : 1000)"
            />
            <span class="unit-label">{{ formatUnitLabel(readingGoalUnit) }}/天</span>
          </div>

          <div v-if="goalProgress" class="goal-preview">
            <div class="preview-header">当前进度</div>
            <div class="preview-stats">
              <span>今日已完成：{{ goalProgress.todayCompleted }} {{ formatUnitLabel(goalProgress.targetUnit) }}</span>
              <span>连续打卡：{{ goalProgress.streakDays }} 天</span>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button @click="showReadingGoalDialog = false">取消</el-button>
          <el-button type="primary" @click="handleSetReadingGoal">保存目标</el-button>
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

.auto-flip-indicator {
  position: fixed;
  top: 60px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  z-index: 150;
  color: var(--text-primary);
  font-size: 13px;
  
  el-icon {
    color: var(--accent-color);
    animation: pulse 1.5s infinite;
  }
  
  .el-button {
    padding: 4px;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.book-meta {
  .session-time {
    font-size: 12px;
    color: var(--accent-color);
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.goto-page-popover {
  .goto-tabs {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
    
    span {
      padding: 4px 8px;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-secondary);
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      
      &.active {
        color: var(--accent-color);
        border-bottom-color: var(--accent-color);
      }
    }
  }
  
  .goto-input-group {
    display: flex;
    gap: 8px;
  }
}

.progress-bar {
  position: relative;
  height: 6px;
  background: var(--bg-secondary);
  cursor: pointer;
  
  .progress-slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    width: 100%;
  }
  
  .progress-tooltip {
    position: absolute;
    top: -28px;
    transform: translateX(-50%);
    background: var(--accent-color);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
  }
}

.goal-progress-bar {
  padding: 8px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-bottom: 1px solid var(--border-color);
  
  .goal-info {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: var(--text-secondary);
    
    el-icon {
      color: var(--accent-color);
    }
    
    .goal-completed {
      color: var(--accent-color);
      font-weight: 500;
    }
    
    .goal-streak {
      margin-left: auto;
      color: #ff9800;
    }
  }
  
  .goal-progress-track {
    height: 4px;
    background: var(--bg-secondary);
    border-radius: 2px;
    overflow: hidden;
    
    .goal-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-color), #67c23a);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
  }
}

.reader-page-mode.double-page {
  display: flex;
  gap: 20px;
  padding: 20px;
  
  .page-content {
    flex: 1;
    height: 100%;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.stats-panel {
  padding: 16px;
  
  .stats-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    color: var(--text-primary);
    
    h3 {
      margin: 0;
      font-size: 18px;
    }
    
    .stats-subtitle {
      margin: 0;
      font-size: 12px;
      color: var(--text-secondary);
    }
  }
  
  .stats-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
    
    .stat-card {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      
      .stat-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 8px;
        color: white;
        
        &.blue { background: #409eff; }
        &.green { background: #67c23a; }
        &.orange { background: #e6a23c; }
      }
      
      .stat-value {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .stat-label {
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 2px;
      }
    }
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    h4 {
      margin: 0;
      font-size: 14px;
      color: var(--text-primary);
    }
  }
  
  .goal-section,
  .stats-section,
  .metadata-section {
    margin-bottom: 24px;
  }
  
  .goal-card {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;
    
    .goal-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      
      .goal-target {
        font-size: 20px;
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .goal-percent {
        font-size: 14px;
        color: var(--accent-color);
        font-weight: 500;
      }
    }
    
    .goal-bar {
      height: 8px;
      background: var(--bg-primary);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
      
      .goal-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent-color), #67c23a);
        border-radius: 4px;
        transition: width 0.3s ease;
      }
    }
    
    .goal-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--text-secondary);
      
      .streak-badge {
        color: #ff9800;
        font-weight: 500;
      }
    }
  }
  
  .empty-stats {
    text-align: center;
    padding: 24px;
    color: var(--text-secondary);
    
    p {
      margin: 0;
    }
    
    .hint {
      font-size: 12px;
      color: var(--text-tertiary);
      margin-top: 4px;
    }
  }
  
  .stats-list {
    .stats-item {
      padding: 12px;
      background: var(--bg-secondary);
      border-radius: 8px;
      margin-bottom: 8px;
      
      .stats-date {
        font-size: 12px;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }
      
      .stats-details {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: var(--text-primary);
        
        span {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }
    }
  }
  
  .metadata-card {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;
    
    .metadata-item {
      margin-bottom: 16px;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .metadata-label {
        display: block;
        font-size: 12px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      
      .metadata-value {
        font-size: 14px;
        color: var(--text-primary);
        
        &.summary {
          line-height: 1.6;
        }
      }
    }
    
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      
      .tag-item {
        padding: 4px 12px;
        background: var(--accent-color);
        color: white;
        border-radius: 12px;
        font-size: 12px;
      }
    }
  }
}

.theme-templates-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  
  .theme-template-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s;
    
    &:hover {
      background: var(--bg-secondary);
    }
    
    &.active {
      border-color: var(--accent-color);
    }
    
    .theme-template-preview {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      border: 1px solid;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      
      .preview-text {
        font-size: 16px;
        font-weight: 500;
      }
      
      .preview-accent {
        position: absolute;
        bottom: 4px;
        left: 4px;
        right: 4px;
        height: 4px;
        border-radius: 2px;
      }
    }
    
    .template-name {
      font-size: 11px;
      color: var(--text-secondary);
    }
  }
}

.customization-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  
  .customization-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-primary);
    
    el-icon {
      color: var(--accent-color);
    }
  }
  
  .customization-actions {
    display: flex;
    gap: 8px;
  }
}

.current-font {
  font-size: 12px;
  color: var(--accent-color);
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  margin-top: 8px;
}

.layout-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  
  .layout-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    border-radius: 8px;
    cursor: pointer;
    border: 2px solid transparent;
    background: var(--bg-secondary);
    transition: all 0.2s;
    
    &:hover {
      background: var(--bg-tertiary);
    }
    
    &.active {
      border-color: var(--accent-color);
      background: var(--accent-color);
      color: white;
    }
    
    el-icon {
      font-size: 20px;
    }
    
    span {
      font-size: 12px;
    }
  }
}

.auto-flip-controls {
  .flip-speed-control {
    margin-top: 12px;
    
    .speed-label {
      display: block;
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    
    .control-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}

.smart-rechapters-dialog,
.clean-text-dialog,
.reading-goal-dialog {
  .dialog-tip {
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
    
    .unit-label {
      margin-left: 8px;
      color: var(--text-secondary);
    }
  }
  
  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .dialog-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    font-size: 13px;
    color: var(--text-primary);
    margin-top: 16px;
    
    el-icon {
      color: var(--accent-color);
    }
  }
  
  .dialog-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: #fef0f0;
    border-radius: 8px;
    font-size: 13px;
    color: #f56c6c;
    margin-top: 16px;
    
    el-icon {
      color: #f56c6c;
    }
  }
  
  .goal-preview {
    margin-top: 16px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    
    .preview-header {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    
    .preview-stats {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: var(--text-secondary);
    }
  }
}

.reader-container.layout-double {
  .reader-content-area {
    .reader-page-mode {
      flex-direction: row;
    }
  }
}

.reader-container.orientation-landscape {
  .reader-content-area {
    .reader-content {
      max-width: 1200px;
    }
  }
}
</style>
