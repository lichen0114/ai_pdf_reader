import { getDatabase } from '../index'
import { randomUUID } from 'crypto'

export interface Highlight {
  id: string
  document_id: string
  page_number: number
  start_offset: number
  end_offset: number
  selected_text: string
  color: string
  note: string | null
  created_at: number
  updated_at: number
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

export interface HighlightCreateInput {
  document_id: string
  page_number: number
  start_offset: number
  end_offset: number
  selected_text: string
  color?: HighlightColor
  note?: string
}

export interface HighlightUpdateInput {
  id: string
  color?: HighlightColor
  note?: string
}

export function createHighlight(input: HighlightCreateInput): Highlight {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO highlights (id, document_id, page_number, start_offset, end_offset, selected_text, color, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.document_id,
    input.page_number,
    input.start_offset,
    input.end_offset,
    input.selected_text,
    input.color || 'yellow',
    input.note || null,
    now,
    now
  )

  return {
    id,
    document_id: input.document_id,
    page_number: input.page_number,
    start_offset: input.start_offset,
    end_offset: input.end_offset,
    selected_text: input.selected_text,
    color: input.color || 'yellow',
    note: input.note || null,
    created_at: now,
    updated_at: now,
  }
}

export function updateHighlight(input: HighlightUpdateInput): Highlight | undefined {
  const db = getDatabase()
  const updates: string[] = ['updated_at = ?']
  const now = Date.now()
  const values: unknown[] = [now]

  if (input.color !== undefined) {
    updates.push('color = ?')
    values.push(input.color)
  }

  if (input.note !== undefined) {
    updates.push('note = ?')
    values.push(input.note || null)
  }

  values.push(input.id)

  const result = db.prepare(
    `UPDATE highlights SET ${updates.join(', ')} WHERE id = ?`
  ).run(...values)

  if (result.changes === 0) return undefined

  return db.prepare('SELECT * FROM highlights WHERE id = ?').get(input.id) as Highlight
}

export function deleteHighlight(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM highlights WHERE id = ?').run(id)
  return result.changes > 0
}

export function getHighlightById(id: string): Highlight | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM highlights WHERE id = ?').get(id) as Highlight | undefined
}

export function getHighlightsByDocument(documentId: string): Highlight[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM highlights WHERE document_id = ? ORDER BY page_number ASC, start_offset ASC'
  ).all(documentId) as Highlight[]
}

export function getHighlightsByPage(documentId: string, pageNumber: number): Highlight[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM highlights WHERE document_id = ? AND page_number = ? ORDER BY start_offset ASC'
  ).all(documentId, pageNumber) as Highlight[]
}

export function getHighlightsWithNotes(documentId: string): Highlight[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM highlights WHERE document_id = ? AND note IS NOT NULL ORDER BY page_number ASC, start_offset ASC'
  ).all(documentId) as Highlight[]
}
