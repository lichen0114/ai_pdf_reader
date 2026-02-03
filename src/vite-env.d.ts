/// <reference types="vite/client" />

interface ProviderInfo {
  id: string
  name: string
  type: 'local' | 'cloud'
  available?: boolean
}

interface Window {
  api: {
    askAI: (
      text: string,
      context: string,
      providerId?: string,
      onChunk?: (chunk: string) => void,
      onDone?: () => void,
      onError?: (error: string) => void
    ) => Promise<void>
    getProviders: () => Promise<ProviderInfo[]>
    getCurrentProvider: () => Promise<ProviderInfo | null>
    setCurrentProvider: (providerId: string) => Promise<boolean>
    setApiKey: (providerId: string, apiKey: string) => Promise<boolean>
    hasApiKey: (providerId: string) => Promise<boolean>
    deleteApiKey: (providerId: string) => Promise<boolean>
    readFile: (filePath: string) => Promise<Buffer>
    onFileOpened: (callback: (filePath: string) => void) => () => void
  }
}
