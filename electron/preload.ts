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
})
