import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppConfig, ReadingConfig } from '@/types'

export const useConfigStore = defineStore('config', () => {
  const appConfig = ref<AppConfig | null>(null)
  const readingConfig = ref<ReadingConfig | null>(null)

  const themeClass = computed(() => {
    if (!readingConfig.value) return 'theme-light'
    return `theme-${readingConfig.value.theme}`
  })

  async function loadConfig() {
    appConfig.value = await window.electronAPI.app.getConfig()
    readingConfig.value = await window.electronAPI.app.getReadingConfig()
  }

  async function updateAppConfig(updates: Partial<AppConfig>) {
    appConfig.value = await window.electronAPI.app.updateConfig(updates)
  }

  async function updateReadingConfig(updates: Partial<ReadingConfig>) {
    readingConfig.value = await window.electronAPI.app.updateReadingConfig(updates)
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

  function applyTheme() {
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-eye')
    if (readingConfig.value) {
      document.documentElement.classList.add(`theme-${readingConfig.value.theme}`)
    }
  }

  return {
    appConfig,
    readingConfig,
    themeClass,
    loadConfig,
    updateAppConfig,
    updateReadingConfig,
    addScanPath,
    removeScanPath,
    addFavoritePath,
    removeFavoritePath,
    applyTheme
  }
})
