import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import { ProviderManager } from './providers/index'
import { KeyStore } from './security/key-store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DIST = path.join(__dirname, '../dist')

let mainWindow: BrowserWindow | null = null
let providerManager: ProviderManager

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'))
  }

  createMenu()
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open PDF',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ['openFile'],
              filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
            })
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('file-opened', result.filePaths[0])
            }
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function setupIPC() {
  providerManager = new ProviderManager()

  // AI Query handler with streaming
  ipcMain.handle('ai:query', async (_event, { text, context, providerId }) => {
    try {
      const provider = providerManager.getProvider(providerId)
      if (!provider) {
        throw new Error(`Provider ${providerId} not found`)
      }

      const available = await provider.isAvailable()
      if (!available) {
        throw new Error(`Provider ${provider.name} is not available`)
      }

      // Return a channel ID for streaming
      const channelId = `ai:stream:${Date.now()}`

      // Start streaming in background
      ;(async () => {
        try {
          const stream = provider.complete({ text, context })
          for await (const chunk of stream) {
            mainWindow?.webContents.send(channelId, { type: 'chunk', data: chunk })
          }
          mainWindow?.webContents.send(channelId, { type: 'done' })
        } catch (err) {
          mainWindow?.webContents.send(channelId, {
            type: 'error',
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      })()

      return { channelId }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Unknown error')
    }
  })

  // Provider status
  ipcMain.handle('provider:list', async () => {
    const providers = providerManager.getAllProviders()
    const statuses = await Promise.all(
      providers.map(async (p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        available: await p.isAvailable(),
      }))
    )
    return statuses
  })

  ipcMain.handle('provider:getCurrent', () => {
    const current = providerManager.getCurrentProvider()
    return current ? { id: current.id, name: current.name, type: current.type } : null
  })

  ipcMain.handle('provider:setCurrent', async (_event, providerId: string) => {
    return providerManager.setCurrentProvider(providerId)
  })

  // API Key management
  ipcMain.handle('keys:set', async (_event, { providerId, apiKey }) => {
    await KeyStore.setKey(providerId, apiKey)
    providerManager.refreshProviders()
    return true
  })

  ipcMain.handle('keys:has', async (_event, providerId: string) => {
    return KeyStore.hasKey(providerId)
  })

  ipcMain.handle('keys:delete', async (_event, providerId: string) => {
    return KeyStore.deleteKey(providerId)
  })

  // File operations
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    const fs = await import('fs/promises')
    const buffer = await fs.readFile(filePath)
    // Convert Buffer to ArrayBuffer for proper IPC serialization with contextIsolation
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  })
}

app.whenReady().then(() => {
  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
