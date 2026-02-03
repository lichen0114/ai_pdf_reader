import { useState, useCallback } from 'react'

export type ActionType = 'explain' | 'summarize' | 'define' | 'parse_equation' | 'explain_fundamental' | 'extract_terms'

export interface HistoryEntry {
  id: string
  timestamp: number
  selectedText: string
  action: ActionType
  response: string
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const addEntry = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    setHistory(prev => [{
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    }, ...prev])
  }, [])

  const getEntry = useCallback((id: string) => {
    return history.find(entry => entry.id === id)
  }, [history])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  return {
    history,
    addEntry,
    getEntry,
    clearHistory,
  }
}
