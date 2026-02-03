import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ResponsePanel from '@/components/ResponsePanel'

describe('ResponsePanel', () => {
  const defaultProps = {
    isOpen: true,
    response: '',
    isLoading: false,
    error: null,
    selectedText: '',
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('visibility', () => {
    it('should render when isOpen is true', () => {
      render(<ResponsePanel {...defaultProps} />)

      expect(screen.getByText('AI Response')).toBeInTheDocument()
    })

    it('should not render when isOpen is false', () => {
      render(<ResponsePanel {...defaultProps} isOpen={false} />)

      expect(screen.queryByText('AI Response')).not.toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('should show loading indicator when isLoading is true', () => {
      render(<ResponsePanel {...defaultProps} isLoading={true} />)

      expect(screen.getByText('Thinking...')).toBeInTheDocument()
    })

    it('should show analyzing message when loading with no response', () => {
      render(<ResponsePanel {...defaultProps} isLoading={true} />)

      expect(screen.getByText('Analyzing your selection...')).toBeInTheDocument()
    })

    it('should not show analyzing message when there is a response', () => {
      render(
        <ResponsePanel {...defaultProps} isLoading={true} response="Some response" />
      )

      expect(screen.queryByText('Analyzing your selection...')).not.toBeInTheDocument()
    })
  })

  describe('response display', () => {
    it('should render markdown response', () => {
      render(<ResponsePanel {...defaultProps} response="**Bold text** and *italic*" />)

      // ReactMarkdown should render the bold text
      expect(screen.getByText('Bold text')).toBeInTheDocument()
    })

    it('should render code blocks', () => {
      const { container } = render(
        <ResponsePanel
          {...defaultProps}
          response="```javascript\nconst x = 1;\n```"
        />
      )

      // ReactMarkdown renders code blocks in pre/code elements
      const codeElement = container.querySelector('code')
      expect(codeElement).toBeInTheDocument()
      expect(codeElement?.textContent).toContain('const x = 1')
    })

    it('should apply typing cursor class when loading', () => {
      const { container } = render(
        <ResponsePanel {...defaultProps} isLoading={true} response="Loading..." />
      )

      const markdownContent = container.querySelector('.markdown-content')
      expect(markdownContent).toHaveClass('typing-cursor')
    })

    it('should not apply typing cursor class when not loading', () => {
      const { container } = render(
        <ResponsePanel {...defaultProps} isLoading={false} response="Done" />
      )

      const markdownContent = container.querySelector('.markdown-content')
      expect(markdownContent).not.toHaveClass('typing-cursor')
    })
  })

  describe('error display', () => {
    it('should display error message', () => {
      render(<ResponsePanel {...defaultProps} error="Connection failed" />)

      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Connection failed')).toBeInTheDocument()
    })

    it('should display error styling', () => {
      render(<ResponsePanel {...defaultProps} error="Test error" />)

      const errorContainer = screen.getByText('Test error').closest('div')
      expect(errorContainer).toBeInTheDocument()
    })
  })

  describe('selected text preview', () => {
    it('should display selected text when provided', () => {
      render(
        <ResponsePanel {...defaultProps} selectedText="This is selected text" />
      )

      expect(screen.getByText('Selected text:')).toBeInTheDocument()
      expect(screen.getByText('This is selected text')).toBeInTheDocument()
    })

    it('should not display selected text section when empty', () => {
      render(<ResponsePanel {...defaultProps} selectedText="" />)

      expect(screen.queryByText('Selected text:')).not.toBeInTheDocument()
    })
  })

  describe('close button', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(<ResponsePanel {...defaultProps} onClose={onClose} />)

      const closeButton = screen.getByRole('button')
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('auto-scroll behavior', () => {
    it('should have content container for scrolling', () => {
      const { container } = render(
        <ResponsePanel {...defaultProps} response="Test content" />
      )

      const scrollContainer = container.querySelector('.overflow-y-auto')
      expect(scrollContainer).toBeInTheDocument()
    })
  })

  describe('combinations of states', () => {
    it('should show error even when there is a response', () => {
      render(
        <ResponsePanel
          {...defaultProps}
          response="Partial response"
          error="Stream interrupted"
        />
      )

      expect(screen.getByText('Partial response')).toBeInTheDocument()
      expect(screen.getByText('Stream interrupted')).toBeInTheDocument()
    })

    it('should show selected text with loading state', () => {
      render(
        <ResponsePanel
          {...defaultProps}
          selectedText="Selected"
          isLoading={true}
        />
      )

      expect(screen.getByText('Selected')).toBeInTheDocument()
      expect(screen.getByText('Thinking...')).toBeInTheDocument()
    })

    it('should show all elements together', () => {
      render(
        <ResponsePanel
          {...defaultProps}
          selectedText="Selected text"
          response="Response content"
          isLoading={true}
        />
      )

      expect(screen.getByText('Selected text')).toBeInTheDocument()
      expect(screen.getByText('Response content')).toBeInTheDocument()
      expect(screen.getByText('Thinking...')).toBeInTheDocument()
    })
  })
})
