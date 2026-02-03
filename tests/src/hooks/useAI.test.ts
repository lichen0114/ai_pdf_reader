import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAI } from '@/hooks/useAI'

describe('useAI', () => {
  let mockWindowApi: {
    askAI: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockWindowApi = {
      askAI: vi.fn(),
    }
    ;(window as Window & { api: typeof mockWindowApi }).api = mockWindowApi
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete (window as Window & { api?: typeof mockWindowApi }).api
  })

  describe('initial state', () => {
    it('should start with empty response and no loading', () => {
      const { result } = renderHook(() => useAI())

      expect(result.current.response).toBe('')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('askAI', () => {
    it('should set loading state when called', async () => {
      mockWindowApi.askAI.mockImplementation(async () => {
        // Simulate async delay
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      const { result } = renderHook(() => useAI())

      act(() => {
        result.current.askAI('test text')
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('should accumulate chunks from streaming response', async () => {
      mockWindowApi.askAI.mockImplementation(
        async (
          _text: string,
          _context: string,
          _providerId: string | undefined,
          onChunk: (chunk: string) => void,
          onDone: () => void
        ) => {
          onChunk('Hello')
          onChunk(' world')
          onChunk('!')
          onDone()
        }
      )

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.askAI('test text')
      })

      expect(result.current.response).toBe('Hello world!')
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle errors from onError callback', async () => {
      mockWindowApi.askAI.mockImplementation(
        async (
          _text: string,
          _context: string,
          _providerId: string | undefined,
          _onChunk: (chunk: string) => void,
          _onDone: () => void,
          onError: (error: string) => void
        ) => {
          onError('API rate limit exceeded')
        }
      )

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.askAI('test text')
      })

      expect(result.current.error).toBe('API rate limit exceeded')
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle thrown errors', async () => {
      mockWindowApi.askAI.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.askAI('test text')
      })

      expect(result.current.error).toBe('Network error')
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle non-Error thrown values', async () => {
      mockWindowApi.askAI.mockRejectedValue('string error')

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.askAI('test text')
      })

      expect(result.current.error).toBe('An error occurred')
      expect(result.current.isLoading).toBe(false)
    })

    it('should pass context to askAI', async () => {
      mockWindowApi.askAI.mockImplementation(
        async (
          _text: string,
          _context: string,
          _providerId: string | undefined,
          _onChunk: (chunk: string) => void,
          onDone: () => void
        ) => {
          onDone()
        }
      )

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.askAI('selected text', 'surrounding context')
      })

      expect(mockWindowApi.askAI).toHaveBeenCalledWith(
        'selected text',
        'surrounding context',
        undefined,
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      )
    })

    it('should pass empty string for undefined context', async () => {
      mockWindowApi.askAI.mockImplementation(
        async (
          _text: string,
          _context: string,
          _providerId: string | undefined,
          _onChunk: (chunk: string) => void,
          onDone: () => void
        ) => {
          onDone()
        }
      )

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.askAI('selected text')
      })

      expect(mockWindowApi.askAI).toHaveBeenCalledWith(
        'selected text',
        '',
        undefined,
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      )
    })

    it('should reset response before new query', async () => {
      let callCount = 0
      mockWindowApi.askAI.mockImplementation(
        async (
          _text: string,
          _context: string,
          _providerId: string | undefined,
          onChunk: (chunk: string) => void,
          onDone: () => void
        ) => {
          callCount++
          if (callCount === 1) {
            onChunk('First response')
          } else {
            onChunk('Second response')
          }
          onDone()
        }
      )

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.askAI('first query')
      })

      expect(result.current.response).toBe('First response')

      await act(async () => {
        await result.current.askAI('second query')
      })

      expect(result.current.response).toBe('Second response')
    })
  })

  describe('when window.api is not available', () => {
    it('should set error when API is not available', async () => {
      delete (window as Window & { api?: typeof mockWindowApi }).api

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.askAI('test text')
      })

      expect(result.current.error).toBe('API not available - running outside Electron')
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('clearResponse', () => {
    it('should clear response and error', async () => {
      mockWindowApi.askAI.mockImplementation(
        async (
          _text: string,
          _context: string,
          _providerId: string | undefined,
          onChunk: (chunk: string) => void,
          onDone: () => void
        ) => {
          onChunk('test response')
          onDone()
        }
      )

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.askAI('test')
      })

      expect(result.current.response).toBe('test response')

      act(() => {
        result.current.clearResponse()
      })

      expect(result.current.response).toBe('')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should clear error state', async () => {
      mockWindowApi.askAI.mockRejectedValue(new Error('Test error'))

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.askAI('test')
      })

      expect(result.current.error).toBe('Test error')

      act(() => {
        result.current.clearResponse()
      })

      expect(result.current.error).toBeNull()
    })
  })
})
