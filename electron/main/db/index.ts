import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { Book, Category, Bookmark, ReadingProgress } from '../types'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'novel-reader.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  migrateDatabase()
  insertDefaultCategory()
}

function createTables(): void {
  const database = getDb()

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
  `)
}

function migrateDatabase(): void {
  const database = getDb()
  
  const columns = database.prepare("PRAGMA table_info(books)").all() as { name: string }[]
  const columnNames = columns.map(c => c.name)
  
  if (!columnNames.includes('totalReadingTime')) {
    database.exec('ALTER TABLE books ADD COLUMN totalReadingTime INTEGER DEFAULT 0')
  }
  if (!columnNames.includes('notes')) {
    database.exec('ALTER TABLE books ADD COLUMN notes TEXT DEFAULT \'\'')
  }
}

function insertDefaultCategory(): void {
  const database = getDb()
  const now = Date.now()

  const stmt = database.prepare(
    'INSERT OR IGNORE INTO categories (name, createdAt) VALUES (?, ?)'
  )
  stmt.run('未分类', now)
}

export const categoryDb = {
  getAll(): Category[] {
    return getDb().prepare('SELECT * FROM categories ORDER BY createdAt ASC').all() as Category[]
  },

  create(name: string): number {
    const now = Date.now()
    const stmt = getDb().prepare(
      'INSERT INTO categories (name, createdAt) VALUES (?, ?)'
    )
    const result = stmt.run(name, now)
    return Number(result.lastInsertRowid)
  },

  update(id: number, name: string): void {
    getDb().prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id)
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
  }
}

export const bookDb = {
  getAll(): Book[] {
    return getDb()
      .prepare('SELECT * FROM books ORDER BY isPinned DESC, lastReadTime DESC, createdAt DESC')
      .all() as Book[]
  },

  getById(id: number): Book | undefined {
    return getDb().prepare('SELECT * FROM books WHERE id = ?').get(id) as Book | undefined
  },

  getByPath(filePath: string): Book | undefined {
    return getDb().prepare('SELECT * FROM books WHERE filePath = ?').get(filePath) as Book | undefined
  },

  create(book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>): number {
    const now = Date.now()
    const stmt = getDb().prepare(`
      INSERT INTO books (
        title, author, filePath, fileType, coverPath, encoding,
        totalPages, totalCharacters, categoryId, isPinned,
        lastReadPage, lastReadPosition, lastReadTime, totalReadingTime, notes,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      book.title, book.author, book.filePath, book.fileType, book.coverPath,
      book.encoding, book.totalPages, book.totalCharacters, book.categoryId,
      book.isPinned, book.lastReadPage, book.lastReadPosition, book.lastReadTime,
      book.totalReadingTime || 0, book.notes || '',
      now, now
    )
    return Number(result.lastInsertRowid)
  },

  update(id: number, updates: Partial<Book>): void {
    const now = Date.now()
    const fields = Object.keys(updates).filter(k => k !== 'id')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(now, id)

    const stmt = getDb().prepare(`UPDATE books SET ${setClause}, updatedAt = ? WHERE id = ?`)
    stmt.run(...values)
  },

  updateReadingProgress(bookId: number, page: number, position: number): void {
    const now = Date.now()
    getDb()
      .prepare('UPDATE books SET lastReadPage = ?, lastReadPosition = ?, lastReadTime = ?, updatedAt = ? WHERE id = ?')
      .run(page, position, now, now, bookId)
  },

  addReadingTime(bookId: number, duration: number): void {
    getDb()
      .prepare('UPDATE books SET totalReadingTime = COALESCE(totalReadingTime, 0) + ?, updatedAt = ? WHERE id = ?')
      .run(duration, Date.now(), bookId)
  },

  togglePin(id: number): void {
    getDb()
      .prepare('UPDATE books SET isPinned = 1 - isPinned, updatedAt = ? WHERE id = ?')
      .run(Date.now(), id)
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM books WHERE id = ?').run(id)
  }
}

export const bookmarkDb = {
  getByBookId(bookId: number): Bookmark[] {
    return getDb()
      .prepare('SELECT * FROM bookmarks WHERE bookId = ? ORDER BY createdAt DESC')
      .all(bookId) as Bookmark[]
  },

  create(bookmark: Omit<Bookmark, 'id' | 'createdAt'>): number {
    const now = Date.now()
    const stmt = getDb().prepare(`
      INSERT INTO bookmarks (bookId, page, position, content, chapterTitle, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      bookmark.bookId, bookmark.page, bookmark.position,
      bookmark.content, bookmark.chapterTitle, now
    )
    return Number(result.lastInsertRowid)
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
  },

  deleteByBookId(bookId: number): void {
    getDb().prepare('DELETE FROM bookmarks WHERE bookId = ?').run(bookId)
  }
}

export const progressDb = {
  getByBookId(bookId: number, limit: number = 100): ReadingProgress[] {
    return getDb()
      .prepare('SELECT * FROM reading_progress WHERE bookId = ? ORDER BY createdAt DESC LIMIT ?')
      .all(bookId, limit) as ReadingProgress[]
  },

  create(progress: Omit<ReadingProgress, 'id' | 'createdAt'>): number {
    const now = Date.now()
    const stmt = getDb().prepare(`
      INSERT INTO reading_progress (bookId, page, position, chapterIndex, readTime, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      progress.bookId, progress.page, progress.position,
      progress.chapterIndex, progress.readTime, now
    )
    return Number(result.lastInsertRowid)
  },

  deleteByBookId(bookId: number): void {
    getDb().prepare('DELETE FROM reading_progress WHERE bookId = ?').run(bookId)
  }
}

export const statsDb = {
  getByDate(date: string): ReadingStats[] {
    return getDb()
      .prepare('SELECT * FROM reading_stats WHERE date = ? ORDER BY createdAt DESC')
      .all(date) as ReadingStats[]
  },

  getByBookId(bookId: number, limit: number = 30): ReadingStats[] {
    return getDb()
      .prepare('SELECT * FROM reading_stats WHERE bookId = ? ORDER BY date DESC LIMIT ?')
      .all(bookId, limit) as ReadingStats[]
  },

  getDateRange(startDate: string, endDate: string): ReadingStats[] {
    return getDb()
      .prepare('SELECT * FROM reading_stats WHERE date >= ? AND date <= ? ORDER BY date ASC')
      .all(startDate, endDate) as ReadingStats[]
  },

  addReading(bookId: number, pagesRead: number, charactersRead: number, readingTime: number): number {
    const now = Date.now()
    const date = new Date().toISOString().split('T')[0]
    
    const existing = getDb()
      .prepare('SELECT * FROM reading_stats WHERE bookId = ? AND date = ?')
      .get(bookId, date) as ReadingStats | undefined

    if (existing) {
      getDb()
        .prepare(`
          UPDATE reading_stats 
          SET pagesRead = pagesRead + ?,
              charactersRead = charactersRead + ?,
              readingTime = readingTime + ?,
              createdAt = ?
          WHERE bookId = ? AND date = ?
        `)
        .run(pagesRead, charactersRead, readingTime, now, bookId, date)
      return existing.id
    } else {
      const stmt = getDb().prepare(`
        INSERT INTO reading_stats (bookId, date, pagesRead, charactersRead, readingTime, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      const result = stmt.run(bookId, date, pagesRead, charactersRead, readingTime, now)
      return Number(result.lastInsertRowid)
    }
  },

  getDailyAverage(days: number = 7): number {
    const date = new Date()
    date.setDate(date.getDate() - days)
    const startDate = date.toISOString().split('T')[0]

    const result = getDb()
      .prepare(`
        SELECT AVG(readingTime) as avgTime 
        FROM reading_stats 
        WHERE date >= ?
      `)
      .get(startDate) as { avgTime: number | null }

    return result.avgTime || 0
  },

  getPagesPerMinute(bookId: number): number {
    const result = getDb()
      .prepare(`
        SELECT SUM(pagesRead) as totalPages, SUM(readingTime) as totalTime
        FROM reading_stats 
        WHERE bookId = ? AND readingTime > 0
      `)
      .get(bookId) as { totalPages: number | null; totalTime: number | null }

    if (!result.totalPages || !result.totalTime) return 0
    return result.totalPages / (result.totalTime / 60)
  },

  deleteByBookId(bookId: number): void {
    getDb().prepare('DELETE FROM reading_stats WHERE bookId = ?').run(bookId)
  }
}

export const goalDb = {
  getAll(): ReadingGoal[] {
    return getDb()
      .prepare('SELECT * FROM reading_goals ORDER BY createdAt DESC')
      .all() as ReadingGoal[]
  },

  getActive(): ReadingGoal | null {
    const now = Date.now()
    return getDb()
      .prepare('SELECT * FROM reading_goals WHERE periodStart <= ? AND periodEnd >= ? ORDER BY createdAt DESC LIMIT 1')
      .get(now, now) as ReadingGoal | null
  },

  create(goal: Omit<ReadingGoal, 'id' | 'createdAt'>): number {
    const now = Date.now()
    const stmt = getDb().prepare(`
      INSERT INTO reading_goals (type, target, targetType, current, periodStart, periodEnd, isCompleted, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      goal.type, goal.target, goal.targetType, goal.current,
      goal.periodStart, goal.periodEnd, goal.isCompleted, now
    )
    return Number(result.lastInsertRowid)
  },

  updateProgress(id: number, increment: number): number {
    const goal = getDb().prepare('SELECT * FROM reading_goals WHERE id = ?').get(id) as ReadingGoal | undefined
    if (!goal) return 0

    const newCurrent = goal.current + increment
    const isCompleted = newCurrent >= goal.target ? 1 : 0

    getDb()
      .prepare('UPDATE reading_goals SET current = ?, isCompleted = ? WHERE id = ?')
      .run(newCurrent, isCompleted, id)

    return newCurrent
  },

  checkIn(type: string): { success: boolean; streak: number } {
    const today = new Date().toISOString().split('T')[0]
    const todayStart = new Date(today).getTime()
    
    const existingToday = getDb()
      .prepare('SELECT * FROM reading_goals WHERE type = ? AND periodStart = ?')
      .get(type, todayStart) as ReadingGoal | undefined

    if (existingToday) {
      return { success: false, streak: 0 }
    }

    const result = getDb()
      .prepare(`
        SELECT COUNT(*) as count 
        FROM reading_goals 
        WHERE type = ? AND isCompleted = 1 
        ORDER BY periodStart DESC
      `)
      .get(type) as { count: number }

    return { success: true, streak: result.count + 1 }
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM reading_goals WHERE id = ?').run(id)
  }
}
