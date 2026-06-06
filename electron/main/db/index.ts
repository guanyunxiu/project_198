import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { Book, Category, Bookmark, ReadingProgress, ReadingStats, ReadingGoal, DailyReadingRecord } from '../types'

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
  insertDefaultReadingGoal()
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
  if (!columnNames.includes('summary')) {
    database.exec('ALTER TABLE books ADD COLUMN summary TEXT DEFAULT \'\'')
  }
  if (!columnNames.includes('tags')) {
    database.exec('ALTER TABLE books ADD COLUMN tags TEXT DEFAULT \'\'')
  }
  if (!columnNames.includes('detectedAuthor')) {
    database.exec('ALTER TABLE books ADD COLUMN detectedAuthor TEXT DEFAULT \'\'')
  }

  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
  const tableNames = tables.map(t => t.name)

  if (!tableNames.includes('reading_stats')) {
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
    `)
  }

  if (!tableNames.includes('reading_goals')) {
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
    `)
    insertDefaultReadingGoal()
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

function insertDefaultReadingGoal(): void {
  const database = getDb()
  const count = database.prepare('SELECT COUNT(*) as count FROM reading_goals').get() as { count: number }
  
  if (count.count === 0) {
    const now = Date.now()
    database.prepare(`
      INSERT INTO reading_goals (dailyTarget, targetUnit, startDate, isActive, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(30, 'minutes', now, 1, now)
  }
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
        summary, tags, detectedAuthor,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      book.title, book.author, book.filePath, book.fileType, book.coverPath,
      book.encoding, book.totalPages, book.totalCharacters, book.categoryId,
      book.isPinned, book.lastReadPage, book.lastReadPosition, book.lastReadTime,
      book.totalReadingTime || 0, book.notes || '',
      book.summary || '', book.tags || '', book.detectedAuthor || '',
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

  updateMetadata(bookId: number, metadata: { summary?: string; tags?: string; detectedAuthor?: string }): void {
    const now = Date.now()
    const fields: string[] = []
    const values: unknown[] = []

    if (metadata.summary !== undefined) {
      fields.push('summary = ?')
      values.push(metadata.summary)
    }
    if (metadata.tags !== undefined) {
      fields.push('tags = ?')
      values.push(metadata.tags)
    }
    if (metadata.detectedAuthor !== undefined) {
      fields.push('detectedAuthor = ?')
      values.push(metadata.detectedAuthor)
    }

    if (fields.length > 0) {
      values.push(now, bookId)
      const stmt = getDb().prepare(`UPDATE books SET ${fields.join(', ')}, updatedAt = ? WHERE id = ?`)
      stmt.run(...values)
    }
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
  getByBookId(bookId: number, startDate?: string, endDate?: string): ReadingStats[] {
    let sql = 'SELECT * FROM reading_stats WHERE bookId = ?'
    const params: unknown[] = [bookId]

    if (startDate) {
      sql += ' AND date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND date <= ?'
      params.push(endDate)
    }

    sql += ' ORDER BY date ASC'
    return getDb().prepare(sql).all(...params) as ReadingStats[]
  },

  getByDateRange(startDate: string, endDate: string): ReadingStats[] {
    return getDb()
      .prepare('SELECT * FROM reading_stats WHERE date >= ? AND date <= ? ORDER BY date ASC')
      .all(startDate, endDate) as ReadingStats[]
  },

  getDailyStats(date: string): ReadingStats[] {
    return getDb()
      .prepare('SELECT * FROM reading_stats WHERE date = ?')
      .all(date) as ReadingStats[]
  },

  getAverageReadingSpeed(bookId?: number): number {
    let sql = 'SELECT AVG(readingSpeed) as avgSpeed FROM reading_stats WHERE readingSpeed > 0'
    const params: unknown[] = []

    if (bookId) {
      sql += ' AND bookId = ?'
      params.push(bookId)
    }

    const result = getDb().prepare(sql).get(...params) as { avgSpeed: number | null }
    return Math.round(result.avgSpeed || 0)
  },

  getDailyTotal(date: string): { readTime: number; readPages: number; readCharacters: number } {
    const result = getDb().prepare(`
      SELECT 
        COALESCE(SUM(readTime), 0) as readTime,
        COALESCE(SUM(readPages), 0) as readPages,
        COALESCE(SUM(readCharacters), 0) as readCharacters
      FROM reading_stats 
      WHERE date = ?
    `).get(date) as { readTime: number; readPages: number; readCharacters: number }
    
    return result
  },

  getDailyAverages(days: number = 7): { avgReadTime: number; avgReadPages: number; avgReadCharacters: number } {
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
    `).get(`-${days} days`) as { avgReadTime: number; avgReadPages: number; avgReadCharacters: number }
    
    return {
      avgReadTime: Math.round(result.avgReadTime),
      avgReadPages: Math.round(result.avgReadPages),
      avgReadCharacters: Math.round(result.avgReadCharacters)
    }
  },

  recordReadingSession(
    bookId: number, 
    readTime: number, 
    readPages: number, 
    readCharacters: number
  ): void {
    const date = new Date().toISOString().split('T')[0]
    const now = Date.now()
    const readingSpeed = readTime > 0 ? Math.round((readCharacters / readTime) * 60) : 0

    const existing = getDb().prepare(
      'SELECT id FROM reading_stats WHERE bookId = ? AND date = ?'
    ).get(bookId, date) as { id: number } | undefined

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
      `).run(readTime, readPages, readCharacters, readingSpeed, now, existing.id)
    } else {
      getDb().prepare(`
        INSERT INTO reading_stats (bookId, date, readTime, readPages, readCharacters, readingSpeed, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(bookId, date, readTime, readPages, readCharacters, readingSpeed, now)
    }
  },

  getReadingStreak(): number {
    const dates = getDb().prepare(`
      SELECT DISTINCT date 
      FROM reading_stats 
      WHERE readTime > 0
      ORDER BY date DESC
    `).all() as { date: string }[]

    if (dates.length === 0) return 0

    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 0; i < dates.length; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - i)
      const checkDateStr = checkDate.toISOString().split('T')[0]

      if (dates.some(d => d.date === checkDateStr)) {
        streak++
      } else if (i === 0) {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        if (dates.some(d => d.date === yesterdayStr)) {
          streak++
        } else {
          break
        }
      } else {
        break
      }
    }

    return streak
  }
}

export const goalDb = {
  getActiveGoal(): ReadingGoal | undefined {
    return getDb()
      .prepare('SELECT * FROM reading_goals WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1')
      .get() as ReadingGoal | undefined
  },

  getAllGoals(): ReadingGoal[] {
    return getDb()
      .prepare('SELECT * FROM reading_goals ORDER BY createdAt DESC')
      .all() as ReadingGoal[]
  },

  create(goal: Omit<ReadingGoal, 'id' | 'createdAt'>): number {
    const now = Date.now()
    const stmt = getDb().prepare(`
      INSERT INTO reading_goals (dailyTarget, targetUnit, startDate, endDate, isActive, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      goal.dailyTarget, goal.targetUnit, goal.startDate, 
      goal.endDate || null, goal.isActive, now
    )
    return Number(result.lastInsertRowid)
  },

  update(id: number, updates: Partial<ReadingGoal>): void {
    const fields = Object.keys(updates).filter(k => k !== 'id')
    if (fields.length === 0) return

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    values.push(id)

    const stmt = getDb().prepare(`UPDATE reading_goals SET ${setClause} WHERE id = ?`)
    stmt.run(...values)
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM reading_goals WHERE id = ?').run(id)
  },

  getDailyRecords(days: number = 7): DailyReadingRecord[] {
    const records: DailyReadingRecord[] = []
    const goal = this.getActiveGoal()
    
    if (!goal) return records

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const dailyTotal = statsDb.getDailyTotal(dateStr)
      
      let current = 0
      switch (goal.targetUnit) {
        case 'minutes':
          current = Math.round(dailyTotal.readTime / 60)
          break
        case 'pages':
          current = dailyTotal.readPages
          break
        case 'characters':
          current = dailyTotal.readCharacters
          break
      }

      records.push({
        date: dateStr,
        readTime: dailyTotal.readTime,
        readPages: dailyTotal.readPages,
        readCharacters: dailyTotal.readCharacters,
        targetReached: current >= goal.dailyTarget ? 1 : 0
      })
    }

    return records
  },

  getGoalProgress(): {
    goal: ReadingGoal
    current: number
    target: number
    percentage: number
    streak: number
    records: DailyReadingRecord[]
  } | null {
    const goal = this.getActiveGoal()
    if (!goal) return null

    const today = new Date().toISOString().split('T')[0]
    const dailyTotal = statsDb.getDailyTotal(today)
    
    let current = 0
    switch (goal.targetUnit) {
      case 'minutes':
        current = Math.round(dailyTotal.readTime / 60)
        break
      case 'pages':
        current = dailyTotal.readPages
        break
      case 'characters':
        current = dailyTotal.readCharacters
        break
    }

    const percentage = goal.dailyTarget > 0 ? Math.min(100, Math.round((current / goal.dailyTarget) * 100)) : 0
    const streak = statsDb.getReadingStreak()
    const records = this.getDailyRecords(7)

    return {
      goal,
      current,
      target: goal.dailyTarget,
      percentage,
      streak,
      records
    }
  }
}
