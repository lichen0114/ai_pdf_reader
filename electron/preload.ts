import { contextBridge, ipcRenderer } from 'electron'

export interface ProviderInfo {
  id: string
  name: string
  type: 'local' | 'cloud'
  available?: boolean
}

export interface StreamEvent {
  type: 'chunk' | 'done' | 'error'
  data?: string
  error?: string
}

contextBridge.exposeInMainWorld('api', {
  // AI Operations
  askAI: async (
    text: string,
    context: string,
    providerId?: string,
    onChunk?: (chunk: string) => void,
    onDone?: () => void,
    onError?: (error: string) => void
  ): Promise<void> => {
    const result = await ipcRenderer.invoke('ai:query', { text, context, providerId })
    const { channelId } = result

    return new Promise((resolve, reject) => {
      const handler = (_event: Electron.IpcRendererEvent, msg: StreamEvent) => {
        if (msg.type === 'chunk' && msg.data) {
          onChunk?.(msg.data)
        } else if (msg.type === 'done') {
          ipcRenderer.removeListener(channelId, handler)
          onDone?.()
          resolve()
        } else if (msg.type === 'error') {
          ipcRenderer.removeListener(channelId, handler)
          onError?.(msg.error || 'Unknown error')
          reject(new Error(msg.error))
        }
      }

      ipcRenderer.on(channelId, handler)
    })
  },

  // Provider Operations
  getProviders: (): Promise<ProviderInfo[]> => {
    return ipcRenderer.invoke('provider:list')
  },

  getCurrentProvider: (): Promise<ProviderInfo | null> => {
    return ipcRenderer.invoke('provider:getCurrent')
  },

  setCurrentProvider: (providerId: string): Promise<boolean> => {
    return ipcRenderer.invoke('provider:setCurrent', providerId)
  },

  // API Key Operations
  setApiKey: (providerId: string, apiKey: string): Promise<boolean> => {
    return ipcRenderer.invoke('keys:set', { providerId, apiKey })
  },

  hasApiKey: (providerId: string): Promise<boolean> => {
    return ipcRenderer.invoke('keys:has', providerId)
  },

  deleteApiKey: (providerId: string): Promise<boolean> => {
    return ipcRenderer.invoke('keys:delete', providerId)
  },

  // File Operations
  readFile: (filePath: string): Promise<Buffer> => {
    return ipcRenderer.invoke('file:read', filePath)
  },

  // Event Listeners
  onFileOpened: (callback: (filePath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) => {
      callback(filePath)
    }
    ipcRenderer.on('file-opened', handler)
    return () => ipcRenderer.removeListener('file-opened', handler)
  },
})

// Type declarations for window.api
declare global {
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
}
