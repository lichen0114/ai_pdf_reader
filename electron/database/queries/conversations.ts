import { getDatabase } from '../index'
import { randomUUID } from 'crypto'

export interface Conversation {
  id: string
  document_id: string
  highlight_id: string | null
  selected_text: string
  page_context: string | null
  page_number: number | null
  title: string | null
  created_at: number
  updated_at: number
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  action_type: string | null
  created_at: number
}

export interface ConversationCreateInput {
  document_id: string
  selected_text: string
  highlight_id?: string
  page_context?: string
  page_number?: number
  title?: string
}

export interface ConversationSummary {
  id: string
  document_id: string
  selected_text: string
  title: string | null
  message_count: number
  created_at: number
  updated_at: number
  last_message_preview: string | null
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[]
}

export function createConversation(input: ConversationCreateInput): Conversation {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO conversations (id, document_id, highlight_id, selected_text, page_context, page_number, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.document_id,
    input.highlight_id || null,
    input.selected_text,
    input.page_context || null,
    input.page_number || null,
    input.title || null,
    now,
    now
  )

  return {
    id,
    document_id: input.document_id,
    highlight_id: input.highlight_id || null,
    selected_text: input.selected_text,
    page_context: input.page_context || null,
    page_number: input.page_number || null,
    title: input.title || null,
    created_at: now,
    updated_at: now,
  }
}

export function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  actionType?: string
): ConversationMessage {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO conversation_messages (id, conversation_id, role, content, action_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, conversationId, role, content, actionType || null, now)

  // Update conversation's updated_at
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId)

  return {
    id,
    conversation_id: conversationId,
    role,
    content,
    action_type: actionType || null,
    created_at: now,
  }
}

export function updateConversationTitle(id: string, title: string): boolean {
  const db = getDatabase()
  const now = Date.now()
  const result = db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(title, now, id)
  return result.changes > 0
}

export function deleteConversation(id: string): boolean {
  const db = getDatabase()
  // Messages are deleted via CASCADE
  const result = db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
  return result.changes > 0
}

export function getConversationById(id: string): Conversation | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined
}

export function getConversationWithMessages(id: string): ConversationWithMessages | undefined {
  const db = getDatabase()

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined
  if (!conversation) return undefined

  const messages = db.prepare(
    'SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(id) as ConversationMessage[]

  return { ...conversation, messages }
}

export function getConversationsByDocument(documentId: string): ConversationSummary[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT
      c.id,
      c.document_id,
      c.selected_text,
      c.title,
      c.created_at,
      c.updated_at,
      COUNT(m.id) as message_count,
      (SELECT content FROM conversation_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview
    FROM conversations c
    LEFT JOIN conversation_messages m ON c.id = m.conversation_id
    WHERE c.document_id = ?
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `).all(documentId) as ConversationSummary[]
}

export function getRecentConversations(limit: number = 10): ConversationSummary[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT
      c.id,
      c.document_id,
      c.selected_text,
      c.title,
      c.created_at,
      c.updated_at,
      COUNT(m.id) as message_count,
      (SELECT content FROM conversation_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview
    FROM conversations c
    LEFT JOIN conversation_messages m ON c.id = m.conversation_id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT ?
  `).all(limit) as ConversationSummary[]
}

export function getConversationMessages(conversationId: string): ConversationMessage[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(conversationId) as ConversationMessage[]
}
