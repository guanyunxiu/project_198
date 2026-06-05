import { app } from 'electron'
import { join } from 'path'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import type { AppConfig, ReadingConfig } from '../types'

const defaultReadingConfig: ReadingConfig = {
  fontSize: 18,
  lineHeight: 2,
  letterSpacing: 1,
  pageMargin: 40,
  theme: 'light',
  readMode: 'scroll',
  pageChars: 800
}

const defaultConfig: AppConfig = {
  defaultEncoding: 'utf-8',
  autoDetectEncoding: true,
  scanPaths: [],
  favoritePaths: [],
  windowWidth: 1200,
  windowHeight: 800,
  windowX: null,
  windowY: null,
  isMaximized: false,
  readingConfig: defaultReadingConfig
}

let configPath: string
let currentConfig: AppConfig

export function initConfig(): void {
  const userDataPath = app.getPath('userData')
  configPath = join(userDataPath, 'config.json')

  if (existsSync(configPath)) {
    try {
      const saved = JSON.parse(readFileSync(configPath, 'utf-8'))
      currentConfig = {
        ...defaultConfig,
        ...saved,
        readingConfig: { ...defaultReadingConfig, ...saved.readingConfig }
      }
    } catch {
      currentConfig = { ...defaultConfig }
    }
  } else {
    currentConfig = { ...defaultConfig }
    saveConfig()
  }
}

export function getConfig(): AppConfig {
  return { ...currentConfig }
}

export function getReadingConfig(): ReadingConfig {
  return { ...currentConfig.readingConfig }
}

export function saveConfig(): void {
  writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8')
}

export function updateConfig(updates: Partial<AppConfig>): void {
  currentConfig = { ...currentConfig, ...updates }
  saveConfig()
}

export function updateReadingConfig(updates: Partial<ReadingConfig>): void {
  currentConfig.readingConfig = { ...currentConfig.readingConfig, ...updates }
  saveConfig()
}

export function addScanPath(path: string): void {
  if (!currentConfig.scanPaths.includes(path)) {
    currentConfig.scanPaths.push(path)
    saveConfig()
  }
}

export function removeScanPath(path: string): void {
  currentConfig.scanPaths = currentConfig.scanPaths.filter(p => p !== path)
  saveConfig()
}

export function addFavoritePath(path: string): void {
  if (!currentConfig.favoritePaths.includes(path)) {
    currentConfig.favoritePaths.push(path)
    saveConfig()
  }
}

export function removeFavoritePath(path: string): void {
  currentConfig.favoritePaths = currentConfig.favoritePaths.filter(p => p !== path)
  saveConfig()
}
