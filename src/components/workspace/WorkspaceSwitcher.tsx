import { useState, useRef, useEffect } from 'react'

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceWithCount[]
  currentWorkspace: Workspace | null
  onSelect: (workspaceId: string | null) => void
  onCreate: (name: string, description?: string) => Promise<Workspace | null>
  onDelete: (id: string) => Promise<boolean>
  isLoading?: boolean
}

function WorkspaceSwitcher({
  workspaces,
  currentWorkspace,
  onSelect,
  onCreate,
  onDelete,
  isLoading,
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsCreating(false)
        setConfirmDelete(null)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const workspace = await onCreate(newName.trim())
    if (workspace) {
      onSelect(workspace.id)
      setNewName('')
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const success = await onDelete(id)
    if (success) {
      setConfirmDelete(null)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 text-sm text-gray-200 transition-colors"
        disabled={isLoading}
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="max-w-[120px] truncate">
          {currentWorkspace ? currentWorkspace.name : 'All Documents'}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 rounded-lg border border-gray-700/50 shadow-xl z-50 overflow-hidden">
          {/* All documents option */}
          <button
            onClick={() => {
              onSelect(null)
              setIsOpen(false)
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-700/50 transition-colors ${
              !currentWorkspace ? 'bg-blue-600/20 text-blue-300' : 'text-gray-200'
            }`}
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="flex-1 text-sm">All Documents</span>
          </button>

          {workspaces.length > 0 && (
            <>
              <div className="border-t border-gray-700/50 my-1" />
              <div className="max-h-48 overflow-y-auto">
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className={`group flex items-center gap-2 px-3 py-2 hover:bg-gray-700/50 transition-colors ${
                      currentWorkspace?.id === workspace.id ? 'bg-blue-600/20' : ''
                    }`}
                  >
                    <button
                      onClick={() => {
                        onSelect(workspace.id)
                        setIsOpen(false)
                      }}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${currentWorkspace?.id === workspace.id ? 'text-blue-300' : 'text-gray-200'}`}>
                          {workspace.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {workspace.document_count} document{workspace.document_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </button>
                    {confirmDelete === workspace.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(workspace.id)}
                          className="p-1 rounded text-red-400 hover:bg-red-600/20"
                          title="Confirm delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="p-1 rounded text-gray-400 hover:bg-gray-600/50"
                          title="Cancel"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(workspace.id)}
                        className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-600/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete workspace"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="border-t border-gray-700/50 mt-1 p-2">
            {isCreating ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') {
                      setIsCreating(false)
                      setNewName('')
                    }
                  }}
                  placeholder="Workspace name"
                  className="flex-1 px-2 py-1 bg-gray-700/50 border border-gray-600/50 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="p-1 rounded text-green-400 hover:bg-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false)
                    setNewName('')
                  }}
                  className="p-1 rounded text-gray-400 hover:bg-gray-600/50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-blue-400 hover:bg-blue-600/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Workspace</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkspaceSwitcher
