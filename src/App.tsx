import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import PDFViewer, { type PDFViewerRef } from './components/PDFViewer'
import ResponsePanel from './components/ResponsePanel'
import ProviderSwitcher from './components/ProviderSwitcher'
import SettingsModal from './components/SettingsModal'
import SelectionPopover from './components/SelectionPopover'
import STEMToolbar from './components/STEMToolbar'
import LibraryView from './components/library/LibraryView'
import TabBar from './components/TabBar'
import ModeIndicator from './components/modes/ModeIndicator'
import { ModeProvider } from './contexts/ModeContext'

// Lazy load heavy components that include large dependencies (recharts, force-graph, pyodide)
const ActivePaperDashboard = lazy(() => import('./components/dashboard/ActivePaperDashboard'))
const VariableManipulationModal = lazy(() => import('./components/equation/VariableManipulationModal'))
const CodeSandboxDrawer = lazy(() => import('./components/code/CodeSandboxDrawer'))
const ConceptStackPanel = lazy(() => import('./components/explainer/ConceptStackPanel'))

// Loading fallback component
function LoadingFallback({ label }: { label?: string }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-500">
      <div className="flex flex-col items-center">
        <svg className="w-8 h-8 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {label && <span className="text-sm">{label}</span>}
      </div>
    </div>
  )
}
import { useSelection } from './hooks/useSelection'
import { useAI } from './hooks/useAI'
import { useConversation } from './hooks/useConversation'
import { useHistory, type ActionType } from './hooks/useHistory'
import { useTabs } from './hooks/useTabs'
import { useUIMode } from './hooks/useUIMode'
import { useEquationEngine } from './hooks/useEquationEngine'
import { useCodeSandbox } from './hooks/useCodeSandbox'
import { useConceptStack } from './hooks/useConceptStack'
import { useHighlights } from './hooks/useHighlights'
import { useBookmarks } from './hooks/useBookmarks'
import { useWorkspace } from './hooks/useWorkspace'
import BookmarksList from './components/highlights/BookmarksList'
import SearchModal from './components/search/SearchModal'
import WorkspaceSwitcher from './components/workspace/WorkspaceSwitcher'
import DocumentNavigator from './components/navigation/DocumentNavigator'
import type { PDFOutlineItem } from './types/pdf'
import type { PDFSearchMatch } from './hooks/useSearch'

type AppView = 'dashboard' | 'library' | 'reader'

// Inner app component that uses mode context
function AppContent() {
  const { mode, simulationType, isSimulating, exitSimulation, enterSimulation } = useUIMode()
  const [currentView, setCurrentView] = useState<AppView>('dashboard')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [providerRefreshKey, setProviderRefreshKey] = useState(0)
  const [currentAction, setCurrentAction] = useState<ActionType>('explain')

  // Tab management
  const {
    tabs,
    activeTabId,
    activeTab,
    openTab,
    closeTab,
    selectTab,
    updateTab,
    reloadTab,
    selectPreviousTab,
    selectNextTab,
    selectTabByIndex,
    closeCurrentTab,
  } = useTabs()

  // Ref to track the last completed interaction for concept extraction
  const pendingConceptExtraction = useRef<{
    interactionId: string
    documentId: string
    text: string
    response: string
  } | null>(null)

  // Refs for stable keyboard handler - avoids 17+ dependencies causing listener recreation
  const keyboardStateRef = useRef({
    selectedText: '',
    currentView: 'dashboard' as AppView,
    tabsLength: 0,
    isPanelOpen: false,
    equationIsOpen: false,
    codeSandboxIsOpen: false,
    codeSandboxIsRunning: false,
    conceptStackIsOpen: false,
    conceptStackCardsLength: 0,
  })
  // Initialize with placeholder functions - will be updated in effect after hooks are called
  const keyboardCallbacksRef = useRef<{
    equationOpenEquation: (latex: string) => void
    equationCloseEquation: () => void
    codeSandboxRunCode: () => void
    codeSandboxCloseSandbox: () => void
    conceptStackPopCard: () => void
    conceptStackCloseStack: () => void
    selectPreviousTab: () => void
    selectNextTab: () => void
    selectTabByIndex: (index: number) => void
    handleAskAI: (action: ActionType) => void
    handleClosePanel: () => void
  }>({
    equationOpenEquation: () => {},
    equationCloseEquation: () => {},
    codeSandboxRunCode: () => {},
    codeSandboxCloseSandbox: () => {},
    conceptStackPopCard: () => {},
    conceptStackCloseStack: () => {},
    selectPreviousTab: () => {},
    selectNextTab: () => {},
    selectTabByIndex: () => {},
    handleAskAI: () => {},
    handleClosePanel: () => {},
  })

  const { selectedText, pageContext, selectionRect, pageNumber, startOffset, endOffset, clearSelection } = useSelection()
  const { response, isLoading, error, askAI, clearResponse } = useAI()
  const {
    conversationId,
    conversation,
    conversations,
    startConversation,
    loadConversation,
    listConversations,
    addMessage,
    appendToLastAssistantMessage,
    clearConversation,
    deleteConversation,
  } = useConversation()
  const { history, addEntry, getEntry } = useHistory()

  // Load conversations when document changes
  useEffect(() => {
    if (activeTab?.documentId) {
      listConversations(activeTab.documentId)
    }
  }, [activeTab?.documentId, listConversations])

  useEffect(() => {
    if (!activeTab) {
      setIsNavigatorOpen(false)
      setIsBookmarksOpen(false)
    }
  }, [activeTab])

  // Equation engine
  const equationEngine = useEquationEngine({
    onSimulationStart: () => enterSimulation('equation'),
    onSimulationEnd: exitSimulation,
  })

  // Code sandbox
  const codeSandbox = useCodeSandbox({
    onSimulationStart: () => enterSimulation('code'),
    onSimulationEnd: exitSimulation,
  })

  // Concept stack (first principles explainer)
  const conceptStack = useConceptStack({
    onSimulationStart: () => enterSimulation('explainer'),
    onSimulationEnd: exitSimulation,
  })

  // Highlights and bookmarks
  const {
    highlights,
    createHighlight,
    updateHighlight,
    deleteHighlight,
  } = useHighlights(activeTab?.documentId || null)

  const {
    bookmarks,
    toggleBookmark,
    deleteBookmark,
  } = useBookmarks(activeTab?.documentId || null)

  // Workspace management
  const workspace = useWorkspace()

  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [activeTotalPages, setActiveTotalPages] = useState(0)
  const [outline, setOutline] = useState<PDFOutlineItem[]>([])
  const viewerRefs = useRef<Map<string, PDFViewerRef>>(new Map())
  const [activeViewer, setActiveViewer] = useState<PDFViewerRef | null>(null)

  // Create Set from bookmarks for efficient lookup
  const bookmarkedPages = new Set(bookmarks.map(b => b.page_number))

  // Handle creating a highlight from selected text
  const handleCreateHighlight = useCallback(async (color: HighlightColor) => {
    if (!selectedText || pageNumber === null || startOffset === null || endOffset === null) {
      return
    }
    await createHighlight(pageNumber, startOffset, endOffset, selectedText, color)
    clearSelection()
  }, [selectedText, pageNumber, startOffset, endOffset, createHighlight, clearSelection])

  // Handle bookmark click from bookmark list
  const handleBookmarkClick = useCallback((bookmarkPageNumber: number) => {
    // Close bookmarks panel and navigate
    setIsBookmarksOpen(false)
    activeViewer?.goToPage(bookmarkPageNumber)
  }, [activeViewer])

  const handlePageChange = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber)
  }, [])

  const handleTotalPagesChange = useCallback((totalPages: number) => {
    setActiveTotalPages(totalPages)
  }, [])

  const handleJumpToPage = useCallback((pageNumber: number) => {
    activeViewer?.goToPage(pageNumber)
  }, [activeViewer])

  // Handle zone click in investigate mode
  const handleZoneClick = useCallback((zone: import('./types/modes').InteractiveZone) => {
    switch (zone.type) {
      case 'equation':
        equationEngine.openEquation(zone.content)
        break
      case 'code':
        codeSandbox.openSandbox(zone.content)
        break
      case 'term':
        conceptStack.pushCard(zone.content)
        break
    }
  }, [equationEngine, codeSandbox, conceptStack])

  const handleKeyChange = useCallback(() => {
    setProviderRefreshKey(k => k + 1)
  }, [])

  const attachViewerRef = useCallback((tabId: string) => (instance: PDFViewerRef | null) => {
    if (instance) {
      viewerRefs.current.set(tabId, instance)
    } else {
      viewerRefs.current.delete(tabId)
    }
    if (tabId === activeTabId) {
      setActiveViewer(instance)
    }
  }, [activeTabId])

  // Open a document (from dashboard, menu, or drag-drop)
  const handleOpenDocument = useCallback(async (documentFilePath: string) => {
    if (!window.api) return

    await openTab(documentFilePath)
    setCurrentView('reader')
  }, [openTab])

  // Handle file open from menu
  useEffect(() => {
    if (!window.api) return

    const unsubscribe = window.api.onFileOpened(async (openedFilePath: string) => {
      await handleOpenDocument(openedFilePath)
    })

    return () => unsubscribe()
  }, [handleOpenDocument])

  // Handle Cmd+W from menu to close current tab
  useEffect(() => {
    if (!window.api) return

    const unsubscribe = window.api.onTabCloseRequested(() => {
      if (currentView === 'reader') {
        closeCurrentTab()
      }
    })

    return () => unsubscribe()
  }, [currentView, closeCurrentTab])

  // Keep keyboard state ref in sync
  useEffect(() => {
    keyboardStateRef.current = {
      selectedText,
      currentView,
      tabsLength: tabs.length,
      isPanelOpen,
      equationIsOpen: equationEngine.isOpen,
      codeSandboxIsOpen: codeSandbox.isOpen,
      codeSandboxIsRunning: codeSandbox.isRunning,
      conceptStackIsOpen: conceptStack.isOpen,
      conceptStackCardsLength: conceptStack.cards.length,
    }
  }, [selectedText, currentView, tabs.length, isPanelOpen,
      equationEngine.isOpen, codeSandbox.isOpen, codeSandbox.isRunning,
      conceptStack.isOpen, conceptStack.cards.length])

  // Handle keyboard shortcuts - empty deps, uses refs for state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = keyboardStateRef.current
      const callbacks = keyboardCallbacksRef.current

      // Escape - close simulation mode, panels, or concept stack
      if (e.key === 'Escape') {
        if (state.equationIsOpen) {
          e.preventDefault()
          callbacks.equationCloseEquation()
          return
        }
        if (state.codeSandboxIsOpen) {
          e.preventDefault()
          callbacks.codeSandboxCloseSandbox()
          return
        }
        if (state.conceptStackIsOpen) {
          e.preventDefault()
          // Pop one card or close if only one
          if (state.conceptStackCardsLength > 1) {
            callbacks.conceptStackPopCard()
          } else {
            callbacks.conceptStackCloseStack()
          }
          return
        }
        if (state.isPanelOpen) {
          e.preventDefault()
          callbacks.handleClosePanel()
          return
        }
      }

      // Cmd+E for equation explorer (when text selected)
      if ((e.metaKey || e.ctrlKey) && e.key === 'e' && !e.shiftKey) {
        e.preventDefault()
        if (state.selectedText && state.currentView === 'reader') {
          callbacks.equationOpenEquation(state.selectedText)
        }
      }

      // Cmd+R for run code (when code sandbox open)
      if ((e.metaKey || e.ctrlKey) && e.key === 'r' && !e.shiftKey) {
        if (state.codeSandboxIsOpen && !state.codeSandboxIsRunning) {
          e.preventDefault()
          callbacks.codeSandboxRunCode()
        }
      }

      // Cmd+J for explain
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        if (state.selectedText && state.currentView === 'reader') {
          callbacks.handleAskAI('explain')
        }
      }

      // Cmd+F for search (current PDF)
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !e.shiftKey) {
        e.preventDefault()
        setIsSearchOpen(true)
      }

      // Cmd+Shift+F for search all
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setIsSearchOpen(true)
      }

      // Tab navigation shortcuts (only in reader view with tabs)
      if (state.currentView === 'reader' && state.tabsLength > 0) {
        // Cmd+Shift+[ for previous tab
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '[') {
          e.preventDefault()
          callbacks.selectPreviousTab()
        }
        // Cmd+Shift+] for next tab
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ']') {
          e.preventDefault()
          callbacks.selectNextTab()
        }
        // Cmd+1-9 for tab by index
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key >= '1' && e.key <= '9') {
          e.preventDefault()
          const index = parseInt(e.key) - 1
          callbacks.selectTabByIndex(index)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // Empty deps - handler uses refs for current state

  // Keep callbacks ref in sync for keyboard handler
  useEffect(() => {
    keyboardCallbacksRef.current = {
      equationOpenEquation: equationEngine.openEquation,
      equationCloseEquation: equationEngine.closeEquation,
      codeSandboxRunCode: codeSandbox.runCode,
      codeSandboxCloseSandbox: codeSandbox.closeSandbox,
      conceptStackPopCard: conceptStack.popCard,
      conceptStackCloseStack: conceptStack.closeStack,
      selectPreviousTab,
      selectNextTab,
      selectTabByIndex,
      handleAskAI: (action: ActionType) => {
        if (!selectedText) return
        setIsPanelOpen(true)
        setCurrentAction(action)
        clearResponse()
        clearConversation()
        const documentId = activeTab?.documentId
        if (documentId) {
          startConversation(selectedText, pageContext || '', documentId).then(() => {
            addMessage('user', selectedText, action)
            addMessage('assistant', '')
            askAI(selectedText, pageContext, action)
          })
        } else {
          startConversation(selectedText, pageContext || '', '').then(() => {
            addMessage('user', selectedText, action)
            addMessage('assistant', '')
            askAI(selectedText, pageContext, action)
          })
        }
      },
      handleClosePanel: () => {
        setIsPanelOpen(false)
        clearSelection()
        clearResponse()
        clearConversation()
      },
    }
  })

  const handleAskAI = useCallback(async (action: ActionType = 'explain') => {
    if (!selectedText) return

    setIsPanelOpen(true)
    setCurrentAction(action)
    clearResponse()
    clearConversation()

    // Start persistent conversation if we have a documentId
    const documentId = activeTab?.documentId
    if (documentId) {
      await startConversation(selectedText, pageContext || '', documentId)
    } else {
      // Fall back to in-memory conversation
      await startConversation(selectedText, pageContext || '', '')
    }

    // Add initial user message and empty assistant message for streaming
    const userMessage = selectedText
    await addMessage('user', userMessage, action)
    await addMessage('assistant', '')

    await askAI(selectedText, pageContext, action)
  }, [selectedText, pageContext, askAI, clearResponse, clearConversation, startConversation, addMessage, activeTab?.documentId])

  // Update conversation when response streams in
  useEffect(() => {
    if (response && conversation) {
      const messages = conversation.messages
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        // Update the last assistant message with the current response
        appendToLastAssistantMessage('')
        // Actually just update through the response state directly
      }
    }
  }, [response])

  // Save to history and database when response completes
  useEffect(() => {
    if (!isLoading && response && selectedText && conversation) {
      // Add to in-memory history
      addEntry({
        selectedText,
        action: currentAction,
        response,
      })

      // Save interaction to database
      const currentDocumentId = activeTab?.documentId
      if (window.api && currentDocumentId) {
        window.api.saveInteraction({
          document_id: currentDocumentId,
          action_type: currentAction,
          selected_text: selectedText,
          page_context: pageContext || undefined,
          response,
        }).then((interaction) => {
          // Store for concept extraction
          pendingConceptExtraction.current = {
            interactionId: interaction.id,
            documentId: currentDocumentId,
            text: selectedText,
            response,
          }

          // Extract concepts in background
          extractConceptsInBackground()

          // Create review card for 'explain' actions
          if (currentAction === 'explain') {
            createReviewCardInBackground(interaction.id, selectedText, response)
          }
        }).catch(err => {
          console.error('Failed to save interaction:', err)
        })
      }
    }
  }, [isLoading, response, activeTab?.documentId])

  // Extract concepts in background after interaction is saved
  const extractConceptsInBackground = useCallback(async () => {
    const pending = pendingConceptExtraction.current
    if (!pending || !window.api) return

    try {
      const conceptNames = await window.api.extractConcepts({
        text: pending.text,
        response: pending.response,
      })

      if (conceptNames.length > 0) {
        await window.api.saveConcepts({
          conceptNames,
          interactionId: pending.interactionId,
          documentId: pending.documentId,
        })
      }
    } catch (err) {
      console.error('Failed to extract concepts:', err)
    }

    pendingConceptExtraction.current = null
  }, [])

  // Create review card in background
  const createReviewCardInBackground = useCallback(async (
    interactionId: string,
    text: string,
    aiResponse: string
  ) => {
    if (!window.api) return

    try {
      // Generate a question from the text
      const question = text.length > 100
        ? `What does this mean: "${text.slice(0, 100)}..."`
        : `What does this mean: "${text}"`

      // Use a summary of the response as the answer
      const answer = aiResponse.length > 300
        ? aiResponse.slice(0, 300) + '...'
        : aiResponse

      await window.api.createReviewCard({
        interaction_id: interactionId,
        question,
        answer,
      })
    } catch (err) {
      console.error('Failed to create review card:', err)
    }
  }, [])

  const handleFollowUp = useCallback(async (followUpText: string) => {
    if (!conversation || isLoading) return

    // Add the follow-up question and empty assistant response
    await addMessage('user', followUpText)
    await addMessage('assistant', '')

    // Build conversation history including the new follow-up
    const historyWithFollowUp = [
      ...conversation.messages,
      { role: 'user' as const, content: followUpText },
    ]

    clearResponse()
    await askAI(
      conversation.selectedText,
      conversation.pageContext,
      currentAction,
      historyWithFollowUp
    )
  }, [conversation, isLoading, addMessage, clearResponse, askAI, currentAction])

  const handleConversationSelect = useCallback(async (id: string) => {
    setIsPanelOpen(true)
    clearResponse()
    await loadConversation(id)
  }, [clearResponse, loadConversation])

  const handleNewConversation = useCallback(() => {
    clearResponse()
    clearConversation()
  }, [clearResponse, clearConversation])

  const handleHistorySelect = useCallback(async (entry: ReturnType<typeof getEntry>) => {
    if (!entry) return
    // Restore the history entry view
    setCurrentAction(entry.action)
    clearResponse()
    clearConversation()
    await startConversation(entry.selectedText, '', '')
    await addMessage('user', entry.selectedText)
    await addMessage('assistant', entry.response)
  }, [clearResponse, clearConversation, startConversation, addMessage])

  const handleClosePanel = () => {
    setIsPanelOpen(false)
    clearSelection()
    clearResponse()
    clearConversation()
  }

  // Handle drag and drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return

    const isPdf = file.type === 'application/pdf' ||
                  file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) return

    if (!window.api) return

    try {
      const droppedFilePath = window.api.getFilePath(file)
      await handleOpenDocument(droppedFilePath)
    } catch (err) {
      console.error('Failed to open dropped file:', err)
    }
  }, [handleOpenDocument])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Handle new tab button click
  const handleNewTab = useCallback(async () => {
    if (!window.api) return
    const filePath = await window.api.openFileDialog()
    if (filePath) {
      await handleOpenDocument(filePath)
    }
  }, [handleOpenDocument])

  // Handle tab close
  const handleTabClose = useCallback((tabId: string) => {
    // Clear conversation when closing active tab
    if (tabId === activeTabId) {
      setIsPanelOpen(false)
      clearResponse()
      clearConversation()
    }
    closeTab(tabId)
  }, [activeTabId, closeTab, clearResponse, clearConversation])

  useEffect(() => {
    if (!activeTabId) {
      setActiveViewer(null)
      return
    }
    setActiveViewer(viewerRefs.current.get(activeTabId) || null)
  }, [activeTabId])

  useEffect(() => {
    if (activeViewer) {
      setCurrentPage(activeViewer.getCurrentPage())
      setActiveTotalPages(activeViewer.getTotalPages())
    } else {
      setCurrentPage(1)
      setActiveTotalPages(0)
    }
  }, [activeViewer, activeTabId])

  useEffect(() => {
    let cancelled = false
    const loadOutline = async () => {
      if (!isNavigatorOpen || !activeViewer) {
        setOutline([])
        return
      }
      const items = await activeViewer.getOutline()
      if (!cancelled) {
        setOutline(items)
      }
    }
    loadOutline()
    return () => {
      cancelled = true
    }
  }, [activeViewer, activeTabId, isNavigatorOpen])

  const searchCurrentPdf = useCallback(async (query: string): Promise<PDFSearchMatch[]> => {
    const viewer = activeViewer
    if (!viewer) return []
    const trimmed = query.trim()
    if (!trimmed) return []

    const normalizedQuery = trimmed.toLowerCase()
    const totalPages = viewer.getTotalPages()
    const matches: PDFSearchMatch[] = []
    const maxMatches = 200
    const concurrency = Math.min(4, Math.max(1, totalPages))
    let nextPage = 1

    const buildSnippet = (text: string, index: number, length: number) => {
      const start = Math.max(0, index - 40)
      const end = Math.min(text.length, index + length + 60)
      const snippet = text.slice(start, end)
      return `${start > 0 ? '…' : ''}${snippet}${end < text.length ? '…' : ''}`
    }

    const searchWorker = async () => {
      while (nextPage <= totalPages && matches.length < maxMatches) {
        const pageNumber = nextPage
        nextPage += 1
        const pageText = await viewer.getPageText(pageNumber)
        if (!pageText) continue
        const lower = pageText.toLowerCase()
        let idx = 0
        while ((idx = lower.indexOf(normalizedQuery, idx)) !== -1) {
          matches.push({
            kind: 'text',
            pageNumber,
            text: buildSnippet(pageText, idx, normalizedQuery.length),
            index: idx,
          })
          idx += normalizedQuery.length
          if (matches.length >= maxMatches) break
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => searchWorker()))

    const annotationMatches = highlights
      .filter((h) => {
        const textMatch = h.selected_text.toLowerCase().includes(normalizedQuery)
        const noteMatch = (h.note || '').toLowerCase().includes(normalizedQuery)
        return textMatch || noteMatch
      })
      .map((h) => ({
        kind: 'annotation' as const,
        pageNumber: h.page_number,
        text: h.selected_text.length > 180 ? `${h.selected_text.slice(0, 180)}…` : h.selected_text,
        index: h.start_offset,
        highlightId: h.id,
        note: h.note,
        color: h.color,
      }))

    const combined = [...matches, ...annotationMatches]
    combined.sort((a, b) => {
      if (a.pageNumber === b.pageNumber) {
        return a.index - b.index
      }
      return a.pageNumber - b.pageNumber
    })

    return combined.slice(0, maxMatches)
  }, [activeViewer, highlights])

  // Get messages for display (use conversation messages or response for display)
  const displayMessages = conversation?.messages.map((msg, idx) => {
    // For the last assistant message, use the streaming response
    if (idx === conversation.messages.length - 1 && msg.role === 'assistant') {
      return { ...msg, content: response || msg.content }
    }
    return msg
  }) || []

  return (
    <div className={`h-full flex flex-col bg-gray-900 ${isSimulating ? 'simulation-mode' : ''}`}>
      {/* Title bar / Top bar */}
      <div className="app-titlebar flex items-center justify-between px-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3 pl-16">
          {/* View toggle */}
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`view-toggle-btn ${currentView === 'library' ? 'active' : ''}`}
              onClick={() => setCurrentView('library')}
            >
              Library
            </button>
            <button
              className={`view-toggle-btn ${currentView === 'reader' ? 'active' : ''}`}
              onClick={() => setCurrentView('reader')}
            >
              Reader
            </button>
          </div>

          {/* Workspace switcher */}
          <WorkspaceSwitcher
            workspaces={workspace.workspaces}
            currentWorkspace={workspace.currentWorkspace}
            onSelect={workspace.selectWorkspace}
            onCreate={workspace.createWorkspace}
            onDelete={workspace.deleteWorkspace}
            isLoading={workspace.isLoading}
          />
        </div>

        {/* STEM Tools - only show in reader view */}
        {currentView === 'reader' && (
          <STEMToolbar
            onEquationClick={() => selectedText && equationEngine.openEquation(selectedText)}
            onCodeClick={() => selectedText && codeSandbox.openSandbox(selectedText)}
            onExplainerClick={() => selectedText && conceptStack.pushCard(selectedText)}
            disabled={!selectedText}
          />
        )}

        <div className="flex items-center gap-2">
          {/* Navigator button - only show in reader view */}
          {currentView === 'reader' && activeTab && (
            <button
              onClick={() => setIsNavigatorOpen(prev => !prev)}
              className={`p-1.5 rounded transition-colors ${
                isNavigatorOpen
                  ? 'bg-blue-600/30 text-blue-300'
                  : 'hover:bg-gray-700/50 text-gray-400 hover:text-gray-200'
              }`}
              title="Navigator"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </button>
          )}

          {/* Search button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
            title="Search (Cmd+F)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Bookmarks button - only show in reader view */}
          {currentView === 'reader' && activeTab && (
            <button
              onClick={() => setIsBookmarksOpen(!isBookmarksOpen)}
              className={`p-1.5 rounded transition-colors ${
                isBookmarksOpen
                  ? 'bg-yellow-600/30 text-yellow-400'
                  : 'hover:bg-gray-700/50 text-gray-400 hover:text-gray-200'
              }`}
              title="Bookmarks"
            >
              <svg className="w-5 h-5" fill={isBookmarksOpen ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          )}
          <ProviderSwitcher onSettingsClick={() => setIsSettingsOpen(true)} refreshKey={providerRefreshKey} />
        </div>
      </div>

      {/* Tab bar - only show in reader view when there are tabs */}
      {currentView === 'reader' && tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onTabSelect={selectTab}
          onTabClose={handleTabClose}
          onNewTab={handleNewTab}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {currentView === 'dashboard' ? (
          <Suspense fallback={<LoadingFallback label="Loading dashboard..." />}>
            <ActivePaperDashboard onOpenDocument={handleOpenDocument} />
          </Suspense>
        ) : currentView === 'library' ? (
          <LibraryView
            isActive={currentView === 'library'}
            onOpenDocument={handleOpenDocument}
            onOpenDialog={handleNewTab}
            currentWorkspace={workspace.currentWorkspace}
            onAddToWorkspace={workspace.addDocument}
          />
        ) : (
          <>
            {/* PDF container - shrinks when sidebar/drawer opens */}
            <div
              className={`flex-1 relative overflow-hidden transition-all duration-300 ${isNavigatorOpen ? 'pl-[288px]' : ''} ${isPanelOpen || conceptStack.isOpen ? 'mr-[400px]' : ''} ${codeSandbox.isOpen ? 'mb-[35vh]' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <DocumentNavigator
                isOpen={isNavigatorOpen}
                documentKey={activeTab?.id ?? null}
                totalPages={activeTotalPages}
                outline={outline}
                highlights={highlights}
                currentPage={currentPage}
                onJumpToPage={handleJumpToPage}
                onClose={() => setIsNavigatorOpen(false)}
                getThumbnail={activeViewer?.renderThumbnail}
              />
              {/* Render all PDFViewers but show/hide based on active tab */}
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={tab.id === activeTabId ? 'block h-full' : 'hidden'}
                >
                  {tab.loadError ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <svg className="w-16 h-16 mb-4 text-red-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-lg mb-2">Failed to open PDF</p>
                      <p className="text-sm text-gray-500 max-w-md text-center px-4">{tab.loadError}</p>
                      <button
                        onClick={() => reloadTab(tab.id)}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : tab.pdfData ? (
                    <PDFViewer
                      ref={attachViewerRef(tab.id)}
                      data={tab.pdfData}
                      initialScrollPosition={tab.scrollPosition}
                      initialScale={tab.scale}
                      onScrollChange={(scrollTop) => updateTab(tab.id, { scrollPosition: scrollTop })}
                      onScaleChange={(scale) => updateTab(tab.id, { scale })}
                      onError={(msg) => updateTab(tab.id, { loadError: msg })}
                      highlights={tab.id === activeTabId ? highlights : []}
                      onUpdateHighlight={tab.id === activeTabId ? updateHighlight : undefined}
                      onDeleteHighlight={tab.id === activeTabId ? deleteHighlight : undefined}
                      bookmarkedPages={tab.id === activeTabId ? bookmarkedPages : new Set()}
                      onToggleBookmark={tab.id === activeTabId ? toggleBookmark : undefined}
                      onPageChange={tab.id === activeTabId ? handlePageChange : undefined}
                      onTotalPagesChange={tab.id === activeTabId ? handleTotalPagesChange : undefined}
                      mode={tab.id === activeTabId ? mode : 'reading'}
                      onZoneClick={tab.id === activeTabId ? handleZoneClick : undefined}
                    />
                  ) : tab.isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                      <svg className="w-12 h-12 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-sm">Loading PDF...</p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                      <svg className="w-16 h-16 mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm">No PDF loaded</p>
                    </div>
                  )}
                </div>
              ))}

              {/* Empty state when no tabs */}
              {tabs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <svg
                    className="w-24 h-24 mb-4 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-lg mb-2">Drop a PDF file here</p>
                  <p className="text-sm">or use File - Open (Cmd+O)</p>
                </div>
              )}

              {/* Selection toolbar */}
              <SelectionPopover
                selectionRect={selectionRect}
                selectedText={selectedText}
                onAction={handleAskAI}
                onEquationClick={equationEngine.openEquation}
                onCodeClick={codeSandbox.openSandbox}
                onExplainerClick={conceptStack.pushCard}
                onHighlight={handleCreateHighlight}
                isVisible={!!selectedText && !isPanelOpen && !equationEngine.isOpen && !codeSandbox.isOpen && !conceptStack.isOpen}
              />
            </div>

            {/* Response sidebar */}
            <ResponsePanel
              isOpen={isPanelOpen}
              response={response}
              isLoading={isLoading}
              error={error}
              selectedText={conversation?.selectedText || selectedText}
              messages={displayMessages}
              onClose={handleClosePanel}
              onFollowUp={handleFollowUp}
              history={history}
              onHistorySelect={handleHistorySelect}
              currentAction={currentAction}
              conversationId={conversationId}
              conversations={conversations}
              onConversationSelect={handleConversationSelect}
              onConversationDelete={deleteConversation}
              onNewConversation={handleNewConversation}
            />

            {/* Bookmarks list panel */}
            <BookmarksList
              isOpen={isBookmarksOpen}
              bookmarks={bookmarks}
              currentPage={currentPage}
              onBookmarkClick={handleBookmarkClick}
              onBookmarkDelete={deleteBookmark}
              onClose={() => setIsBookmarksOpen(false)}
            />
          </>
        )}
      </div>

      {/* Settings modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onKeyChange={handleKeyChange}
      />

      {/* Search modal */}
      <SearchModal
        isOpen={isSearchOpen}
        documentId={activeTab?.documentId}
        onClose={() => setIsSearchOpen(false)}
        onOpenDocument={handleOpenDocument}
        onSearchPdf={searchCurrentPdf}
        onJumpToPage={handleJumpToPage}
        onNavigateToInteraction={async (docId, page) => {
          // Look up document filepath and open it
          try {
            const doc = await window.api.getDocumentById(docId)
            if (doc) {
              await handleOpenDocument(doc.filepath)
              // Wait for tab to load, then jump to page
              setTimeout(() => {
                handleJumpToPage(page)
              }, 500)
            }
          } catch (err) {
            console.error('Failed to navigate to interaction:', err)
          }
        }}
      />

      {/* Mode indicator - only in reader view */}
      {currentView === 'reader' && (
        <ModeIndicator mode={mode} simulationType={simulationType} />
      )}

      {/* Equation manipulation modal - lazy loaded with recharts */}
      {equationEngine.isOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <VariableManipulationModal
            isOpen={equationEngine.isOpen}
            originalLatex={equationEngine.originalLatex}
            parsedEquation={equationEngine.parsedEquation}
            isParsing={equationEngine.isParsing}
            error={equationEngine.error}
            graphData={equationEngine.graphData}
            graphIndependentVar={equationEngine.graphIndependentVar}
            currentResult={equationEngine.currentResult}
            onClose={equationEngine.closeEquation}
            onUpdateVariable={equationEngine.updateVariable}
            onSetGraphVariable={equationEngine.setGraphIndependentVar}
          />
        </Suspense>
      )}

      {/* Code sandbox drawer - lazy loaded with pyodide */}
      {codeSandbox.isOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <CodeSandboxDrawer
            isOpen={codeSandbox.isOpen}
            code={codeSandbox.editedCode}
            runtime={codeSandbox.runtime}
            output={codeSandbox.output}
            isRunning={codeSandbox.isRunning}
            isRuntimeReady={codeSandbox.isRuntimeReady}
            isLoadingRuntime={codeSandbox.isLoadingRuntime}
            error={codeSandbox.error}
            onClose={codeSandbox.closeSandbox}
            onCodeChange={codeSandbox.updateCode}
            onRuntimeChange={codeSandbox.setRuntime}
            onRun={codeSandbox.runCode}
            onStop={codeSandbox.stopCode}
            onClear={codeSandbox.clearOutput}
            onReset={codeSandbox.resetCode}
          />
        </Suspense>
      )}

      {/* Concept stack panel (first principles explainer) - lazy loaded */}
      {conceptStack.isOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <ConceptStackPanel
            isOpen={conceptStack.isOpen}
            cards={conceptStack.cards}
            breadcrumbs={conceptStack.breadcrumbs}
            isLoading={conceptStack.isLoading}
            error={conceptStack.error}
            onTermClick={conceptStack.pushCard}
            onNavigate={conceptStack.popToIndex}
            onClose={conceptStack.closeStack}
            onBack={conceptStack.popCard}
          />
        </Suspense>
      )}
    </div>
  )
}

// Main App component wrapped with providers
function App() {
  return (
    <ModeProvider>
      <AppContent />
    </ModeProvider>
  )
}

export default App
