import { useState, useCallback } from 'react'
import type { TabState } from '../types/tabs'

const SCALE_DEFAULT = 1.5

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useTabs() {
  const [tabs, setTabs] = useState<TabState[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  const openTab = useCallback(async (filePath: string): Promise<TabState | null> => {
    // Check if file is already open
    const existingTab = tabs.find(t => t.filePath === filePath)
    if (existingTab) {
      setActiveTabId(existingTab.id)
      return existingTab
    }

    const fileName = filePath.split('/').pop() || 'document.pdf'
    const newTab: TabState = {
      id: generateTabId(),
      filePath,
      fileName,
      documentId: null,
      pdfData: null,
      scrollPosition: 0,
      scale: SCALE_DEFAULT,
      isLoading: true,
      loadError: null,
    }

    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)

    // Load PDF data
    if (window.api) {
      try {
        const arrayBuffer = await window.api.readFile(filePath)
        const doc = await window.api.getOrCreateDocument({
          filename: fileName,
          filepath: filePath,
        })

        setTabs(prev => prev.map(t =>
          t.id === newTab.id
            ? { ...t, pdfData: arrayBuffer, documentId: doc.id, isLoading: false }
            : t
        ))

        return { ...newTab, pdfData: arrayBuffer, documentId: doc.id, isLoading: false }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open file'
        setTabs(prev => prev.map(t =>
          t.id === newTab.id
            ? { ...t, isLoading: false, loadError: message }
            : t
        ))
        return null
      }
    }

    return null
  }, [tabs])

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const tabIndex = prev.findIndex(t => t.id === tabId)
      if (tabIndex === -1) return prev

      const newTabs = prev.filter(t => t.id !== tabId)

      // If closing the active tab, switch to adjacent tab
      if (activeTabId === tabId && newTabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, newTabs.length - 1)
        setActiveTabId(newTabs[newActiveIndex].id)
      } else if (newTabs.length === 0) {
        setActiveTabId(null)
      }

      return newTabs
    })
  }, [activeTabId])

  const selectTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (tab) {
      setActiveTabId(tabId)
    }
  }, [tabs])

  const updateTab = useCallback((tabId: string, updates: Partial<TabState>) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, ...updates } : t
    ))
  }, [])

  const selectPreviousTab = useCallback(() => {
    if (tabs.length <= 1 || !activeTabId) return
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)
    const newIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1
    setActiveTabId(tabs[newIndex].id)
  }, [tabs, activeTabId])

  const selectNextTab = useCallback(() => {
    if (tabs.length <= 1 || !activeTabId) return
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)
    const newIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1
    setActiveTabId(tabs[newIndex].id)
  }, [tabs, activeTabId])

  const selectTabByIndex = useCallback((index: number) => {
    if (index >= 0 && index < tabs.length) {
      setActiveTabId(tabs[index].id)
    }
  }, [tabs])

  const closeCurrentTab = useCallback(() => {
    if (activeTabId) {
      closeTab(activeTabId)
    }
  }, [activeTabId, closeTab])

  return {
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
  }
}
