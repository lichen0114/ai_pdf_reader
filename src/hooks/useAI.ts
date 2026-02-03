import { useState, useCallback } from 'react'

interface AIState {
  response: string
  isLoading: boolean
  error: string | null
}

export function useAI() {
  const [state, setState] = useState<AIState>({
    response: '',
    isLoading: false,
    error: null,
  })

  const askAI = useCallback(async (text: string, context?: string) => {
    if (!window.api) {
      setState({
        response: '',
        isLoading: false,
        error: 'API not available - running outside Electron',
      })
      return
    }

    setState({
      response: '',
      isLoading: true,
      error: null,
    })

    try {
      await window.api.askAI(
        text,
        context || '',
        undefined, // Use current provider
        // onChunk
        (chunk) => {
          setState((prev) => ({
            ...prev,
            response: prev.response + chunk,
          }))
        },
        // onDone
        () => {
          setState((prev) => ({
            ...prev,
            isLoading: false,
          }))
        },
        // onError
        (error) => {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error,
          }))
        }
      )
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'An error occurred',
      }))
    }
  }, [])

  const clearResponse = useCallback(() => {
    setState({
      response: '',
      isLoading: false,
      error: null,
    })
  }, [])

  return {
    response: state.response,
    isLoading: state.isLoading,
    error: state.error,
    askAI,
    clearResponse,
  }
}
