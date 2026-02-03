import { useRef, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import QuoteCard from './QuoteCard'
import HistoryPanel from './HistoryPanel'
import ConversationPicker from './conversation/ConversationPicker'
import type { HistoryEntry, ActionType } from '../hooks/useHistory'
import type { Message } from '../hooks/useConversation'

interface ResponsePanelProps {
  isOpen: boolean
  response: string
  isLoading: boolean
  error: string | null
  selectedText: string
  messages: Message[]
  onClose: () => void
  onFollowUp: (text: string) => void
  history: HistoryEntry[]
  onHistorySelect: (entry: HistoryEntry) => void
  currentAction?: ActionType
  // Conversation props
  conversationId?: string | null
  conversations?: ConversationSummary[]
  onConversationSelect?: (id: string) => void
  onConversationDelete?: (id: string) => void
  onNewConversation?: () => void
}

function ResponsePanel({
  isOpen,
  response,
  isLoading,
  error,
  selectedText,
  messages,
  onClose,
  onFollowUp,
  history,
  onHistorySelect,
  currentAction,
  conversationId,
  conversations = [],
  onConversationSelect,
  onConversationDelete,
  onNewConversation,
}: ResponsePanelProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [followUpText, setFollowUpText] = useState('')
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isConversationsOpen, setIsConversationsOpen] = useState(false)

  // Auto-scroll to bottom as response streams in
  useEffect(() => {
    if (contentRef.current && isLoading) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [response, messages, isLoading])

  const handleFollowUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUpText.trim() || isLoading) return
    onFollowUp(followUpText.trim())
    setFollowUpText('')
  }

  const handleHistorySelect = (entry: HistoryEntry) => {
    setIsHistoryOpen(false)
    onHistorySelect(entry)
  }

  const getActionLabel = (action?: ActionType) => {
    switch (action) {
      case 'explain': return 'Explanation'
      case 'summarize': return 'Summary'
      case 'define': return 'Definition'
      default: return 'Response'
    }
  }

  return (
    <aside className={`
      fixed right-0 top-[28px] bottom-0 w-[400px]
      flex flex-col
      glass-panel
      border-l border-gray-700/50 shadow-2xl
      transform transition-transform duration-300 ease-out
      ${isOpen ? 'translate-x-0' : 'translate-x-full'}
    `}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span className="font-medium text-gray-100">Copilot</span>
          {isLoading && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Thinking...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onConversationSelect && conversations.length > 0 && (
            <button
              onClick={() => setIsConversationsOpen(true)}
              className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
              title="Conversations"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
            title="History"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Content - scrollable */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {/* Selected text preview */}
        {selectedText && <QuoteCard text={selectedText} />}

        {/* Action badge */}
        {currentAction && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {getActionLabel(currentAction)}
            </span>
            <div className="flex-1 h-px bg-gray-700/50" />
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role === 'user' ? 'pl-4' : ''}>
            {msg.role === 'user' ? (
              <div className="bg-gray-700/30 rounded-lg p-3">
                <p className="text-sm text-gray-300">{msg.content}</p>
              </div>
            ) : (
              <div className={`markdown-content-enhanced ${isLoading && idx === messages.length - 1 ? 'typing-cursor' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {/* Legacy single response (when no conversation) */}
        {response && messages.length === 0 && (
          <div className={`markdown-content-enhanced ${isLoading ? 'typing-cursor' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{response}</ReactMarkdown>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-1 text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Empty state while loading */}
        {!response && !error && messages.length === 0 && isLoading && (
          <div className="flex items-center gap-2 text-gray-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Analyzing your selection...</span>
          </div>
        )}
      </div>

      {/* Footer - follow-up input */}
      <footer className="px-4 py-3 border-t border-gray-700/50">
        <form onSubmit={handleFollowUp} className="flex items-center gap-2">
          <input
            type="text"
            value={followUpText}
            onChange={(e) => setFollowUpText(e.target.value)}
            placeholder="Ask a follow-up..."
            className="flex-1 px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!followUpText.trim() || isLoading}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </footer>

      {/* History overlay */}
      <HistoryPanel
        isOpen={isHistoryOpen}
        history={history}
        onSelect={handleHistorySelect}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Conversations overlay */}
      {onConversationSelect && onConversationDelete && onNewConversation && (
        <ConversationPicker
          isOpen={isConversationsOpen}
          conversations={conversations}
          activeId={conversationId ?? null}
          onSelect={onConversationSelect}
          onDelete={onConversationDelete}
          onNewConversation={onNewConversation}
          onClose={() => setIsConversationsOpen(false)}
        />
      )}
    </aside>
  )
}

export default ResponsePanel
