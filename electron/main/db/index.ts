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
  `)
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
        lastReadPage, lastReadPosition, lastReadTime, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      book.title, book.author, book.filePath, book.fileType, book.coverPath,
      book.encoding, book.totalPages, book.totalCharacters, book.categoryId,
      book.isPinned, book.lastReadPage, book.lastReadPosition, book.lastReadTime,
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
