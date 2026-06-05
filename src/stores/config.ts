import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppConfig, ReadingConfig, ShortcutConfig } from '@/types'

export const useConfigStore = defineStore('config', () => {
  const appConfig = ref<AppConfig | null>(null)
  const readingConfig = ref<ReadingConfig | null>(null)
  const shortcuts = ref<ShortcutConfig | null>(null)
  const isAlwaysOnTop = ref(false)
  const isFullscreen = ref(false)

  const themeClass = computed(() => {
    if (!readingConfig.value) return 'theme-light'
    return `theme-${readingConfig.value.theme}`
  })

  async function loadConfig() {
    appConfig.value = await window.electronAPI.app.getConfig()
    readingConfig.value = await window.electronAPI.app.getReadingConfig()
    shortcuts.value = await window.electronAPI.app.getShortcuts()
    isAlwaysOnTop.value = await window.electronAPI.window.isAlwaysOnTop()
    isFullscreen.value = await window.electronAPI.window.isFullscreen()
  }

  async function updateAppConfig(updates: Partial<AppConfig>) {
    appConfig.value = await window.electronAPI.app.updateConfig(updates)
  }

  async function updateReadingConfig(updates: Partial<ReadingConfig>) {
    readingConfig.value = await window.electronAPI.app.updateReadingConfig(updates)
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
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-eye')
    if (readingConfig.value) {
      document.documentElement.classList.add(`theme-${readingConfig.value.theme}`)
    }
  }

  return {
    appConfig,
    readingConfig,
    shortcuts,
    isAlwaysOnTop,
    isFullscreen,
    themeClass,
    loadConfig,
    updateAppConfig,
    updateReadingConfig,
    updateShortcuts,
    addScanPath,
    removeScanPath,
    addFavoritePath,
    removeFavoritePath,
    toggleFullscreen,
    toggleAlwaysOnTop,
    matchShortcut,
    applyTheme
  }
})
