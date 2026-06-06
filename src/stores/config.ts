import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { AppConfig, ReadingConfig, ShortcutConfig, ThemeTemplate, ReadingGoalProgress, ReadingGoal } from '@/types'

export const useConfigStore = defineStore('config', () => {
  const appConfig = ref<AppConfig | null>(null)
  const readingConfig = ref<ReadingConfig | null>(null)
  const shortcuts = ref<ShortcutConfig | null>(null)
  const isAlwaysOnTop = ref(false)
  const isFullscreen = ref(false)
  const themeTemplates = ref<ThemeTemplate[]>([])
  const goalProgress = ref<ReadingGoalProgress | null>(null)
  const autoFlipActive = ref(false)

  const themeClass = computed(() => {
    if (!readingConfig.value) return 'theme-light'
    return `theme-${readingConfig.value.themeTemplate || readingConfig.value.theme}`
  })

  const isDoublePage = computed(() => readingConfig.value?.pageLayout === 'double')
  const isLandscape = computed(() => readingConfig.value?.orientation === 'landscape')
  const opacity = computed(() => readingConfig.value?.opacity ?? 100)
  const backgroundImage = computed(() => readingConfig.value?.backgroundImage)
  const customFont = computed(() => readingConfig.value?.customFont)

  const readerStyle = computed(() => {
    const style: Record<string, string> = {}
    if (readingConfig.value) {
      if (readingConfig.value.backgroundImage) {
        style.backgroundImage = `url(${readingConfig.value.backgroundImage})`
        style.backgroundSize = 'cover'
        style.backgroundPosition = 'center'
        style.backgroundRepeat = 'no-repeat'
      }
      if (readingConfig.value.customFont) {
        style.fontFamily = readingConfig.value.customFont
      }
      if (readingConfig.value.opacity !== undefined && readingConfig.value.opacity < 100) {
        style.opacity = `${readingConfig.value.opacity / 100}`
      }
    }
    return style
  })

  async function loadConfig() {
    appConfig.value = await window.electronAPI.app.getConfig()
    readingConfig.value = await window.electronAPI.app.getReadingConfig()
    shortcuts.value = await window.electronAPI.app.getShortcuts()
    isAlwaysOnTop.value = await window.electronAPI.window.isAlwaysOnTop()
    isFullscreen.value = await window.electronAPI.window.isFullscreen()
    themeTemplates.value = await window.electronAPI.app.getThemeTemplates()
    await loadGoalProgress()
    applyTheme()
    applyCustomStyles()
  }

  async function loadGoalProgress() {
    try {
      goalProgress.value = await window.electronAPI.goal.getGoalProgress()
    } catch (err) {
      console.error('Load goal progress error:', err)
    }
  }

  async function updateAppConfig(updates: Partial<AppConfig>) {
    appConfig.value = await window.electronAPI.app.updateConfig(updates)
  }

  async function updateReadingConfig(updates: Partial<ReadingConfig>) {
    readingConfig.value = await window.electronAPI.app.updateReadingConfig(updates)
    if (updates.theme || updates.themeTemplate) {
      applyTheme()
    }
    if (updates.backgroundImage || updates.customFont || updates.opacity) {
      applyCustomStyles()
    }
  }

  async function applyThemeTemplate(templateId: string) {
    readingConfig.value = await window.electronAPI.app.applyThemeTemplate(templateId)
    applyTheme()
  }

  async function updateShortcuts(updates: Partial<ShortcutConfig>) {
    shortcuts.value = await window.electronAPI.app.updateShortcuts(updates)
  }

  async function addScanPath(path: string) {
    appConfig.value = await window.electronAPI.app.addScanPath(path)
  }

  async function removeScanPath(path: string) {
    appConfig.value = await window.electronAPI.app.removeScanPath(path)
  }

  async function addFavoritePath(path: string) {
    appConfig.value = await window.electronAPI.app.addFavoritePath(path)
  }

  async function removeFavoritePath(path: string) {
    appConfig.value = await window.electronAPI.app.removeFavoritePath(path)
  }

  async function toggleFullscreen() {
    isFullscreen.value = await window.electronAPI.window.toggleFullscreen()
    return isFullscreen.value
  }

  async function toggleAlwaysOnTop() {
    isAlwaysOnTop.value = await window.electronAPI.window.toggleAlwaysOnTop()
    return isAlwaysOnTop.value
  }

  async function toggleAutoFlip() {
    if (!readingConfig.value) return
    autoFlipActive.value = !autoFlipActive.value
    return autoFlipActive.value
  }

  async function selectBackgroundImage() {
    const path = await window.electronAPI.file.selectImage()
    if (path) {
      await updateReadingConfig({ backgroundImage: path })
    }
    return path
  }

  async function clearBackgroundImage() {
    await updateReadingConfig({ backgroundImage: null })
  }

  async function selectCustomFont() {
    const path = await window.electronAPI.file.selectFont()
    if (path) {
      const fontName = path.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Custom Font'
      await updateReadingConfig({ 
        customFont: fontName,
        customFontPath: path 
      })
      loadCustomFont(path, fontName)
    }
    return path
  }

  async function clearCustomFont() {
    await updateReadingConfig({ 
      customFont: null,
      customFontPath: null 
    })
  }

  function loadCustomFont(fontPath: string, fontName: string) {
    const existingStyle = document.getElementById('custom-font-style')
    if (existingStyle) {
      existingStyle.remove()
    }

    const style = document.createElement('style')
    style.id = 'custom-font-style'
    style.textContent = `
      @font-face {
        font-family: '${fontName}';
        src: url('${fontPath}');
      }
    `
    document.head.appendChild(style)
  }

  function applyCustomStyles() {
    if (readingConfig.value?.customFont && readingConfig.value?.customFontPath) {
      loadCustomFont(readingConfig.value.customFontPath, readingConfig.value.customFont)
    }
  }

  async function setReadingGoal(target: number, unit: 'pages' | 'minutes' | 'characters') {
    const existingGoal = await window.electronAPI.goal.getActiveGoal()
    if (existingGoal) {
      await window.electronAPI.goal.update(existingGoal.id, { 
        dailyTarget: target, 
        targetUnit: unit,
        isActive: 1
      })
    } else {
      await window.electronAPI.goal.create({
        dailyTarget: target,
        targetUnit: unit,
        startDate: Date.now(),
        endDate: null,
        isActive: 1
      })
    }
    await loadGoalProgress()
  }

  function matchShortcut(e: KeyboardEvent, action: keyof ShortcutConfig): boolean {
    if (!shortcuts.value) return false
    
    const shortcut = shortcuts.value[action]
    if (!shortcut) return false
    
    const parts = shortcut.split('+').map(p => p.trim().toLowerCase())
    const key = parts[parts.length - 1]
    
    const hasCtrl = parts.includes('ctrl') || parts.includes('control')
    const hasAlt = parts.includes('alt') || parts.includes('option')
    const hasShift = parts.includes('shift')
    const hasMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command')
    
    const actualKey = e.key.toLowerCase()
    const matchesKey = actualKey === key || 
      (key === 'arrowright' && e.key === 'ArrowRight') ||
      (key === 'arrowleft' && e.key === 'ArrowLeft') ||
      (key === 'arrowup' && e.key === 'ArrowUp') ||
      (key === 'arrowdown' && e.key === 'ArrowDown') ||
      (key === 'escape' && e.key === 'Escape') ||
      (key === 'enter' && e.key === 'Enter') ||
      (key === ' ' && e.key === ' ') ||
      (key === 'space' && e.key === ' ')
    
    const matchesModifiers = 
      hasCtrl === e.ctrlKey &&
      hasAlt === e.altKey &&
      hasShift === e.shiftKey &&
      hasMeta === e.metaKey
    
    return matchesKey && matchesModifiers
  }

  function applyTheme() {
    document.documentElement.classList.remove(
      'theme-light', 'theme-dark', 'theme-eye', 'theme-paper', 
      'theme-ocean', 'theme-forest', 'theme-sunset', 'theme-lavender'
    )
    if (readingConfig.value) {
      const themeName = readingConfig.value.themeTemplate || readingConfig.value.theme
      document.documentElement.classList.add(`theme-${themeName}`)
      applyThemeVariables(themeName)
    }
  }

  function applyThemeVariables(themeName: string) {
    const template = themeTemplates.value.find(t => t.id === themeName)
    if (template) {
      const root = document.documentElement
      root.style.setProperty('--reader-bg', template.bgColor)
      root.style.setProperty('--reader-text', template.textColor)
      root.style.setProperty('--accent-color', template.accentColor)
      root.style.setProperty('--bg-primary', template.bgColor)
      root.style.setProperty('--bg-secondary', template.secondaryBg)
      root.style.setProperty('--text-primary', template.textColor)
      root.style.setProperty('--border-color', template.borderColor)
      root.style.setProperty('--bg-primary-rgb', hexToRgb(template.bgColor))
    }
  }

  function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '253, 251, 247'
  }

  return {
    appConfig,
    readingConfig,
    shortcuts,
    isAlwaysOnTop,
    isFullscreen,
    themeTemplates,
    goalProgress,
    autoFlipActive,
    themeClass,
    isDoublePage,
    isLandscape,
    opacity,
    backgroundImage,
    customFont,
    readerStyle,
    loadConfig,
    loadGoalProgress,
    updateAppConfig,
    updateReadingConfig,
    updateShortcuts,
    addScanPath,
    removeScanPath,
    addFavoritePath,
    removeFavoritePath,
    toggleFullscreen,
    toggleAlwaysOnTop,
    toggleAutoFlip,
    applyThemeTemplate,
    selectBackgroundImage,
    clearBackgroundImage,
    selectCustomFont,
    clearCustomFont,
    setReadingGoal,
    matchShortcut,
    applyTheme,
    applyCustomStyles
  }
})
