"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const iconv = require("iconv-lite");
const jschardet = require("jschardet");
const defaultShortcuts = {
  nextPage: "ArrowRight",
  prevPage: "ArrowLeft",
  addBookmark: "b",
  goBack: "Escape",
  toggleFullscreen: "F11",
  toggleTheme: "t",
  toggleAlwaysOnTop: "p",
  search: "Ctrl+f",
  toggleSidebar: "s"
};
const defaultReadingConfig = {
  fontSize: 18,
  lineHeight: 2,
  letterSpacing: 1,
  pageMargin: 40,
  theme: "light",
  readMode: "scroll",
  pageChars: 800,
  highlightColor: "#ffe066",
  backgroundOpacity: 100,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  pageLayout: "single",
  orientation: "portrait",
  autoTurnSpeed: 30,
  autoTurnEnabled: false
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
  isAlwaysOnTop: false,
  rememberWindowSize: true,
  rememberWindowPosition: true,
  startFullscreen: false,
  startMinimized: false,
  shortcuts: defaultShortcuts,
  readingConfig: defaultReadingConfig,
  customThemes: [],
  customFonts: [],
  dailyReadingGoal: 30,
  weeklyReadingGoal: 180,
  enableSmartChapterDetection: true,
  enableAutoCleanText: true,
  enableGarbledFix: true
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
        shortcuts: { ...defaultShortcuts, ...saved.shortcuts },
        readingConfig: { ...defaultReadingConfig, ...saved.readingConfig },
        customThemes: saved.customThemes || [],
        customFonts: saved.customFonts || []
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
function updateShortcuts(updates) {
  currentConfig.shortcuts = { ...currentConfig.shortcuts, ...updates };
  saveConfig();
}
function getShortcuts() {
  return { ...currentConfig.shortcuts };
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
let mainWindow = null;
let readingStartTime = null;
let currentBookId = null;
function getWindowBounds() {
  const config = getConfig();
  const { workArea } = electron.screen.getPrimaryDisplay();
  let width = config.windowWidth || Math.min(1200, workArea.width - 100);
  let height = config.windowHeight || Math.min(800, workArea.height - 100);
  let x = config.windowX;
  let y = config.windowY;
  if (x === null || y === null) {
    x = workArea.x + Math.floor((workArea.width - width) / 2);
    y = workArea.y + Math.floor((workArea.height - height) / 2);
  }
  const display = electron.screen.getDisplayMatching({ x, y, width, height });
  const displayWorkArea = display.workArea;
  if (x < displayWorkArea.x) x = displayWorkArea.x;
  if (y < displayWorkArea.y) y = displayWorkArea.y;
  if (x + width > displayWorkArea.x + displayWorkArea.width) {
    x = displayWorkArea.x + displayWorkArea.width - width;
  }
  if (y + height > displayWorkArea.y + displayWorkArea.height) {
    y = displayWorkArea.y + displayWorkArea.height - height;
  }
  return { width, height, x, y };
}
function createWindow() {
  const config = getConfig();
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
  if (config.isMaximized) {
    mainWindow.maximize();
  }
  if (config.startFullscreen) {
    mainWindow.setFullScreen(true);
  }
  if (config.isAlwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, "floating");
  }
  mainWindow.on("ready-to-show", () => {
    if (config.startMinimized) {
      mainWindow == null ? void 0 : mainWindow.minimize();
    } else {
      mainWindow == null ? void 0 : mainWindow.show();
    }
  });
  mainWindow.on("resize", () => {
    if (!mainWindow) return;
    const isMaximized = mainWindow.isMaximized();
    if (!isMaximized) {
      const bounds2 = mainWindow.getBounds();
      updateConfig({
        windowWidth: bounds2.width,
        windowHeight: bounds2.height,
        isMaximized: false
      });
    } else {
      updateConfig({ isMaximized: true });
    }
  });
  mainWindow.on("move", () => {
    if (!mainWindow || mainWindow.isMaximized()) return;
    const bounds2 = mainWindow.getBounds();
    updateConfig({
      windowX: bounds2.x,
      windowY: bounds2.y
    });
  });
  mainWindow.on("maximize", () => {
    updateConfig({ isMaximized: true });
  });
  mainWindow.on("unmaximize", () => {
    updateConfig({ isMaximized: false });
  });
  mainWindow.on("closed", () => {
    saveReadingTime();
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
function toggleFullscreen() {
  if (!mainWindow) return false;
  const willBeFullscreen = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(willBeFullscreen);
  return willBeFullscreen;
}
function toggleAlwaysOnTop() {
  if (!mainWindow) return false;
  const willBeOnTop = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(willBeOnTop, "floating");
  updateConfig({ isAlwaysOnTop: willBeOnTop });
  return willBeOnTop;
}
function isAlwaysOnTop() {
  return (mainWindow == null ? void 0 : mainWindow.isAlwaysOnTop()) ?? false;
}
function isFullscreen() {
  return (mainWindow == null ? void 0 : mainWindow.isFullScreen()) ?? false;
}
function setReadingStart(bookId) {
  currentBookId = bookId;
  readingStartTime = Date.now();
}
function saveReadingTime() {
  if (currentBookId !== null && readingStartTime !== null) {
    const duration = Date.now() - readingStartTime;
    if (duration > 1e3) {
      try {
        const { bookDb: bookDb2 } = require("./db");
        bookDb2.addReadingTime(currentBookId, Math.floor(duration / 1e3));
      } catch (e) {
        console.error("Failed to save reading time:", e);
      }
    }
    readingStartTime = null;
    currentBookId = null;
  }
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
  migrateDatabase();
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
      totalReadingTime INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      tags TEXT DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS reading_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookId INTEGER NOT NULL,
      date TEXT NOT NULL,
      pagesRead INTEGER DEFAULT 0,
      charactersRead INTEGER DEFAULT 0,
      readingTime INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE,
      UNIQUE(bookId, date)
    );

    CREATE TABLE IF NOT EXISTS reading_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      target INTEGER NOT NULL,
      targetType TEXT NOT NULL,
      current INTEGER DEFAULT 0,
      periodStart INTEGER NOT NULL,
      periodEnd INTEGER NOT NULL,
      isCompleted INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_books_category ON books(categoryId);
    CREATE INDEX IF NOT EXISTS idx_books_pinned ON books(isPinned);
    CREATE INDEX IF NOT EXISTS idx_books_lastRead ON books(lastReadTime);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_book ON bookmarks(bookId);
    CREATE INDEX IF NOT EXISTS idx_progress_book ON reading_progress(bookId);
    CREATE INDEX IF NOT EXISTS idx_stats_date ON reading_stats(date);
    CREATE INDEX IF NOT EXISTS idx_stats_book ON reading_stats(bookId);
    CREATE INDEX IF NOT EXISTS idx_goals_type ON reading_goals(type);
  `);
}
function migrateDatabase() {
  const database = getDb();
  const columns = database.prepare("PRAGMA table_info(books)").all();
  const columnNames = columns.map((c) => c.name);
  if (!columnNames.includes("totalReadingTime")) {
    database.exec("ALTER TABLE books ADD COLUMN totalReadingTime INTEGER DEFAULT 0");
  }
  if (!columnNames.includes("notes")) {
    database.exec("ALTER TABLE books ADD COLUMN notes TEXT DEFAULT ''");
  }
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
        lastReadPage, lastReadPosition, lastReadTime, totalReadingTime, notes,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      book.totalReadingTime || 0,
      book.notes || "",
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
  addReadingTime(bookId, duration) {
    getDb().prepare("UPDATE books SET totalReadingTime = COALESCE(totalReadingTime, 0) + ?, updatedAt = ? WHERE id = ?").run(duration, Date.now(), bookId);
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
const statsDb = {
  getByDate(date) {
    return getDb().prepare("SELECT * FROM reading_stats WHERE date = ? ORDER BY createdAt DESC").all(date);
  },
  getByBookId(bookId, limit = 30) {
    return getDb().prepare("SELECT * FROM reading_stats WHERE bookId = ? ORDER BY date DESC LIMIT ?").all(bookId, limit);
  },
  getDateRange(startDate, endDate) {
    return getDb().prepare("SELECT * FROM reading_stats WHERE date >= ? AND date <= ? ORDER BY date ASC").all(startDate, endDate);
  },
  addReading(bookId, pagesRead, charactersRead, readingTime) {
    const now = Date.now();
    const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const existing = getDb().prepare("SELECT * FROM reading_stats WHERE bookId = ? AND date = ?").get(bookId, date);
    if (existing) {
      getDb().prepare(`
          UPDATE reading_stats 
          SET pagesRead = pagesRead + ?,
              charactersRead = charactersRead + ?,
              readingTime = readingTime + ?,
              createdAt = ?
          WHERE bookId = ? AND date = ?
        `).run(pagesRead, charactersRead, readingTime, now, bookId, date);
      return existing.id;
    } else {
      const stmt = getDb().prepare(`
        INSERT INTO reading_stats (bookId, date, pagesRead, charactersRead, readingTime, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(bookId, date, pagesRead, charactersRead, readingTime, now);
      return Number(result.lastInsertRowid);
    }
  },
  getDailyAverage(days = 7) {
    const date = /* @__PURE__ */ new Date();
    date.setDate(date.getDate() - days);
    const startDate = date.toISOString().split("T")[0];
    const result = getDb().prepare(`
        SELECT AVG(readingTime) as avgTime 
        FROM reading_stats 
        WHERE date >= ?
      `).get(startDate);
    return result.avgTime || 0;
  },
  getPagesPerMinute(bookId) {
    const result = getDb().prepare(`
        SELECT SUM(pagesRead) as totalPages, SUM(readingTime) as totalTime
        FROM reading_stats 
        WHERE bookId = ? AND readingTime > 0
      `).get(bookId);
    if (!result.totalPages || !result.totalTime) return 0;
    return result.totalPages / (result.totalTime / 60);
  },
  deleteByBookId(bookId) {
    getDb().prepare("DELETE FROM reading_stats WHERE bookId = ?").run(bookId);
  }
};
const goalDb = {
  getAll() {
    return getDb().prepare("SELECT * FROM reading_goals ORDER BY createdAt DESC").all();
  },
  getActive() {
    const now = Date.now();
    return getDb().prepare("SELECT * FROM reading_goals WHERE periodStart <= ? AND periodEnd >= ? ORDER BY createdAt DESC LIMIT 1").get(now, now);
  },
  create(goal) {
    const now = Date.now();
    const stmt = getDb().prepare(`
      INSERT INTO reading_goals (type, target, targetType, current, periodStart, periodEnd, isCompleted, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      goal.type,
      goal.target,
      goal.targetType,
      goal.current,
      goal.periodStart,
      goal.periodEnd,
      goal.isCompleted,
      now
    );
    return Number(result.lastInsertRowid);
  },
  updateProgress(id, increment) {
    const goal = getDb().prepare("SELECT * FROM reading_goals WHERE id = ?").get(id);
    if (!goal) return 0;
    const newCurrent = goal.current + increment;
    const isCompleted = newCurrent >= goal.target ? 1 : 0;
    getDb().prepare("UPDATE reading_goals SET current = ?, isCompleted = ? WHERE id = ?").run(newCurrent, isCompleted, id);
    return newCurrent;
  },
  checkIn(type) {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const todayStart = new Date(today).getTime();
    const existingToday = getDb().prepare("SELECT * FROM reading_goals WHERE type = ? AND periodStart = ?").get(type, todayStart);
    if (existingToday) {
      return { success: false, streak: 0 };
    }
    const result = getDb().prepare(`
        SELECT COUNT(*) as count 
        FROM reading_goals 
        WHERE type = ? AND isCompleted = 1 
        ORDER BY periodStart DESC
      `).get(type);
    return { success: true, streak: result.count + 1 };
  },
  delete(id) {
    getDb().prepare("DELETE FROM reading_goals WHERE id = ?").run(id);
  }
};
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
  /^楔子|^序章|^序言|^前言|^后记|^番外|^引子|^尾声/m,
  /^[正外前后序末]篇.*$/m,
  /^第[一二三四五六七八九十百千零\d]+卷.*$/m,
  /^BOOK\s*\d+.*$/im,
  /^VOLUME\s*\d+.*$/im,
  /^Act\s*\d+.*$/im,
  /^Scene\s*\d+.*$/im,
  /^Episode\s*\d+.*$/im,
  /^\([一二三四五六七八九十\d]+\).*$/m,
  /^[一二三四五六七八九十百千]+、.*$/m
];
const GARBLED_PATTERNS = [
  { pattern: /[^\u4e00-\u9fa5\u0000-\u007f\u3000-\u303f\uff00-\uffef\r\n\t]/g, replace: "" },
  { pattern: /\u0000+/g, replace: "" },
  { pattern: /\uFFFD+/g, replace: "" },
  { pattern: /[�]+/g, replace: "" },
  { pattern: /\r{2,}/g, replace: "\r" },
  { pattern: / {4,}/g, replace: "  " }
];
const AUTHOR_PATTERNS = [
  /作者[：:]\s*([^\n\r]+)/i,
  /作\s*者[：:]\s*([^\n\r]+)/i,
  /[【\[]作者[】\]]\s*([^\n\r]+)/i,
  /Author[：:]\s*([^\n\r]+)/i,
  /著[：:]\s*([^\n\r]+)/i,
  /^([^\n\r]{2,20})\s*著$/im
];
const TAG_KEYWORDS = [
  "玄幻",
  "奇幻",
  "仙侠",
  "武侠",
  "都市",
  "言情",
  "历史",
  "军事",
  "科幻",
  "悬疑",
  "恐怖",
  "灵异",
  "游戏",
  "竞技",
  "同人",
  "耽美",
  "百合",
  "穿越",
  "重生",
  "系统",
  "快穿",
  "无限流",
  "种田",
  "基建",
  "爽文",
  "甜文",
  "虐文",
  "治愈",
  "搞笑",
  "轻松",
  "正剧",
  "悲剧",
  "总裁",
  "豪门",
  "校园",
  "职场",
  "娱乐圈",
  "网游",
  "末世",
  "星际",
  "修真",
  "修仙",
  "魔法",
  "斗气",
  "洪荒",
  "封神",
  "西游",
  "三国"
];
function cleanText(content, options = {}) {
  const { removeEmptyLines = true, fixGarbled = true, removeDuplicates = true } = options;
  let cleaned = content;
  let emptyLinesRemoved = 0;
  let garbledFixed = 0;
  const originalLength = content.length;
  if (fixGarbled) {
    for (const { pattern, replace } of GARBLED_PATTERNS) {
      const matches = cleaned.match(pattern);
      if (matches) {
        garbledFixed += matches.length;
        cleaned = cleaned.replace(pattern, replace);
      }
    }
  }
  if (removeEmptyLines) {
    const lines = cleaned.split("\n");
    const nonEmptyLines = [];
    let consecutiveEmpty = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "") {
        consecutiveEmpty++;
        if (consecutiveEmpty <= 1) {
          nonEmptyLines.push(line);
        } else {
          emptyLinesRemoved++;
        }
      } else {
        consecutiveEmpty = 0;
        nonEmptyLines.push(line);
      }
    }
    cleaned = nonEmptyLines.join("\n");
  }
  const duplicateChapters = [];
  if (removeDuplicates) {
    const chapters = extractChapters(cleaned);
    const seenTitles = /* @__PURE__ */ new Map();
    for (let i = 0; i < chapters.length; i++) {
      const title = chapters[i].title;
      if (seenTitles.has(title)) {
        duplicateChapters.push(i);
      } else {
        seenTitles.set(title, i);
      }
    }
    if (duplicateChapters.length > 0) {
      for (let i = duplicateChapters.length - 1; i >= 0; i--) {
        const idx = duplicateChapters[i];
        const chapter = chapters[idx];
        const nextChapter = chapters[idx + 1];
        if (nextChapter) {
          cleaned = cleaned.slice(0, chapter.startPosition) + cleaned.slice(nextChapter.startPosition);
        }
      }
    }
  }
  return {
    originalLength,
    cleanedLength: cleaned.length,
    emptyLinesRemoved,
    duplicateChapters,
    garbledFixed,
    content: cleaned
  };
}
function smartExtractChapters(content) {
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
    if (line.length > 0 && line.length < 150) {
      let isChapter = false;
      for (const pattern of CHAPTER_PATTERNS) {
        if (pattern.test(line)) {
          isChapter = true;
          break;
        }
      }
      if (!isChapter) {
        const prevLine = i > 0 ? lines[i - 1].trim() : "";
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : "";
        const isIsolated = prevLine === "" && nextLine === "";
        const hasChapterKeyword = /(章|节|卷|部|回|话|篇)/.test(line);
        if (isIsolated && hasChapterKeyword && line.length < 50) {
          isChapter = true;
        }
      }
      if (isChapter) {
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
      }
    }
    currentPosition += lines[i].length + 1;
  }
  if (chapters.length > 0) {
    chapters[chapters.length - 1].endPosition = content.length;
  }
  return chapters;
}
function extractBookSmartInfo(content, title) {
  let author = "未知";
  const tags = [];
  const first3000Chars = content.slice(0, 3e3);
  const last3000Chars = content.slice(-3e3);
  const fullSample = first3000Chars + "\n" + last3000Chars;
  for (const pattern of AUTHOR_PATTERNS) {
    const match = fullSample.match(pattern);
    if (match && match[1]) {
      author = match[1].trim();
      if (author.length > 30) {
        author = author.slice(0, 30);
      }
      break;
    }
  }
  for (const keyword of TAG_KEYWORDS) {
    const regex = new RegExp(keyword, "gi");
    if (regex.test(fullSample)) {
      tags.push(keyword);
      if (tags.length >= 5) break;
    }
  }
  const chapters = extractChapters(content);
  const chineseChars = content.match(/[\u4e00-\u9fa5]/g) || [];
  const englishChars = content.match(/[a-zA-Z]/g) || [];
  const detectedLanguage = chineseChars.length > englishChars.length ? "zh" : "en";
  const summary = generateSummary(content, chapters, title);
  return {
    summary,
    author,
    tags,
    estimatedChapters: chapters.length,
    wordCount: content.length,
    detectedLanguage
  };
}
function generateSummary(content, chapters, title) {
  const firstChapterContent = chapters.length > 1 ? content.slice(chapters[1].startPosition, chapters[1].startPosition + 1e3) : content.slice(0, 1e3);
  let summary = firstChapterContent.replace(/\s+/g, " ").replace(/[，。！？、；：]/g, "，").split("，").slice(0, 5).join("，").trim();
  if (summary.length > 200) {
    summary = summary.slice(0, 200) + "...";
  }
  if (summary.length < 50) {
    summary = `《${title}》共${chapters.length}章，${(content.length / 1e4).toFixed(1)}万字。`;
  }
  return summary;
}
function parseTxtFile(filePath, encoding, options = {}) {
  var _a;
  const { smartDetection = true, autoClean = true } = options;
  const buffer = fs.readFileSync(filePath);
  if (!encoding) {
    encoding = detectEncoding(buffer);
  }
  let content = readTextFile(filePath, encoding);
  if (autoClean) {
    const cleanResult = cleanText(content, {
      removeEmptyLines: true,
      fixGarbled: true,
      removeDuplicates: true
    });
    content = cleanResult.content;
  }
  const chapters = smartDetection ? smartExtractChapters(content) : extractChapters(content);
  const result = {
    content,
    encoding,
    chapters,
    totalCharacters: content.length
  };
  if (smartDetection) {
    const fileName = ((_a = filePath.split(/[/\\]/).pop()) == null ? void 0 : _a.replace(/\.[^/.]+$/, "")) || "未知书籍";
    result.smartInfo = extractBookSmartInfo(content, fileName);
  }
  return result;
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
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;
function registerIpcHandlers() {
  electron.ipcMain.handle("app:getConfig", () => getConfig());
  electron.ipcMain.handle("app:getReadingConfig", () => getReadingConfig());
  electron.ipcMain.handle("app:getShortcuts", () => getShortcuts());
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
  electron.ipcMain.handle("app:updateShortcuts", (_e, updates) => {
    updateShortcuts(updates);
    return getShortcuts();
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
  electron.ipcMain.handle("window:toggleFullscreen", () => toggleFullscreen());
  electron.ipcMain.handle("window:toggleAlwaysOnTop", () => toggleAlwaysOnTop());
  electron.ipcMain.handle("window:isAlwaysOnTop", () => isAlwaysOnTop());
  electron.ipcMain.handle("window:isFullscreen", () => isFullscreen());
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
  electron.ipcMain.handle("book:addReadingTime", (_e, bookId, duration) => {
    bookDb.addReadingTime(bookId, duration);
    return true;
  });
  electron.ipcMain.handle("book:add", async (_e, filePath) => {
    if (!fs.existsSync(filePath) || !isSupportedFile(filePath)) {
      throw new Error("不支持的文件格式");
    }
    const existing = bookDb.getByPath(filePath);
    if (existing) {
      return existing.id;
    }
    return addBookInternal(filePath);
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
  electron.ipcMain.handle("book:batchImport", async (_e, filePaths) => {
    const results = { success: [], failed: [] };
    for (const filePath of filePaths) {
      try {
        const existing = bookDb.getByPath(filePath);
        if (existing) {
          results.success.push(existing.id);
        } else {
          const id = await addBookInternal(filePath);
          if (id) results.success.push(id);
          else results.failed.push(filePath);
        }
      } catch (err) {
        results.failed.push(filePath);
      }
    }
    return results;
  });
  electron.ipcMain.handle("book:batchExport", async (_e, bookIds) => {
    const exportData = [];
    for (const bookId of bookIds) {
      const book = bookDb.getById(bookId);
      if (!book) continue;
      const bookmarks = bookmarkDb.getByBookId(bookId);
      const progress = progressDb.getByBookId(bookId, 1e3);
      const { id, createdAt, updatedAt, ...bookData } = book;
      const bookmarkData = bookmarks.map(({ id: id2, createdAt: createdAt2, ...rest }) => rest);
      const progressData = progress.map(({ id: id2, createdAt: createdAt2, ...rest }) => rest);
      exportData.push({
        book: bookData,
        bookmarks: bookmarkData,
        progress: progressData
      });
    }
    return exportData;
  });
  electron.ipcMain.handle("book:exportJson", async (_e, exportData) => {
    const result = await electron.dialog.showSaveDialog({
      title: "导出书架数据",
      defaultPath: `bookshelf_${Date.now()}.json`,
      filters: [{ name: "JSON文件", extensions: ["json"] }]
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), "utf-8");
      return true;
    }
    return false;
  });
  electron.ipcMain.handle("book:importJson", async () => {
    const result = await electron.dialog.showOpenDialog({
      title: "导入书架数据",
      properties: ["openFile"],
      filters: [{ name: "JSON文件", extensions: ["json"] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      try {
        const data = JSON.parse(fs.readFileSync(result.filePaths[0], "utf-8"));
        const importedIds = [];
        for (const item of data) {
          const existing = bookDb.getByPath(item.book.filePath);
          if (existing) {
            importedIds.push(existing.id);
            continue;
          }
          const bookId = bookDb.create(item.book);
          importedIds.push(bookId);
          for (const bookmark of item.bookmarks) {
            bookmarkDb.create({ ...bookmark, bookId });
          }
          for (const progress of item.progress) {
            progressDb.create({ ...progress, bookId });
          }
        }
        return { success: true, importedIds };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "用户取消" };
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
    let summary = "";
    let tags = "";
    try {
      if (fileType === "txt") {
        const result = parseTxtFile(filePath, void 0, { smartDetection: true, autoClean: true });
        encoding = result.encoding;
        totalCharacters = result.totalCharacters;
        if (result.smartInfo) {
          author = result.smartInfo.author || author;
          title = result.smartInfo.estimatedChapters > 1 ? title : getFileNameWithoutExtension(filePath);
          summary = result.smartInfo.summary || "";
          tags = result.smartInfo.tags.join(",") || "";
        }
      } else if (fileType === "epub") {
        const result = parseEpubFile(filePath);
        title = result.title || title;
        author = result.author || author;
        coverPath = result.coverPath;
        totalCharacters = result.totalCharacters;
      } else if (fileType === "pdf" || fileType === "chm") {
        const stats = fs.statSync(filePath);
        totalCharacters = stats.size;
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
      lastReadTime: Date.now(),
      totalReadingTime: 0,
      notes: "",
      summary,
      tags
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
    setReadingStart(bookId);
    const cached = bookCache.get(bookId);
    if (cached) {
      return {
        content: cached.isLargeFile ? "" : cached.content,
        chapters: cached.chapters,
        totalPages: cached.totalPages,
        isLargeFile: cached.isLargeFile
      };
    }
    let content = "";
    let chapters = [];
    const isLargeFile = book.totalCharacters > LARGE_FILE_THRESHOLD;
    try {
      if (book.fileType === "txt") {
        const result = parseTxtFile(book.filePath, book.encoding);
        content = result.content;
        chapters = result.chapters;
      } else if (book.fileType === "epub") {
        const result = parseEpubFile(book.filePath);
        content = result.content;
        chapters = result.chapters;
      } else if (book.fileType === "pdf" || book.fileType === "chm") {
        content = `这是一本${book.fileType.toUpperCase()}格式的电子书，当前仅支持简易阅读模式。

书名：${book.title}
作者：${book.author}

由于格式限制，部分功能可能不可用。`;
        chapters = [{
          index: 0,
          title: "全文",
          startPosition: 0,
          endPosition: content.length,
          startPage: 1
        }];
      }
    } catch (err) {
      console.error("Open book error:", err);
      throw new Error("解析书籍失败");
    }
    const pagination = book.fileType === "epub" || book.fileType === "pdf" || book.fileType === "chm" ? paginateEpubContent(content, chapters, pageChars) : paginateContent(content, chapters, pageChars);
    const cacheData = {
      content,
      chapters,
      totalPages: pagination.totalPages,
      pages: pagination.pages,
      isLargeFile
    };
    bookCache.set(bookId, cacheData);
    bookDb.update(bookId, { totalPages: pagination.totalPages });
    return {
      content: isLargeFile ? "" : content,
      chapters,
      totalPages: pagination.totalPages,
      isLargeFile
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
    if (cache.isLargeFile) {
      return {
        content: "",
        chapters: cache.chapters,
        isLargeFile: true
      };
    }
    return {
      content: cache.content,
      chapters: cache.chapters,
      isLargeFile: false
    };
  });
  electron.ipcMain.handle("reader:getChapterContent", (_e, bookId, chapterIndex) => {
    const book = bookDb.getById(bookId);
    if (!book) throw new Error("书籍不存在");
    const cache = bookCache.get(bookId);
    if (!cache) throw new Error("书籍未加载");
    const chapter = cache.chapters.find((c) => c.index === chapterIndex);
    if (!chapter) return null;
    const content = cache.content.slice(chapter.startPosition, chapter.endPosition);
    return {
      chapter,
      content,
      pages: cache.pages.filter((p) => p.chapterIndex === chapterIndex)
    };
  });
  electron.ipcMain.handle("reader:search", (_e, bookId, keyword) => {
    const book = bookDb.getById(bookId);
    if (!book) throw new Error("书籍不存在");
    if (!keyword || keyword.trim().length === 0) return [];
    const cache = bookCache.get(bookId);
    if (!cache) throw new Error("书籍未加载");
    const results = [];
    const searchKeyword = keyword.toLowerCase();
    const contextLength = 50;
    let matchIndex = 0;
    for (const page of cache.pages) {
      const contentLower = page.content.toLowerCase();
      let pos = contentLower.indexOf(searchKeyword);
      while (pos !== -1) {
        const actualPos = page.startPosition + pos;
        const startContext = Math.max(0, pos - contextLength);
        const endContext = Math.min(page.content.length, pos + keyword.length + contextLength);
        const context = page.content.slice(startContext, endContext);
        results.push({
          page: page.page,
          position: actualPos,
          chapterTitle: page.chapterTitle,
          content: context,
          matchIndex: matchIndex++
        });
        pos = contentLower.indexOf(searchKeyword, pos + 1);
      }
    }
    return results;
  });
  electron.ipcMain.handle("reader:splitVolume", async (_e, bookId, options) => {
    const book = bookDb.getById(bookId);
    if (!book || book.fileType !== "txt") {
      throw new Error("仅支持TXT文件分卷");
    }
    const cache = bookCache.get(bookId);
    if (!cache) throw new Error("书籍未加载");
    const volumes = [];
    if (options.unit === "chapters") {
      const chaptersPerVolume = options.volumeSize;
      for (let i = 0; i < cache.chapters.length; i += chaptersPerVolume) {
        const volumeChapters = cache.chapters.slice(i, i + chaptersPerVolume);
        const startChapter = volumeChapters[0].index;
        const endChapter = volumeChapters[volumeChapters.length - 1].index;
        volumeChapters[0].startPosition;
        volumeChapters[volumeChapters.length - 1].endPosition;
        let volumeContent = "";
        for (const chapter of volumeChapters) {
          const chapterContent = cache.content.slice(chapter.startPosition, chapter.endPosition);
          volumeContent += chapterContent + "\n\n";
        }
        volumes.push({
          title: `${book.title}_第${Math.floor(i / chaptersPerVolume) + 1}卷`,
          content: volumeContent,
          startChapter,
          endChapter
        });
      }
    } else {
      const charsPerVolume = options.volumeSize * 1e4;
      let currentPos = 0;
      let volumeIndex = 1;
      while (currentPos < cache.content.length) {
        let endPos = Math.min(currentPos + charsPerVolume, cache.content.length);
        if (endPos < cache.content.length) {
          const breakPoints = [
            cache.content.lastIndexOf("\n\n", endPos),
            cache.content.lastIndexOf("\n", endPos),
            cache.content.lastIndexOf("。", endPos)
          ];
          const validBreak = breakPoints.find((p) => p > currentPos + charsPerVolume * 0.8);
          if (validBreak !== void 0) {
            endPos = validBreak + 1;
          }
        }
        volumes.push({
          title: `${book.title}_第${volumeIndex}卷`,
          content: cache.content.slice(currentPos, endPos),
          startChapter: 0,
          endChapter: 0
        });
        currentPos = endPos;
        volumeIndex++;
      }
    }
    const result = await electron.dialog.showOpenDialog({
      title: "选择保存目录",
      properties: ["openDirectory"]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const saveDir = result.filePaths[0];
      for (let i = 0; i < volumes.length; i++) {
        const volume = volumes[i];
        const fileName = `${volume.title}.txt`;
        const filePath = path.join(saveDir, fileName);
        fs.writeFileSync(filePath, volume.content, book.encoding || "utf-8");
      }
      return { success: true, count: volumes.length, saveDir };
    }
    return { success: false, count: 0, saveDir: "" };
  });
  electron.ipcMain.handle("reader:getChapters", (_e, bookId) => {
    const cache = bookCache.get(bookId);
    if (!cache) return [];
    return cache.chapters;
  });
  electron.ipcMain.handle("reader:closeBook", (_e, bookId) => {
    saveReadingTime();
    bookCache.delete(bookId);
    return true;
  });
  electron.ipcMain.handle("reader:generateToc", (_e, content) => {
    return extractChapters(content);
  });
  electron.ipcMain.handle("reader:smartGenerateToc", (_e, content) => {
    return smartExtractChapters(content);
  });
  electron.ipcMain.handle("reader:cleanText", (_e, content, options) => {
    return cleanText(content, options);
  });
  electron.ipcMain.handle("reader:getSmartInfo", (_e, bookId) => {
    const book = bookDb.getById(bookId);
    if (!book) throw new Error("书籍不存在");
    const cache = bookCache.get(bookId);
    if (!cache) throw new Error("书籍未加载");
    return extractBookSmartInfo(cache.content, book.title);
  });
  electron.ipcMain.handle("reader:goToPercent", (_e, bookId, percent) => {
    const book = bookDb.getById(bookId);
    if (!book) throw new Error("书籍不存在");
    const cache = bookCache.get(bookId);
    if (!cache) throw new Error("书籍未加载");
    const targetPage = Math.max(1, Math.min(cache.totalPages, Math.floor(cache.totalPages * percent / 100)));
    return cache.pages.find((p) => p.page === targetPage) || null;
  });
  electron.ipcMain.handle("stats:getByDate", (_e, date) => statsDb.getByDate(date));
  electron.ipcMain.handle("stats:getByBookId", (_e, bookId, limit) => statsDb.getByBookId(bookId, limit));
  electron.ipcMain.handle("stats:getDateRange", (_e, startDate, endDate) => statsDb.getDateRange(startDate, endDate));
  electron.ipcMain.handle("stats:addReading", (_e, bookId, pagesRead, charactersRead, readingTime) => {
    return statsDb.addReading(bookId, pagesRead, charactersRead, readingTime);
  });
  electron.ipcMain.handle("stats:getDailyAverage", (_e, days) => statsDb.getDailyAverage(days));
  electron.ipcMain.handle("stats:getPagesPerMinute", (_e, bookId) => statsDb.getPagesPerMinute(bookId));
  electron.ipcMain.handle("goals:getAll", () => goalDb.getAll());
  electron.ipcMain.handle("goals:getActive", () => goalDb.getActive());
  electron.ipcMain.handle("goals:create", (_e, goal) => goalDb.create(goal));
  electron.ipcMain.handle("goals:updateProgress", (_e, id, increment) => goalDb.updateProgress(id, increment));
  electron.ipcMain.handle("goals:checkIn", (_e, type) => goalDb.checkIn(type));
  electron.ipcMain.handle("goals:delete", (_e, id) => goalDb.delete(id));
  electron.ipcMain.handle("theme:getPresetThemes", () => {
    return [
      {
        name: "light",
        displayName: "日间",
        bgPrimary: "#ffffff",
        bgSecondary: "#f5f5f5",
        bgTertiary: "#fafafa",
        textPrimary: "#333333",
        textSecondary: "#666666",
        textTertiary: "#999999",
        borderColor: "#e5e5e5",
        accentColor: "#409eff",
        readerBg: "#fdfbf7",
        readerText: "#333333",
        bgPrimaryRgb: "255, 255, 255"
      },
      {
        name: "dark",
        displayName: "夜间",
        bgPrimary: "#1a1a2e",
        bgSecondary: "#16213e",
        bgTertiary: "#0f0f1a",
        textPrimary: "#e5e5e5",
        textSecondary: "#a0a0a0",
        textTertiary: "#666666",
        borderColor: "#2d2d44",
        accentColor: "#66b1ff",
        readerBg: "#1a1a2e",
        readerText: "#c0c0c0",
        bgPrimaryRgb: "26, 26, 46"
      },
      {
        name: "eye",
        displayName: "护眼",
        bgPrimary: "#c7edcc",
        bgSecondary: "#b8e8c2",
        bgTertiary: "#d4f0d9",
        textPrimary: "#2f4f4f",
        textSecondary: "#3d5c5c",
        textTertiary: "#5a7a7a",
        borderColor: "#a0d4a8",
        accentColor: "#2e8b57",
        readerBg: "#c7edcc",
        readerText: "#2f4f4f",
        bgPrimaryRgb: "199, 237, 204"
      },
      {
        name: "sepia",
        displayName: "羊皮纸",
        bgPrimary: "#f4ecd8",
        bgSecondary: "#e8dcc8",
        bgTertiary: "#f0e6d0",
        textPrimary: "#5b4636",
        textSecondary: "#7a6555",
        textTertiary: "#998877",
        borderColor: "#d4c4a8",
        accentColor: "#8b7355",
        readerBg: "#f4ecd8",
        readerText: "#5b4636",
        bgPrimaryRgb: "244, 236, 216"
      },
      {
        name: "gray",
        displayName: "灰调",
        bgPrimary: "#f0f0f0",
        bgSecondary: "#e0e0e0",
        bgTertiary: "#e8e8e8",
        textPrimary: "#333333",
        textSecondary: "#666666",
        textTertiary: "#999999",
        borderColor: "#d0d0d0",
        accentColor: "#666666",
        readerBg: "#f0f0f0",
        readerText: "#333333",
        bgPrimaryRgb: "240, 240, 240"
      },
      {
        name: "blue",
        displayName: "深蓝",
        bgPrimary: "#0a192f",
        bgSecondary: "#112240",
        bgTertiary: "#0d1a2d",
        textPrimary: "#e6f1ff",
        textSecondary: "#a8b2d1",
        textTertiary: "#8892b0",
        borderColor: "#233554",
        accentColor: "#64ffda",
        readerBg: "#0a192f",
        readerText: "#e6f1ff",
        bgPrimaryRgb: "10, 25, 47"
      }
    ];
  });
  electron.ipcMain.handle("file:uploadBackground", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "图片文件", extensions: ["jpg", "jpeg", "png", "gif", "webp"] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const userDataPath = electron.app.getPath("userData");
      const backgroundsDir = path.join(userDataPath, "backgrounds");
      if (!fs.existsSync(backgroundsDir)) {
        fs.mkdirSync(backgroundsDir, { recursive: true });
      }
      const originalPath = result.filePaths[0];
      const fileName = `bg_${Date.now()}${path.extname(originalPath)}`;
      const newPath = path.join(backgroundsDir, fileName);
      fs.copyFileSync(originalPath, newPath);
      return newPath;
    }
    return null;
  });
  electron.ipcMain.handle("file:uploadFont", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "字体文件", extensions: ["ttf", "otf", "woff", "woff2"] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const userDataPath = electron.app.getPath("userData");
      const fontsDir = path.join(userDataPath, "fonts");
      if (!fs.existsSync(fontsDir)) {
        fs.mkdirSync(fontsDir, { recursive: true });
      }
      const originalPath = result.filePaths[0];
      const fileName = `font_${Date.now()}${path.extname(originalPath)}`;
      const newPath = path.join(fontsDir, fileName);
      fs.copyFileSync(originalPath, newPath);
      return { path: newPath, name: path.basename(originalPath, path.extname(originalPath)) };
    }
    return null;
  });
  electron.ipcMain.handle("book:updateSmartInfo", (_e, bookId, updates) => {
    bookDb.update(bookId, updates);
    return bookDb.getById(bookId);
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
