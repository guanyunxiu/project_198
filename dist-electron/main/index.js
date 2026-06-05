"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const iconv = require("iconv-lite");
const jschardet = require("jschardet");
let mainWindow = null;
function getWindowBounds() {
  const { workArea } = electron.screen.getPrimaryDisplay();
  const defaultWidth = Math.min(1200, workArea.width - 100);
  const defaultHeight = Math.min(800, workArea.height - 100);
  return {
    width: defaultWidth,
    height: defaultHeight,
    x: workArea.x + Math.floor((workArea.width - defaultWidth) / 2),
    y: workArea.y + Math.floor((workArea.height - defaultHeight) / 2)
  };
}
function createWindow() {
  const bounds = getWindowBounds();
  mainWindow = new electron.BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  return mainWindow;
}
let db = null;
function getDb() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}
function initDatabase() {
  const userDataPath = electron.app.getPath("userData");
  const dbDir = path.join(userDataPath, "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, "novel-reader.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  createTables();
  insertDefaultCategory();
}
function createTables() {
  const database = getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      filePath TEXT NOT NULL UNIQUE,
      fileType TEXT NOT NULL,
      coverPath TEXT,
      encoding TEXT DEFAULT 'utf-8',
      totalPages INTEGER DEFAULT 0,
      totalCharacters INTEGER DEFAULT 0,
      categoryId INTEGER,
      isPinned INTEGER DEFAULT 0,
      lastReadPage INTEGER DEFAULT 0,
      lastReadPosition INTEGER DEFAULT 0,
      lastReadTime INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookId INTEGER NOT NULL,
      page INTEGER NOT NULL,
      position INTEGER NOT NULL,
      content TEXT NOT NULL,
      chapterTitle TEXT DEFAULT '',
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookId INTEGER NOT NULL,
      page INTEGER NOT NULL,
      position INTEGER NOT NULL,
      chapterIndex INTEGER DEFAULT 0,
      readTime INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_books_category ON books(categoryId);
    CREATE INDEX IF NOT EXISTS idx_books_pinned ON books(isPinned);
    CREATE INDEX IF NOT EXISTS idx_books_lastRead ON books(lastReadTime);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_book ON bookmarks(bookId);
    CREATE INDEX IF NOT EXISTS idx_progress_book ON reading_progress(bookId);
  `);
}
function insertDefaultCategory() {
  const database = getDb();
  const now = Date.now();
  const stmt = database.prepare(
    "INSERT OR IGNORE INTO categories (name, createdAt) VALUES (?, ?)"
  );
  stmt.run("未分类", now);
}
const categoryDb = {
  getAll() {
    return getDb().prepare("SELECT * FROM categories ORDER BY createdAt ASC").all();
  },
  create(name) {
    const now = Date.now();
    const stmt = getDb().prepare(
      "INSERT INTO categories (name, createdAt) VALUES (?, ?)"
    );
    const result = stmt.run(name, now);
    return Number(result.lastInsertRowid);
  },
  update(id, name) {
    getDb().prepare("UPDATE categories SET name = ? WHERE id = ?").run(name, id);
  },
  delete(id) {
    getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
  }
};
const bookDb = {
  getAll() {
    return getDb().prepare("SELECT * FROM books ORDER BY isPinned DESC, lastReadTime DESC, createdAt DESC").all();
  },
  getById(id) {
    return getDb().prepare("SELECT * FROM books WHERE id = ?").get(id);
  },
  getByPath(filePath) {
    return getDb().prepare("SELECT * FROM books WHERE filePath = ?").get(filePath);
  },
  create(book) {
    const now = Date.now();
    const stmt = getDb().prepare(`
      INSERT INTO books (
        title, author, filePath, fileType, coverPath, encoding,
        totalPages, totalCharacters, categoryId, isPinned,
        lastReadPage, lastReadPosition, lastReadTime, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      book.title,
      book.author,
      book.filePath,
      book.fileType,
      book.coverPath,
      book.encoding,
      book.totalPages,
      book.totalCharacters,
      book.categoryId,
      book.isPinned,
      book.lastReadPage,
      book.lastReadPosition,
      book.lastReadTime,
      now,
      now
    );
    return Number(result.lastInsertRowid);
  },
  update(id, updates) {
    const now = Date.now();
    const fields = Object.keys(updates).filter((k) => k !== "id");
    if (fields.length === 0) return;
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => updates[f]);
    values.push(now, id);
    const stmt = getDb().prepare(`UPDATE books SET ${setClause}, updatedAt = ? WHERE id = ?`);
    stmt.run(...values);
  },
  updateReadingProgress(bookId, page, position) {
    const now = Date.now();
    getDb().prepare("UPDATE books SET lastReadPage = ?, lastReadPosition = ?, lastReadTime = ?, updatedAt = ? WHERE id = ?").run(page, position, now, now, bookId);
  },
  togglePin(id) {
    getDb().prepare("UPDATE books SET isPinned = 1 - isPinned, updatedAt = ? WHERE id = ?").run(Date.now(), id);
  },
  delete(id) {
    getDb().prepare("DELETE FROM books WHERE id = ?").run(id);
  }
};
const bookmarkDb = {
  getByBookId(bookId) {
    return getDb().prepare("SELECT * FROM bookmarks WHERE bookId = ? ORDER BY createdAt DESC").all(bookId);
  },
  create(bookmark) {
    const now = Date.now();
    const stmt = getDb().prepare(`
      INSERT INTO bookmarks (bookId, page, position, content, chapterTitle, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      bookmark.bookId,
      bookmark.page,
      bookmark.position,
      bookmark.content,
      bookmark.chapterTitle,
      now
    );
    return Number(result.lastInsertRowid);
  },
  delete(id) {
    getDb().prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
  },
  deleteByBookId(bookId) {
    getDb().prepare("DELETE FROM bookmarks WHERE bookId = ?").run(bookId);
  }
};
const progressDb = {
  getByBookId(bookId, limit = 100) {
    return getDb().prepare("SELECT * FROM reading_progress WHERE bookId = ? ORDER BY createdAt DESC LIMIT ?").all(bookId, limit);
  },
  create(progress) {
    const now = Date.now();
    const stmt = getDb().prepare(`
      INSERT INTO reading_progress (bookId, page, position, chapterIndex, readTime, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      progress.bookId,
      progress.page,
      progress.position,
      progress.chapterIndex,
      progress.readTime,
      now
    );
    return Number(result.lastInsertRowid);
  },
  deleteByBookId(bookId) {
    getDb().prepare("DELETE FROM reading_progress WHERE bookId = ?").run(bookId);
  }
};
const defaultReadingConfig = {
  fontSize: 18,
  lineHeight: 2,
  letterSpacing: 1,
  pageMargin: 40,
  theme: "light",
  readMode: "scroll",
  pageChars: 800
};
const defaultConfig = {
  defaultEncoding: "utf-8",
  autoDetectEncoding: true,
  scanPaths: [],
  favoritePaths: [],
  windowWidth: 1200,
  windowHeight: 800,
  windowX: null,
  windowY: null,
  isMaximized: false,
  readingConfig: defaultReadingConfig
};
let configPath;
let currentConfig;
function initConfig() {
  const userDataPath = electron.app.getPath("userData");
  configPath = path.join(userDataPath, "config.json");
  if (fs.existsSync(configPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      currentConfig = {
        ...defaultConfig,
        ...saved,
        readingConfig: { ...defaultReadingConfig, ...saved.readingConfig }
      };
    } catch {
      currentConfig = { ...defaultConfig };
    }
  } else {
    currentConfig = { ...defaultConfig };
    saveConfig();
  }
}
function getConfig() {
  return { ...currentConfig };
}
function getReadingConfig() {
  return { ...currentConfig.readingConfig };
}
function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), "utf-8");
}
function updateConfig(updates) {
  currentConfig = { ...currentConfig, ...updates };
  saveConfig();
}
function updateReadingConfig(updates) {
  currentConfig.readingConfig = { ...currentConfig.readingConfig, ...updates };
  saveConfig();
}
function addScanPath(path2) {
  if (!currentConfig.scanPaths.includes(path2)) {
    currentConfig.scanPaths.push(path2);
    saveConfig();
  }
}
function removeScanPath(path2) {
  currentConfig.scanPaths = currentConfig.scanPaths.filter((p) => p !== path2);
  saveConfig();
}
function addFavoritePath(path2) {
  if (!currentConfig.favoritePaths.includes(path2)) {
    currentConfig.favoritePaths.push(path2);
    saveConfig();
  }
}
function removeFavoritePath(path2) {
  currentConfig.favoritePaths = currentConfig.favoritePaths.filter((p) => p !== path2);
  saveConfig();
}
const SUPPORTED_EXTENSIONS = [".txt", ".epub", ".pdf", ".chm"];
function isSupportedFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}
function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  return ext;
}
function listDirectory(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.filter((entry) => !entry.name.startsWith(".")).map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      try {
        const stats = fs.statSync(fullPath);
        return {
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: stats.size,
          extension: path.extname(entry.name).toLowerCase().slice(1),
          createdAt: stats.birthtimeMs,
          updatedAt: stats.mtimeMs
        };
      } catch {
        return null;
      }
    }).filter((item) => item !== null).sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  } catch {
    return [];
  }
}
function scanDirectoryForBooks(dirPath, recursive = true, results = []) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && recursive) {
        scanDirectoryForBooks(fullPath, recursive, results);
      } else if (entry.isFile() && isSupportedFile(fullPath)) {
        results.push(fullPath);
      }
    }
  } catch {
  }
  return results;
}
function scanMultiplePaths(paths, recursive = true) {
  const allBooks = /* @__PURE__ */ new Set();
  for (const path2 of paths) {
    if (fs.existsSync(path2)) {
      const stats = fs.statSync(path2);
      if (stats.isDirectory()) {
        scanDirectoryForBooks(path2, recursive).forEach((book) => allBooks.add(book));
      } else if (stats.isFile() && isSupportedFile(path2)) {
        allBooks.add(path2);
      }
    }
  }
  return Array.from(allBooks);
}
function detectEncoding(buffer) {
  try {
    const result = jschardet.detect(buffer.slice(0, 1024 * 1024));
    if (result && result.confidence > 0.7) {
      const encoding = result.encoding.toLowerCase();
      if (encoding.includes("gb") || encoding === "gb2312" || encoding === "gbk" || encoding === "gb18030") {
        return "gbk";
      }
      if (encoding === "utf-8" || encoding === "utf8") {
        return "utf-8";
      }
      return encoding;
    }
  } catch {
  }
  return "utf-8";
}
function readTextFile(filePath, encoding) {
  const buffer = fs.readFileSync(filePath);
  if (!encoding) {
    encoding = detectEncoding(buffer);
  }
  if (iconv.encodingExists(encoding)) {
    return iconv.decode(buffer, encoding);
  }
  return buffer.toString("utf-8");
}
function getFileNameWithoutExtension(filePath) {
  return path.parse(filePath).name;
}
const CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千零\d]+[章节卷部][\s、．。：:].*$/m,
  /^Chapter\s+\d+.*$/im,
  /^\d+\s*[.、]\s*.+$/m,
  /^[【\[].*[】\]]\s*$/m,
  /^楔子|^序章|^序言|^前言|^后记|^番外|^引子|^尾声/m
];
function parseTxtFile(filePath, encoding) {
  const buffer = fs.readFileSync(filePath);
  if (!encoding) {
    encoding = detectEncoding(buffer);
  }
  const content = readTextFile(filePath, encoding);
  const chapters = extractChapters(content);
  return {
    content,
    encoding,
    chapters,
    totalCharacters: content.length
  };
}
function extractChapters(content) {
  const chapters = [];
  const lines = content.split("\n");
  let currentPosition = 0;
  let chapterIndex = 0;
  const introChapter = {
    index: 0,
    title: "引言",
    startPosition: 0,
    endPosition: 0,
    startPage: 0
  };
  chapters.push(introChapter);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 0 && line.length < 100) {
      for (const pattern of CHAPTER_PATTERNS) {
        if (pattern.test(line)) {
          if (chapters.length > 0) {
            chapters[chapters.length - 1].endPosition = currentPosition;
          }
          chapterIndex++;
          chapters.push({
            index: chapterIndex,
            title: line.replace(/[\s\r\n]+$/, ""),
            startPosition: currentPosition,
            endPosition: 0,
            startPage: 0
          });
          break;
        }
      }
    }
    currentPosition += lines[i].length + 1;
  }
  if (chapters.length > 0) {
    chapters[chapters.length - 1].endPosition = content.length;
  }
  return chapters;
}
function paginateContent(content, chapters, pageChars = 800) {
  const pages = [];
  let currentPage = 1;
  let chapterStartPage = 1;
  for (const chapter of chapters) {
    chapter.startPage = chapterStartPage;
    const chapterContent = content.slice(chapter.startPosition, chapter.endPosition);
    const chapterPages = paginateChapter$1(chapterContent, chapter, currentPage, pageChars);
    pages.push(...chapterPages.pages);
    currentPage += chapterPages.totalPages;
    chapterStartPage += chapterPages.totalPages;
  }
  return {
    pages,
    totalPages: pages.length
  };
}
function paginateChapter$1(content, chapter, startPage, pageChars) {
  const pages = [];
  let currentPos = 0;
  let pageNum = startPage;
  while (currentPos < content.length) {
    let endPos = currentPos + pageChars;
    if (endPos < content.length) {
      const breakPoints = [
        content.lastIndexOf("\n", endPos),
        content.lastIndexOf("。", endPos),
        content.lastIndexOf("！", endPos),
        content.lastIndexOf("？", endPos),
        content.lastIndexOf("…", endPos),
        content.lastIndexOf(". ", endPos),
        content.lastIndexOf("! ", endPos),
        content.lastIndexOf("? ", endPos)
      ];
      const validBreakPoint = breakPoints.find((p) => p > currentPos + pageChars * 0.5);
      if (validBreakPoint !== void 0) {
        endPos = validBreakPoint + 1;
      }
    } else {
      endPos = content.length;
    }
    const pageContent = content.slice(currentPos, endPos).trim();
    if (pageContent.length > 0) {
      pages.push({
        page: pageNum,
        content: pageContent,
        chapterTitle: chapter.title,
        chapterIndex: chapter.index,
        startPosition: chapter.startPosition + currentPos,
        endPosition: chapter.startPosition + endPos
      });
      pageNum++;
    }
    currentPos = endPos;
  }
  return {
    pages,
    totalPages: pages.length
  };
}
function parseEpubFile(filePath) {
  const cacheDir = path.join(electron.app.getPath("userData"), "cache", "epub");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const cacheKey = Buffer.from(filePath).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);
  if (fs.existsSync(cachePath)) {
    try {
      return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    } catch {
    }
  }
  const result = extractEpubContent(filePath);
  try {
    fs.writeFileSync(cachePath, JSON.stringify(result), "utf-8");
  } catch {
  }
  return result;
}
function extractEpubContent(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const chapters = [];
  let fullText = "";
  let currentPosition = 0;
  let chapterIndex = 0;
  chapters.push({
    index: 0,
    title: "引言",
    startPosition: 0,
    endPosition: 0,
    startPage: 0
  });
  for (const line of lines) {
    const trimmed = line.trim();
    if (isChapterHeading(trimmed)) {
      if (chapters.length > 0) {
        chapters[chapters.length - 1].endPosition = currentPosition;
      }
      chapterIndex++;
      chapters.push({
        index: chapterIndex,
        title: trimmed,
        startPosition: currentPosition,
        endPosition: 0,
        startPage: 0
      });
    }
    fullText += line + "\n";
    currentPosition += line.length + 1;
  }
  if (chapters.length > 0) {
    chapters[chapters.length - 1].endPosition = fullText.length;
  }
  return {
    title: extractTitle(filePath, content),
    author: extractAuthor(content) || "未知",
    coverPath: null,
    chapters,
    content: fullText,
    totalCharacters: fullText.length
  };
}
function isChapterHeading(line) {
  if (line.length === 0 || line.length > 100) return false;
  const patterns = [
    /^第[一二三四五六七八九十百千零\d]+[章节卷部][\s、．。：:].*$/i,
    /^Chapter\s+\d+.*$/i,
    /^[一二三四五六七八九十百千]+、.*/,
    /^\d+\s*[.、]\s*.+$/
  ];
  return patterns.some((p) => p.test(line));
}
function extractTitle(filePath, content) {
  const nameMatch = content.match(/<dc:title>([^<]+)<\/dc:title>/i);
  if (nameMatch && nameMatch[1]) {
    return nameMatch[1].trim();
  }
  const fileName = filePath.split(/[/\\]/).pop() || "未知";
  return fileName.replace(/\.[^/.]+$/, "");
}
function extractAuthor(content) {
  const authorMatch = content.match(/<dc:creator>([^<]+)<\/dc:creator>/i);
  if (authorMatch && authorMatch[1]) {
    return authorMatch[1].trim();
  }
  return null;
}
function paginateEpubContent(content, chapters, pageChars = 800) {
  const pages = [];
  let currentPage = 1;
  for (const chapter of chapters) {
    chapter.startPage = currentPage;
    const chapterContent = content.slice(chapter.startPosition, chapter.endPosition);
    const result = paginateChapter(chapterContent, chapter, currentPage, pageChars);
    pages.push(...result.pages);
    currentPage += result.totalPages;
  }
  return {
    pages,
    totalPages: pages.length
  };
}
function paginateChapter(content, chapter, startPage, pageChars) {
  const pages = [];
  let currentPos = 0;
  let pageNum = startPage;
  while (currentPos < content.length) {
    let endPos = currentPos + pageChars;
    if (endPos < content.length) {
      const breakPoints = [
        content.lastIndexOf("\n\n", endPos),
        content.lastIndexOf("\n", endPos),
        content.lastIndexOf("。", endPos),
        content.lastIndexOf("！", endPos),
        content.lastIndexOf("？", endPos),
        content.lastIndexOf(". ", endPos)
      ];
      const validBreakPoint = breakPoints.find((p) => p > currentPos + pageChars * 0.5);
      if (validBreakPoint !== void 0) {
        endPos = validBreakPoint + (content.charAt(validBreakPoint) === "\n" ? 2 : 1);
      }
    } else {
      endPos = content.length;
    }
    const pageContent = content.slice(currentPos, endPos).trim();
    if (pageContent.length > 0) {
      pages.push({
        page: pageNum,
        content: pageContent,
        chapterTitle: chapter.title,
        chapterIndex: chapter.index,
        startPosition: chapter.startPosition + currentPos,
        endPosition: chapter.startPosition + endPos
      });
      pageNum++;
    }
    currentPos = endPos;
  }
  return {
    pages,
    totalPages: pages.length
  };
}
const bookCache = /* @__PURE__ */ new Map();
function registerIpcHandlers() {
  electron.ipcMain.handle("app:getConfig", () => getConfig());
  electron.ipcMain.handle("app:getReadingConfig", () => getReadingConfig());
  electron.ipcMain.handle("app:getSystemInfo", () => ({
    platform: process.platform,
    homedir: require("os").homedir(),
    user: process.env.USER || process.env.USERNAME || ""
  }));
  electron.ipcMain.handle("app:updateConfig", (_e, updates) => {
    updateConfig(updates);
    return getConfig();
  });
  electron.ipcMain.handle("app:updateReadingConfig", (_e, updates) => {
    updateReadingConfig(updates);
    return getReadingConfig();
  });
  electron.ipcMain.handle("app:addScanPath", (_e, path2) => {
    addScanPath(path2);
    return getConfig();
  });
  electron.ipcMain.handle("app:removeScanPath", (_e, path2) => {
    removeScanPath(path2);
    return getConfig();
  });
  electron.ipcMain.handle("app:addFavoritePath", (_e, path2) => {
    addFavoritePath(path2);
    return getConfig();
  });
  electron.ipcMain.handle("app:removeFavoritePath", (_e, path2) => {
    removeFavoritePath(path2);
    return getConfig();
  });
  electron.ipcMain.handle("category:getAll", () => categoryDb.getAll());
  electron.ipcMain.handle("category:create", (_e, name) => categoryDb.create(name));
  electron.ipcMain.handle("category:update", (_e, id, name) => {
    categoryDb.update(id, name);
    return true;
  });
  electron.ipcMain.handle("category:delete", (_e, id) => {
    categoryDb.delete(id);
    return true;
  });
  electron.ipcMain.handle("book:getAll", () => bookDb.getAll());
  electron.ipcMain.handle("book:getById", (_e, id) => bookDb.getById(id));
  electron.ipcMain.handle("book:getByPath", (_e, path2) => bookDb.getByPath(path2));
  electron.ipcMain.handle("book:add", async (_e, filePath) => {
    if (!fs.existsSync(filePath) || !isSupportedFile(filePath)) {
      throw new Error("不支持的文件格式");
    }
    const existing = bookDb.getByPath(filePath);
    if (existing) {
      return existing.id;
    }
    const fileType = getFileType(filePath);
    const defaultCategory = categoryDb.getAll().find((c) => c.name === "未分类");
    let title = getFileNameWithoutExtension(filePath);
    let author = "未知";
    let encoding = "utf-8";
    let totalCharacters = 0;
    let coverPath = null;
    try {
      if (fileType === "txt") {
        const result = parseTxtFile(filePath);
        encoding = result.encoding;
        totalCharacters = result.totalCharacters;
      } else if (fileType === "epub") {
        const result = parseEpubFile(filePath);
        title = result.title || title;
        author = result.author || author;
        coverPath = result.coverPath;
        totalCharacters = result.totalCharacters;
      }
    } catch (err) {
      console.error("Parse file error:", err);
    }
    fs.statSync(filePath);
    const bookId = bookDb.create({
      title,
      author,
      filePath,
      fileType,
      coverPath,
      encoding,
      totalPages: 0,
      totalCharacters,
      categoryId: (defaultCategory == null ? void 0 : defaultCategory.id) || null,
      isPinned: 0,
      lastReadPage: 1,
      lastReadPosition: 0,
      lastReadTime: Date.now()
    });
    return bookId;
  });
  electron.ipcMain.handle("book:update", (_e, id, updates) => {
    bookDb.update(id, updates);
    return bookDb.getById(id);
  });
  electron.ipcMain.handle("book:togglePin", (_e, id) => {
    bookDb.togglePin(id);
    return true;
  });
  electron.ipcMain.handle("book:delete", (_e, id) => {
    bookCache.delete(id);
    bookDb.delete(id);
    return true;
  });
  electron.ipcMain.handle("book:updateProgress", (_e, bookId, page, position) => {
    bookDb.updateReadingProgress(bookId, page, position);
    return true;
  });
  electron.ipcMain.handle("bookmark:getByBookId", (_e, bookId) => bookmarkDb.getByBookId(bookId));
  electron.ipcMain.handle("bookmark:add", (_e, bookmark) => bookmarkDb.create(bookmark));
  electron.ipcMain.handle("bookmark:delete", (_e, id) => {
    bookmarkDb.delete(id);
    return true;
  });
  electron.ipcMain.handle("progress:getByBookId", (_e, bookId, limit) => progressDb.getByBookId(bookId, limit));
  electron.ipcMain.handle("progress:add", (_e, progress) => progressDb.create(progress));
  electron.ipcMain.handle("file:listDirectory", (_e, dirPath) => listDirectory(dirPath));
  async function addBookInternal(filePath) {
    if (!fs.existsSync(filePath) || !isSupportedFile(filePath)) {
      return null;
    }
    const existing = bookDb.getByPath(filePath);
    if (existing) {
      return existing.id;
    }
    const fileType = getFileType(filePath);
    const defaultCategory = categoryDb.getAll().find((c) => c.name === "未分类");
    let title = getFileNameWithoutExtension(filePath);
    let author = "未知";
    let encoding = "utf-8";
    let totalCharacters = 0;
    let coverPath = null;
    try {
      if (fileType === "txt") {
        const result = parseTxtFile(filePath);
        encoding = result.encoding;
        totalCharacters = result.totalCharacters;
      } else if (fileType === "epub") {
        const result = parseEpubFile(filePath);
        title = result.title || title;
        author = result.author || author;
        coverPath = result.coverPath;
        totalCharacters = result.totalCharacters;
      }
    } catch (err) {
      console.error("Parse file error:", err);
    }
    const bookId = bookDb.create({
      title,
      author,
      filePath,
      fileType,
      coverPath,
      encoding,
      totalPages: 0,
      totalCharacters,
      categoryId: (defaultCategory == null ? void 0 : defaultCategory.id) || null,
      isPinned: 0,
      lastReadPage: 1,
      lastReadPosition: 0,
      lastReadTime: Date.now()
    });
    return bookId;
  }
  electron.ipcMain.handle("file:scanBooks", async (_e, paths) => {
    const books = scanMultiplePaths(paths, true);
    const results = [];
    for (const filePath of books) {
      try {
        const existing = bookDb.getByPath(filePath);
        if (existing) {
          results.push(existing.id);
        } else {
          const bookId = await addBookInternal(filePath);
          if (bookId) results.push(bookId);
        }
      } catch (err) {
        console.error("Scan book error:", err);
      }
    }
    return results;
  });
  electron.ipcMain.handle("file:openDialog", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "电子书", extensions: ["txt", "epub", "pdf", "chm"] },
        { name: "所有文件", extensions: ["*"] }
      ]
    });
    if (!result.canceled) {
      const bookIds = [];
      for (const filePath of result.filePaths) {
        try {
          const existing = bookDb.getByPath(filePath);
          if (existing) {
            bookIds.push(existing.id);
          } else {
            const bookId = await addBookInternal(filePath);
            if (bookId) bookIds.push(bookId);
          }
        } catch (err) {
          console.error("Add book error:", err);
        }
      }
      return bookIds;
    }
    return [];
  });
  electron.ipcMain.handle("file:openFolderDialog", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
  });
  electron.ipcMain.handle("file:detectEncoding", (_e, filePath) => {
    const buffer = require("fs").readFileSync(filePath);
    return detectEncoding(buffer);
  });
  electron.ipcMain.handle("file:readText", (_e, filePath, encoding) => {
    return readTextFile(filePath, encoding);
  });
  electron.ipcMain.handle("reader:openBook", (_e, bookId, pageChars = 800) => {
    const book = bookDb.getById(bookId);
    if (!book) throw new Error("书籍不存在");
    const cached = bookCache.get(bookId);
    if (cached) {
      return {
        content: cached.content,
        chapters: cached.chapters,
        totalPages: cached.totalPages
      };
    }
    let content = "";
    let chapters = [];
    try {
      if (book.fileType === "txt") {
        const result = parseTxtFile(book.filePath, book.encoding);
        content = result.content;
        chapters = result.chapters;
      } else if (book.fileType === "epub") {
        const result = parseEpubFile(book.filePath);
        content = result.content;
        chapters = result.chapters;
      }
    } catch (err) {
      console.error("Open book error:", err);
      throw new Error("解析书籍失败");
    }
    const pagination = book.fileType === "epub" ? paginateEpubContent(content, chapters, pageChars) : paginateContent(content, chapters, pageChars);
    const cacheData = {
      content,
      chapters,
      totalPages: pagination.totalPages,
      pages: pagination.pages
    };
    bookCache.set(bookId, cacheData);
    bookDb.update(bookId, { totalPages: pagination.totalPages });
    return {
      content,
      chapters,
      totalPages: pagination.totalPages
    };
  });
  electron.ipcMain.handle("reader:getPage", (_e, bookId, page) => {
    const book = bookDb.getById(bookId);
    if (!book) throw new Error("书籍不存在");
    const cache = bookCache.get(bookId);
    if (!cache) throw new Error("书籍未加载");
    return cache.pages.find((p) => p.page === page) || null;
  });
  electron.ipcMain.handle("reader:getFullContent", (_e, bookId) => {
    const book = bookDb.getById(bookId);
    if (!book) throw new Error("书籍不存在");
    const cache = bookCache.get(bookId);
    if (!cache) throw new Error("书籍未加载");
    return {
      content: cache.content,
      chapters: cache.chapters
    };
  });
  electron.ipcMain.handle("reader:closeBook", (_e, bookId) => {
    bookCache.delete(bookId);
    return true;
  });
  electron.ipcMain.handle("shell:openExternal", (_e, url) => {
    electron.shell.openExternal(url);
    return true;
  });
  electron.ipcMain.handle("shell:showInFolder", (_e, path2) => {
    electron.shell.showItemInFolder(path2);
    return true;
  });
}
const isSingleInstance = electron.app.requestSingleInstanceLock();
if (!isSingleInstance) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", () => {
    const win = electron.BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}
electron.app.whenReady().then(async () => {
  try {
    await initDatabase();
    await initConfig();
    registerIpcHandlers();
    createWindow();
  } catch (error) {
    console.error("App initialization failed:", error);
  }
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  const allWindows = electron.BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});
electron.app.on("before-quit", () => {
  electron.ipcMain.removeAllListeners();
});
//# sourceMappingURL=index.js.map
