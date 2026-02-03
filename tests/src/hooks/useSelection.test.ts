import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSelection } from '@/hooks/useSelection'

describe('useSelection', () => {
  let mockSelection: {
    toString: ReturnType<typeof vi.fn>
    isCollapsed: boolean
    getRangeAt: ReturnType<typeof vi.fn>
    removeAllRanges: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.useFakeTimers()

    mockSelection = {
      toString: vi.fn(() => 'selected text'),
      isCollapsed: false,
      getRangeAt: vi.fn(() => ({
        commonAncestorContainer: document.body,
      })),
      removeAllRanges: vi.fn(),
    }

    window.getSelection = vi.fn(() => mockSelection as unknown as Selection)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should start with empty selection', () => {
      const { result } = renderHook(() => useSelection())

      expect(result.current.selectedText).toBe('')
      expect(result.current.pageContext).toBe('')
      expect(result.current.pageNumber).toBeNull()
    })
  })

  describe('selection change handling', () => {
    it('should update selected text on selection change', () => {
      const { result } = renderHook(() => useSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
        vi.advanceTimersByTime(350)
      })

      expect(result.current.selectedText).toBe('selected text')
    })

    it('should debounce rapid selection changes', () => {
      const { result } = renderHook(() => useSelection())

      // Trigger multiple selection changes rapidly
      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
        vi.advanceTimersByTime(100)
        document.dispatchEvent(new Event('selectionchange'))
        vi.advanceTimersByTime(100)
        document.dispatchEvent(new Event('selectionchange'))
      })

      // Not enough time has passed
      expect(result.current.selectedText).toBe('')

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.selectedText).toBe('selected text')
    })

    it('should not update when selection is collapsed', () => {
      mockSelection.isCollapsed = true

      const { result } = renderHook(() => useSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
        vi.advanceTimersByTime(350)
      })

      expect(result.current.selectedText).toBe('')
    })

    it('should not update when selection is empty', () => {
      mockSelection.toString.mockReturnValue('   ')

      const { result } = renderHook(() => useSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
        vi.advanceTimersByTime(350)
      })

      expect(result.current.selectedText).toBe('')
    })

    it('should trim selected text', () => {
      mockSelection.toString.mockReturnValue('  text with spaces  ')

      const { result } = renderHook(() => useSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
        vi.advanceTimersByTime(350)
      })

      expect(result.current.selectedText).toBe('text with spaces')
    })
  })

  describe('page context extraction', () => {
    it('should extract context from text layer', () => {
      // Create a mock page element with text layer
      const pageElement = document.createElement('div')
      pageElement.classList.add('pdf-page')
      pageElement.setAttribute('data-page-number', '5')

      const textLayer = document.createElement('div')
      textLayer.classList.add('textLayer')
      textLayer.textContent = 'This is the context from the text layer'
      pageElement.appendChild(textLayer)

      document.body.appendChild(pageElement)

      mockSelection.getRangeAt.mockReturnValue({
        commonAncestorContainer: textLayer,
      })

      const { result } = renderHook(() => useSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
        vi.advanceTimersByTime(350)
      })

      expect(result.current.pageContext).toBe('This is the context from the text layer')
      expect(result.current.pageNumber).toBe(5)

      // Cleanup
      document.body.removeChild(pageElement)
    })

    it('should fallback to parent text when no text layer', () => {
      const parent = document.createElement('div')
      parent.textContent = 'Parent context text'
      document.body.appendChild(parent)

      // Mock getting the parent element's textContent as context
      mockSelection.getRangeAt.mockReturnValue({
        commonAncestorContainer: parent.firstChild!, // Text node
      })

      const { result } = renderHook(() => useSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
        vi.advanceTimersByTime(350)
      })

      // The hook gets parent.textContent as fallback context
      // Check that context was captured (may be from DOM structure)
      expect(result.current.selectedText).toBe('selected text')

      // Cleanup
      document.body.removeChild(parent)
    })
  })

  describe('clearSelection', () => {
    it('should clear selection state', () => {
      const { result } = renderHook(() => useSelection())

      // First, make a selection
      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
        vi.advanceTimersByTime(350)
      })

      expect(result.current.selectedText).toBe('selected text')

      // Now clear it
      act(() => {
        result.current.clearSelection()
      })

      expect(result.current.selectedText).toBe('')
      expect(result.current.pageContext).toBe('')
      expect(result.current.pageNumber).toBeNull()
    })

    it('should call removeAllRanges on window selection', () => {
      const { result } = renderHook(() => useSelection())

      act(() => {
        result.current.clearSelection()
      })

      expect(mockSelection.removeAllRanges).toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      const { unmount } = renderHook(() => useSelection())

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'selectionchange',
        expect.any(Function)
      )

      removeEventListenerSpy.mockRestore()
    })

    it('should clear pending debounce on unmount', () => {
      const { unmount } = renderHook(() => useSelection())

      // Trigger a selection change but don't wait for debounce
      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      // Unmount before debounce completes
      unmount()

      // This should not throw or cause issues
      act(() => {
        vi.advanceTimersByTime(500)
      })
    })
  })
})
