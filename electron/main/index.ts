import { app, BrowserWindow, ipcMain } from 'electron'
import { createWindow } from './window'
import { registerIpcHandlers } from './ipc'
import { initDatabase } from './db'
import { initConfig } from './config'

const isSingleInstance = app.requestSingleInstanceLock()

if (!isSingleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

app.whenReady().then(async () => {
  try {
    await initDatabase()
    await initConfig()
    registerIpcHandlers()
    createWindow()
  } catch (error) {
    console.error('App initialization failed:', error)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

app.on('before-quit', () => {
  ipcMain.removeAllListeners()
})
