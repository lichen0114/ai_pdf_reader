import { useState, useEffect, useCallback } from 'react'
import PDFViewer from './components/PDFViewer'
import ResponsePanel from './components/ResponsePanel'
import ProviderSwitcher from './components/ProviderSwitcher'
import SettingsModal from './components/SettingsModal'
import { useSelection } from './hooks/useSelection'
import { useAI } from './hooks/useAI'

function App() {
  const [pdfFile, setPdfFile] = useState<ArrayBuffer | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [providerRefreshKey, setProviderRefreshKey] = useState(0)

  const { selectedText, pageContext, clearSelection } = useSelection()
  const { response, isLoading, error, askAI, clearResponse } = useAI()

  const handleKeyChange = useCallback(() => {
    setProviderRefreshKey(k => k + 1)
  }, [])

  // Handle file open from menu
  useEffect(() => {
    if (!window.api) return

    const unsubscribe = window.api.onFileOpened(async (filePath: string) => {
      try {
        setLoadError(null)
        const arrayBuffer = await window.api.readFile(filePath)
        setPdfFile(arrayBuffer)
        setFileName(filePath.split('/').pop() || 'document.pdf')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open file'
        setLoadError(message)
        console.error('Failed to open file:', err)
      }
    })

    return () => unsubscribe()
  }, [])

  // Handle Cmd+J keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        if (selectedText) {
          handleAskAI()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedText, pageContext])

  const handleAskAI = useCallback(async () => {
    if (!selectedText) return

    setIsPanelOpen(true)
    clearResponse()
    await askAI(selectedText, pageContext)
  }, [selectedText, pageContext, askAI, clearResponse])

  const handleClosePanel = () => {
    setIsPanelOpen(false)
    clearSelection()
    clearResponse()
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
      setLoadError(null)
      const filePath = window.api.getFilePath(file)
      const arrayBuffer = await window.api.readFile(filePath)
      setPdfFile(arrayBuffer)
      setFileName(file.name)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open file'
      setLoadError(message)
      console.error('Failed to open dropped file:', err)
    }
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Title bar / Top bar */}
      <div className="app-titlebar flex items-center justify-between px-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3 pl-16">
          <span className="text-sm text-gray-400 truncate max-w-md">
            {fileName || 'AI PDF Reader'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ProviderSwitcher onSettingsClick={() => setIsSettingsOpen(true)} refreshKey={providerRefreshKey} />
        </div>
      </div>

      {/* Main content area */}
      <div
        className="flex-1 relative overflow-hidden"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {pdfFile ? (
          <PDFViewer data={pdfFile} onError={(msg) => setLoadError(msg)} />
        ) : (
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
            <p className="text-sm">or use File → Open (⌘O)</p>
          </div>
        )}

        {/* Error display */}
        {loadError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-200 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 max-w-md">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">{loadError}</span>
            <button
              onClick={() => setLoadError(null)}
              className="ml-2 p-1 hover:bg-red-800 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Selection hint */}
        {selectedText && !isPanelOpen && (
          <div className="absolute bottom-4 right-4 bg-gray-800 text-gray-300 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
            <span>Text selected</span>
            <kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">⌘J</kbd>
            <span>to ask AI</span>
          </div>
        )}

        {/* Response panel */}
        <ResponsePanel
          isOpen={isPanelOpen}
          response={response}
          isLoading={isLoading}
          error={error}
          selectedText={selectedText}
          onClose={handleClosePanel}
        />
      </div>

      {/* Settings modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onKeyChange={handleKeyChange}
      />
    </div>
  )
}

export default App
