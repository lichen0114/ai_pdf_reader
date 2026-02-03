import { getDatabase } from '../index'
import { randomUUID } from 'crypto'

export interface Bookmark {
  id: string
  document_id: string
  page_number: number
  label: string | null
  created_at: number
}

export interface BookmarkCreateInput {
  document_id: string
  page_number: number
  label?: string
}

export function toggleBookmark(input: BookmarkCreateInput): Bookmark | null {
  const db = getDatabase()

  // Check if bookmark exists
  const existing = db.prepare(
    'SELECT * FROM bookmarks WHERE document_id = ? AND page_number = ?'
  ).get(input.document_id, input.page_number) as Bookmark | undefined

  if (existing) {
    // Remove existing bookmark
    db.prepare('DELETE FROM bookmarks WHERE id = ?').run(existing.id)
    return null
  }

  // Create new bookmark
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO bookmarks (id, document_id, page_number, label, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, input.document_id, input.page_number, input.label || null, now)

  return {
    id,
    document_id: input.document_id,
    page_number: input.page_number,
    label: input.label || null,
    created_at: now,
  }
}

export function updateBookmarkLabel(id: string, label: string | null): boolean {
  const db = getDatabase()
  const result = db.prepare('UPDATE bookmarks SET label = ? WHERE id = ?').run(label, id)
  return result.changes > 0
}

export function deleteBookmark(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
  return result.changes > 0
}

export function getBookmarkById(id: string): Bookmark | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as Bookmark | undefined
}

export function getBookmarksByDocument(documentId: string): Bookmark[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM bookmarks WHERE document_id = ? ORDER BY page_number ASC'
  ).all(documentId) as Bookmark[]
}

export function isPageBookmarked(documentId: string, pageNumber: number): boolean {
  const db = getDatabase()
  const result = db.prepare(
    'SELECT 1 FROM bookmarks WHERE document_id = ? AND page_number = ?'
  ).get(documentId, pageNumber)
  return result !== undefined
}
