import { useState, useCallback, useEffect } from 'react'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface SourceDocument {
  id: string
  documentId: string
  fileName: string
  quotedText?: string | null
  pageNumber?: number | null
}

export interface ConversationState {
  messages: Message[]
  selectedText: string
  pageContext: string
  pageNumber?: number
  workspaceId?: string | null
  sourceDocuments: SourceDocument[]
}

export interface PersistentConversation {
  conversationId: string | null
  conversation: ConversationState | null
  conversations: ConversationSummary[]
  isLoading: boolean
  error: string | null
  startConversation: (
    selectedText: string,
    pageContext: string,
    documentId: string,
    pageNumber?: number,
    workspaceId?: string
  ) => Promise<string | null>
  loadConversation: (id: string) => Promise<void>
  listConversations: (documentId: string) => Promise<void>
  addMessage: (role: 'user' | 'assistant', content: string, actionType?: string) => Promise<void>
  updateLastAssistantMessage: (content: string) => void
  appendToLastAssistantMessage: (chunk: string) => void
  clearConversation: () => void
  deleteConversation: (id: string) => Promise<void>
  clearError: () => void
  // Multi-document support
  addSourceDocument: (documentId: string, fileName: string, quotedText?: string, pageNumber?: number) => Promise<void>
  removeSourceDocument: (documentId: string) => Promise<void>
  getSourceDocuments: () => SourceDocument[]
}

export function useConversation(): PersistentConversation {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationState | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingMessages, setPendingMessages] = useState<Array<{role: 'user' | 'assistant', content: string, actionType?: string}>>([])

  // Persist pending messages after streaming completes
  useEffect(() => {
    if (pendingMessages.length > 0 && conversationId && !isLoading) {
      const persistMessages = async () => {
        for (const msg of pendingMessages) {
          await window.api.addConversationMessage(conversationId, msg.role, msg.content, msg.actionType)
        }
        setPendingMessages([])
      }
      persistMessages()
    }
  }, [conversationId, isLoading, pendingMessages])

  const startConversation = useCallback(async (
    selectedText: string,
    pageContext: string,
    documentId: string,
    pageNumber?: number,
    workspaceId?: string
  ): Promise<string | null> => {
    setError(null)
    try {
      // Create conversation in database
      const conv = await window.api.createConversation({
        document_id: documentId,
        selected_text: selectedText,
        page_context: pageContext,
        page_number: pageNumber,
      })

      // Set workspace if provided
      if (workspaceId) {
        await window.api.setConversationWorkspace(conv.id, workspaceId)
      }

      setConversationId(conv.id)
      setConversation({
        messages: [],
        selectedText,
        pageContext,
        pageNumber,
        workspaceId: workspaceId || null,
        sourceDocuments: [],
      })

      return conv.id
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start conversation'
      console.error('Failed to start conversation:', err)
      setError(message)
      // Fall back to in-memory only
      setConversationId(null)
      setConversation({
        messages: [],
        selectedText,
        pageContext,
        pageNumber,
        workspaceId: workspaceId || null,
        sourceDocuments: [],
      })
      return null
    }
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const conv = await window.api.getConversationWithMessages(id)
      if (conv) {
        // Load source documents
        let sourceDocuments: SourceDocument[] = []
        try {
          const sources = await window.api.getConversationSources(id)
          sourceDocuments = sources.map(s => ({
            id: s.id,
            documentId: s.document_id,
            fileName: s.filename,
            quotedText: s.quoted_text,
            pageNumber: s.page_number,
          }))
        } catch (err) {
          console.error('Failed to load source documents:', err)
        }

        setConversationId(conv.id)
        setConversation({
          messages: conv.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          selectedText: conv.selected_text,
          pageContext: conv.page_context || '',
          pageNumber: conv.page_number ?? undefined,
          workspaceId: (conv as { workspace_id?: string }).workspace_id || null,
          sourceDocuments,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load conversation'
      console.error('Failed to load conversation:', err)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const listConversations = useCallback(async (documentId: string) => {
    setError(null)
    try {
      const convs = await window.api.getConversationsByDocument(documentId)
      setConversations(convs)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list conversations'
      console.error('Failed to list conversations:', err)
      setError(message)
    }
  }, [])

  const addMessage = useCallback(async (role: 'user' | 'assistant', content: string, actionType?: string) => {
    // Update local state immediately
    setConversation(prev => prev ? {
      ...prev,
      messages: [...prev.messages, { role, content }]
    } : null)

    // Queue for persistence (will be saved when streaming completes)
    if (conversationId) {
      setPendingMessages(prev => [...prev, { role, content, actionType }])
    }
  }, [conversationId])

  const updateLastAssistantMessage = useCallback((content: string) => {
    setConversation(prev => {
      if (!prev) return null
      const messages = [...prev.messages]
      const lastIndex = messages.length - 1
      if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
        messages[lastIndex] = { ...messages[lastIndex], content }
      }
      return { ...prev, messages }
    })
  }, [])

  const appendToLastAssistantMessage = useCallback((chunk: string) => {
    setConversation(prev => {
      if (!prev) return null
      const messages = [...prev.messages]
      const lastIndex = messages.length - 1
      if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content: messages[lastIndex].content + chunk
        }
      }
      return { ...prev, messages }
    })
  }, [])

  const clearConversation = useCallback(() => {
    setConversationId(null)
    setConversation(null)
    setPendingMessages([])
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    setError(null)
    try {
      await window.api.deleteConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (conversationId === id) {
        clearConversation()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete conversation'
      console.error('Failed to delete conversation:', err)
      setError(message)
    }
  }, [conversationId, clearConversation])

  const clearError = useCallback(() => setError(null), [])

  const addSourceDocument = useCallback(async (
    documentId: string,
    fileName: string,
    quotedText?: string,
    pageNumber?: number
  ) => {
    if (!conversationId) return

    setError(null)
    try {
      const source = await window.api.addConversationSource(
        conversationId,
        documentId,
        quotedText,
        pageNumber
      )

      setConversation(prev => {
        if (!prev) return null
        const newSource: SourceDocument = {
          id: source.id,
          documentId: source.document_id,
          fileName,
          quotedText: source.quoted_text,
          pageNumber: source.page_number,
        }
        return {
          ...prev,
          sourceDocuments: [...prev.sourceDocuments, newSource],
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add source document'
      console.error('Failed to add source document:', err)
      setError(message)
    }
  }, [conversationId])

  const removeSourceDocument = useCallback(async (documentId: string) => {
    if (!conversationId) return

    setError(null)
    try {
      await window.api.removeConversationSourceByDocument(conversationId, documentId)

      setConversation(prev => {
        if (!prev) return null
        return {
          ...prev,
          sourceDocuments: prev.sourceDocuments.filter(s => s.documentId !== documentId),
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove source document'
      console.error('Failed to remove source document:', err)
      setError(message)
    }
  }, [conversationId])

  const getSourceDocuments = useCallback((): SourceDocument[] => {
    return conversation?.sourceDocuments || []
  }, [conversation?.sourceDocuments])

  return {
    conversationId,
    conversation,
    conversations,
    isLoading,
    error,
    startConversation,
    loadConversation,
    listConversations,
    addMessage,
    updateLastAssistantMessage,
    appendToLastAssistantMessage,
    clearConversation,
    deleteConversation,
    clearError,
    // Multi-document support
    addSourceDocument,
    removeSourceDocument,
    getSourceDocuments,
  }
}
