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
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const { selectedText, pageContext, clearSelection } = useSelection()
  const { response, isLoading, error, askAI, clearResponse } = useAI()

  // Handle file open from menu
  useEffect(() => {
    if (!window.api) return

    const unsubscribe = window.api.onFileOpened(async (filePath: string) => {
      try {
        const buffer = await window.api.readFile(filePath)
        const arrayBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        ) as ArrayBuffer
        setPdfFile(arrayBuffer)
        setFileName(filePath.split('/').pop() || 'document.pdf')
      } catch (err) {
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

    // Check both MIME type and file extension
    const isPdf = file.type === 'application/pdf' ||
                  file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) return

    // Use Electron's file.path property + IPC to read file (same as menu handler)
    const filePath = (file as File & { path: string }).path

    if (filePath && window.api) {
      try {
        const buffer = await window.api.readFile(filePath)
        const arrayBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        ) as ArrayBuffer
        setPdfFile(arrayBuffer)
        setFileName(file.name)
      } catch (err) {
        console.error('Failed to open dropped file:', err)
      }
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
          <ProviderSwitcher onSettingsClick={() => setIsSettingsOpen(true)} />
        </div>
      </div>

      {/* Main content area */}
      <div
        className="flex-1 relative overflow-hidden"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {pdfFile ? (
          <PDFViewer data={pdfFile} />
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
      />
    </div>
  )
}

export default App
