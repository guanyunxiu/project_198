"use strict";
const electron = require("electron");
const electronAPI = {
  app: {
    getConfig: () => electron.ipcRenderer.invoke("app:getConfig"),
    getReadingConfig: () => electron.ipcRenderer.invoke("app:getReadingConfig"),
    getSystemInfo: () => electron.ipcRenderer.invoke("app:getSystemInfo"),
    updateConfig: (updates) => electron.ipcRenderer.invoke("app:updateConfig", updates),
    updateReadingConfig: (updates) => electron.ipcRenderer.invoke("app:updateReadingConfig", updates),
    addScanPath: (path) => electron.ipcRenderer.invoke("app:addScanPath", path),
    removeScanPath: (path) => electron.ipcRenderer.invoke("app:removeScanPath", path),
    addFavoritePath: (path) => electron.ipcRenderer.invoke("app:addFavoritePath", path),
    removeFavoritePath: (path) => electron.ipcRenderer.invoke("app:removeFavoritePath", path)
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
    updateProgress: (bookId, page, position) => electron.ipcRenderer.invoke("book:updateProgress", bookId, page, position)
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
    readText: (filePath, encoding) => electron.ipcRenderer.invoke("file:readText", filePath, encoding)
  },
  reader: {
    openBook: (bookId, pageChars = 800) => electron.ipcRenderer.invoke("reader:openBook", bookId, pageChars),
    getPage: (bookId, page) => electron.ipcRenderer.invoke("reader:getPage", bookId, page),
    getFullContent: (bookId) => electron.ipcRenderer.invoke("reader:getFullContent", bookId),
    closeBook: (bookId) => electron.ipcRenderer.invoke("reader:closeBook", bookId)
  },
  shell: {
    openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url),
    showInFolder: (path) => electron.ipcRenderer.invoke("shell:showInFolder", path)
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
//# sourceMappingURL=index.js.map
