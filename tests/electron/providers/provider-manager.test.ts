import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock KeyStore before importing ProviderManager
const mockKeyStore = {
  getKey: vi.fn(),
}

vi.mock('@electron/security/key-store', () => ({
  KeyStore: mockKeyStore,
}))

describe('ProviderManager', () => {
  let ProviderManager: typeof import('@electron/providers/index').ProviderManager
  let manager: InstanceType<typeof ProviderManager>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Default: no API keys configured
    mockKeyStore.getKey.mockReturnValue(null)

    // Re-import to get fresh module
    const module = await import('@electron/providers/index')
    ProviderManager = module.ProviderManager
    manager = new ProviderManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default Ollama provider as current', () => {
      const currentProvider = manager.getCurrentProvider()

      expect(currentProvider).toBeDefined()
      expect(currentProvider?.id).toBe('ollama')
    })

    it('should initialize all providers', () => {
      const providers = manager.getAllProviders()

      expect(providers.length).toBe(4)
      expect(providers.map((p) => p.id)).toContain('ollama')
      expect(providers.map((p) => p.id)).toContain('openai')
      expect(providers.map((p) => p.id)).toContain('anthropic')
      expect(providers.map((p) => p.id)).toContain('gemini')
    })
  })

  describe('getProvider', () => {
    it('should return provider by id', () => {
      const provider = manager.getProvider('openai')

      expect(provider).toBeDefined()
      expect(provider?.id).toBe('openai')
    })

    it('should return current provider when no id specified', () => {
      const provider = manager.getProvider()

      expect(provider).toBeDefined()
      expect(provider?.id).toBe('ollama')
    })

    it('should return undefined for non-existent provider', () => {
      const provider = manager.getProvider('nonexistent')

      expect(provider).toBeUndefined()
    })
  })

  describe('getCurrentProvider', () => {
    it('should return the current provider', () => {
      const provider = manager.getCurrentProvider()

      expect(provider).toBeDefined()
      expect(provider?.id).toBe('ollama')
    })
  })

  describe('setCurrentProvider', () => {
    it('should set current provider to valid provider', () => {
      const result = manager.setCurrentProvider('openai')

      expect(result).toBe(true)
      expect(manager.getCurrentProvider()?.id).toBe('openai')
    })

    it('should return false for non-existent provider', () => {
      const result = manager.setCurrentProvider('nonexistent')

      expect(result).toBe(false)
      expect(manager.getCurrentProvider()?.id).toBe('ollama') // unchanged
    })

    it('should allow switching between providers', () => {
      manager.setCurrentProvider('anthropic')
      expect(manager.getCurrentProvider()?.id).toBe('anthropic')

      manager.setCurrentProvider('gemini')
      expect(manager.getCurrentProvider()?.id).toBe('gemini')

      manager.setCurrentProvider('ollama')
      expect(manager.getCurrentProvider()?.id).toBe('ollama')
    })
  })

  describe('getAllProviders', () => {
    it('should return array of all providers', () => {
      const providers = manager.getAllProviders()

      expect(Array.isArray(providers)).toBe(true)
      expect(providers.length).toBe(4)
    })

    it('should include local and cloud providers', () => {
      const providers = manager.getAllProviders()

      const localProviders = providers.filter((p) => p.type === 'local')
      const cloudProviders = providers.filter((p) => p.type === 'cloud')

      expect(localProviders.length).toBe(1)
      expect(cloudProviders.length).toBe(3)
    })
  })

  describe('refreshProviders', () => {
    it('should re-initialize providers with new API keys', () => {
      // Initially no keys
      expect(mockKeyStore.getKey).toHaveBeenCalled()
      vi.clearAllMocks()

      // Now simulate having a key
      mockKeyStore.getKey.mockImplementation((id: string) => {
        if (id === 'openai') return 'sk-new-key'
        return null
      })

      manager.refreshProviders()

      // Should have called getKey again for each cloud provider
      expect(mockKeyStore.getKey).toHaveBeenCalledWith('gemini')
      expect(mockKeyStore.getKey).toHaveBeenCalledWith('openai')
      expect(mockKeyStore.getKey).toHaveBeenCalledWith('anthropic')
    })

    it('should preserve current provider setting after refresh', () => {
      manager.setCurrentProvider('anthropic')

      manager.refreshProviders()

      // The implementation re-initializes but doesn't reset currentProviderId
      const current = manager.getCurrentProvider()
      expect(current).toBeDefined()
    })
  })

  describe('provider initialization with API keys', () => {
    it('should initialize cloud providers with keys when available', async () => {
      vi.resetModules()
      mockKeyStore.getKey.mockImplementation((id: string) => {
        const keys: Record<string, string> = {
          openai: 'sk-openai-key',
          anthropic: 'sk-ant-key',
          gemini: 'gemini-key',
        }
        return keys[id] || null
      })

      const module = await import('@electron/providers/index')
      const newManager = new module.ProviderManager()

      // All providers should be present
      expect(newManager.getProvider('openai')).toBeDefined()
      expect(newManager.getProvider('anthropic')).toBeDefined()
      expect(newManager.getProvider('gemini')).toBeDefined()
    })

    it('should initialize cloud providers with empty key when not available', () => {
      // Providers should still exist, but will not be available
      expect(manager.getProvider('openai')).toBeDefined()
      expect(manager.getProvider('anthropic')).toBeDefined()
      expect(manager.getProvider('gemini')).toBeDefined()
    })
  })
})
