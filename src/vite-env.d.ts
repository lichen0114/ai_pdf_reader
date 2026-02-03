/// <reference types="vite/client" />

type ActionType = 'explain' | 'summarize' | 'define' | 'parse_equation' | 'explain_fundamental' | 'extract_terms'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ProviderInfo {
  id: string
  name: string
  type: 'local' | 'cloud'
  available?: boolean
}

// Database types
interface Document {
  id: string
  filename: string
  filepath: string
  last_opened_at: number
  scroll_position: number
  total_pages: number | null
  created_at: number
}

interface Interaction {
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

interface Concept {
  id: string
  name: string
  created_at: number
  total_occurrences?: number
  document_count?: number
}

interface ConceptGraphData {
  nodes: Concept[]
  links: Array<{ source: string; target: string; weight: number }>
}

interface ReviewCard {
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

interface DailyActivityCount {
  date: string
  explain_count: number
  summarize_count: number
  define_count: number
}

interface DocumentActivity {
  document_id: string
  filename: string
  total_interactions: number
  explain_count: number
  summarize_count: number
  define_count: number
  last_interaction_at: number
}

interface Window {
  api: {
    askAI: (
      text: string,
      context: string,
      providerId?: string,
      action?: ActionType,
      conversationHistory?: ConversationMessage[],
      onChunk?: (chunk: string) => void,
      onDone?: () => void,
      onError?: (error: string) => void
    ) => Promise<void>
    getProviders: () => Promise<ProviderInfo[]>
    getCurrentProvider: () => Promise<ProviderInfo | null>
    setCurrentProvider: (providerId: string) => Promise<boolean>
    setApiKey: (providerId: string, apiKey: string) => Promise<boolean>
    hasApiKey: (providerId: string) => Promise<boolean>
    deleteApiKey: (providerId: string) => Promise<boolean>
    readFile: (filePath: string) => Promise<ArrayBuffer>
    getFilePath: (file: File) => string
    openFileDialog: () => Promise<string | null>
    onFileOpened: (callback: (filePath: string) => void) => () => void
    onTabCloseRequested: (callback: () => void) => () => void
    // Database - Documents
    getRecentDocuments: (limit?: number) => Promise<Document[]>
    getOrCreateDocument: (data: { filename: string; filepath: string; total_pages?: number }) => Promise<Document>
    updateDocument: (data: { id: string; scroll_position?: number; total_pages?: number }) => Promise<boolean>
    getDocumentById: (id: string) => Promise<Document | null>
    // Database - Interactions
    saveInteraction: (data: {
      document_id: string
      action_type: ActionType
      selected_text: string
      page_context?: string
      response: string
      page_number?: number
      scroll_position?: number
    }) => Promise<Interaction>
    getInteractionsByDocument: (documentId: string) => Promise<Interaction[]>
    getRecentInteractions: (limit?: number) => Promise<Interaction[]>
    getActivityByDay: (days?: number) => Promise<DailyActivityCount[]>
    getDocumentActivityStats: () => Promise<DocumentActivity[]>
    // Database - Concepts
    getConceptGraph: () => Promise<ConceptGraphData>
    saveConcepts: (data: { conceptNames: string[]; interactionId: string; documentId: string }) => Promise<Concept[]>
    extractConcepts: (data: { text: string; response: string }) => Promise<string[]>
    getConceptsForDocument: (documentId: string) => Promise<Concept[]>
    getDocumentsForConcept: (conceptId: string) => Promise<Array<{ document_id: string; filename: string; occurrence_count: number }>>
    // Database - Reviews
    getNextReviewCard: () => Promise<ReviewCard | null>
    updateReviewCard: (data: { cardId: string; quality: number }) => Promise<ReviewCard | null>
    createReviewCard: (data: { interaction_id: string; question: string; answer: string }) => Promise<ReviewCard>
    getDueReviewCount: () => Promise<number>
    getAllReviewCards: () => Promise<ReviewCard[]>
  }
}
