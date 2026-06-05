import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null

function getWindowBounds() {
  const { workArea } = screen.getPrimaryDisplay()
  const defaultWidth = Math.min(1200, workArea.width - 100)
  const defaultHeight = Math.min(800, workArea.height - 100)

  return {
    width: defaultWidth,
    height: defaultHeight,
    x: workArea.x + Math.floor((workArea.width - defaultWidth) / 2),
    y: workArea.y + Math.floor((workArea.height - defaultHeight) / 2)
  }
}

export function createWindow(): BrowserWindow {
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

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
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
