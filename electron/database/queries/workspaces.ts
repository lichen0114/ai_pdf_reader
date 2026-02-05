import { getDatabase } from '../index'
import { randomUUID } from 'crypto'
import type { Document } from './documents'

export interface Workspace {
  id: string
  name: string
  description: string | null
  created_at: number
  updated_at: number
}

export interface WorkspaceDocument {
  workspace_id: string
  document_id: string
  position: number
  added_at: number
}

export interface WorkspaceWithDocuments extends Workspace {
  documents: Document[]
  document_count: number
}

export interface ConversationSource {
  id: string
  conversation_id: string
  document_id: string
  quoted_text: string | null
  page_number: number | null
  created_at: number
}

export interface ConversationSourceWithDocument extends ConversationSource {
  filename: string
}

export function createWorkspace(name: string, description?: string): Workspace {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO workspaces (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, description || null, now, now)

  return {
    id,
    name,
    description: description || null,
    created_at: now,
    updated_at: now,
  }
}

export function getWorkspaces(): Workspace[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM workspaces ORDER BY updated_at DESC'
  ).all() as Workspace[]
}

export function getWorkspacesWithDocumentCount(): Array<Workspace & { document_count: number }> {
  const db = getDatabase()
  return db.prepare(`
    SELECT w.*, COUNT(wd.document_id) as document_count
    FROM workspaces w
    LEFT JOIN workspace_documents wd ON w.id = wd.workspace_id
    GROUP BY w.id
    ORDER BY w.updated_at DESC
  `).all() as Array<Workspace & { document_count: number }>
}

export function getWorkspace(id: string): Workspace | null {
  const db = getDatabase()
  const workspace = db.prepare(
    'SELECT * FROM workspaces WHERE id = ?'
  ).get(id) as Workspace | undefined
  return workspace || null
}

export function updateWorkspace(
  id: string,
  updates: { name?: string; description?: string }
): Workspace | null {
  const db = getDatabase()
  const now = Date.now()
  const setClauses: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (updates.name !== undefined) {
    setClauses.push('name = ?')
    values.push(updates.name)
  }

  if (updates.description !== undefined) {
    setClauses.push('description = ?')
    values.push(updates.description)
  }

  values.push(id)

  const result = db.prepare(
    `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = ?`
  ).run(...values)

  if (result.changes === 0) return null

  return getWorkspace(id)
}

export function deleteWorkspace(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
  return result.changes > 0
}

export function addDocumentToWorkspace(
  workspaceId: string,
  documentId: string
): boolean {
  const db = getDatabase()
  const now = Date.now()

  // Get the next position
  const maxPos = db.prepare(`
    SELECT MAX(position) as max_pos FROM workspace_documents WHERE workspace_id = ?
  `).get(workspaceId) as { max_pos: number | null } | undefined
  const position = (maxPos?.max_pos ?? -1) + 1

  try {
    db.prepare(`
      INSERT INTO workspace_documents (workspace_id, document_id, position, added_at)
      VALUES (?, ?, ?, ?)
    `).run(workspaceId, documentId, position, now)

    // Update workspace's updated_at
    db.prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(now, workspaceId)

    return true
  } catch (err) {
    // Likely a duplicate entry
    console.error('Failed to add document to workspace:', err)
    return false
  }
}

export function removeDocumentFromWorkspace(
  workspaceId: string,
  documentId: string
): boolean {
  const db = getDatabase()
  const now = Date.now()

  const result = db.prepare(`
    DELETE FROM workspace_documents WHERE workspace_id = ? AND document_id = ?
  `).run(workspaceId, documentId)

  if (result.changes > 0) {
    // Update workspace's updated_at
    db.prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(now, workspaceId)
    return true
  }

  return false
}

export function reorderDocumentInWorkspace(
  workspaceId: string,
  documentId: string,
  newPosition: number
): boolean {
  const db = getDatabase()
  const now = Date.now()

  const result = db.prepare(`
    UPDATE workspace_documents SET position = ? WHERE workspace_id = ? AND document_id = ?
  `).run(newPosition, workspaceId, documentId)

  if (result.changes > 0) {
    db.prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(now, workspaceId)
    return true
  }

  return false
}

export function getWorkspaceDocuments(workspaceId: string): Document[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT d.* FROM documents d
    INNER JOIN workspace_documents wd ON d.id = wd.document_id
    WHERE wd.workspace_id = ?
    ORDER BY wd.position ASC
  `).all(workspaceId) as Document[]
}

export function getDocumentWorkspaces(documentId: string): Workspace[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT w.* FROM workspaces w
    INNER JOIN workspace_documents wd ON w.id = wd.workspace_id
    WHERE wd.document_id = ?
    ORDER BY w.updated_at DESC
  `).all(documentId) as Workspace[]
}

export function isDocumentInWorkspace(
  workspaceId: string,
  documentId: string
): boolean {
  const db = getDatabase()
  const result = db.prepare(`
    SELECT 1 FROM workspace_documents WHERE workspace_id = ? AND document_id = ?
  `).get(workspaceId, documentId)
  return !!result
}

// Conversation source functions for multi-document chat

export function addConversationSource(
  conversationId: string,
  documentId: string,
  quotedText?: string,
  pageNumber?: number
): ConversationSource {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO conversation_sources (id, conversation_id, document_id, quoted_text, page_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, conversationId, documentId, quotedText || null, pageNumber ?? null, now)

  return {
    id,
    conversation_id: conversationId,
    document_id: documentId,
    quoted_text: quotedText || null,
    page_number: pageNumber ?? null,
    created_at: now,
  }
}

export function removeConversationSource(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM conversation_sources WHERE id = ?').run(id)
  return result.changes > 0
}

export function removeConversationSourceByDocument(
  conversationId: string,
  documentId: string
): boolean {
  const db = getDatabase()
  const result = db.prepare(`
    DELETE FROM conversation_sources WHERE conversation_id = ? AND document_id = ?
  `).run(conversationId, documentId)
  return result.changes > 0
}

export function getConversationSources(
  conversationId: string
): ConversationSourceWithDocument[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT cs.*, d.filename
    FROM conversation_sources cs
    INNER JOIN documents d ON cs.document_id = d.id
    WHERE cs.conversation_id = ?
    ORDER BY cs.created_at ASC
  `).all(conversationId) as ConversationSourceWithDocument[]
}

export function setConversationWorkspace(
  conversationId: string,
  workspaceId: string | null
): boolean {
  const db = getDatabase()
  const result = db.prepare(`
    UPDATE conversations SET workspace_id = ? WHERE id = ?
  `).run(workspaceId, conversationId)
  return result.changes > 0
}

export function getWorkspaceConversations(workspaceId: string): Array<{
  id: string
  selected_text: string
  title: string | null
  created_at: number
  updated_at: number
}> {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, selected_text, title, created_at, updated_at
    FROM conversations
    WHERE workspace_id = ?
    ORDER BY updated_at DESC
  `).all(workspaceId) as Array<{
    id: string
    selected_text: string
    title: string | null
    created_at: number
    updated_at: number
  }>
}
