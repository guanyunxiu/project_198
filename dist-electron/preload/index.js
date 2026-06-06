"use strict";
const electron = require("electron");
const electronAPI = {
  app: {
    getConfig: () => electron.ipcRenderer.invoke("app:getConfig"),
    getReadingConfig: () => electron.ipcRenderer.invoke("app:getReadingConfig"),
    getShortcuts: () => electron.ipcRenderer.invoke("app:getShortcuts"),
    getSystemInfo: () => electron.ipcRenderer.invoke("app:getSystemInfo"),
    updateConfig: (updates) => electron.ipcRenderer.invoke("app:updateConfig", updates),
    updateReadingConfig: (updates) => electron.ipcRenderer.invoke("app:updateReadingConfig", updates),
    updateShortcuts: (updates) => electron.ipcRenderer.invoke("app:updateShortcuts", updates),
    addScanPath: (path) => electron.ipcRenderer.invoke("app:addScanPath", path),
    removeScanPath: (path) => electron.ipcRenderer.invoke("app:removeScanPath", path),
    addFavoritePath: (path) => electron.ipcRenderer.invoke("app:addFavoritePath", path),
    removeFavoritePath: (path) => electron.ipcRenderer.invoke("app:removeFavoritePath", path)
  },
  window: {
    toggleFullscreen: () => electron.ipcRenderer.invoke("window:toggleFullscreen"),
    toggleAlwaysOnTop: () => electron.ipcRenderer.invoke("window:toggleAlwaysOnTop"),
    isAlwaysOnTop: () => electron.ipcRenderer.invoke("window:isAlwaysOnTop"),
    isFullscreen: () => electron.ipcRenderer.invoke("window:isFullscreen")
  },
  category: {
    getAll: () => electron.ipcRenderer.invoke("category:getAll"),
    create: (name) => electron.ipcRenderer.invoke("category:create", name),
    update: (id, name) => electron.ipcRenderer.invoke("category:update", id, name),
    delete: (id) => electron.ipcRenderer.invoke("category:delete", id)
  },
  book: {
    getAll: () => electron.ipcRenderer.invoke("book:getAll"),
    getById: (id) => electron.ipcRenderer.invoke("book:getById", id),
    getByPath: (path) => electron.ipcRenderer.invoke("book:getByPath", path),
    add: (filePath) => electron.ipcRenderer.invoke("book:add", filePath),
    update: (id, updates) => electron.ipcRenderer.invoke("book:update", id, updates),
    togglePin: (id) => electron.ipcRenderer.invoke("book:togglePin", id),
    delete: (id) => electron.ipcRenderer.invoke("book:delete", id),
    updateProgress: (bookId, page, position) => electron.ipcRenderer.invoke("book:updateProgress", bookId, page, position),
    addReadingTime: (bookId, duration) => electron.ipcRenderer.invoke("book:addReadingTime", bookId, duration),
    batchImport: (filePaths) => electron.ipcRenderer.invoke("book:batchImport", filePaths),
    batchExport: (bookIds) => electron.ipcRenderer.invoke("book:batchExport", bookIds),
    exportJson: (data) => electron.ipcRenderer.invoke("book:exportJson", data),
    importJson: () => electron.ipcRenderer.invoke("book:importJson"),
    updateSmartInfo: (bookId, updates) => electron.ipcRenderer.invoke("book:updateSmartInfo", bookId, updates)
  },
  bookmark: {
    getByBookId: (bookId) => electron.ipcRenderer.invoke("bookmark:getByBookId", bookId),
    add: (bookmark) => electron.ipcRenderer.invoke("bookmark:add", bookmark),
    delete: (id) => electron.ipcRenderer.invoke("bookmark:delete", id)
  },
  progress: {
    getByBookId: (bookId, limit = 100) => electron.ipcRenderer.invoke("progress:getByBookId", bookId, limit),
    add: (progress) => electron.ipcRenderer.invoke("progress:add", progress)
  },
  file: {
    listDirectory: (dirPath) => electron.ipcRenderer.invoke("file:listDirectory", dirPath),
    scanBooks: (paths) => electron.ipcRenderer.invoke("file:scanBooks", paths),
    openDialog: () => electron.ipcRenderer.invoke("file:openDialog"),
    openFolderDialog: () => electron.ipcRenderer.invoke("file:openFolderDialog"),
    detectEncoding: (filePath) => electron.ipcRenderer.invoke("file:detectEncoding", filePath),
    readText: (filePath, encoding) => electron.ipcRenderer.invoke("file:readText", filePath, encoding),
    uploadBackground: () => electron.ipcRenderer.invoke("file:uploadBackground"),
    uploadFont: () => electron.ipcRenderer.invoke("file:uploadFont")
  },
  reader: {
    openBook: (bookId, pageChars = 800) => electron.ipcRenderer.invoke("reader:openBook", bookId, pageChars),
    getPage: (bookId, page) => electron.ipcRenderer.invoke("reader:getPage", bookId, page),
    getFullContent: (bookId) => electron.ipcRenderer.invoke("reader:getFullContent", bookId),
    getChapterContent: (bookId, chapterIndex) => electron.ipcRenderer.invoke("reader:getChapterContent", bookId, chapterIndex),
    getChapters: (bookId) => electron.ipcRenderer.invoke("reader:getChapters", bookId),
    search: (bookId, keyword) => electron.ipcRenderer.invoke("reader:search", bookId, keyword),
    splitVolume: (bookId, options) => electron.ipcRenderer.invoke("reader:splitVolume", bookId, options),
    generateToc: (content) => electron.ipcRenderer.invoke("reader:generateToc", content),
    smartGenerateToc: (content) => electron.ipcRenderer.invoke("reader:smartGenerateToc", content),
    cleanText: (content, options) => electron.ipcRenderer.invoke("reader:cleanText", content, options),
    getSmartInfo: (bookId) => electron.ipcRenderer.invoke("reader:getSmartInfo", bookId),
    goToPercent: (bookId, percent) => electron.ipcRenderer.invoke("reader:goToPercent", bookId, percent),
    closeBook: (bookId) => electron.ipcRenderer.invoke("reader:closeBook", bookId)
  },
  stats: {
    getByDate: (date) => electron.ipcRenderer.invoke("stats:getByDate", date),
    getByBookId: (bookId, limit = 30) => electron.ipcRenderer.invoke("stats:getByBookId", bookId, limit),
    getDateRange: (startDate, endDate) => electron.ipcRenderer.invoke("stats:getDateRange", startDate, endDate),
    addReading: (bookId, pagesRead, charactersRead, readingTime) => electron.ipcRenderer.invoke("stats:addReading", bookId, pagesRead, charactersRead, readingTime),
    getDailyAverage: (days = 7) => electron.ipcRenderer.invoke("stats:getDailyAverage", days),
    getPagesPerMinute: (bookId) => electron.ipcRenderer.invoke("stats:getPagesPerMinute", bookId)
  },
  goals: {
    getAll: () => electron.ipcRenderer.invoke("goals:getAll"),
    getActive: () => electron.ipcRenderer.invoke("goals:getActive"),
    create: (goal) => electron.ipcRenderer.invoke("goals:create", goal),
    updateProgress: (id, increment) => electron.ipcRenderer.invoke("goals:updateProgress", id, increment),
    checkIn: (type) => electron.ipcRenderer.invoke("goals:checkIn", type),
    delete: (id) => electron.ipcRenderer.invoke("goals:delete", id)
  },
  theme: {
    getPresetThemes: () => electron.ipcRenderer.invoke("theme:getPresetThemes")
  },
  shell: {
    openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url),
    showInFolder: (path) => electron.ipcRenderer.invoke("shell:showInFolder", path)
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
//# sourceMappingURL=index.js.map
