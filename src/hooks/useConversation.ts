import { useState, useCallback, useEffect } from 'react'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface ConversationState {
  messages: Message[]
  selectedText: string
  pageContext: string
  pageNumber?: number
}

export interface PersistentConversation {
  conversationId: string | null
  conversation: ConversationState | null
  conversations: ConversationSummary[]
  isLoading: boolean
  startConversation: (
    selectedText: string,
    pageContext: string,
    documentId: string,
    pageNumber?: number
  ) => Promise<string | null>
  loadConversation: (id: string) => Promise<void>
  listConversations: (documentId: string) => Promise<void>
  addMessage: (role: 'user' | 'assistant', content: string, actionType?: string) => Promise<void>
  updateLastAssistantMessage: (content: string) => void
  appendToLastAssistantMessage: (chunk: string) => void
  clearConversation: () => void
  deleteConversation: (id: string) => Promise<void>
}

export function useConversation(): PersistentConversation {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationState | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
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
    pageNumber?: number
  ): Promise<string | null> => {
    try {
      // Create conversation in database
      const conv = await window.api.createConversation({
        document_id: documentId,
        selected_text: selectedText,
        page_context: pageContext,
        page_number: pageNumber,
      })

      setConversationId(conv.id)
      setConversation({
        messages: [],
        selectedText,
        pageContext,
        pageNumber,
      })

      return conv.id
    } catch (error) {
      console.error('Failed to start conversation:', error)
      // Fall back to in-memory only
      setConversationId(null)
      setConversation({
        messages: [],
        selectedText,
        pageContext,
        pageNumber,
      })
      return null
    }
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true)
    try {
      const conv = await window.api.getConversationWithMessages(id)
      if (conv) {
        setConversationId(conv.id)
        setConversation({
          messages: conv.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          selectedText: conv.selected_text,
          pageContext: conv.page_context || '',
          pageNumber: conv.page_number ?? undefined,
        })
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const listConversations = useCallback(async (documentId: string) => {
    try {
      const convs = await window.api.getConversationsByDocument(documentId)
      setConversations(convs)
    } catch (error) {
      console.error('Failed to list conversations:', error)
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
    try {
      await window.api.deleteConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (conversationId === id) {
        clearConversation()
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }, [conversationId, clearConversation])

  return {
    conversationId,
    conversation,
    conversations,
    isLoading,
    startConversation,
    loadConversation,
    listConversations,
    addMessage,
    updateLastAssistantMessage,
    appendToLastAssistantMessage,
    clearConversation,
    deleteConversation,
  }
}
