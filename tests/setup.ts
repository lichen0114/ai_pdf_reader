import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

// Setup MSW server for HTTP mocking
export const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' })
})

// Reset handlers and cleanup after each test
afterEach(() => {
  server.resetHandlers()
  cleanup()
  vi.clearAllMocks()
})

// Close server after all tests
afterAll(() => {
  server.close()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
globalThis.ResizeObserver = ResizeObserverMock

// Mock scrollTo
window.scrollTo = vi.fn()

// Mock getSelection for selection tests
const mockSelection = {
  toString: vi.fn(() => ''),
  isCollapsed: true,
  getRangeAt: vi.fn(() => ({
    commonAncestorContainer: document.body,
  })),
  removeAllRanges: vi.fn(),
}
window.getSelection = vi.fn(() => mockSelection as unknown as Selection)

// Mock fetch for Node.js environment (providers use native fetch)
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn()
}

// Export mock selection helper for tests
export { mockSelection }
