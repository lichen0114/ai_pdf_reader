import { useState, useEffect, useCallback, useRef } from 'react'
import PDFViewer from './components/PDFViewer'
import ResponsePanel from './components/ResponsePanel'
import ProviderSwitcher from './components/ProviderSwitcher'
import SettingsModal from './components/SettingsModal'
import SelectionPopover from './components/SelectionPopover'
import STEMToolbar from './components/STEMToolbar'
import ActivePaperDashboard from './components/dashboard/ActivePaperDashboard'
import TabBar from './components/TabBar'
import ModeIndicator from './components/modes/ModeIndicator'
import VariableManipulationModal from './components/equation/VariableManipulationModal'
import CodeSandboxDrawer from './components/code/CodeSandboxDrawer'
import ConceptStackPanel from './components/explainer/ConceptStackPanel'
import { ModeProvider } from './contexts/ModeContext'
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
import BookmarksList from './components/highlights/BookmarksList'
import SearchModal from './components/search/SearchModal'

type AppView = 'dashboard' | 'reader'

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

  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

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
  const handleBookmarkClick = useCallback((_bookmarkPageNumber: number) => {
    // Close bookmarks panel and navigate
    setIsBookmarksOpen(false)
    // TODO: Add ref to PDFViewer to call goToPage
  }, [])

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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape - close simulation mode, panels, or concept stack
      if (e.key === 'Escape') {
        if (equationEngine.isOpen) {
          e.preventDefault()
          equationEngine.closeEquation()
          return
        }
        if (codeSandbox.isOpen) {
          e.preventDefault()
          codeSandbox.closeSandbox()
          return
        }
        if (conceptStack.isOpen) {
          e.preventDefault()
          // Pop one card or close if only one
          if (conceptStack.cards.length > 1) {
            conceptStack.popCard()
          } else {
            conceptStack.closeStack()
          }
          return
        }
        if (isPanelOpen) {
          e.preventDefault()
          handleClosePanel()
          return
        }
      }

      // Cmd+E for equation explorer (when text selected)
      if ((e.metaKey || e.ctrlKey) && e.key === 'e' && !e.shiftKey) {
        e.preventDefault()
        if (selectedText && currentView === 'reader') {
          equationEngine.openEquation(selectedText)
        }
      }

      // Cmd+R for run code (when code sandbox open)
      if ((e.metaKey || e.ctrlKey) && e.key === 'r' && !e.shiftKey) {
        if (codeSandbox.isOpen && !codeSandbox.isRunning) {
          e.preventDefault()
          codeSandbox.runCode()
        }
      }

      // Cmd+J for explain
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        if (selectedText && currentView === 'reader') {
          handleAskAI('explain')
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
      if (currentView === 'reader' && tabs.length > 0) {
        // Cmd+Shift+[ for previous tab
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '[') {
          e.preventDefault()
          selectPreviousTab()
        }
        // Cmd+Shift+] for next tab
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ']') {
          e.preventDefault()
          selectNextTab()
        }
        // Cmd+1-9 for tab by index
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key >= '1' && e.key <= '9') {
          e.preventDefault()
          const index = parseInt(e.key) - 1
          selectTabByIndex(index)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedText, pageContext, currentView, tabs.length,
    selectPreviousTab, selectNextTab, selectTabByIndex,
    isPanelOpen,
    equationEngine.isOpen, equationEngine.openEquation, equationEngine.closeEquation,
    codeSandbox.isOpen, codeSandbox.isRunning, codeSandbox.runCode, codeSandbox.closeSandbox,
    conceptStack.isOpen, conceptStack.cards.length, conceptStack.popCard, conceptStack.closeStack,
  ])

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
              className={`view-toggle-btn ${currentView === 'reader' ? 'active' : ''}`}
              onClick={() => setCurrentView('reader')}
            >
              Reader
            </button>
          </div>
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
          <ActivePaperDashboard onOpenDocument={handleOpenDocument} />
        ) : (
          <>
            {/* PDF container - shrinks when sidebar/drawer opens */}
            <div
              className={`flex-1 relative overflow-hidden transition-all duration-300 ${isPanelOpen || conceptStack.isOpen ? 'mr-[400px]' : ''} ${codeSandbox.isOpen ? 'mb-[35vh]' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {/* Render all PDFViewers but show/hide based on active tab */}
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={tab.id === activeTabId ? 'block h-full' : 'hidden'}
                >
                  {tab.pdfData ? (
                    <PDFViewer
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
                  ) : null}
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

              {/* Error display */}
              {activeTab?.loadError && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-200 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 max-w-md">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="truncate">{activeTab.loadError}</span>
                  <button
                    onClick={() => updateTab(activeTab.id, { loadError: null })}
                    className="ml-2 p-1 hover:bg-red-800 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
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
              currentPage={1}
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
      />

      {/* Mode indicator - only in reader view */}
      {currentView === 'reader' && (
        <ModeIndicator mode={mode} simulationType={simulationType} />
      )}

      {/* Equation manipulation modal */}
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

      {/* Code sandbox drawer */}
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

      {/* Concept stack panel (first principles explainer) */}
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
