import { useState, useCallback } from 'react'
import type { ConceptCard } from '../types/explainer'
import { extractBoldTerms, MAX_CONCEPT_DEPTH } from '../types/explainer'

interface UseConceptStackOptions {
  onSimulationStart?: () => void
  onSimulationEnd?: () => void
}

export function useConceptStack(options: UseConceptStackOptions = {}) {
  const { onSimulationStart, onSimulationEnd } = options

  const [isOpen, setIsOpen] = useState(false)
  const [cards, setCards] = useState<ConceptCard[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentDepth = cards.length

  /**
   * Push a new concept card onto the stack
   */
  const pushCard = useCallback(async (term: string, context?: string) => {
    // Check depth limit
    if (currentDepth >= MAX_CONCEPT_DEPTH) {
      setError(`Maximum explanation depth (${MAX_CONCEPT_DEPTH}) reached`)
      return
    }

    // Open panel if not already open
    if (!isOpen) {
      setIsOpen(true)
      onSimulationStart?.()
    }

    setIsLoading(true)
    setError(null)

    try {
      let fullResponse = ''

      await window.api.askAI(
        term,
        context || '',
        undefined,
        'explain_fundamental',
        undefined,
        (chunk) => {
          fullResponse += chunk
        },
        () => {
          // Parse explanation to find bold terms
          const technicalTerms = extractBoldTerms(fullResponse)

          const newCard: ConceptCard = {
            id: crypto.randomUUID(),
            term,
            explanation: fullResponse,
            technicalTerms,
            depth: currentDepth,
            timestamp: Date.now(),
          }

          setCards(prev => [...prev, newCard])
          setBreadcrumbs(prev => [...prev, term])
          setIsLoading(false)
        },
        (errorMsg) => {
          setError(errorMsg)
          setIsLoading(false)
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setIsLoading(false)
    }
  }, [isOpen, currentDepth, onSimulationStart])

  /**
   * Pop the top card from the stack (go back one level)
   */
  const popCard = useCallback(() => {
    setCards(prev => {
      if (prev.length <= 1) {
        // Closing the stack
        setIsOpen(false)
        setBreadcrumbs([])
        onSimulationEnd?.()
        return []
      }
      return prev.slice(0, -1)
    })
    setBreadcrumbs(prev => prev.slice(0, -1))
    setError(null)
  }, [onSimulationEnd])

  /**
   * Pop to a specific index (breadcrumb navigation)
   */
  const popToIndex = useCallback((index: number) => {
    if (index < 0) return

    if (index === 0 && cards.length > 0) {
      // Going back to the first card
      setCards(prev => prev.slice(0, 1))
      setBreadcrumbs(prev => prev.slice(0, 1))
    } else if (index < cards.length - 1) {
      setCards(prev => prev.slice(0, index + 1))
      setBreadcrumbs(prev => prev.slice(0, index + 1))
    }
    setError(null)
  }, [cards.length])

  /**
   * Close the entire stack
   */
  const closeStack = useCallback(() => {
    setIsOpen(false)
    setCards([])
    setBreadcrumbs([])
    setError(null)
    setIsLoading(false)
    onSimulationEnd?.()
  }, [onSimulationEnd])

  /**
   * Get the current (top) card
   */
  const currentCard = cards[cards.length - 1] || null

  return {
    // State
    isOpen,
    cards,
    breadcrumbs,
    currentDepth,
    currentCard,
    isLoading,
    error,

    // Actions
    pushCard,
    popCard,
    popToIndex,
    closeStack,
  }
}
