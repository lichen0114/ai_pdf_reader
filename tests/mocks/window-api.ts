import { vi } from 'vitest'

export interface MockProviderInfo {
  id: string
  name: string
  type: 'local' | 'cloud'
  available?: boolean
}

// Default mock providers
export const mockProviders: MockProviderInfo[] = [
  { id: 'ollama', name: 'Ollama (Local)', type: 'local', available: true },
  { id: 'openai', name: 'OpenAI', type: 'cloud', available: false },
  { id: 'anthropic', name: 'Claude', type: 'cloud', available: false },
  { id: 'gemini', name: 'Gemini', type: 'cloud', available: false },
]

// Create mock window.api
export function createMockWindowApi() {
  return {
    askAI: vi.fn(
      async (
        _text: string,
        _context: string,
        _providerId?: string,
        onChunk?: (chunk: string) => void,
        onDone?: () => void,
        _onError?: (error: string) => void
      ) => {
        // Simulate streaming response
        if (onChunk) {
          onChunk('This is ')
          onChunk('a test ')
          onChunk('response.')
        }
        if (onDone) {
          onDone()
        }
      }
    ),
    getProviders: vi.fn(async () => mockProviders),
    getCurrentProvider: vi.fn(async () => mockProviders[0]),
    setCurrentProvider: vi.fn(async () => true),
    setApiKey: vi.fn(async () => true),
    hasApiKey: vi.fn(async () => false),
    deleteApiKey: vi.fn(async () => true),
    readFile: vi.fn(async () => new ArrayBuffer(0)),
    getFilePath: vi.fn((file: { name: string }) => `/mock/path/${file.name}`),
    onFileOpened: vi.fn(() => () => {}),
  }
}

// Setup window.api mock
export function setupWindowApiMock(customApi?: ReturnType<typeof createMockWindowApi>) {
  const api = customApi || createMockWindowApi()
  ;(globalThis as typeof globalThis & { window: { api: typeof api } }).window = {
    ...globalThis.window,
    api,
  }
  return api
}

// Reset window.api mock
export function resetWindowApiMock() {
  const api = createMockWindowApi()
  setupWindowApiMock(api)
  return api
}
