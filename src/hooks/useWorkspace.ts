import { useState, useCallback, useEffect, useRef } from 'react'

interface WorkspaceState {
  workspaces: WorkspaceWithCount[]
  currentWorkspace: Workspace | null
  documents: Document[]
  isLoading: boolean
  error: string | null
}

const CURRENT_WORKSPACE_KEY = 'activepaper:currentWorkspaceId'

export function useWorkspace() {
  const [state, setState] = useState<WorkspaceState>({
    workspaces: [],
    currentWorkspace: null,
    documents: [],
    isLoading: false,
    error: null,
  })

  const hasRestoredWorkspace = useRef(false)
  const selectWorkspaceRef = useRef<(id: string | null) => Promise<void>>()

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces()
  }, [])

  // Load saved workspace from localStorage (once)
  useEffect(() => {
    if (hasRestoredWorkspace.current) return
    const savedWorkspaceId = localStorage.getItem(CURRENT_WORKSPACE_KEY)
    if (savedWorkspaceId && state.workspaces.length > 0) {
      const workspace = state.workspaces.find(w => w.id === savedWorkspaceId)
      if (workspace && selectWorkspaceRef.current) {
        selectWorkspaceRef.current(savedWorkspaceId)
        hasRestoredWorkspace.current = true
      }
    }
  }, [state.workspaces])

  const loadWorkspaces = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const workspaces = await window.api.getWorkspaces()
      setState(prev => ({ ...prev, workspaces, isLoading: false }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workspaces'
      console.error('Failed to load workspaces:', err)
      setState(prev => ({ ...prev, isLoading: false, error: message }))
    }
  }, [])

  const loadWorkspaceDocuments = useCallback(async (workspaceId: string) => {
    try {
      const documents = await window.api.getWorkspaceDocuments(workspaceId)
      setState(prev => ({ ...prev, documents }))
    } catch (err) {
      console.error('Failed to load workspace documents:', err)
    }
  }, [])

  const selectWorkspace = useCallback(async (workspaceId: string | null) => {
    if (!workspaceId) {
      setState(prev => ({ ...prev, currentWorkspace: null, documents: [] }))
      localStorage.removeItem(CURRENT_WORKSPACE_KEY)
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const workspace = await window.api.getWorkspace(workspaceId)
      if (workspace) {
        setState(prev => ({ ...prev, currentWorkspace: workspace, isLoading: false }))
        localStorage.setItem(CURRENT_WORKSPACE_KEY, workspaceId)
        await loadWorkspaceDocuments(workspaceId)
      } else {
        setState(prev => ({ ...prev, currentWorkspace: null, documents: [], isLoading: false }))
        localStorage.removeItem(CURRENT_WORKSPACE_KEY)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select workspace'
      console.error('Failed to select workspace:', err)
      setState(prev => ({ ...prev, isLoading: false, error: message }))
    }
  }, [loadWorkspaceDocuments])
  selectWorkspaceRef.current = selectWorkspace

  const createWorkspace = useCallback(async (name: string, description?: string): Promise<Workspace | null> => {
    setState(prev => ({ ...prev, error: null }))
    try {
      const workspace = await window.api.createWorkspace(name, description)
      await loadWorkspaces()
      return workspace
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace'
      console.error('Failed to create workspace:', err)
      setState(prev => ({ ...prev, error: message }))
      return null
    }
  }, [loadWorkspaces])

  const updateWorkspace = useCallback(async (
    id: string,
    updates: { name?: string; description?: string }
  ): Promise<Workspace | null> => {
    setState(prev => ({ ...prev, error: null }))
    try {
      const workspace = await window.api.updateWorkspace(id, updates)
      await loadWorkspaces()
      if (state.currentWorkspace?.id === id && workspace) {
        setState(prev => ({ ...prev, currentWorkspace: workspace }))
      }
      return workspace
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update workspace'
      console.error('Failed to update workspace:', err)
      setState(prev => ({ ...prev, error: message }))
      return null
    }
  }, [loadWorkspaces, state.currentWorkspace?.id])

  const deleteWorkspace = useCallback(async (id: string): Promise<boolean> => {
    setState(prev => ({ ...prev, error: null }))
    try {
      const success = await window.api.deleteWorkspace(id)
      if (success) {
        await loadWorkspaces()
        if (state.currentWorkspace?.id === id) {
          setState(prev => ({ ...prev, currentWorkspace: null, documents: [] }))
          localStorage.removeItem(CURRENT_WORKSPACE_KEY)
        }
      }
      return success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete workspace'
      console.error('Failed to delete workspace:', err)
      setState(prev => ({ ...prev, error: message }))
      return false
    }
  }, [loadWorkspaces, state.currentWorkspace?.id])

  const addDocument = useCallback(async (documentId: string): Promise<boolean> => {
    if (!state.currentWorkspace) return false

    setState(prev => ({ ...prev, error: null }))
    try {
      const success = await window.api.addDocumentToWorkspace(state.currentWorkspace.id, documentId)
      if (success) {
        await loadWorkspaceDocuments(state.currentWorkspace.id)
        await loadWorkspaces() // Update document count
      }
      return success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add document to workspace'
      console.error('Failed to add document to workspace:', err)
      setState(prev => ({ ...prev, error: message }))
      return false
    }
  }, [state.currentWorkspace, loadWorkspaceDocuments, loadWorkspaces])

  const removeDocument = useCallback(async (documentId: string): Promise<boolean> => {
    if (!state.currentWorkspace) return false

    setState(prev => ({ ...prev, error: null }))
    try {
      const success = await window.api.removeDocumentFromWorkspace(state.currentWorkspace.id, documentId)
      if (success) {
        await loadWorkspaceDocuments(state.currentWorkspace.id)
        await loadWorkspaces() // Update document count
      }
      return success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove document from workspace'
      console.error('Failed to remove document from workspace:', err)
      setState(prev => ({ ...prev, error: message }))
      return false
    }
  }, [state.currentWorkspace, loadWorkspaceDocuments, loadWorkspaces])

  const isDocumentInCurrentWorkspace = useCallback(async (documentId: string): Promise<boolean> => {
    if (!state.currentWorkspace) return false
    try {
      return await window.api.isDocumentInWorkspace(state.currentWorkspace.id, documentId)
    } catch (err) {
      console.error('Failed to check document in workspace:', err)
      return false
    }
  }, [state.currentWorkspace])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    workspaces: state.workspaces,
    currentWorkspace: state.currentWorkspace,
    documents: state.documents,
    isLoading: state.isLoading,
    error: state.error,
    loadWorkspaces,
    selectWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addDocument,
    removeDocument,
    isDocumentInCurrentWorkspace,
    clearError,
  }
}
