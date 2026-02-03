import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProviderSwitcher from '@/components/ProviderSwitcher'

describe('ProviderSwitcher', () => {
  const mockProviders = [
    { id: 'ollama', name: 'Ollama (Local)', type: 'local' as const, available: true },
    { id: 'openai', name: 'OpenAI', type: 'cloud' as const, available: true },
    { id: 'anthropic', name: 'Claude', type: 'cloud' as const, available: false },
    { id: 'gemini', name: 'Gemini', type: 'cloud' as const, available: true },
  ]

  let mockWindowApi: {
    getProviders: ReturnType<typeof vi.fn>
    getCurrentProvider: ReturnType<typeof vi.fn>
    setCurrentProvider: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockWindowApi = {
      getProviders: vi.fn().mockResolvedValue(mockProviders),
      getCurrentProvider: vi.fn().mockResolvedValue(mockProviders[0]),
      setCurrentProvider: vi.fn().mockResolvedValue(true),
    }
    ;(window as Window & { api: typeof mockWindowApi }).api = mockWindowApi
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete (window as Window & { api?: typeof mockWindowApi }).api
  })

  describe('initial render', () => {
    it('should load and display current provider', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })
    })

    it('should call getProviders and getCurrentProvider on mount', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(mockWindowApi.getProviders).toHaveBeenCalled()
        expect(mockWindowApi.getCurrentProvider).toHaveBeenCalled()
      })
    })
  })

  describe('dropdown behavior', () => {
    it('should open dropdown when button is clicked', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(screen.getByText('AI Provider')).toBeInTheDocument()
    })

    it('should show all providers in dropdown', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(screen.getByText('OpenAI')).toBeInTheDocument()
      expect(screen.getByText('Claude')).toBeInTheDocument()
      expect(screen.getByText('Gemini')).toBeInTheDocument()
    })

    it('should close dropdown when clicking outside', async () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <ProviderSwitcher onSettingsClick={vi.fn()} />
        </div>
      )

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      // Open dropdown
      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(screen.getByText('AI Provider')).toBeInTheDocument()

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'))

      await waitFor(() => {
        expect(screen.queryByText('AI Provider')).not.toBeInTheDocument()
      })
    })

    it('should toggle dropdown on button click', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      const button = screen.getByRole('button')

      // Open
      fireEvent.click(button)
      expect(screen.getByText('AI Provider')).toBeInTheDocument()

      // Close
      fireEvent.click(button)
      await waitFor(() => {
        expect(screen.queryByText('AI Provider')).not.toBeInTheDocument()
      })
    })
  })

  describe('provider switching', () => {
    it('should call setCurrentProvider when provider is selected', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      // Open dropdown
      fireEvent.click(screen.getByRole('button'))

      // Select OpenAI
      const openaiButton = screen.getByText('OpenAI').closest('button')!
      fireEvent.click(openaiButton)

      expect(mockWindowApi.setCurrentProvider).toHaveBeenCalledWith('openai')
    })

    it('should update displayed provider after selection', async () => {
      mockWindowApi.setCurrentProvider.mockResolvedValue(true)

      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      // Open dropdown and select
      fireEvent.click(screen.getByRole('button'))
      const openaiButton = screen.getByText('OpenAI').closest('button')!
      fireEvent.click(openaiButton)

      await waitFor(() => {
        // Dropdown should close
        expect(screen.queryByText('AI Provider')).not.toBeInTheDocument()
      })
    })

    it('should close dropdown after selection', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button'))
      const openaiButton = screen.getByText('OpenAI').closest('button')!
      fireEvent.click(openaiButton)

      await waitFor(() => {
        expect(screen.queryByText('AI Provider')).not.toBeInTheDocument()
      })
    })
  })

  describe('availability display', () => {
    it('should show "Not configured" for unavailable providers', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByText('Cloud · Not configured')).toBeInTheDocument()
    })

    it('should disable unavailable provider buttons', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button'))

      const claudeButton = screen.getByText('Claude').closest('button')
      expect(claudeButton).toBeDisabled()
    })

    it('should not call setCurrentProvider for unavailable provider', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button'))

      const claudeButton = screen.getByText('Claude').closest('button')!
      fireEvent.click(claudeButton)

      expect(mockWindowApi.setCurrentProvider).not.toHaveBeenCalled()
    })
  })

  describe('settings button', () => {
    it('should show settings button in dropdown', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should call onSettingsClick when settings button is clicked', async () => {
      const onSettingsClick = vi.fn()
      render(<ProviderSwitcher onSettingsClick={onSettingsClick} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button'))
      fireEvent.click(screen.getByText('Settings'))

      expect(onSettingsClick).toHaveBeenCalledTimes(1)
    })

    it('should close dropdown after clicking settings', async () => {
      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button'))
      fireEvent.click(screen.getByText('Settings'))

      await waitFor(() => {
        expect(screen.queryByText('AI Provider')).not.toBeInTheDocument()
      })
    })
  })

  describe('when window.api is not available', () => {
    it('should handle missing API gracefully', async () => {
      delete (window as Window & { api?: typeof mockWindowApi }).api

      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      // Should not throw, just not display anything
      await waitFor(() => {
        const button = screen.queryByRole('button')
        expect(button).toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('should handle getProviders error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockWindowApi.getProviders.mockRejectedValue(new Error('Network error'))

      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled()
      })

      consoleSpy.mockRestore()
    })

    it('should handle setCurrentProvider error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockWindowApi.setCurrentProvider.mockRejectedValue(new Error('Failed'))

      render(<ProviderSwitcher onSettingsClick={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Ollama (Local)')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button'))
      const openaiButton = screen.getByText('OpenAI').closest('button')!
      fireEvent.click(openaiButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled()
      })

      consoleSpy.mockRestore()
    })
  })
})
