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

// Highlight types
type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

interface Highlight {
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

interface HighlightCreateInput {
  document_id: string
  page_number: number
  start_offset: number
  end_offset: number
  selected_text: string
  color?: HighlightColor
  note?: string
}

interface HighlightUpdateInput {
  id: string
  color?: HighlightColor
  note?: string
}

// Bookmark types
interface Bookmark {
  id: string
  document_id: string
  page_number: number
  label: string | null
  created_at: number
}

// Conversation types
interface ConversationDb {
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

interface ConversationMessageDb {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  action_type: string | null
  created_at: number
}

interface ConversationSummary {
  id: string
  document_id: string
  selected_text: string
  title: string | null
  message_count: number
  created_at: number
  updated_at: number
  last_message_preview: string | null
}

interface ConversationWithMessages extends ConversationDb {
  messages: ConversationMessageDb[]
}

// Search types
interface DocumentSearchResult {
  id: string
  filename: string
  filepath: string
  last_opened_at: number
  rank: number
}

interface InteractionSearchResult {
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

interface ConceptSearchResult {
  id: string
  name: string
  created_at: number
  rank: number
}

interface SearchResults {
  documents: DocumentSearchResult[]
  interactions: InteractionSearchResult[]
  concepts: ConceptSearchResult[]
}

// Workspace types
interface Workspace {
  id: string
  name: string
  description: string | null
  created_at: number
  updated_at: number
}

interface WorkspaceWithCount extends Workspace {
  document_count: number
}

interface ConversationSource {
  id: string
  conversation_id: string
  document_id: string
  quoted_text: string | null
  page_number: number | null
  created_at: number
  filename: string
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
    // Database - Highlights
    createHighlight: (data: HighlightCreateInput) => Promise<Highlight>
    updateHighlight: (data: HighlightUpdateInput) => Promise<Highlight | null>
    deleteHighlight: (id: string) => Promise<boolean>
    getHighlightsByDocument: (documentId: string) => Promise<Highlight[]>
    getHighlightsByPage: (documentId: string, pageNumber: number) => Promise<Highlight[]>
    getHighlightsWithNotes: (documentId: string) => Promise<Highlight[]>
    // Database - Bookmarks
    toggleBookmark: (data: { document_id: string; page_number: number; label?: string }) => Promise<Bookmark | null>
    updateBookmarkLabel: (id: string, label: string | null) => Promise<boolean>
    deleteBookmark: (id: string) => Promise<boolean>
    getBookmarksByDocument: (documentId: string) => Promise<Bookmark[]>
    isPageBookmarked: (documentId: string, pageNumber: number) => Promise<boolean>
    // Database - Conversations
    createConversation: (data: {
      document_id: string
      selected_text: string
      highlight_id?: string
      page_context?: string
      page_number?: number
      title?: string
    }) => Promise<ConversationDb>
    addConversationMessage: (conversationId: string, role: 'user' | 'assistant', content: string, actionType?: string) => Promise<ConversationMessageDb>
    updateConversationTitle: (id: string, title: string) => Promise<boolean>
    deleteConversation: (id: string) => Promise<boolean>
    getConversationsByDocument: (documentId: string) => Promise<ConversationSummary[]>
    getConversationWithMessages: (id: string) => Promise<ConversationWithMessages | null>
    getRecentConversations: (limit?: number) => Promise<ConversationSummary[]>
    getConversationMessages: (conversationId: string) => Promise<ConversationMessageDb[]>
    // Search
    searchDocuments: (query: string, limit?: number) => Promise<DocumentSearchResult[]>
    searchInteractions: (query: string, limit?: number) => Promise<InteractionSearchResult[]>
    searchConcepts: (query: string, limit?: number) => Promise<ConceptSearchResult[]>
    searchAll: (query: string, limitPerType?: number) => Promise<SearchResults>
    searchInteractionsInDocument: (documentId: string, query: string, limit?: number) => Promise<InteractionSearchResult[]>
    // Workspaces
    createWorkspace: (name: string, description?: string) => Promise<Workspace>
    getWorkspaces: () => Promise<WorkspaceWithCount[]>
    getWorkspace: (id: string) => Promise<Workspace | null>
    updateWorkspace: (id: string, updates: { name?: string; description?: string }) => Promise<Workspace | null>
    deleteWorkspace: (id: string) => Promise<boolean>
    addDocumentToWorkspace: (workspaceId: string, documentId: string) => Promise<boolean>
    removeDocumentFromWorkspace: (workspaceId: string, documentId: string) => Promise<boolean>
    getWorkspaceDocuments: (workspaceId: string) => Promise<Document[]>
    getDocumentWorkspaces: (documentId: string) => Promise<Workspace[]>
    isDocumentInWorkspace: (workspaceId: string, documentId: string) => Promise<boolean>
    // Conversation sources for multi-document chat
    addConversationSource: (conversationId: string, documentId: string, quotedText?: string, pageNumber?: number) => Promise<ConversationSource>
    removeConversationSource: (id: string) => Promise<boolean>
    removeConversationSourceByDocument: (conversationId: string, documentId: string) => Promise<boolean>
    getConversationSources: (conversationId: string) => Promise<ConversationSource[]>
    setConversationWorkspace: (conversationId: string, workspaceId: string | null) => Promise<boolean>
    getWorkspaceConversations: (workspaceId: string) => Promise<Array<{ id: string; selected_text: string; title: string | null; created_at: number; updated_at: number }>>
  }
}
