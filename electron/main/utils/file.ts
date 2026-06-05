import { readdirSync, statSync, readFileSync, existsSync } from 'fs'
import { join, extname, basename, parse } from 'path'
import iconv from 'iconv-lite'
import jschardet from 'jschardet'
import type { FileInfo } from '../types'

const SUPPORTED_EXTENSIONS = ['.txt', '.epub', '.pdf', '.chm']

export function isSupportedFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  return SUPPORTED_EXTENSIONS.includes(ext)
}

export function getFileType(filePath: string): 'txt' | 'epub' | 'pdf' | 'chm' {
  const ext = extname(filePath).toLowerCase().slice(1) as 'txt' | 'epub' | 'pdf' | 'chm'
  return ext
}

export function listDirectory(dirPath: string): FileInfo[] {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    return entries
      .filter(entry => !entry.name.startsWith('.'))
      .map(entry => {
        const fullPath = join(dirPath, entry.name)
        try {
          const stats = statSync(fullPath)
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            extension: extname(entry.name).toLowerCase().slice(1),
            createdAt: stats.birthtimeMs,
            updatedAt: stats.mtimeMs
          }
        } catch {
          return null
        }
      })
      .filter((item): item is FileInfo => item !== null)
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name, 'zh-CN')
      })
  } catch {
    return []
  }
}

export function scanDirectoryForBooks(
  dirPath: string,
  recursive: boolean = true,
  results: string[] = []
): string[] {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory() && recursive) {
        scanDirectoryForBooks(fullPath, recursive, results)
      } else if (entry.isFile() && isSupportedFile(fullPath)) {
        results.push(fullPath)
      }
    }
  } catch {
    // Skip inaccessible directories
  }

  return results
}

export function scanMultiplePaths(paths: string[], recursive: boolean = true): string[] {
  const allBooks: Set<string> = new Set()

  for (const path of paths) {
    if (existsSync(path)) {
      const stats = statSync(path)
      if (stats.isDirectory()) {
        scanDirectoryForBooks(path, recursive).forEach(book => allBooks.add(book))
      } else if (stats.isFile() && isSupportedFile(path)) {
        allBooks.add(path)
      }
    }
  }

  return Array.from(allBooks)
}

export function detectEncoding(buffer: Buffer): string {
  try {
    const result = jschardet.detect(buffer.slice(0, 1024 * 1024))
    if (result && result.confidence > 0.7) {
      const encoding = result.encoding.toLowerCase()
      if (encoding.includes('gb') || encoding === 'gb2312' || encoding === 'gbk' || encoding === 'gb18030') {
        return 'gbk'
      }
      if (encoding === 'utf-8' || encoding === 'utf8') {
        return 'utf-8'
      }
      return encoding
    }
  } catch {
    // Fall through to default
  }
  return 'utf-8'
}

export function readTextFile(filePath: string, encoding?: string): string {
  const buffer = readFileSync(filePath)

  if (!encoding) {
    encoding = detectEncoding(buffer)
  }

  if (iconv.encodingExists(encoding)) {
    return iconv.decode(buffer, encoding)
  }

  return buffer.toString('utf-8')
}

export function getFileNameWithoutExtension(filePath: string): string {
  return parse(filePath).name
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}
