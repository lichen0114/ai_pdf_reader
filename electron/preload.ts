import { contextBridge, ipcRenderer, webUtils } from 'electron'

export type ActionType = 'explain' | 'summarize' | 'define'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ProviderInfo {
  id: string
  name: string
  type: 'local' | 'cloud'
  available?: boolean
}

export interface StreamEvent {
  type: 'chunk' | 'done' | 'error'
  data?: string
  error?: string
}

// Database types
export interface Document {
  id: string
  filename: string
  filepath: string
  last_opened_at: number
  scroll_position: number
  total_pages: number | null
  created_at: number
}

export interface Interaction {
  id: string
  document_id: string
  action_type: ActionType
  selected_text: string
  page_context: string | null
  response: string
  page_number: number | null
  scroll_position: number | null
  created_at: number
}

export interface Concept {
  id: string
  name: string
  created_at: number
  total_occurrences?: number
  document_count?: number
}

export interface ConceptGraphData {
  nodes: Concept[]
  links: Array<{ source: string; target: string; weight: number }>
}

export interface ReviewCard {
  id: string
  interaction_id: string
  question: string
  answer: string
  next_review_at: number
  interval_days: number
  ease_factor: number
  review_count: number
  created_at: number
  selected_text?: string
  document_filename?: string
  action_type?: string
}

export interface DailyActivityCount {
  date: string
  explain_count: number
  summarize_count: number
  define_count: number
}

export interface DocumentActivity {
  document_id: string
  filename: string
  total_interactions: number
  explain_count: number
  summarize_count: number
  define_count: number
  last_interaction_at: number
}

// Highlight types
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

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

// Bookmark types
export interface Bookmark {
  id: string
  document_id: string
  page_number: number
  label: string | null
  created_at: number
}

// Conversation types
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

export interface ConversationMessageDb {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  action_type: string | null
  created_at: number
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
  messages: ConversationMessageDb[]
}

// Search types
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

// Workspace types
export interface Workspace {
  id: string
  name: string
  description: string | null
  created_at: number
  updated_at: number
}

export interface WorkspaceWithCount extends Workspace {
  document_count: number
}

export interface ConversationSource {
  id: string
  conversation_id: string
  document_id: string
  quoted_text: string | null
  page_number: number | null
  created_at: number
  filename: string
}

contextBridge.exposeInMainWorld('api', {
  // AI Operations
  askAI: async (
    text: string,
    context: string,
    providerId?: string,
    action?: ActionType,
    conversationHistory?: ConversationMessage[],
    onChunk?: (chunk: string) => void,
    onDone?: () => void,
    onError?: (error: string) => void
  ): Promise<void> => {
    const result = await ipcRenderer.invoke('ai:query', { text, context, providerId, action, conversationHistory })
    const { channelId } = result

    return new Promise((resolve, reject) => {
      const handler = (_event: Electron.IpcRendererEvent, msg: StreamEvent) => {
        if (msg.type === 'chunk' && msg.data) {
          onChunk?.(msg.data)
        } else if (msg.type === 'done') {
          ipcRenderer.removeListener(channelId, handler)
          onDone?.()
          resolve()
        } else if (msg.type === 'error') {
          ipcRenderer.removeListener(channelId, handler)
          onError?.(msg.error || 'Unknown error')
          reject(new Error(msg.error))
        }
      }

      ipcRenderer.on(channelId, handler)
    })
  },

  // Provider Operations
  getProviders: (): Promise<ProviderInfo[]> => {
    return ipcRenderer.invoke('provider:list')
  },

  getCurrentProvider: (): Promise<ProviderInfo | null> => {
    return ipcRenderer.invoke('provider:getCurrent')
  },

  setCurrentProvider: (providerId: string): Promise<boolean> => {
    return ipcRenderer.invoke('provider:setCurrent', providerId)
  },

  // API Key Operations
  setApiKey: (providerId: string, apiKey: string): Promise<boolean> => {
    return ipcRenderer.invoke('keys:set', { providerId, apiKey })
  },

  hasApiKey: (providerId: string): Promise<boolean> => {
    return ipcRenderer.invoke('keys:has', providerId)
  },

  deleteApiKey: (providerId: string): Promise<boolean> => {
    return ipcRenderer.invoke('keys:delete', providerId)
  },

  // File Operations
  readFile: (filePath: string): Promise<ArrayBuffer> => {
    return ipcRenderer.invoke('file:read', filePath)
  },

  // Get file path from dropped file (for drag-and-drop)
  getFilePath: (file: File): string => {
    return webUtils.getPathForFile(file)
  },

  // File dialog
  openFileDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke('file:openDialog')
  },

  // Event Listeners
  onFileOpened: (callback: (filePath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) => {
      callback(filePath)
    }
    ipcRenderer.on('file-opened', handler)
    return () => ipcRenderer.removeListener('file-opened', handler)
  },

  onTabCloseRequested: (callback: () => void) => {
    const handler = () => {
      callback()
    }
    ipcRenderer.on('tab:close-current', handler)
    return () => ipcRenderer.removeListener('tab:close-current', handler)
  },

  // Database - Documents
  getRecentDocuments: (limit?: number): Promise<Document[]> => {
    return ipcRenderer.invoke('db:documents:recent', limit)
  },

  getOrCreateDocument: (data: { filename: string; filepath: string; total_pages?: number }): Promise<Document> => {
    return ipcRenderer.invoke('db:documents:getOrCreate', data)
  },

  updateDocument: (data: { id: string; scroll_position?: number; total_pages?: number }): Promise<boolean> => {
    return ipcRenderer.invoke('db:documents:update', data)
  },

  getDocumentById: (id: string): Promise<Document | null> => {
    return ipcRenderer.invoke('db:documents:getById', id)
  },

  // Database - Interactions
  saveInteraction: (data: {
    document_id: string
    action_type: ActionType
    selected_text: string
    page_context?: string
    response: string
    page_number?: number
    scroll_position?: number
  }): Promise<Interaction> => {
    return ipcRenderer.invoke('db:interactions:save', data)
  },

  getInteractionsByDocument: (documentId: string): Promise<Interaction[]> => {
    return ipcRenderer.invoke('db:interactions:byDocument', documentId)
  },

  getRecentInteractions: (limit?: number): Promise<Interaction[]> => {
    return ipcRenderer.invoke('db:interactions:recent', limit)
  },

  getActivityByDay: (days?: number): Promise<DailyActivityCount[]> => {
    return ipcRenderer.invoke('db:interactions:activityByDay', days)
  },

  getDocumentActivityStats: (): Promise<DocumentActivity[]> => {
    return ipcRenderer.invoke('db:interactions:documentStats')
  },

  // Database - Concepts
  getConceptGraph: (): Promise<ConceptGraphData> => {
    return ipcRenderer.invoke('db:concepts:graph')
  },

  saveConcepts: (data: { conceptNames: string[]; interactionId: string; documentId: string }): Promise<Concept[]> => {
    return ipcRenderer.invoke('db:concepts:save', data)
  },

  extractConcepts: (data: { text: string; response: string }): Promise<string[]> => {
    return ipcRenderer.invoke('db:concepts:extract', data)
  },

  getConceptsForDocument: (documentId: string): Promise<Concept[]> => {
    return ipcRenderer.invoke('db:concepts:forDocument', documentId)
  },

  getDocumentsForConcept: (conceptId: string): Promise<Array<{ document_id: string; filename: string; occurrence_count: number }>> => {
    return ipcRenderer.invoke('db:concepts:documentsForConcept', conceptId)
  },

  // Database - Reviews
  getNextReviewCard: (): Promise<ReviewCard | null> => {
    return ipcRenderer.invoke('db:review:next')
  },

  updateReviewCard: (data: { cardId: string; quality: number }): Promise<ReviewCard | null> => {
    return ipcRenderer.invoke('db:review:update', data)
  },

  createReviewCard: (data: { interaction_id: string; question: string; answer: string }): Promise<ReviewCard> => {
    return ipcRenderer.invoke('db:review:create', data)
  },

  getDueReviewCount: (): Promise<number> => {
    return ipcRenderer.invoke('db:review:dueCount')
  },

  getAllReviewCards: (): Promise<ReviewCard[]> => {
    return ipcRenderer.invoke('db:review:all')
  },

  // Database - Highlights
  createHighlight: (data: HighlightCreateInput): Promise<Highlight> => {
    return ipcRenderer.invoke('db:highlights:create', data)
  },

  updateHighlight: (data: HighlightUpdateInput): Promise<Highlight | null> => {
    return ipcRenderer.invoke('db:highlights:update', data)
  },

  deleteHighlight: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('db:highlights:delete', id)
  },

  getHighlightsByDocument: (documentId: string): Promise<Highlight[]> => {
    return ipcRenderer.invoke('db:highlights:byDocument', documentId)
  },

  getHighlightsByPage: (documentId: string, pageNumber: number): Promise<Highlight[]> => {
    return ipcRenderer.invoke('db:highlights:byPage', { documentId, pageNumber })
  },

  getHighlightsWithNotes: (documentId: string): Promise<Highlight[]> => {
    return ipcRenderer.invoke('db:highlights:withNotes', documentId)
  },

  // Database - Bookmarks
  toggleBookmark: (data: { document_id: string; page_number: number; label?: string }): Promise<Bookmark | null> => {
    return ipcRenderer.invoke('db:bookmarks:toggle', data)
  },

  updateBookmarkLabel: (id: string, label: string | null): Promise<boolean> => {
    return ipcRenderer.invoke('db:bookmarks:updateLabel', { id, label })
  },

  deleteBookmark: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('db:bookmarks:delete', id)
  },

  getBookmarksByDocument: (documentId: string): Promise<Bookmark[]> => {
    return ipcRenderer.invoke('db:bookmarks:byDocument', documentId)
  },

  isPageBookmarked: (documentId: string, pageNumber: number): Promise<boolean> => {
    return ipcRenderer.invoke('db:bookmarks:isPageBookmarked', { documentId, pageNumber })
  },

  // Database - Conversations
  createConversation: (data: {
    document_id: string
    selected_text: string
    highlight_id?: string
    page_context?: string
    page_number?: number
    title?: string
  }): Promise<Conversation> => {
    return ipcRenderer.invoke('db:conversations:create', data)
  },

  addConversationMessage: (conversationId: string, role: 'user' | 'assistant', content: string, actionType?: string): Promise<ConversationMessageDb> => {
    return ipcRenderer.invoke('db:conversations:addMessage', { conversationId, role, content, actionType })
  },

  updateConversationTitle: (id: string, title: string): Promise<boolean> => {
    return ipcRenderer.invoke('db:conversations:updateTitle', { id, title })
  },

  deleteConversation: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('db:conversations:delete', id)
  },

  getConversationsByDocument: (documentId: string): Promise<ConversationSummary[]> => {
    return ipcRenderer.invoke('db:conversations:byDocument', documentId)
  },

  getConversationWithMessages: (id: string): Promise<ConversationWithMessages | null> => {
    return ipcRenderer.invoke('db:conversations:getWithMessages', id)
  },

  getRecentConversations: (limit?: number): Promise<ConversationSummary[]> => {
    return ipcRenderer.invoke('db:conversations:recent', limit)
  },

  getConversationMessages: (conversationId: string): Promise<ConversationMessageDb[]> => {
    return ipcRenderer.invoke('db:conversations:messages', conversationId)
  },

  // Search
  searchDocuments: (query: string, limit?: number): Promise<DocumentSearchResult[]> => {
    return ipcRenderer.invoke('search:documents', { query, limit })
  },

  searchInteractions: (query: string, limit?: number): Promise<InteractionSearchResult[]> => {
    return ipcRenderer.invoke('search:interactions', { query, limit })
  },

  searchConcepts: (query: string, limit?: number): Promise<ConceptSearchResult[]> => {
    return ipcRenderer.invoke('search:concepts', { query, limit })
  },

  searchAll: (query: string, limitPerType?: number): Promise<SearchResults> => {
    return ipcRenderer.invoke('search:all', { query, limitPerType })
  },

  searchInteractionsInDocument: (documentId: string, query: string, limit?: number): Promise<InteractionSearchResult[]> => {
    return ipcRenderer.invoke('search:interactionsInDocument', { documentId, query, limit })
  },

  // Workspaces
  createWorkspace: (name: string, description?: string): Promise<Workspace> => {
    return ipcRenderer.invoke('db:workspaces:create', { name, description })
  },

  getWorkspaces: (): Promise<WorkspaceWithCount[]> => {
    return ipcRenderer.invoke('db:workspaces:list')
  },

  getWorkspace: (id: string): Promise<Workspace | null> => {
    return ipcRenderer.invoke('db:workspaces:get', id)
  },

  updateWorkspace: (id: string, updates: { name?: string; description?: string }): Promise<Workspace | null> => {
    return ipcRenderer.invoke('db:workspaces:update', { id, ...updates })
  },

  deleteWorkspace: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('db:workspaces:delete', id)
  },

  addDocumentToWorkspace: (workspaceId: string, documentId: string): Promise<boolean> => {
    return ipcRenderer.invoke('db:workspaces:addDocument', { workspaceId, documentId })
  },

  removeDocumentFromWorkspace: (workspaceId: string, documentId: string): Promise<boolean> => {
    return ipcRenderer.invoke('db:workspaces:removeDocument', { workspaceId, documentId })
  },

  getWorkspaceDocuments: (workspaceId: string): Promise<Document[]> => {
    return ipcRenderer.invoke('db:workspaces:getDocuments', workspaceId)
  },

  getDocumentWorkspaces: (documentId: string): Promise<Workspace[]> => {
    return ipcRenderer.invoke('db:workspaces:getForDocument', documentId)
  },

  isDocumentInWorkspace: (workspaceId: string, documentId: string): Promise<boolean> => {
    return ipcRenderer.invoke('db:workspaces:isDocumentInWorkspace', { workspaceId, documentId })
  },

  // Conversation sources for multi-document chat
  addConversationSource: (conversationId: string, documentId: string, quotedText?: string, pageNumber?: number): Promise<ConversationSource> => {
    return ipcRenderer.invoke('db:conversationSources:add', { conversationId, documentId, quotedText, pageNumber })
  },

  removeConversationSource: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('db:conversationSources:remove', id)
  },

  removeConversationSourceByDocument: (conversationId: string, documentId: string): Promise<boolean> => {
    return ipcRenderer.invoke('db:conversationSources:removeByDocument', { conversationId, documentId })
  },

  getConversationSources: (conversationId: string): Promise<ConversationSource[]> => {
    return ipcRenderer.invoke('db:conversationSources:get', conversationId)
  },

  setConversationWorkspace: (conversationId: string, workspaceId: string | null): Promise<boolean> => {
    return ipcRenderer.invoke('db:conversations:setWorkspace', { conversationId, workspaceId })
  },

  getWorkspaceConversations: (workspaceId: string): Promise<Array<{ id: string; selected_text: string; title: string | null; created_at: number; updated_at: number }>> => {
    return ipcRenderer.invoke('db:workspaces:getConversations', workspaceId)
  },
})
