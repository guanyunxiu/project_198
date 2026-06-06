<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '@/stores/config'
import { useBooksStore } from '@/stores/books'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Back,
  FolderAdd,
  Delete,
  Folder,
  Setting as SettingIcon,
  Reading,
  Monitor,
  Refresh,
  Key,
  Monitor as MonitorIcon,
  DataAnalysis,
  Download,
  Upload,
  RefreshRight,
  Warning,
  FullScreen,
  Top,
  Picture,
  Document,
  Edit,
  Minus,
  Plus,
  Apple,
  Food,
  Collection,
  Coffee,
  Cherry,
  Sunny,
  MoonNight
} from '@element-plus/icons-vue'
import type { ShortcutConfig, ThemeTemplate, ReadingGoal } from '@/types'

const router = useRouter()
const configStore = useConfigStore()
const booksStore = useBooksStore()

const readingGoalTarget = ref(30)
const readingGoalUnit = ref<'pages' | 'minutes' | 'characters'>('pages')
const activeGoal = ref<ReadingGoal | null>(null)
const showGoalDialog = ref(false)

const activeTab = ref('reading')
const newCategoryName = ref('')
const isScanning = ref(false)
const editingShortcut = ref<keyof ShortcutConfig | null>(null)
const recordingKey = ref(false)
const tempShortcut = ref('')

const shortcutLabels: Record<keyof ShortcutConfig, { label: string; description: string }> = {
  nextPage: { label: '下一页', description: '翻到下一页' },
  prevPage: { label: '上一页', description: '翻到上一页' },
  addBookmark: { label: '添加书签', description: '在当前位置添加书签' },
  goBack: { label: '返回书架', description: '返回书架页面' },
  toggleFullscreen: { label: '切换全屏', description: '开启/关闭全屏模式' },
  toggleTheme: { label: '切换主题', description: '在日间/夜间/护眼主题间切换' },
  toggleAlwaysOnTop: { label: '切换置顶', description: '开启/关闭窗口置顶' },
  search: { label: '搜索', description: '打开搜索框' },
  toggleSidebar: { label: '切换侧边栏', description: '显示/隐藏侧边栏' }
}

const windowSettings = reactive({
  rememberWindowSize: true,
  rememberWindowPosition: true,
  startFullscreen: false,
  startMinimized: false
})

onMounted(async () => {
  await configStore.loadConfig()
  await booksStore.loadCategories()
  if (configStore.appConfig) {
    windowSettings.rememberWindowSize = configStore.appConfig.rememberWindowSize ?? true
    windowSettings.rememberWindowPosition = configStore.appConfig.rememberWindowPosition ?? true
    windowSettings.startFullscreen = configStore.appConfig.startFullscreen ?? false
    windowSettings.startMinimized = configStore.appConfig.startMinimized ?? false
  }
  await loadActiveGoal()
})

async function loadActiveGoal() {
  try {
    activeGoal.value = await window.electronAPI.goal.getActiveGoal()
    if (activeGoal.value) {
      readingGoalTarget.value = activeGoal.value.dailyTarget
      readingGoalUnit.value = activeGoal.value.targetUnit
    }
  } catch (err) {
    console.error('Load active goal error:', err)
  }
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
  if (!configStore.readingConfig) return
  const newOpacity = Math.min(100, Math.max(30, (configStore.readingConfig.opacity || 100) + delta))
  configStore.updateReadingConfig({ opacity: newOpacity })
}

function togglePageLayout() {
  if (!configStore.readingConfig) return
  const newLayout = configStore.readingConfig.pageLayout === 'double' ? 'single' : 'double'
  configStore.updateReadingConfig({ pageLayout: newLayout })
  ElMessage.info(configStore.readingConfig.pageLayout === 'double' ? '已切换到双页模式' : '已切换到单页模式')
}

function toggleOrientation() {
  if (!configStore.readingConfig) return
  const newOrientation = configStore.readingConfig.orientation === 'landscape' ? 'portrait' : 'landscape'
  configStore.updateReadingConfig({ orientation: newOrientation })
  ElMessage.info(configStore.readingConfig.orientation === 'landscape' ? '已切换到横屏模式' : '已切换到竖屏模式')
}

async function handleSetReadingGoal() {
  try {
    await configStore.setReadingGoal(readingGoalTarget.value, readingGoalUnit.value)
    await loadActiveGoal()
    ElMessage.success('阅读目标已设置')
    showGoalDialog.value = false
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

function getThemeIcon(templateId: string) {
  const icons: Record<string, any> = {
    light: Sunny,
    dark: MoonNight,
    eye: Cherry,
    paper: Food,
    ocean: Apple,
    forest: Collection,
    sunset: Upload,
    lavender: Coffee
  }
  return icons[templateId] || Sunny
}

function goBack() {
  router.push('/')
}

async function addCategory() {
  if (!newCategoryName.value.trim()) {
    ElMessage.warning('请输入分类名称')
    return
  }
  await booksStore.addCategory(newCategoryName.value.trim())
  newCategoryName.value = ''
  ElMessage.success('分类创建成功')
}

async function deleteCategory(id: number, name: string) {
  try {
    await ElMessageBox.confirm(
      `确定要删除分类"${name}"吗？该分类下的书籍将移至"未分类"。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await booksStore.deleteCategory(id)
    ElMessage.success('删除成功')
  } catch {
    // User cancelled
  }
}

async function addScanPath() {
  const path = await window.electronAPI.file.openFolderDialog()
  if (path) {
    await configStore.addScanPath(path)
    ElMessage.success('扫描路径已添加')
  }
}

async function removeScanPath(path: string) {
  await configStore.removeScanPath(path)
}

async function scanBooks() {
  if (!configStore.appConfig?.scanPaths.length) {
    ElMessage.warning('请先添加扫描路径')
    return
  }

  isScanning.value = true
  try {
    const bookIds = await window.electronAPI.file.scanBooks(configStore.appConfig.scanPaths)
    ElMessage.success(`扫描完成，共找到 ${bookIds.length} 本书籍`)
    await booksStore.loadBooks()
  } finally {
    isScanning.value = false
  }
}

function resetReadingConfig() {
  configStore.updateReadingConfig({
    fontSize: 18,
    lineHeight: 2,
    letterSpacing: 1,
    pageMargin: 40,
    theme: 'light',
    readMode: 'scroll',
    pageChars: 800,
    highlightColor: '#ffeb3b'
  })
  ElMessage.success('阅读设置已重置')
}

function startEditShortcut(action: keyof ShortcutConfig) {
  editingShortcut.value = action
  recordingKey.value = true
  tempShortcut.value = ''
}

function handleKeyDown(e: KeyEvent) {
  if (!recordingKey.value || !editingShortcut.value) return
  
  e.preventDefault()
  e.stopPropagation()
  
  const keys: string[] = []
  
  if (e.ctrlKey) keys.push('Ctrl')
  if (e.altKey) keys.push('Alt')
  if (e.shiftKey) keys.push('Shift')
  if (e.metaKey) keys.push('Cmd')
  
  let keyName = e.key
  if (keyName === ' ') keyName = 'Space'
  else if (keyName === 'ArrowRight') keyName = '→'
  else if (keyName === 'ArrowLeft') keyName = '←'
  else if (keyName === 'ArrowUp') keyName = '↑'
  else if (keyName === 'ArrowDown') keyName = '↓'
  else if (keyName === 'Escape') keyName = 'Esc'
  else if (keyName === 'Enter') keyName = 'Enter'
  else if (keyName === 'Backspace') keyName = 'Backspace'
  else if (keyName === 'Tab') keyName = 'Tab'
  else keyName = keyName.toUpperCase()
  
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    keys.push(keyName)
    tempShortcut.value = keys.join(' + ')
  } else {
    tempShortcut.value = keys.join(' + ') + ' + ...'
  }
}

function handleKeyUp(e: KeyEvent) {
  if (!recordingKey.value || !editingShortcut.value) return
  
  e.preventDefault()
  e.stopPropagation()
  
  if (tempShortcut.value.includes('...')) return
  
  if (!tempShortcut.value || tempShortcut.value === '...') {
    cancelEditShortcut()
    return
  }
  
  const modifiers = ['Ctrl', 'Alt', 'Shift', 'Cmd']
  const hasKey = tempShortcut.value.split('+').some(p => !modifiers.includes(p.trim()))
  
  if (!hasKey) {
    ElMessage.warning('请至少按下一个非修饰键')
    return
  }
  
  saveShortcut()
}

async function saveShortcut() {
  if (!editingShortcut.value || !tempShortcut.value) return
  
  let storageValue = tempShortcut.value
  storageValue = storageValue.replace(/→/g, 'ArrowRight')
  storageValue = storageValue.replace(/←/g, 'ArrowLeft')
  storageValue = storageValue.replace(/↑/g, 'ArrowUp')
  storageValue = storageValue.replace(/↓/g, 'ArrowDown')
  storageValue = storageValue.replace(/Esc/g, 'Escape')
  storageValue = storageValue.replace(/Space/g, ' ')
  
  try {
    await configStore.updateShortcuts({ [editingShortcut.value]: storageValue })
    ElMessage.success('快捷键已更新')
  } catch (err) {
    ElMessage.error('保存失败')
  }
  
  cancelEditShortcut()
}

function cancelEditShortcut() {
  editingShortcut.value = null
  recordingKey.value = false
  tempShortcut.value = ''
}

async function resetShortcuts() {
  try {
    await ElMessageBox.confirm(
      '确定要重置所有快捷键为默认值吗？',
      '重置确认',
      {
        confirmButtonText: '重置',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await configStore.updateShortcuts({
      nextPage: 'ArrowRight',
      prevPage: 'ArrowLeft',
      addBookmark: 'b',
      goBack: 'Escape',
      toggleFullscreen: 'F11',
      toggleTheme: 't',
      toggleAlwaysOnTop: 'p',
      search: 'Ctrl+f',
      toggleSidebar: 's'
    })
    ElMessage.success('快捷键已重置')
  } catch {
    // User cancelled
  }
}

async function updateWindowSetting(key: keyof typeof windowSettings, value: boolean) {
  windowSettings[key] = value
  await configStore.updateAppConfig({ [key]: value })
}

async function exportAllData() {
  try {
    const data = await booksStore.batchExport(booksStore.books.map(b => b.id))
    const success = await booksStore.exportToJson(data)
    if (success) {
      ElMessage.success(`成功导出 ${data.length} 本书籍数据`)
    }
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

async function importData() {
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

async function clearAllData() {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有数据吗？此操作不可恢复！\n\n将删除：所有书籍记录、书签、阅读进度、分类、配置',
      '危险操作确认',
      {
        confirmButtonText: '确认清空',
        cancelButtonText: '取消',
        type: 'error',
        dangerouslyUseHTMLString: false
      }
    )
    ElMessage.warning('此功能暂未实现，如需重置请删除应用数据目录')
  } catch {
    // User cancelled
  }
}

function displayShortcut(value: string): string {
  let display = value
  display = display.replace(/ArrowRight/g, '→')
  display = display.replace(/ArrowLeft/g, '←')
  display = display.replace(/ArrowUp/g, '↑')
  display = display.replace(/ArrowDown/g, '↓')
  display = display.replace(/Escape/g, 'Esc')
  display = display.replace(/ /g, 'Space')
  return display
}
</script>

<template>
  <div
    class="settings-page"
    @keydown="handleKeyDown"
    @keyup="handleKeyUp"
  >
    <header class="settings-header">
      <div class="header-left">
        <el-button circle :icon="Back" @click="goBack" />
        <h1 class="title">设置</h1>
      </div>
    </header>

    <div class="settings-content">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <el-tab-pane label="阅读设置" name="reading">
          <template #label>
            <el-icon><Reading /></el-icon>
            阅读设置
          </template>
          <div class="settings-section">
            <div class="section-header">
              <h2>默认阅读配置</h2>
              <el-button size="small" :icon="Refresh" @click="resetReadingConfig">
                重置默认
              </el-button>
            </div>

            <div class="setting-item">
              <label>主题模板</label>
              <div class="theme-templates-grid">
                <div
                  v-for="template in configStore.themeTemplates"
                  :key="template.id"
                  class="theme-template-item"
                  :class="{ active: configStore.themeClass === `theme-${template.id}` || (template.id === 'light' && !configStore.themeClass) }"
                  @click="handleApplyThemeTemplate(template.id)"
                >
                  <div class="theme-template-preview" :style="{ backgroundColor: template.bgColor, borderColor: template.borderColor }">
                    <el-icon :size="18" :style="{ color: template.textColor }">
                      <component :is="getThemeIcon(template.id)" />
                    </el-icon>
                    <div class="preview-accent" :style="{ backgroundColor: template.accentColor }"></div>
                  </div>
                  <span class="template-name">{{ template.name }}</span>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <label>个性化设置</label>
              <div class="customization-grid">
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
                    <el-icon><Font /></el-icon>
                    <span>自定义字体</span>
                  </div>
                  <div class="customization-actions">
                    <el-button size="small" @click="handleSelectCustomFont">导入字体</el-button>
                    <el-button v-if="configStore.customFont" size="small" type="danger" plain @click="handleClearCustomFont">清除</el-button>
                  </div>
                </div>
              </div>
              <div v-if="configStore.customFont" class="current-font">
                当前字体：{{ configStore.customFont }}
              </div>
            </div>

            <div class="setting-item">
              <label>
                透明度
                <span class="value">{{ configStore.readingConfig?.opacity ?? 100 }}%</span>
              </label>
              <div class="control-row">
                <el-button circle :icon="Minus" @click="adjustOpacity(-5)" />
                <el-slider
                  v-model="configStore.readingConfig!.opacity"
                  :min="30"
                  :max="100"
                  :step="5"
                  @change="(val) => configStore.updateReadingConfig({ opacity: val })"
                />
                <el-button circle :icon="Plus" @click="adjustOpacity(5)" />
              </div>
            </div>

            <div class="setting-item">
              <label>页面布局</label>
              <div class="layout-buttons">
                <el-button
                  :type="!configStore.isDoublePage ? 'primary' : 'default'"
                  @click="togglePageLayout"
                >
                  <el-icon><Document /></el-icon>
                  单页模式
                </el-button>
                <el-button
                  :type="configStore.isDoublePage ? 'primary' : 'default'"
                  @click="togglePageLayout"
                >
                  <el-icon><Collection /></el-icon>
                  双页模式
                </el-button>
                <el-button
                  :type="!configStore.isLandscape ? 'primary' : 'default'"
                  @click="toggleOrientation"
                >
                  <el-icon><Cherry /></el-icon>
                  竖屏模式
                </el-button>
                <el-button
                  :type="configStore.isLandscape ? 'primary' : 'default'"
                  @click="toggleOrientation"
                >
                  <el-icon><Food /></el-icon>
                  横屏模式
                </el-button>
              </div>
            </div>

            <div class="setting-item">
              <label>自动翻页</label>
              <div class="auto-flip-setting">
                <el-switch
                  v-model="configStore.readingConfig!.autoFlipEnabled"
                  @change="(val) => configStore.updateReadingConfig({ autoFlipEnabled: val })"
                />
                <div v-if="configStore.readingConfig?.autoFlipEnabled" class="flip-speed-info">
                  <span>速度：{{ configStore.readingConfig?.autoFlipSpeed || 3 }}页/分钟</span>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <label>默认阅读模式</label>
              <el-radio-group
                v-model="configStore.readingConfig!.readMode"
                @change="(val) => configStore.updateReadingConfig({ readMode: val })"
              >
                <el-radio-button value="scroll">滚动模式</el-radio-button>
                <el-radio-button value="page">翻页模式</el-radio-button>
              </el-radio-group>
            </div>

            <div class="setting-item">
              <label>阅读目标</label>
              <div class="reading-goal-setting">
                <div v-if="activeGoal" class="current-goal">
                  <span>当前目标：每天 {{ activeGoal.dailyTarget }} {{ formatUnitLabel(activeGoal.targetUnit) }}</span>
                </div>
                <el-button size="small" @click="showGoalDialog = true">
                  <el-icon><Edit /></el-icon>
                  {{ activeGoal ? '修改目标' : '设置目标' }}
                </el-button>
              </div>
            </div>

            <div class="setting-item">
              <label>
                默认字号
                <span class="value">{{ configStore.readingConfig?.fontSize }}px</span>
              </label>
              <el-slider
                v-model="configStore.readingConfig!.fontSize"
                :min="12"
                :max="48"
                :step="2"
                :marks="{ 12: '12px', 18: '18px', 24: '24px', 36: '36px', 48: '48px' }"
                @change="(val) => configStore.updateReadingConfig({ fontSize: val })"
              />
            </div>

            <div class="setting-item">
              <label>
                默认行间距
                <span class="value">{{ configStore.readingConfig?.lineHeight.toFixed(1) }}</span>
              </label>
              <el-slider
                v-model="configStore.readingConfig!.lineHeight"
                :min="1.2"
                :max="4"
                :step="0.2"
                :marks="{ 1.2: '1.2', 2: '2.0', 3: '3.0', 4: '4.0' }"
                @change="(val) => configStore.updateReadingConfig({ lineHeight: val })"
              />
            </div>

            <div class="setting-item">
              <label>
                默认页边距
                <span class="value">{{ configStore.readingConfig?.pageMargin }}px</span>
              </label>
              <el-slider
                v-model="configStore.readingConfig!.pageMargin"
                :min="10"
                :max="200"
                :step="10"
                :marks="{ 10: '10px', 40: '40px', 100: '100px', 200: '200px' }"
                @change="(val) => configStore.updateReadingConfig({ pageMargin: val })"
              />
            </div>

            <div class="setting-item">
              <label>
                默认每页字数
                <span class="value">{{ configStore.readingConfig?.pageChars }}</span>
              </label>
              <el-slider
                v-model="configStore.readingConfig!.pageChars"
                :min="200"
                :max="2000"
                :step="100"
                :marks="{ 200: '200', 800: '800', 1400: '1400', 2000: '2000' }"
                @change="(val) => configStore.updateReadingConfig({ pageChars: val })"
              />
            </div>

            <div class="setting-item">
              <label>搜索高亮颜色</label>
              <el-color-picker
                v-model="configStore.readingConfig!.highlightColor"
                @change="(val) => configStore.updateReadingConfig({ highlightColor: val })"
                show-alpha
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="快捷键" name="shortcuts">
          <template #label>
            <el-icon><Key /></el-icon>
            快捷键
          </template>
          <div class="settings-section">
            <div class="section-header">
              <h2>快捷键设置</h2>
              <el-button size="small" :icon="RefreshRight" @click="resetShortcuts">
                重置默认
              </el-button>
            </div>
            <p class="section-desc">
              点击快捷键进行修改，按下新的组合键完成设置。支持 Ctrl、Alt、Shift、Cmd 组合键。
            </p>

            <div class="shortcut-list">
              <div
                v-for="(info, action) in shortcutLabels"
                :key="action"
                class="shortcut-item"
              >
                <div class="shortcut-info">
                  <div class="shortcut-name">{{ info.label }}</div>
                  <div class="shortcut-desc">{{ info.description }}</div>
                </div>
                <div class="shortcut-value">
                  <el-button
                    v-if="editingShortcut !== action"
                    class="shortcut-btn"
                    @click="startEditShortcut(action as keyof ShortcutConfig)"
                  >
                    {{ displayShortcut(configStore.shortcuts?.[action as keyof ShortcutConfig] || '') }}
                  </el-button>
                  <el-button
                    v-else
                    class="shortcut-btn recording"
                    type="primary"
                    @click="cancelEditShortcut"
                  >
                    {{ recordingKey ? (tempShortcut || '按下按键...') : '保存' }}
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="窗口设置" name="window">
          <template #label>
            <el-icon><MonitorIcon /></el-icon>
            窗口设置
          </template>
          <div class="settings-section">
            <div class="section-header">
              <h2>窗口行为</h2>
            </div>

            <div class="setting-item">
              <label>
                <el-icon><FullScreen /></el-icon>
                记住窗口大小
              </label>
              <el-switch
                v-model="windowSettings.rememberWindowSize"
                @change="(val) => updateWindowSetting('rememberWindowSize', val)"
              />
            </div>

            <div class="setting-item">
              <label>
                <el-icon><MonitorIcon /></el-icon>
                记住窗口位置
              </label>
              <el-switch
                v-model="windowSettings.rememberWindowPosition"
                @change="(val) => updateWindowSetting('rememberWindowPosition', val)"
              />
            </div>

            <div class="setting-item">
              <label>
                <el-icon><FullScreen /></el-icon>
                启动时全屏
              </label>
              <el-switch
                v-model="windowSettings.startFullscreen"
                @change="(val) => updateWindowSetting('startFullscreen', val)"
              />
            </div>

            <div class="setting-item">
              <label>
                <el-icon><Warning /></el-icon>
                启动时最小化
              </label>
              <el-switch
                v-model="windowSettings.startMinimized"
                @change="(val) => updateWindowSetting('startMinimized', val)"
              />
            </div>

            <div class="setting-item">
              <label>
                <el-icon><Top /></el-icon>
                默认窗口置顶
              </label>
              <el-switch
                v-model="configStore.appConfig!.isAlwaysOnTop"
                @change="(val) => configStore.updateAppConfig({ isAlwaysOnTop: val })"
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="数据管理" name="data">
          <template #label>
            <el-icon><DataAnalysis /></el-icon>
            数据管理
          </template>
          <div class="settings-section">
            <div class="section-header">
              <h2>书架数据</h2>
            </div>
            <p class="section-desc">
              导出或导入您的书架数据，包括书籍信息、阅读进度、书签、分类等。
            </p>

            <div class="data-actions">
              <div class="data-action-card">
                <el-icon class="action-icon" :size="32"><Download /></el-icon>
                <div class="action-info">
                  <h3>导出全部数据</h3>
                  <p>将所有书架数据导出为 JSON 文件</p>
                </div>
                <el-button type="primary" :icon="Download" @click="exportAllData">
                  导出
                </el-button>
              </div>

              <div class="data-action-card">
                <el-icon class="action-icon" :size="32"><Upload /></el-icon>
                <div class="action-info">
                  <h3>导入数据</h3>
                  <p>从 JSON 文件导入书架数据</p>
                </div>
                <el-button :icon="Upload" @click="importData">
                  导入
                </el-button>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-header">
              <h2>统计信息</h2>
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">{{ booksStore.books.length }}</div>
                <div class="stat-label">书籍总数</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ booksStore.categories.length }}</div>
                <div class="stat-label">分类数量</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ booksStore.books.reduce((sum, b) => sum + (b.totalReadingTime || 0), 0) > 3600 ? Math.floor(booksStore.books.reduce((sum, b) => sum + (b.totalReadingTime || 0), 0) / 3600) + 'h' : Math.floor(booksStore.books.reduce((sum, b) => sum + (b.totalReadingTime || 0), 0) / 60) + 'm' }}</div>
                <div class="stat-label">总阅读时长</div>
              </div>
            </div>
          </div>

          <div class="settings-section danger-section">
            <div class="section-header">
              <h2>危险操作</h2>
            </div>
            <div class="danger-actions">
              <el-button type="danger" :icon="Delete" @click="clearAllData">
                清空所有数据
              </el-button>
              <p class="danger-desc">此操作将删除所有书籍、书签、阅读进度和设置，且无法恢复。</p>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="分类管理" name="category">
          <template #label>
            <el-icon><Folder /></el-icon>
            分类管理
          </template>
          <div class="settings-section">
            <div class="section-header">
              <h2>书籍分类</h2>
            </div>

            <div class="add-category">
              <el-input
                v-model="newCategoryName"
                placeholder="输入新分类名称"
                @keyup.enter="addCategory"
              />
              <el-button type="primary" :icon="FolderAdd" @click="addCategory">
                添加分类
              </el-button>
            </div>

            <div class="category-list">
              <div
                v-for="cat in booksStore.categories"
                :key="cat.id"
                class="category-item"
              >
                <div class="category-info">
                  <el-icon><Folder /></el-icon>
                  <span class="category-name">{{ cat.name }}</span>
                  <span class="category-count">
                    {{ booksStore.books.filter(b => b.categoryId === cat.id).length }} 本
                  </span>
                </div>
                <el-button
                  v-if="cat.name !== '未分类'"
                  circle
                  size="small"
                  type="danger"
                  :icon="Delete"
                  @click="deleteCategory(cat.id, cat.name)"
                />
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="扫描设置" name="scan">
          <template #label>
            <el-icon><Monitor /></el-icon>
            扫描设置
          </template>
          <div class="settings-section">
            <div class="section-header">
              <h2>扫描路径</h2>
              <el-button
                type="primary"
                :icon="FolderAdd"
                :loading="isScanning"
                @click="scanBooks"
              >
                立即扫描
              </el-button>
            </div>

            <div class="scan-paths">
              <div v-if="!configStore.appConfig?.scanPaths.length" class="empty-paths">
                <el-icon :size="48"><Folder /></el-icon>
                <p>暂无扫描路径</p>
                <p class="hint">添加路径后会自动扫描该目录下的所有小说文件</p>
              </div>
              <div
                v-for="path in configStore.appConfig?.scanPaths"
                :key="path"
                class="path-item"
              >
                <div class="path-info">
                  <el-icon><Folder /></el-icon>
                  <span class="path-text">{{ path }}</span>
                </div>
                <el-button
                  circle
                  size="small"
                  type="danger"
                  :icon="Delete"
                  @click="removeScanPath(path)"
                />
              </div>
            </div>

            <el-button :icon="FolderAdd" @click="addScanPath">
              添加扫描路径
            </el-button>
          </div>

          <div class="settings-section">
            <div class="section-header">
              <h2>编码设置</h2>
            </div>
            <div class="setting-item">
              <label>自动检测编码</label>
              <el-switch
                v-model="configStore.appConfig!.autoDetectEncoding"
                @change="(val) => configStore.updateAppConfig({ autoDetectEncoding: val })"
              />
            </div>
            <div class="setting-item">
              <label>默认编码</label>
              <el-select
                v-model="configStore.appConfig!.defaultEncoding"
                @change="(val) => configStore.updateAppConfig({ defaultEncoding: val })"
              >
                <el-option label="UTF-8" value="utf-8" />
                <el-option label="GBK" value="gbk" />
                <el-option label="GB2312" value="gb2312" />
                <el-option label="GB18030" value="gb18030" />
                <el-option label="BIG5" value="big5" />
              </el-select>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="关于" name="about">
          <template #label>
            <el-icon><SettingIcon /></el-icon>
            关于
          </template>
          <div class="settings-section about-section">
            <div class="app-logo">📚</div>
            <h2 class="app-name">小说阅读器</h2>
            <p class="app-version">版本 1.0.0</p>
            <p class="app-desc">
              一个简洁、高效的本地小说阅读器，支持 TXT、EPUB、PDF、CHM 等多种格式。
            </p>
            <div class="tech-stack">
              <h3>技术栈</h3>
              <ul>
                <li>Electron 28+</li>
                <li>Vue 3 + TypeScript</li>
                <li>Vite</li>
                <li>Pinia</li>
                <li>Element Plus</li>
                <li>Better-SQLite3</li>
              </ul>
            </div>
            <div class="features">
              <h3>功能特性</h3>
              <ul>
                <li>📖 支持 TXT、EPUB、PDF、CHM 格式</li>
                <li>🎨 三种主题（日间/夜间/护眼）</li>
                <li>📑 智能分页，章节识别</li>
                <li>🔖 书签功能</li>
                <li>📊 阅读进度保存</li>
                <li>📁 批量扫描导入</li>
                <li>🏷️ 分类管理</li>
                <li>⌨️ 自定义快捷键</li>
                <li>🔍 全文搜索，关键词高亮</li>
                <li>📂 TXT分卷拆分</li>
                <li>💾 数据导入导出</li>
                <li>📈 阅读时长统计</li>
                <li>📝 书籍备注</li>
                <li>🪟 窗口置顶、全屏、记忆位置</li>
              </ul>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div v-if="recordingKey" class="shortcut-overlay" @click="cancelEditShortcut">
      <div class="shortcut-popup">
        <h3>按下新的快捷键</h3>
        <div class="current-keys">{{ tempShortcut || '按下按键...' }}</div>
        <p class="hint">按 Esc 或点击外部取消</p>
      </div>
    </div>

    <el-dialog
      v-model="showGoalDialog"
      title="设置阅读目标"
      width="400px"
    >
      <div class="reading-goal-form">
        <div class="goal-input-row">
          <div class="goal-target-input">
            <label>每日目标</label>
            <el-input-number
              v-model="readingGoalTarget"
              :min="1"
              :max="1000"
              size="large"
              style="width: 100%"
            />
          </div>
          <div class="goal-unit-select">
            <label>单位</label>
            <el-select v-model="readingGoalUnit" size="large" style="width: 100%">
              <el-option label="页" value="pages" />
              <el-option label="分钟" value="minutes" />
              <el-option label="字" value="characters" />
            </el-select>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showGoalDialog = false">取消</el-button>
          <el-button type="primary" @click="handleSetReadingGoal">
            确认设置
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.settings-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  position: relative;
}

.settings-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .title {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      color: var(--text-primary);
    }
  }
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;

  :deep(.el-tabs__header) {
    margin-bottom: 24px;
  }

  :deep(.el-tabs__nav-wrap) {
    padding: 0;
  }

  :deep(.el-tabs__item) {
    padding: 0 20px;
  }
}

.settings-section {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h2 {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      color: var(--text-primary);
    }
  }

  .section-desc {
    color: var(--text-secondary);
    font-size: 13px;
    margin-bottom: 24px;
  }

  &.danger-section {
    border: 1px solid var(--error-color, #f56c6c);
    
    .section-header h2 {
      color: var(--error-color, #f56c6c);
    }
  }
}

.setting-item {
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
  }

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 160px;
    font-size: 14px;
    color: var(--text-primary);
    margin-bottom: 8px;

    .value {
      color: var(--accent-color);
      margin-left: 8px;
      font-weight: 500;
    }
  }

  :deep(.el-slider) {
    flex: 1;
    max-width: 400px;
  }
}

.add-category {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;

  .el-input {
    flex: 1;
    max-width: 300px;
  }
}

.category-list {
  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    margin-bottom: 8px;

    .category-info {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--text-primary);

      .category-name {
        font-weight: 500;
      }

      .category-count {
        font-size: 12px;
        color: var(--text-tertiary);
      }
    }
  }
}

.scan-paths {
  margin-bottom: 16px;

  .empty-paths {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    border-radius: 8px;
    margin-bottom: 16px;

    .hint {
      font-size: 12px;
      color: var(--text-tertiary);
      margin-top: 4px;
    }
  }

  .path-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    margin-bottom: 8px;

    .path-info {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--text-primary);
      overflow: hidden;

      .path-text {
        font-family: monospace;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}

.shortcut-list {
  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px solid var(--border-color);

    &:last-child {
      border-bottom: none;
    }

    .shortcut-info {
      .shortcut-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      .shortcut-desc {
        font-size: 12px;
        color: var(--text-tertiary);
      }
    }

    .shortcut-value {
      .shortcut-btn {
        min-width: 180px;
        text-align: center;
        font-family: monospace;
        font-size: 13px;

        &.recording {
          animation: pulse 1s infinite;
        }
      }
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.shortcut-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  .shortcut-popup {
    background: var(--bg-primary);
    padding: 40px 60px;
    border-radius: 16px;
    text-align: center;

    h3 {
      font-size: 18px;
      margin: 0 0 20px;
      color: var(--text-primary);
    }

    .current-keys {
      font-size: 24px;
      font-family: monospace;
      font-weight: 600;
      color: var(--accent-color);
      background: var(--bg-secondary);
      padding: 16px 32px;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .hint {
      font-size: 13px;
      color: var(--text-tertiary);
      margin: 0;
    }
  }
}

.data-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .data-action-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 20px;
    background: var(--bg-secondary);
    border-radius: 12px;

    .action-icon {
      color: var(--accent-color);
    }

    .action-info {
      flex: 1;

      h3 {
        font-size: 15px;
        font-weight: 600;
        margin: 0 0 4px;
        color: var(--text-primary);
      }

      p {
        font-size: 13px;
        color: var(--text-secondary);
        margin: 0;
      }
    }
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;

  .stat-item {
    text-align: center;
    padding: 24px;
    background: var(--bg-secondary);
    border-radius: 12px;

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: var(--accent-color);
      margin-bottom: 8px;
    }

    .stat-label {
      font-size: 13px;
      color: var(--text-secondary);
    }
  }
}

.danger-actions {
  text-align: center;

  .danger-desc {
    margin-top: 12px;
    font-size: 12px;
    color: var(--text-tertiary);
  }
}

.about-section {
  text-align: center;

  .app-logo {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .app-name {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px;
  }

  .app-version {
    font-size: 14px;
    color: var(--text-tertiary);
    margin: 0 0 16px;
  }

  .app-desc {
    color: var(--text-secondary);
    margin-bottom: 24px;
  }

  .tech-stack,
  .features {
    text-align: left;
    margin-bottom: 24px;

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    ul {
      list-style: none;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;

      li {
        padding: 8px 12px;
        background: var(--bg-secondary);
        border-radius: 6px;
        font-size: 13px;
        color: var(--text-secondary);
      }
    }
  }
}

.theme-templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.theme-template-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  
  &:hover {
    background: var(--bg-tertiary);
    transform: translateY(-2px);
  }
  
  &.active {
    border-color: var(--accent-color);
    background: var(--bg-secondary);
  }
}

.theme-template-preview {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  
  .preview-accent {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 6px;
  }
}

.template-name {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

.customization-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.customization-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.customization-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  
  .el-icon {
    color: var(--accent-color);
  }
}

.customization-actions {
  display: flex;
  gap: 8px;
}

.current-font {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  
  .el-slider {
    flex: 1;
  }
}

.layout-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.auto-flip-setting {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.flip-speed-info {
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 13px;
  color: var(--accent-color);
}

.reading-goal-setting {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.current-goal {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 13px;
}

.reading-goal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.goal-input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.goal-target-input {
  flex: 1;
}

.goal-unit-select {
  width: 120px;
}

.setting-item label {
  .value {
    margin-left: 8px;
    color: var(--accent-color);
    font-weight: 500;
  }
}
</style>
