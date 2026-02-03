import { vi } from 'vitest'

// Mock fs module
export const mockFs = {
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}

// Mock path module
export const mockPath = {
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
}

// Mock Electron safeStorage
export const mockSafeStorage = {
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((str: string) => Buffer.from(`encrypted:${str}`)),
  decryptString: vi.fn((buf: Buffer) => {
    const str = buf.toString()
    return str.startsWith('encrypted:') ? str.slice(10) : str
  }),
}

// Mock Electron app
export const mockApp = {
  getPath: vi.fn(() => '/mock/userData'),
}

// Setup Electron mocks
export function setupElectronMocks() {
  vi.mock('electron', () => ({
    safeStorage: mockSafeStorage,
    app: mockApp,
  }))

  vi.mock('fs', () => mockFs)
  vi.mock('path', () => mockPath)
}

// Reset all mocks
export function resetElectronMocks() {
  mockFs.existsSync.mockClear()
  mockFs.readFileSync.mockClear()
  mockFs.writeFileSync.mockClear()
  mockFs.mkdirSync.mockClear()
  mockPath.join.mockClear()
  mockPath.dirname.mockClear()
  mockSafeStorage.isEncryptionAvailable.mockClear()
  mockSafeStorage.encryptString.mockClear()
  mockSafeStorage.decryptString.mockClear()
  mockApp.getPath.mockClear()
}
