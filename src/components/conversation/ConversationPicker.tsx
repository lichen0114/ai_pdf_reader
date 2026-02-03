import ConversationList from './ConversationList'

interface ConversationPickerProps {
  isOpen: boolean
  conversations: ConversationSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNewConversation: () => void
  onClose: () => void
}

function ConversationPicker({
  isOpen,
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNewConversation,
  onClose,
}: ConversationPickerProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 z-10"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-x-4 top-16 bottom-20 bg-gray-800 rounded-lg shadow-2xl border border-gray-700/50 z-20 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
          <h3 className="font-medium text-gray-100">Conversations</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={(id) => {
              onSelect(id)
              onClose()
            }}
            onDelete={onDelete}
            onNewConversation={() => {
              onNewConversation()
              onClose()
            }}
          />
        </div>
      </div>
    </>
  )
}

export default ConversationPicker
