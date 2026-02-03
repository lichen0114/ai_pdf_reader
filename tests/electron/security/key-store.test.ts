import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create mock modules
const mockFs = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}

const mockSafeStorage = {
  isEncryptionAvailable: vi.fn(),
  encryptString: vi.fn(),
  decryptString: vi.fn(),
}

const mockApp = {
  getPath: vi.fn(() => '/mock/userData'),
}

// Mock modules
vi.mock('fs', () => ({
  default: mockFs,
  ...mockFs,
}))

vi.mock('electron', () => ({
  safeStorage: mockSafeStorage,
  app: mockApp,
}))

vi.mock('path', () => ({
  default: {
    join: (...args: string[]) => args.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
  },
  join: (...args: string[]) => args.join('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
}))

describe('KeyStore', () => {
  // Import dynamically to ensure mocks are applied
  let KeyStore: typeof import('@electron/security/key-store').KeyStore

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
    vi.resetModules()

    // Default mock implementations
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
    mockSafeStorage.encryptString.mockImplementation((str: string) =>
      Buffer.from(`encrypted:${str}`)
    )
    mockSafeStorage.decryptString.mockImplementation((buf: Buffer) => {
      const str = buf.toString()
      return str.startsWith('encrypted:') ? str.slice(10) : str
    })
    mockFs.existsSync.mockReturnValue(false)
    mockFs.readFileSync.mockReturnValue('{}')

    // Re-import to get fresh module with reset static state
    const module = await import('@electron/security/key-store')
    KeyStore = module.KeyStore
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('setKey', () => {
    it('should encrypt and save a key when encryption is available', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('{}')

      KeyStore.setKey('openai', 'sk-test-key-123')

      expect(mockSafeStorage.isEncryptionAvailable).toHaveBeenCalled()
      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('sk-test-key-123')
      expect(mockFs.writeFileSync).toHaveBeenCalled()
    })

    it('should store in cache only when encryption is not available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      KeyStore.setKey('openai', 'sk-test-key-123')

      expect(mockSafeStorage.encryptString).not.toHaveBeenCalled()
      expect(mockFs.writeFileSync).not.toHaveBeenCalled()
    })

    it('should create directory if it does not exist', () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('api-keys.encrypted')) return false
        return false
      })

      KeyStore.setKey('gemini', 'test-gemini-key')

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      )
    })
  })

  describe('getKey', () => {
    it('should return cached key if available', () => {
      // Set a key first to populate cache
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
      KeyStore.setKey('openai', 'cached-key')

      const result = KeyStore.getKey('openai')

      expect(result).toBe('cached-key')
    })

    it('should decrypt key from storage if not in cache', () => {
      const encryptedKey = Buffer.from('encrypted:stored-key').toString('base64')
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ openai: encryptedKey }))

      const result = KeyStore.getKey('openai')

      expect(mockSafeStorage.decryptString).toHaveBeenCalled()
      expect(result).toBe('stored-key')
    })

    it('should return null when encryption is not available and key not in cache', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      const result = KeyStore.getKey('nonexistent')

      expect(result).toBeNull()
    })

    it('should return null for non-existent key', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('{}')

      const result = KeyStore.getKey('nonexistent')

      expect(result).toBeNull()
    })

    it('should handle decryption errors gracefully', () => {
      const encryptedKey = Buffer.from('encrypted:test').toString('base64')
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ openai: encryptedKey }))
      mockSafeStorage.decryptString.mockImplementation(() => {
        throw new Error('Decryption failed')
      })

      const result = KeyStore.getKey('openai')

      expect(result).toBeNull()
    })
  })

  describe('hasKey', () => {
    it('should return true if key is in cache', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
      KeyStore.setKey('anthropic', 'cached-key')

      const result = KeyStore.hasKey('anthropic')

      expect(result).toBe(true)
    })

    it('should return true if key exists in storage', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ openai: 'encrypted-data' }))

      const result = KeyStore.hasKey('openai')

      expect(result).toBe(true)
    })

    it('should return false if key does not exist', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('{}')

      const result = KeyStore.hasKey('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('deleteKey', () => {
    it('should remove key from cache and storage', () => {
      // First set a key
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
      KeyStore.setKey('openai', 'to-delete')

      // Mock storage with the key
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ openai: 'encrypted' }))

      const result = KeyStore.deleteKey('openai')

      expect(result).toBe(true)
      expect(mockFs.writeFileSync).toHaveBeenCalled()
    })

    it('should return false if key does not exist', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('{}')

      const result = KeyStore.deleteKey('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('getAllProviderIds', () => {
    it('should return all provider IDs from storage', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          openai: 'encrypted1',
          anthropic: 'encrypted2',
          gemini: 'encrypted3',
        })
      )

      const result = KeyStore.getAllProviderIds()

      expect(result).toEqual(['openai', 'anthropic', 'gemini'])
    })

    it('should return empty array if no keys exist', () => {
      mockFs.existsSync.mockReturnValue(false)

      const result = KeyStore.getAllProviderIds()

      expect(result).toEqual([])
    })
  })
})
