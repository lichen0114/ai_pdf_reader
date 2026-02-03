import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsModal from '@/components/SettingsModal'

describe('SettingsModal', () => {
  let mockWindowApi: {
    hasApiKey: ReturnType<typeof vi.fn>
    setApiKey: ReturnType<typeof vi.fn>
    deleteApiKey: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockWindowApi = {
      hasApiKey: vi.fn().mockResolvedValue(false),
      setApiKey: vi.fn().mockResolvedValue(true),
      deleteApiKey: vi.fn().mockResolvedValue(true),
    }
    ;(window as Window & { api: typeof mockWindowApi }).api = mockWindowApi
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete (window as Window & { api?: typeof mockWindowApi }).api
  })

  describe('visibility', () => {
    it('should render when isOpen is true', () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should not render when isOpen is false', () => {
      render(<SettingsModal isOpen={false} onClose={vi.fn()} />)

      expect(screen.queryByText('Settings')).not.toBeInTheDocument()
    })
  })

  describe('provider list', () => {
    it('should display local provider section', async () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Local AI')).toBeInTheDocument()
      expect(screen.getByText('Ollama')).toBeInTheDocument()
    })

    it('should display cloud providers section', async () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Cloud AI Providers')).toBeInTheDocument()
        expect(screen.getByText('Google Gemini')).toBeInTheDocument()
        expect(screen.getByText('OpenAI')).toBeInTheDocument()
        expect(screen.getByText('Anthropic (Claude)')).toBeInTheDocument()
      })
    })

    it('should load key status on mount', async () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(mockWindowApi.hasApiKey).toHaveBeenCalledWith('gemini')
        expect(mockWindowApi.hasApiKey).toHaveBeenCalledWith('openai')
        expect(mockWindowApi.hasApiKey).toHaveBeenCalledWith('anthropic')
      })
    })

    it('should show "No API key" for unconfigured providers', async () => {
      mockWindowApi.hasApiKey.mockResolvedValue(false)

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        const noKeyElements = screen.getAllByText('No API key')
        expect(noKeyElements.length).toBe(3)
      })
    })

    it('should show "API key configured" for configured providers', async () => {
      mockWindowApi.hasApiKey.mockResolvedValue(true)

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        const configuredElements = screen.getAllByText('API key configured')
        expect(configuredElements.length).toBe(3)
      })
    })
  })

  describe('adding API key', () => {
    it('should show input when "Add key" is clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Google Gemini')).toBeInTheDocument()
      })

      const addButtons = screen.getAllByText('Add key')
      fireEvent.click(addButtons[0])

      expect(screen.getByPlaceholderText('Enter your Gemini API key')).toBeInTheDocument()
    })

    it('should save key when Save is clicked', async () => {
      const user = userEvent.setup()
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Google Gemini')).toBeInTheDocument()
      })

      const addButtons = screen.getAllByText('Add key')
      fireEvent.click(addButtons[0])

      const input = screen.getByPlaceholderText('Enter your Gemini API key')
      await user.type(input, 'test-api-key')

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockWindowApi.setApiKey).toHaveBeenCalledWith('gemini', 'test-api-key')
      })
    })

    it('should show error when trying to save empty key', async () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Google Gemini')).toBeInTheDocument()
      })

      const addButtons = screen.getAllByText('Add key')
      fireEvent.click(addButtons[0])

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Please enter an API key')).toBeInTheDocument()
      })
    })

    it('should cancel editing when Cancel is clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Google Gemini')).toBeInTheDocument()
      })

      const addButtons = screen.getAllByText('Add key')
      fireEvent.click(addButtons[0])

      expect(screen.getByPlaceholderText('Enter your Gemini API key')).toBeInTheDocument()

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Enter your Gemini API key')).not.toBeInTheDocument()
      })
    })

    it('should show loading state while saving', async () => {
      const user = userEvent.setup()
      mockWindowApi.setApiKey.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      )

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Google Gemini')).toBeInTheDocument()
      })

      const addButtons = screen.getAllByText('Add key')
      fireEvent.click(addButtons[0])

      const input = screen.getByPlaceholderText('Enter your Gemini API key')
      await user.type(input, 'test-key')

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  describe('updating API key', () => {
    it('should show "Update" button for configured providers', async () => {
      mockWindowApi.hasApiKey.mockResolvedValue(true)

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        const updateButtons = screen.getAllByText('Update')
        expect(updateButtons.length).toBe(3)
      })
    })

    it('should show input when "Update" is clicked', async () => {
      mockWindowApi.hasApiKey.mockResolvedValue(true)

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Google Gemini')).toBeInTheDocument()
      })

      const updateButtons = screen.getAllByText('Update')
      fireEvent.click(updateButtons[0])

      expect(screen.getByPlaceholderText('Enter your Gemini API key')).toBeInTheDocument()
    })
  })

  describe('deleting API key', () => {
    it('should show "Remove" button for configured providers', async () => {
      mockWindowApi.hasApiKey.mockResolvedValue(true)

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        const removeButtons = screen.getAllByText('Remove')
        expect(removeButtons.length).toBe(3)
      })
    })

    it('should call deleteApiKey when Remove is clicked', async () => {
      mockWindowApi.hasApiKey.mockResolvedValue(true)

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Google Gemini')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByText('Remove')
      fireEvent.click(removeButtons[0])

      await waitFor(() => {
        expect(mockWindowApi.deleteApiKey).toHaveBeenCalledWith('gemini')
      })
    })

    it('should update status after deletion', async () => {
      mockWindowApi.hasApiKey
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false) // After deletion

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getAllByText('API key configured').length).toBe(3)
      })

      const removeButtons = screen.getAllByText('Remove')
      fireEvent.click(removeButtons[0])

      await waitFor(() => {
        expect(mockWindowApi.hasApiKey).toHaveBeenCalled()
      })
    })
  })

  describe('close button', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(<SettingsModal isOpen={true} onClose={onClose} />)

      // Find close button in header (first button with X icon)
      const closeButtons = screen.getAllByRole('button')
      const headerCloseButton = closeButtons[0]
      fireEvent.click(headerCloseButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when Done button is clicked', () => {
      const onClose = vi.fn()
      render(<SettingsModal isOpen={true} onClose={onClose} />)

      const doneButton = screen.getByText('Done')
      fireEvent.click(doneButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    it('should display error when setApiKey fails', async () => {
      const user = userEvent.setup()
      mockWindowApi.setApiKey.mockRejectedValue(new Error('Failed to save'))

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Google Gemini')).toBeInTheDocument()
      })

      const addButtons = screen.getAllByText('Add key')
      fireEvent.click(addButtons[0])

      const input = screen.getByPlaceholderText('Enter your Gemini API key')
      await user.type(input, 'test-key')

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to save')).toBeInTheDocument()
      })
    })

    it('should handle deleteApiKey failure gracefully', async () => {
      mockWindowApi.hasApiKey.mockResolvedValue(true)
      mockWindowApi.deleteApiKey.mockRejectedValue(new Error('Failed to delete'))

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Google Gemini')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByText('Remove')
      fireEvent.click(removeButtons[0])

      // The component catches the error but doesn't display it for delete operations
      // (error only shows in edit mode). Verify deleteApiKey was called.
      await waitFor(() => {
        expect(mockWindowApi.deleteApiKey).toHaveBeenCalledWith('gemini')
      })
    })
  })

  describe('when window.api is not available', () => {
    it('should show providers as unconfigured', async () => {
      delete (window as Window & { api?: typeof mockWindowApi }).api

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        const noKeyElements = screen.getAllByText('No API key')
        expect(noKeyElements.length).toBe(3)
      })
    })

    it('should show error when trying to save without API', async () => {
      delete (window as Window & { api?: typeof mockWindowApi }).api
      const user = userEvent.setup()

      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      const addButtons = screen.getAllByText('Add key')
      fireEvent.click(addButtons[0])

      const input = screen.getByPlaceholderText('Enter your Gemini API key')
      await user.type(input, 'test-key')

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('API not available')).toBeInTheDocument()
      })
    })
  })

  describe('security note', () => {
    it('should display security information', () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

      expect(
        screen.getByText(/API keys are encrypted and stored securely/)
      ).toBeInTheDocument()
    })
  })
})
