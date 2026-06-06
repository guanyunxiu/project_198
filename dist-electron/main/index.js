"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const iconv = require("iconv-lite");
const jschardet = require("jschardet");
const GARBLED_PATTERNS = [
  /[亜唖娃阿哀愛挨姶葵逢穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭]/,
  /[\uFFFD\u0080-\u009F]/,
  /[?]{3,}/
];
const AUTHOR_PATTERNS = [
  /(?:作者|著|作|書|撰)[：:]\s*([^\n\r]+)/i,
  /(?:作者|著者|作者：|作者:)\s*([^\n\r，。、；\n]+)/i,
  /^([^\n\r]{2,20})\s*[著|作|編]$/m,
  /(?:by|作者)\s+([A-Za-z\u4e00-\u9fa5]{2,30})/i
];
const TAG_KEYWORDS = {
  玄幻: ["玄幻", "奇幻", "魔法", "斗气", "修真", "修仙", "仙俠", "武俠", "武道"],
  都市: ["都市", "現代", "職場", "商業", "娛樂", "明星", "醫生", "老師"],
  言情: ["言情", "愛情", "戀愛", "婚寵", "總裁", "甜寵", "虐戀", "青春"],
  科幻: ["科幻", "未來", "星際", "太空", "機甲", "末世", "賽博", "蒸汽"],
  歷史: ["歷史", "古代", "穿越", "重生", "明朝", "唐朝", "三國", "抗戰"],
  懸疑: ["懸疑", "推理", "偵探", "恐怖", "靈異", "鬼", "殭屍", "盜墓"],
  遊戲: ["遊戲", "電競", "網遊", "虛擬", "吃雞", "王者", "聯盟"],
  體育: ["體育", "籃球", "足球", "網球", "田徑", "奧運", "競技"]
};
const COMMON_GARBLED_CHARS = {
  "鈥": "“",
  "樎": "”",
  "鈥檚": "'s",
  "鈥檙": "’",
  "鈥楾": "‘",
  "鈥旀": "–",
  "鈥斺": "—",
  "鈥橽": "…",
  "锘": "",
  "Ã©": "é",
  "Ã¨": "è",
  "Ã ": "à",
  "Â": ""
};
function cleanText(content, options) {
  let cleaned = content;
  if (options.fixGarbledText) {
    cleaned = fixGarbledText(cleaned);
  }
  if (options.removeEmptyLines) {
    cleaned = removeEmptyLines(cleaned);
  }
  if (options.removeExtraSpaces) {
    cleaned = removeExtraSpaces(cleaned);
  }
  if (options.normalizePunctuation) {
    cleaned = normalizePunctuation(cleaned);
  }
  return cleaned;
}
function fixGarbledText(content) {
  let fixed = content;
  for (const [garbled, correct] of Object.entries(COMMON_GARBLED_CHARS)) {
    fixed = fixed.replace(new RegExp(garbled, "g"), correct);
  }
  fixed = fixed.replace(/[\uFFFD]/g, "");
  fixed = fixed.replace(/[?]{2,}/g, "?");
  fixed = fixed.replace(/[!]{2,}/g, "!");
  return fixed;
}
function removeEmptyLines(content) {
  return content.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/^[ \t]+$/gm, "").replace(/^\n+|\n+$/g, "");
}
function removeExtraSpaces(content) {
  return content.replace(/[ \t]{2,}/g, " ").replace(/^[ \t]+|[ \t]+$/gm, "");
}
function normalizePunctuation(content) {
  return content.replace(/，/g, "，").replace(/。/g, "。").replace(/！/g, "！").replace(/？/g, "？").replace(/：/g, "：").replace(/；/g, "；").replace(/（/g, "（").replace(/）/g, "）").replace(/【/g, "【").replace(/】/g, "】");
}
function detectDuplicateChapters(chapters) {
  const duplicates = [];
  const titleMap = /* @__PURE__ */ new Map();
  chapters.forEach((chapter, index) => {
    const normalizedTitle = normalizeTitle(chapter.title);
    if (titleMap.has(normalizedTitle)) {
      titleMap.get(normalizedTitle).push(index);
    } else {
      titleMap.set(normalizedTitle, [index]);
    }
  });
  titleMap.forEach((indices) => {
    if (indices.length > 1) {
      duplicates.push(...indices.slice(1));
    }
  });
  return duplicates.sort((a, b) => b - a);
}
function removeDuplicateChapters(content, chapters) {
  const duplicateIndices = detectDuplicateChapters(chapters);
  if (duplicateIndices.length === 0) {
    return { content, chapters };
  }
  let newContent = content;
  const newChapters = [...chapters];
  for (const index of duplicateIndices) {
    const chapter = newChapters[index];
    const chapterContent = newContent.slice(chapter.startPosition, chapter.endPosition);
    newContent = newContent.replace(chapterContent, "");
    const lengthDiff = chapter.endPosition - chapter.startPosition;
    for (let i = index + 1; i < newChapters.length; i++) {
      newChapters[i].startPosition -= lengthDiff;
      newChapters[i].endPosition -= lengthDiff;
    }
    newChapters.splice(index, 1);
  }
  newChapters.forEach((chapter, index) => {
    chapter.index = index;
  });
  return { content: newContent, chapters: newChapters };
}
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[\s\-_【\[\]（）()《》<>""''`]/g, "").replace(/第[一二三四五六七八九十百千零\d]+/g, "第N").replace(/chapter\s*\d+/gi, "chapterN").replace(/[^\u4e00-\u9fa5a-z0-9]/g, "");
}
const SMART_CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千零\d]+[章节卷部篇回][\s、．。：:].*$/m,
  /^Chapter\s+\d+.*$/im,
  /^CH\.?\s*\d+.*$/im,
  /^\d+\s*[.、\-)\]】]\s*.+$/m,
  /^[【\[（(]\s*第?[一二三四五六七八九十百千零\d]+\s*[章节卷部篇回]?\s*[】\]）)].*$/m,
  /^楔子|^序章|^序言|^前言|^後記|^番外|^引子|^尾聲|^附錄|^完結|^結局/m,
  /^(?:上|下|前|後|正|續)篇.*$/m,
  /^[一二三四五六七八九十]+[、.\s].*$/m,
  /^VOL\.?\s*\d+.*$/im,
  /^BOOK\s+\d+.*$/im,
  /^ACT\s+\d+.*$/im,
  /^SCENE\s+\d+.*$/im
];
const SENTENCE_END_PATTERNS = [
  /[。！？!?…]/g,
  /[.?!]\s+/g,
  /\n{2,}/g
];
function smartExtractChapters(content, options) {
  const chapters = [];
  let chapterIndex = 0;
  const introContent = findIntroContent(content);
  if (introContent.length > 0) {
    chapters.push({
      index: 0,
      title: "引言",
      startPosition: 0,
      endPosition: introContent.length,
      startPage: 0,
      wordCount: introContent.length
    });
    chapterIndex = 1;
  }
  const matches = findAllChapterMatches(content);
  let lastEndPos = chapters.length > 0 ? chapters[0].endPosition : 0;
  matches.forEach((match) => {
    if (match.position < lastEndPos) return;
    if (chapters.length > 0) {
      chapters[chapters.length - 1].endPosition = match.position;
      chapters[chapters.length - 1].wordCount = chapters[chapters.length - 1].endPosition - chapters[chapters.length - 1].startPosition;
    }
    const title = cleanChapterTitle(match.title);
    if (title.length === 0) return;
    chapters.push({
      index: chapterIndex++,
      title,
      startPosition: match.position,
      endPosition: content.length,
      startPage: 0,
      wordCount: 0
    });
    lastEndPos = match.position;
  });
  if (chapters.length > 0) {
    chapters[chapters.length - 1].endPosition = content.length;
    chapters[chapters.length - 1].wordCount = chapters[chapters.length - 1].endPosition - chapters[chapters.length - 1].startPosition;
  }
  if (options.mergeShortChapters) {
    return mergeShortChapters(chapters, options.minChapterLength || 500);
  }
  return chapters;
}
function findIntroContent(content) {
  const firstMatch = findFirstChapterMatch(content);
  if (firstMatch === -1) return "";
  const intro = content.slice(0, firstMatch).trim();
  return intro.length < 5e3 ? intro : "";
}
function findFirstChapterMatch(content) {
  let earliestPos = Infinity;
  for (const pattern of SMART_CHAPTER_PATTERNS) {
    const match = content.match(pattern);
    if (match && match.index !== void 0 && match.index < earliestPos) {
      earliestPos = match.index;
    }
  }
  return earliestPos === Infinity ? -1 : earliestPos;
}
function findAllChapterMatches(content) {
  const matches = [];
  const foundPositions = /* @__PURE__ */ new Set();
  for (const pattern of SMART_CHAPTER_PATTERNS) {
    const regex = new RegExp(pattern.source, "gm");
    let match;
    while ((match = regex.exec(content)) !== null) {
      const pos = match.index;
      const title = match[0].trim();
      if (!foundPositions.has(pos) && isValidChapterTitle(title, content, pos)) {
        foundPositions.add(pos);
        matches.push({ title, position: pos });
      }
    }
  }
  return matches.sort((a, b) => a.position - b.position);
}
function isValidChapterTitle(title, content, position) {
  if (title.length > 100 || title.length < 2) return false;
  if (position > 0) {
    const prevChar = content[position - 1];
    if (prevChar && prevChar !== "\n" && prevChar !== "\r" && prevChar !== " " && prevChar !== "	") {
      return false;
    }
  }
  const lineStart = content.lastIndexOf("\n", position) + 1;
  const lineEnd = content.indexOf("\n", position);
  const lineContent = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim();
  if (lineContent !== title) return false;
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("第") && lowerTitle.includes("章")) {
    return true;
  }
  if (/^chapter\s+\d+/i.test(title)) {
    return true;
  }
  if (/^\d+\s*[.、]/.test(title)) {
    return true;
  }
  if (/^[【\[（(]/.test(title)) {
    return true;
  }
  return false;
}
function cleanChapterTitle(title) {
  return title.replace(/^[\s\u3000]+|[\s\u3000]+$/g, "").replace(/[\r\n]+/g, "").replace(/\s{2,}/g, " ");
}
function mergeShortChapters(chapters, minLength) {
  if (chapters.length <= 1) return chapters;
  const merged = [];
  let i = 0;
  while (i < chapters.length) {
    let current = { ...chapters[i] };
    while (i + 1 < chapters.length && current.wordCount < minLength && chapters[i + 1].wordCount < minLength) {
      const next = chapters[i + 1];
      current.title = `${current.title} · ${next.title}`;
      current.endPosition = next.endPosition;
      current.wordCount = current.endPosition - current.startPosition;
      i++;
    }
    merged.push(current);
    i++;
  }
  merged.forEach((chapter, index) => {
    chapter.index = index;
  });
  return merged;
}
function extractSentences(content) {
  const sentences = [];
  let lastIndex = 0;
  const combinedPattern = new RegExp(
    SENTENCE_END_PATTERNS.map((p) => p.source).join("|"),
    "g"
  );
  let match;
  while ((match = combinedPattern.exec(content)) !== null) {
    const sentence = content.slice(lastIndex, match.index + match[0].length).trim();
    if (sentence.length > 0) {
      sentences.push(sentence);
    }
    lastIndex = match.index + match[0].length;
  }
  const remaining = content.slice(lastIndex).trim();
  if (remaining.length > 0) {
    sentences.push(remaining);
  }
  return sentences;
}
function extractMetadata(content, title) {
  const first2000Chars = content.slice(0, 2e3);
  const last1000Chars = content.slice(-1e3);
  const author = detectAuthor(first2000Chars) || detectAuthor(last1000Chars) || "未知";
  const summary = generateSummary(content);
  const tags = detectTags(content, title);
  const chapterMatches = content.match(/第[一二三四五六七八九十百千零\d]+章/g) || [];
  const chapterCount = Math.max(
    chapterMatches.length,
    (content.match(/^第[一二三四五六七八九十百千零\d]+章/gm) || []).length
  );
  return {
    title,
    author,
    summary,
    tags,
    wordCount: content.length,
    chapterCount
  };
}
function detectAuthor(text) {
  for (const pattern of AUTHOR_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const author = match[1].trim().replace(/[作者|著|作|：:]/g, "").trim();
      if (author.length >= 2 && author.length <= 30) {
        return author;
      }
    }
  }
  return null;
}
function generateSummary(content, title) {
  const sentences = extractSentences(content.slice(0, 5e3));
  let summary = "";
  for (const sentence of sentences) {
    if (sentence.length > 10 && sentence.length < 200) {
      summary += sentence + " ";
      if (summary.length >= 300) break;
    }
  }
  if (summary.length < 50) {
    const firstParagraph = content.split("\n\n")[0] || content.split("\n")[0];
    summary = firstParagraph.slice(0, 300);
  }
  return summary.trim().slice(0, 300);
}
function detectTags(content, title) {
  const tags = [];
  const combinedText = (content.slice(0, 1e4) + " " + title).toLowerCase();
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        tags.push(tag);
        break;
      }
    }
  }
  if (tags.length === 0) {
    tags.push("其他");
  }
  return tags.slice(0, 5);
}
function getThemeTemplates() {
  return [
    {
      id: "light",
      name: "日间模式",
      bgColor: "#fdfbf7",
      textColor: "#333333",
      accentColor: "#409eff",
      secondaryBg: "#f5f5f5",
      borderColor: "#e4e7ed",
      preview: "#fdfbf7"
    },
    {
      id: "dark",
      name: "夜间模式",
      bgColor: "#1a1a2e",
      textColor: "#e0e0e0",
      accentColor: "#409eff",
      secondaryBg: "#2d2d44",
      borderColor: "#3d3d5c",
      preview: "#1a1a2e"
    },
    {
      id: "eye",
      name: "护眼模式",
      bgColor: "#c7edcc",
      textColor: "#333333",
      accentColor: "#52c41a",
      secondaryBg: "#d4f0d8",
      borderColor: "#b3dcc0",
      preview: "#c7edcc"
    },
    {
      id: "paper",
      name: "羊皮纸",
      bgColor: "#f4e4bc",
      textColor: "#5c4033",
      accentColor: "#8b4513",
      secondaryBg: "#efe0b5",
      borderColor: "#d4c4a0",
      preview: "#f4e4bc"
    },
    {
      id: "ocean",
      name: "海洋蓝",
      bgColor: "#e6f3ff",
      textColor: "#1e3a5f",
      accentColor: "#1890ff",
      secondaryBg: "#d6e8fa",
      borderColor: "#91caff",
      preview: "#e6f3ff"
    },
    {
      id: "forest",
      name: "森林绿",
      bgColor: "#e8f5e9",
      textColor: "#1b5e20",
      accentColor: "#4caf50",
      secondaryBg: "#c8e6c9",
      borderColor: "#a5d6a7",
      preview: "#e8f5e9"
    },
    {
      id: "sunset",
      name: "日落橙",
      bgColor: "#fff3e0",
      textColor: "#bf360c",
      accentColor: "#ff9800",
      secondaryBg: "#ffe0b2",
      borderColor: "#ffcc80",
      preview: "#fff3e0"
    },
    {
      id: "lavender",
      name: "薰衣草",
      bgColor: "#f3e5f5",
      textColor: "#4a148c",
      accentColor: "#9c27b0",
      secondaryBg: "#e1bee7",
      borderColor: "#ce93d8",
      preview: "#f3e5f5"
    }
  ];
}
function analyzeTextQuality(content) {
  const lines = content.split("\n");
  const emptyLines = lines.filter((l) => l.trim().length === 0).length;
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  const avgLineLength = nonEmptyLines.length > 0 ? nonEmptyLines.reduce((sum, l) => sum + l.length, 0) / nonEmptyLines.length : 0;
  let garbledCount = 0;
  for (const pattern of GARBLED_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      garbledCount += matches.length;
    }
  }
  return {
    hasGarbled: garbledCount > 5,
    garbledCount,
    emptyLineRatio: lines.length > 0 ? emptyLines / lines.length : 0,
    avgLineLength,
    totalLines: lines.length
  };
}
const defaultShortcuts = {
  nextPage: "ArrowRight",
  prevPage: "ArrowLeft",
  addBookmark: "b",
  goBack: "Escape",
  toggleFullscreen: "F11",
  toggleTheme: "t",
  toggleAlwaysOnTop: "p",
  search: "Ctrl+f",
  toggleSidebar: "s",
  toggleAutoFlip: "a"
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
  backgroundImage: null,
  customFont: null,
  customFontPath: null,
  pageLayout: "single",
  orientation: "portrait",
  opacity: 100,
  autoFlipEnabled: false,
  autoFlipSpeed: 1,
  autoFlipInterval: 30,
  themeTemplate: "light"
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
        shortcuts: { ...defaultShortcuts, ...saved.shortcuts },
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
function getThemeTemplatesList() {
  return getThemeTemplates();
}
function applyThemeTemplate(templateId) {
  const templates = getThemeTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (template) {
    currentConfig.readingConfig.themeTemplate = templateId;
    saveConfig();
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
  insertDefaultReadingGoal();
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
      detectedAuthor TEXT DEFAULT '',
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
      readTime INTEGER DEFAULT 0,
      readPages INTEGER DEFAULT 0,
      readCharacters INTEGER DEFAULT 0,
      readingSpeed INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reading_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dailyTarget INTEGER NOT NULL DEFAULT 30,
      targetUnit TEXT NOT NULL DEFAULT 'minutes',
      startDate INTEGER NOT NULL,
      endDate INTEGER,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_books_category ON books(categoryId);
    CREATE INDEX IF NOT EXISTS idx_books_pinned ON books(isPinned);
    CREATE INDEX IF NOT EXISTS idx_books_lastRead ON books(lastReadTime);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_book ON bookmarks(bookId);
    CREATE INDEX IF NOT EXISTS idx_progress_book ON reading_progress(bookId);
    CREATE INDEX IF NOT EXISTS idx_stats_book ON reading_stats(bookId);
    CREATE INDEX IF NOT EXISTS idx_stats_date ON reading_stats(date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_book_date ON reading_stats(bookId, date);
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
  if (!columnNames.includes("summary")) {
    database.exec("ALTER TABLE books ADD COLUMN summary TEXT DEFAULT ''");
  }
  if (!columnNames.includes("tags")) {
    database.exec("ALTER TABLE books ADD COLUMN tags TEXT DEFAULT ''");
  }
  if (!columnNames.includes("detectedAuthor")) {
    database.exec("ALTER TABLE books ADD COLUMN detectedAuthor TEXT DEFAULT ''");
  }
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = tables.map((t) => t.name);
  if (!tableNames.includes("reading_stats")) {
    database.exec(`
      CREATE TABLE reading_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookId INTEGER NOT NULL,
        date TEXT NOT NULL,
        readTime INTEGER DEFAULT 0,
        readPages INTEGER DEFAULT 0,
        readCharacters INTEGER DEFAULT 0,
        readingSpeed INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_stats_book ON reading_stats(bookId);
      CREATE INDEX idx_stats_date ON reading_stats(date);
      CREATE UNIQUE INDEX idx_stats_book_date ON reading_stats(bookId, date);
    `);
  } else {
    const statsColumns = database.prepare("PRAGMA table_info(reading_stats)").all();
    const statsColumnNames = statsColumns.map((c) => c.name);
    if (!statsColumnNames.includes("readTime")) {
      database.exec("ALTER TABLE reading_stats ADD COLUMN readTime INTEGER DEFAULT 0");
    }
    if (!statsColumnNames.includes("readPages")) {
      database.exec("ALTER TABLE reading_stats ADD COLUMN readPages INTEGER DEFAULT 0");
    }
    if (!statsColumnNames.includes("readCharacters")) {
      database.exec("ALTER TABLE reading_stats ADD COLUMN readCharacters INTEGER DEFAULT 0");
    }
    if (!statsColumnNames.includes("readingSpeed")) {
      database.exec("ALTER TABLE reading_stats ADD COLUMN readingSpeed INTEGER DEFAULT 0");
    }
    if (!statsColumnNames.includes("createdAt")) {
      database.exec("ALTER TABLE reading_stats ADD COLUMN createdAt INTEGER");
    }
  }
  if (!tableNames.includes("reading_goals")) {
    database.exec(`
      CREATE TABLE reading_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dailyTarget INTEGER NOT NULL DEFAULT 30,
        targetUnit TEXT NOT NULL DEFAULT 'minutes',
        startDate INTEGER NOT NULL,
        endDate INTEGER,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL
      );
    `);
    insertDefaultReadingGoal();
  } else {
    const goalColumns = database.prepare("PRAGMA table_info(reading_goals)").all();
    const goalColumnNames = goalColumns.map((c) => c.name);
    const hasLegacyColumns = goalColumnNames.includes("type");
    const hasNewColumns = goalColumnNames.includes("dailyTarget") && goalColumnNames.includes("targetUnit");
    if (hasLegacyColumns || !hasNewColumns) {
      database.exec("DROP TABLE reading_goals");
      database.exec(`
        CREATE TABLE reading_goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dailyTarget INTEGER NOT NULL DEFAULT 30,
          targetUnit TEXT NOT NULL DEFAULT 'minutes',
          startDate INTEGER NOT NULL,
          endDate INTEGER,
          isActive INTEGER NOT NULL DEFAULT 1,
          createdAt INTEGER NOT NULL
        );
      `);
      insertDefaultReadingGoal();
    }
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
function insertDefaultReadingGoal() {
  const database = getDb();
  const count = database.prepare("SELECT COUNT(*) as count FROM reading_goals").get();
  if (count.count === 0) {
    const now = Date.now();
    database.prepare(`
      INSERT INTO reading_goals (dailyTarget, targetUnit, startDate, isActive, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(30, "minutes", now, 1, now);
  }
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
        summary, tags, detectedAuthor,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      book.summary || "",
      book.tags || "",
      book.detectedAuthor || "",
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
  updateMetadata(bookId, metadata) {
    const now = Date.now();
    const fields = [];
    const values = [];
    if (metadata.summary !== void 0) {
      fields.push("summary = ?");
      values.push(metadata.summary);
    }
    if (metadata.tags !== void 0) {
      fields.push("tags = ?");
      values.push(metadata.tags);
    }
    if (metadata.detectedAuthor !== void 0) {
      fields.push("detectedAuthor = ?");
      values.push(metadata.detectedAuthor);
    }
    if (fields.length > 0) {
      values.push(now, bookId);
      const stmt = getDb().prepare(`UPDATE books SET ${fields.join(", ")}, updatedAt = ? WHERE id = ?`);
      stmt.run(...values);
    }
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
  getByBookId(bookId, startDate, endDate) {
    let sql = "SELECT * FROM reading_stats WHERE bookId = ?";
    const params = [bookId];
    if (startDate) {
      sql += " AND date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      sql += " AND date <= ?";
      params.push(endDate);
    }
    sql += " ORDER BY date ASC";
    return getDb().prepare(sql).all(...params);
  },
  getByDateRange(startDate, endDate) {
    return getDb().prepare("SELECT * FROM reading_stats WHERE date >= ? AND date <= ? ORDER BY date ASC").all(startDate, endDate);
  },
  getDailyStats(date) {
    return getDb().prepare("SELECT * FROM reading_stats WHERE date = ?").all(date);
  },
  getAverageReadingSpeed(bookId) {
    let sql = "SELECT AVG(readingSpeed) as avgSpeed FROM reading_stats WHERE readingSpeed > 0";
    const params = [];
    if (bookId) {
      sql += " AND bookId = ?";
      params.push(bookId);
    }
    const result = getDb().prepare(sql).get(...params);
    return Math.round(result.avgSpeed || 0);
  },
  getDailyTotal(date) {
    const result = getDb().prepare(`
      SELECT 
        COALESCE(SUM(readTime), 0) as readTime,
        COALESCE(SUM(readPages), 0) as readPages,
        COALESCE(SUM(readCharacters), 0) as readCharacters
      FROM reading_stats 
      WHERE date = ?
    `).get(date);
    return result;
  },
  getDailyAverages(days = 7) {
    const result = getDb().prepare(`
      SELECT 
        COALESCE(AVG(dailyTime), 0) as avgReadTime,
        COALESCE(AVG(dailyPages), 0) as avgReadPages,
        COALESCE(AVG(dailyChars), 0) as avgReadCharacters
      FROM (
        SELECT 
          date,
          SUM(readTime) as dailyTime,
          SUM(readPages) as dailyPages,
          SUM(readCharacters) as dailyChars
        FROM reading_stats
        WHERE date >= date('now', ?)
        GROUP BY date
      )
    `).get(`-${days} days`);
    return {
      avgReadTime: Math.round(result.avgReadTime),
      avgReadPages: Math.round(result.avgReadPages),
      avgReadCharacters: Math.round(result.avgReadCharacters)
    };
  },
  recordReadingSession(bookId, readTime, readPages, readCharacters) {
    const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const now = Date.now();
    const readingSpeed = readTime > 0 ? Math.round(readCharacters / readTime * 60) : 0;
    const existing = getDb().prepare(
      "SELECT id FROM reading_stats WHERE bookId = ? AND date = ?"
    ).get(bookId, date);
    if (existing) {
      getDb().prepare(`
        UPDATE reading_stats 
        SET 
          readTime = readTime + ?,
          readPages = readPages + ?,
          readCharacters = readCharacters + ?,
          readingSpeed = ?,
          createdAt = ?
        WHERE id = ?
      `).run(readTime, readPages, readCharacters, readingSpeed, now, existing.id);
    } else {
      getDb().prepare(`
        INSERT INTO reading_stats (bookId, date, readTime, readPages, readCharacters, readingSpeed, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(bookId, date, readTime, readPages, readCharacters, readingSpeed, now);
    }
  },
  getReadingStreak() {
    const dates = getDb().prepare(`
      SELECT DISTINCT date 
      FROM reading_stats 
      WHERE readTime > 0
      ORDER BY date DESC
    `).all();
    if (dates.length === 0) return 0;
    let streak = 0;
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < dates.length; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const checkDateStr = checkDate.toISOString().split("T")[0];
      if (dates.some((d) => d.date === checkDateStr)) {
        streak++;
      } else if (i === 0) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        if (dates.some((d) => d.date === yesterdayStr)) {
          streak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return streak;
  }
};
const goalDb = {
  getActiveGoal() {
    return getDb().prepare("SELECT * FROM reading_goals WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1").get();
  },
  getAllGoals() {
    return getDb().prepare("SELECT * FROM reading_goals ORDER BY createdAt DESC").all();
  },
  create(goal) {
    const now = Date.now();
    const stmt = getDb().prepare(`
      INSERT INTO reading_goals (dailyTarget, targetUnit, startDate, endDate, isActive, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      goal.dailyTarget,
      goal.targetUnit,
      goal.startDate,
      goal.endDate || null,
      goal.isActive,
      now
    );
    return Number(result.lastInsertRowid);
  },
  update(id, updates) {
    const fields = Object.keys(updates).filter((k) => k !== "id");
    if (fields.length === 0) return;
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => updates[f]);
    values.push(id);
    const stmt = getDb().prepare(`UPDATE reading_goals SET ${setClause} WHERE id = ?`);
    stmt.run(...values);
  },
  delete(id) {
    getDb().prepare("DELETE FROM reading_goals WHERE id = ?").run(id);
  },
  getDailyRecords(days = 7) {
    const records = [];
    const goal = this.getActiveGoal();
    if (!goal) return records;
    for (let i = days - 1; i >= 0; i--) {
      const date = /* @__PURE__ */ new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dailyTotal = statsDb.getDailyTotal(dateStr);
      let current = 0;
      switch (goal.targetUnit) {
        case "minutes":
          current = Math.round(dailyTotal.readTime / 60);
          break;
        case "pages":
          current = dailyTotal.readPages;
          break;
        case "characters":
          current = dailyTotal.readCharacters;
          break;
      }
      records.push({
        date: dateStr,
        readTime: dailyTotal.readTime,
        readPages: dailyTotal.readPages,
        readCharacters: dailyTotal.readCharacters,
        targetReached: current >= goal.dailyTarget ? 1 : 0
      });
    }
    return records;
  },
  getGoalProgress() {
    const goal = this.getActiveGoal();
    if (!goal) return null;
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const dailyTotal = statsDb.getDailyTotal(today);
    let current = 0;
    switch (goal.targetUnit) {
      case "minutes":
        current = Math.round(dailyTotal.readTime / 60);
        break;
      case "pages":
        current = dailyTotal.readPages;
        break;
      case "characters":
        current = dailyTotal.readCharacters;
        break;
    }
    const percentage = goal.dailyTarget > 0 ? Math.min(100, Math.round(current / goal.dailyTarget * 100)) : 0;
    const streak = statsDb.getReadingStreak();
    const records = this.getDailyRecords(7);
    return {
      goal,
      current,
      target: goal.dailyTarget,
      percentage,
      streak,
      records
    };
  }
};
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
        bookDb.addReadingTime(currentBookId, Math.floor(duration / 1e3));
      } catch (e) {
        console.error("Failed to save reading time:", e);
      }
    }
    readingStartTime = null;
    currentBookId = null;
  }
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
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;
const DEFAULT_CLEANUP_OPTIONS = {
  removeDuplicateChapters: true,
  removeEmptyLines: true,
  fixGarbledText: true,
  normalizePunctuation: true,
  removeExtraSpaces: true
};
const DEFAULT_SMART_CHAPTER_OPTIONS = {
  enableSmartSegmentation: true,
  minChapterLength: 500,
  mergeShortChapters: true,
  autoDetectTitlePatterns: true
};
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
  electron.ipcMain.handle("app:getThemeTemplates", () => getThemeTemplatesList());
  electron.ipcMain.handle("app:applyThemeTemplate", (_e, templateId) => {
    applyThemeTemplate(templateId);
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
  electron.ipcMain.handle("book:updateMetadata", (_e, bookId, metadata) => {
    bookDb.updateMetadata(bookId, metadata);
    return true;
  });
  electron.ipcMain.handle("book:getMetadata", (_e, bookId) => {
    const book = bookDb.getById(bookId);
    if (!book) return null;
    const tags = book.tags ? JSON.parse(book.tags) : [];
    return {
      title: book.title,
      author: book.author,
      summary: book.summary,
      tags,
      detectedAuthor: book.detectedAuthor,
      wordCount: book.totalCharacters,
      totalPages: book.totalPages
    };
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
  electron.ipcMain.handle("stats:getByBookId", (_e, bookId, startDate, endDate) => statsDb.getByBookId(bookId, startDate, endDate));
  electron.ipcMain.handle("stats:getByDateRange", (_e, startDate, endDate) => statsDb.getByDateRange(startDate, endDate));
  electron.ipcMain.handle("stats:getDailyStats", (_e, date) => statsDb.getDailyStats(date));
  electron.ipcMain.handle("stats:getDailyTotal", (_e, date) => statsDb.getDailyTotal(date));
  electron.ipcMain.handle("stats:getDailyAverages", (_e, days) => statsDb.getDailyAverages(days));
  electron.ipcMain.handle("stats:getAverageSpeed", (_e, bookId) => statsDb.getAverageReadingSpeed(bookId));
  electron.ipcMain.handle("stats:getReadingStreak", () => statsDb.getReadingStreak());
  electron.ipcMain.handle("stats:recordSession", (_e, bookId, readTime, readPages, readChars) => {
    statsDb.recordReadingSession(bookId, readTime, readPages, readChars);
    return true;
  });
  electron.ipcMain.handle("goal:getActiveGoal", () => goalDb.getActiveGoal());
  electron.ipcMain.handle("goal:getAllGoals", () => goalDb.getAllGoals());
  electron.ipcMain.handle("goal:getGoalProgress", () => goalDb.getGoalProgress());
  electron.ipcMain.handle("goal:getDailyRecords", (_e, days) => goalDb.getDailyRecords(days));
  electron.ipcMain.handle("goal:create", (_e, goal) => goalDb.create(goal));
  electron.ipcMain.handle("goal:update", (_e, id, updates) => {
    goalDb.update(id, updates);
    return true;
  });
  electron.ipcMain.handle("goal:delete", (_e, id) => {
    goalDb.delete(id);
    return true;
  });
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
    let tags = [];
    let detectedAuthor = "";
    try {
      if (fileType === "txt") {
        const result = parseTxtFile(filePath);
        encoding = result.encoding;
        totalCharacters = result.totalCharacters;
        const metadata = extractMetadata(result.content, title);
        author = metadata.author;
        detectedAuthor = metadata.author;
        summary = metadata.summary;
        tags = metadata.tags;
        const quality = analyzeTextQuality(result.content);
        if (quality.hasGarbled || quality.emptyLineRatio > 0.3) {
          console.log(`Text quality issues detected for ${filePath}:`, quality);
        }
      } else if (fileType === "epub") {
        const result = parseEpubFile(filePath);
        title = result.title || title;
        author = result.author || author;
        coverPath = result.coverPath;
        totalCharacters = result.totalCharacters;
        summary = result.content.slice(0, 300);
        detectedAuthor = author;
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
      tags: JSON.stringify(tags),
      detectedAuthor,
      createdAt: Date.now(),
      updatedAt: Date.now()
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
  electron.ipcMain.handle("file:selectImage", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "图片文件", extensions: ["jpg", "jpeg", "png", "gif", "bmp", "webp"] }
      ]
    });
    return result.canceled ? null : result.filePaths[0];
  });
  electron.ipcMain.handle("file:selectFont", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "字体文件", extensions: ["ttf", "otf", "woff", "woff2"] }
      ]
    });
    return result.canceled ? null : result.filePaths[0];
  });
  electron.ipcMain.handle("reader:openBook", (_e, bookId, pageChars = 800) => {
    const book = bookDb.getById(bookId);
    if (!book) throw new Error("书籍不存在");
    setReadingStart(bookId);
    const cached = bookCache.get(bookId);
    if (cached) {
      cached.readingSessionStart = Date.now();
      cached.readingSessionPages = 0;
      cached.readingSessionChars = 0;
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
        const quality = analyzeTextQuality(content);
        if (quality.hasGarbled || quality.emptyLineRatio > 0.3 || detectDuplicateChapters(chapters).length > 0) {
          const cleanedContent = cleanText(content, DEFAULT_CLEANUP_OPTIONS);
          const smartChapters = smartExtractChapters(cleanedContent, DEFAULT_SMART_CHAPTER_OPTIONS);
          const dedupResult = removeDuplicateChapters(cleanedContent, smartChapters);
          content = dedupResult.content;
          chapters = dedupResult.chapters;
        }
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
      isLargeFile,
      readingSessionStart: Date.now(),
      readingSessionPages: 0,
      readingSessionChars: 0
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
    if (cache.readingSessionStart) {
      const pageContent = cache.pages.find((p) => p.page === page);
      if (pageContent) {
        cache.readingSessionPages = (cache.readingSessionPages || 0) + 1;
        cache.readingSessionChars = (cache.readingSessionChars || 0) + (pageContent.endPosition - pageContent.startPosition);
      }
    }
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
    const cache = bookCache.get(bookId);
    if (cache && cache.readingSessionStart) {
      const readTime = Math.floor((Date.now() - cache.readingSessionStart) / 1e3);
      if (readTime > 10) {
        statsDb.recordReadingSession(
          bookId,
          readTime,
          cache.readingSessionPages || 0,
          cache.readingSessionChars || 0
        );
        bookDb.addReadingTime(bookId, readTime);
      }
    }
    saveReadingTime();
    bookCache.delete(bookId);
    return true;
  });
  electron.ipcMain.handle("reader:generateToc", (_e, content) => {
    return smartExtractChapters(content, DEFAULT_SMART_CHAPTER_OPTIONS);
  });
  electron.ipcMain.handle("reader:cleanText", (_e, content, options) => {
    return cleanText(content, options || DEFAULT_CLEANUP_OPTIONS);
  });
  electron.ipcMain.handle("reader:analyzeQuality", (_e, content) => {
    return analyzeTextQuality(content);
  });
  electron.ipcMain.handle("reader:extractMetadata", (_e, content, title) => {
    return extractMetadata(content, title);
  });
  electron.ipcMain.handle("reader:smartRechapters", (_e, bookId, options) => {
    const book = bookDb.getById(bookId);
    if (!book) throw new Error("书籍不存在");
    const cache = bookCache.get(bookId);
    if (!cache) throw new Error("书籍未加载");
    const smartOptions = options || DEFAULT_SMART_CHAPTER_OPTIONS;
    const newChapters = smartExtractChapters(cache.content, smartOptions);
    const dedupResult = removeDuplicateChapters(cache.content, newChapters);
    cache.chapters = dedupResult.chapters;
    cache.content = dedupResult.content;
    const pageChars = getReadingConfig().pageChars;
    const pagination = paginateContent(cache.content, cache.chapters, pageChars);
    cache.pages = pagination.pages;
    cache.totalPages = pagination.totalPages;
    bookDb.update(bookId, { totalPages: pagination.totalPages });
    return {
      chapters: cache.chapters,
      totalPages: cache.totalPages
    };
  });
  electron.ipcMain.handle("reader:goToPercentage", (_e, bookId, percentage) => {
    const book = bookDb.getById(bookId);
    if (!book) throw new Error("书籍不存在");
    const cache = bookCache.get(bookId);
    if (!cache) throw new Error("书籍未加载");
    const targetPos = Math.floor(percentage / 100 * cache.content.length);
    const page = cache.pages.find((p) => targetPos >= p.startPosition && targetPos < p.endPosition);
    return page ? page.page : 1;
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
