import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { getConfig, updateConfig } from './config'
import { bookDb } from './db'

let mainWindow: BrowserWindow | null = null
let readingStartTime: number | null = null
let currentBookId: number | null = null

function getWindowBounds() {
  const config = getConfig()
  const { workArea } = screen.getPrimaryDisplay()
  
  let width = config.windowWidth || Math.min(1200, workArea.width - 100)
  let height = config.windowHeight || Math.min(800, workArea.height - 100)
  let x = config.windowX
  let y = config.windowY

  if (x === null || y === null) {
    x = workArea.x + Math.floor((workArea.width - width) / 2)
    y = workArea.y + Math.floor((workArea.height - height) / 2)
  }

  const display = screen.getDisplayMatching({ x, y, width, height })
  const displayWorkArea = display.workArea
  
  if (x < displayWorkArea.x) x = displayWorkArea.x
  if (y < displayWorkArea.y) y = displayWorkArea.y
  if (x + width > displayWorkArea.x + displayWorkArea.width) {
    x = displayWorkArea.x + displayWorkArea.width - width
  }
  if (y + height > displayWorkArea.y + displayWorkArea.height) {
    y = displayWorkArea.y + displayWorkArea.height - height
  }

  return { width, height, x, y }
}

export function createWindow(): BrowserWindow {
  const config = getConfig()
  const bounds = getWindowBounds()

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  if (config.isMaximized) {
    mainWindow.maximize()
  }

  if (config.startFullscreen) {
    mainWindow.setFullScreen(true)
  }

  if (config.isAlwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, 'floating')
  }

  mainWindow.on('ready-to-show', () => {
    if (config.startMinimized) {
      mainWindow?.minimize()
    } else {
      mainWindow?.show()
    }
  })

  mainWindow.on('resize', () => {
    if (!mainWindow) return
    
    const isMaximized = mainWindow.isMaximized()
    if (!isMaximized) {
      const bounds = mainWindow.getBounds()
      updateConfig({
        windowWidth: bounds.width,
        windowHeight: bounds.height,
        isMaximized: false
      })
    } else {
      updateConfig({ isMaximized: true })
    }
  })

  mainWindow.on('move', () => {
    if (!mainWindow || mainWindow.isMaximized()) return
    
    const bounds = mainWindow.getBounds()
    updateConfig({
      windowX: bounds.x,
      windowY: bounds.y
    })
  })

  mainWindow.on('maximize', () => {
    updateConfig({ isMaximized: true })
  })

  mainWindow.on('unmaximize', () => {
    updateConfig({ isMaximized: false })
  })

  mainWindow.on('closed', () => {
    saveReadingTime()
    mainWindow = null
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function restoreWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  }
}

export function toggleFullscreen(): boolean {
  if (!mainWindow) return false
  const willBeFullscreen = !mainWindow.isFullScreen()
  mainWindow.setFullScreen(willBeFullscreen)
  return willBeFullscreen
}

export function toggleAlwaysOnTop(): boolean {
  if (!mainWindow) return false
  const willBeOnTop = !mainWindow.isAlwaysOnTop()
  mainWindow.setAlwaysOnTop(willBeOnTop, 'floating')
  updateConfig({ isAlwaysOnTop: willBeOnTop })
  return willBeOnTop
}

export function isAlwaysOnTop(): boolean {
  return mainWindow?.isAlwaysOnTop() ?? false
}

export function isFullscreen(): boolean {
  return mainWindow?.isFullScreen() ?? false
}

export function setReadingStart(bookId: number) {
  currentBookId = bookId
  readingStartTime = Date.now()
}

export function saveReadingTime() {
  if (currentBookId !== null && readingStartTime !== null) {
    const duration = Date.now() - readingStartTime
    if (duration > 1000) {
      try {
        bookDb.addReadingTime(currentBookId, Math.floor(duration / 1000))
      } catch (e) {
        console.error('Failed to save reading time:', e)
      }
    }
    readingStartTime = null
    currentBookId = null
  }
}

export function resetReadingTime(bookId: number) {
  if (currentBookId !== null && readingStartTime !== null) {
    saveReadingTime()
  }
  setReadingStart(bookId)
}
