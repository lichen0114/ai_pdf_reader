import { getDatabase } from '../index'

export interface DocumentSearchResult {
  id: string
  filename: string
  filepath: string
  last_opened_at: number
  rank: number
}

export interface InteractionSearchResult {
  id: string
  document_id: string
  action_type: string
  selected_text: string
  response: string
  page_number: number | null
  created_at: number
  filename: string
  rank: number
  snippet: string
}

export interface ConceptSearchResult {
  id: string
  name: string
  created_at: number
  rank: number
}

export interface SearchResults {
  documents: DocumentSearchResult[]
  interactions: InteractionSearchResult[]
  concepts: ConceptSearchResult[]
}

function escapeQuery(query: string): string {
  // Escape special FTS5 characters and wrap each term with *
  return query
    .replace(/[":*^~()]/g, '')
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => `"${term}"*`)
    .join(' ')
}

export function searchDocuments(query: string, limit: number = 20): DocumentSearchResult[] {
  const db = getDatabase()
  const escaped = escapeQuery(query)
  if (!escaped) return []

  return db.prepare(`
    SELECT
      d.id,
      d.filename,
      d.filepath,
      d.last_opened_at,
      rank
    FROM documents_fts
    JOIN documents d ON documents_fts.rowid = d.rowid
    WHERE documents_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(escaped, limit) as DocumentSearchResult[]
}

export function searchInteractions(query: string, limit: number = 20): InteractionSearchResult[] {
  const db = getDatabase()
  const escaped = escapeQuery(query)
  if (!escaped) return []

  return db.prepare(`
    SELECT
      i.id,
      i.document_id,
      i.action_type,
      i.selected_text,
      i.response,
      i.page_number,
      i.created_at,
      d.filename,
      rank,
      snippet(interactions_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
    FROM interactions_fts
    JOIN interactions i ON interactions_fts.rowid = i.rowid
    JOIN documents d ON i.document_id = d.id
    WHERE interactions_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(escaped, limit) as InteractionSearchResult[]
}

export function searchConcepts(query: string, limit: number = 20): ConceptSearchResult[] {
  const db = getDatabase()
  const escaped = escapeQuery(query)
  if (!escaped) return []

  return db.prepare(`
    SELECT
      c.id,
      c.name,
      c.created_at,
      rank
    FROM concepts_fts
    JOIN concepts c ON concepts_fts.rowid = c.rowid
    WHERE concepts_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(escaped, limit) as ConceptSearchResult[]
}

export function searchAll(query: string, limitPerType: number = 10): SearchResults {
  return {
    documents: searchDocuments(query, limitPerType),
    interactions: searchInteractions(query, limitPerType),
    concepts: searchConcepts(query, limitPerType),
  }
}

export function searchInteractionsInDocument(
  documentId: string,
  query: string,
  limit: number = 20
): InteractionSearchResult[] {
  const db = getDatabase()
  const escaped = escapeQuery(query)
  if (!escaped) return []

  return db.prepare(`
    SELECT
      i.id,
      i.document_id,
      i.action_type,
      i.selected_text,
      i.response,
      i.page_number,
      i.created_at,
      d.filename,
      rank,
      snippet(interactions_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
    FROM interactions_fts
    JOIN interactions i ON interactions_fts.rowid = i.rowid
    JOIN documents d ON i.document_id = d.id
    WHERE interactions_fts MATCH ? AND i.document_id = ?
    ORDER BY rank
    LIMIT ?
  `).all(escaped, documentId, limit) as InteractionSearchResult[]
}
