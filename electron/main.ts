import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import { ProviderManager } from './providers/index'
import { KeyStore } from './security/key-store'
import { getDatabase, closeDatabase } from './database/index'
import { verifyAndRepairSchema } from './database/migrations'
import * as documentsDb from './database/queries/documents'
import * as interactionsDb from './database/queries/interactions'
import * as conceptsDb from './database/queries/concepts'
import * as reviewsDb from './database/queries/reviews'
import * as highlightsDb from './database/queries/highlights'
import * as bookmarksDb from './database/queries/bookmarks'
import * as conversationsDb from './database/queries/conversations'
import * as searchDb from './database/queries/search'
import * as workspacesDb from './database/queries/workspaces'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DIST = path.join(__dirname, '../dist')

let mainWindow: BrowserWindow | null = null
let providerManager: ProviderManager

// Provider availability cache with TTL
const providerAvailabilityCache = new Map<string, { available: boolean; timestamp: number }>()
const AVAILABILITY_CACHE_TTL = 30000 // 30 seconds

// Stream management for cancellation support
const activeStreams = new Map<string, AbortController>()

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
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            mainWindow?.webContents.send('tab:close-current')
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

  // AI Query handler with streaming, buffering, and cancellation support
  ipcMain.handle('ai:query', async (_event, { text, context, providerId, action, conversationHistory }) => {
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

      // Create abort controller for cancellation
      const abortController = new AbortController()
      activeStreams.set(channelId, abortController)

      // Start streaming in background with IPC chunk buffering
      ;(async () => {
        try {
          const stream = provider.complete({ text, context, action, conversationHistory })

          // Buffer chunks for 50ms or 500 chars before flushing to reduce IPC overhead
          let buffer = ''
          let lastFlush = Date.now()
          const BUFFER_SIZE = 500
          const BUFFER_TIME = 50

          const flush = () => {
            if (buffer.length > 0) {
              mainWindow?.webContents.send(channelId, { type: 'chunk', data: buffer })
              buffer = ''
              lastFlush = Date.now()
            }
          }

          for await (const chunk of stream) {
            // Check for cancellation
            if (abortController.signal.aborted) {
              break
            }

            buffer += chunk

            // Flush if buffer is large enough or enough time has passed
            if (buffer.length >= BUFFER_SIZE || Date.now() - lastFlush >= BUFFER_TIME) {
              flush()
            }
          }

          // Flush any remaining content
          flush()

          if (!abortController.signal.aborted) {
            mainWindow?.webContents.send(channelId, { type: 'done' })
          }
        } catch (err) {
          if (!abortController.signal.aborted) {
            mainWindow?.webContents.send(channelId, {
              type: 'error',
              error: err instanceof Error ? err.message : 'Unknown error'
            })
          }
        } finally {
          activeStreams.delete(channelId)
        }
      })()

      return { channelId }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Unknown error')
    }
  })

  // Cancel streaming request
  ipcMain.handle('ai:cancel', async (_event, channelId: string) => {
    const controller = activeStreams.get(channelId)
    if (controller) {
      controller.abort()
      activeStreams.delete(channelId)
      return true
    }
    return false
  })

  // Provider status with availability caching
  ipcMain.handle('provider:list', async () => {
    const providers = providerManager.getAllProviders()
    const now = Date.now()

    const statuses = await Promise.all(
      providers.map(async (p) => {
        // Check cache first
        const cached = providerAvailabilityCache.get(p.id)
        if (cached && now - cached.timestamp < AVAILABILITY_CACHE_TTL) {
          return {
            id: p.id,
            name: p.name,
            type: p.type,
            available: cached.available,
          }
        }

        // Cache miss - check availability
        const available = await p.isAvailable()
        providerAvailabilityCache.set(p.id, { available, timestamp: now })

        return {
          id: p.id,
          name: p.name,
          type: p.type,
          available,
        }
      })
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
    // Invalidate availability cache for this provider
    providerAvailabilityCache.delete(providerId)
    return true
  })

  ipcMain.handle('keys:has', async (_event, providerId: string) => {
    return KeyStore.hasKey(providerId)
  })

  ipcMain.handle('keys:delete', async (_event, providerId: string) => {
    return KeyStore.deleteKey(providerId)
  })

  // File operations (with error handling)
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      const fs = await import('fs/promises')
      const buffer = await fs.readFile(filePath)
      // Convert Buffer to ArrayBuffer for proper IPC serialization with contextIsolation
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } catch (error) {
      console.error('Failed to read file:', error)
      throw error instanceof Error ? error : new Error('Failed to read file')
    }
  })

  ipcMain.handle('file:openDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // Database operations - Documents
  ipcMain.handle('db:documents:recent', (_event, limit = 3) => {
    return documentsDb.getRecentDocuments(limit)
  })

  ipcMain.handle('db:documents:getOrCreate', (_event, data: { filename: string; filepath: string; total_pages?: number }) => {
    return documentsDb.getOrCreateDocument(data)
  })

  ipcMain.handle('db:documents:update', (_event, data: { id: string; scroll_position?: number; total_pages?: number }) => {
    return documentsDb.updateDocument(data)
  })

  ipcMain.handle('db:documents:getById', (_event, id: string) => {
    return documentsDb.getDocumentById(id)
  })

  // Database operations - Interactions
  ipcMain.handle('db:interactions:save', (_event, data: interactionsDb.InteractionCreateInput) => {
    return interactionsDb.saveInteraction(data)
  })

  ipcMain.handle('db:interactions:byDocument', (_event, documentId: string) => {
    return interactionsDb.getInteractionsByDocument(documentId)
  })

  ipcMain.handle('db:interactions:recent', (_event, limit = 50) => {
    return interactionsDb.getRecentInteractions(limit)
  })

  ipcMain.handle('db:interactions:activityByDay', (_event, days = 90) => {
    return interactionsDb.getActivityByDay(days)
  })

  ipcMain.handle('db:interactions:documentStats', () => {
    return interactionsDb.getDocumentActivityStats()
  })

  // Database operations - Concepts
  ipcMain.handle('db:concepts:graph', () => {
    return conceptsDb.getConceptGraph()
  })

  ipcMain.handle('db:concepts:save', (_event, data: { conceptNames: string[]; interactionId: string; documentId: string }) => {
    return conceptsDb.saveConceptsForInteraction(data.conceptNames, data.interactionId, data.documentId)
  })

  ipcMain.handle('db:concepts:forDocument', (_event, documentId: string) => {
    return conceptsDb.getConceptsForDocument(documentId)
  })

  ipcMain.handle('db:concepts:documentsForConcept', (_event, conceptId: string) => {
    return conceptsDb.getDocumentsForConcept(conceptId)
  })

  // Database operations - Reviews
  ipcMain.handle('db:review:next', () => {
    return reviewsDb.getNextReviewCard()
  })

  ipcMain.handle('db:review:update', (_event, data: { cardId: string; quality: number }) => {
    return reviewsDb.updateReviewCard(data.cardId, data.quality)
  })

  ipcMain.handle('db:review:create', (_event, data: { interaction_id: string; question: string; answer: string }) => {
    return reviewsDb.createReviewCard(data)
  })

  ipcMain.handle('db:review:dueCount', () => {
    return reviewsDb.getDueReviewCount()
  })

  ipcMain.handle('db:review:all', () => {
    return reviewsDb.getAllReviewCards()
  })

  // Database operations - Highlights
  ipcMain.handle('db:highlights:create', (_event, data: highlightsDb.HighlightCreateInput) => {
    return highlightsDb.createHighlight(data)
  })

  ipcMain.handle('db:highlights:update', (_event, data: highlightsDb.HighlightUpdateInput) => {
    return highlightsDb.updateHighlight(data)
  })

  ipcMain.handle('db:highlights:delete', (_event, id: string) => {
    return highlightsDb.deleteHighlight(id)
  })

  ipcMain.handle('db:highlights:byDocument', (_event, documentId: string) => {
    return highlightsDb.getHighlightsByDocument(documentId)
  })

  ipcMain.handle('db:highlights:byPage', (_event, { documentId, pageNumber }: { documentId: string; pageNumber: number }) => {
    return highlightsDb.getHighlightsByPage(documentId, pageNumber)
  })

  ipcMain.handle('db:highlights:withNotes', (_event, documentId: string) => {
    return highlightsDb.getHighlightsWithNotes(documentId)
  })

  // Database operations - Bookmarks
  ipcMain.handle('db:bookmarks:toggle', (_event, data: bookmarksDb.BookmarkCreateInput) => {
    return bookmarksDb.toggleBookmark(data)
  })

  ipcMain.handle('db:bookmarks:updateLabel', (_event, { id, label }: { id: string; label: string | null }) => {
    return bookmarksDb.updateBookmarkLabel(id, label)
  })

  ipcMain.handle('db:bookmarks:delete', (_event, id: string) => {
    return bookmarksDb.deleteBookmark(id)
  })

  ipcMain.handle('db:bookmarks:byDocument', (_event, documentId: string) => {
    return bookmarksDb.getBookmarksByDocument(documentId)
  })

  ipcMain.handle('db:bookmarks:isPageBookmarked', (_event, { documentId, pageNumber }: { documentId: string; pageNumber: number }) => {
    return bookmarksDb.isPageBookmarked(documentId, pageNumber)
  })

  // Database operations - Conversations
  ipcMain.handle('db:conversations:create', (_event, data: conversationsDb.ConversationCreateInput) => {
    return conversationsDb.createConversation(data)
  })

  ipcMain.handle('db:conversations:addMessage', (_event, { conversationId, role, content, actionType }: { conversationId: string; role: 'user' | 'assistant'; content: string; actionType?: string }) => {
    return conversationsDb.addMessage(conversationId, role, content, actionType)
  })

  ipcMain.handle('db:conversations:updateTitle', (_event, { id, title }: { id: string; title: string }) => {
    return conversationsDb.updateConversationTitle(id, title)
  })

  ipcMain.handle('db:conversations:delete', (_event, id: string) => {
    return conversationsDb.deleteConversation(id)
  })

  ipcMain.handle('db:conversations:byDocument', (_event, documentId: string) => {
    return conversationsDb.getConversationsByDocument(documentId)
  })

  ipcMain.handle('db:conversations:getWithMessages', (_event, id: string) => {
    return conversationsDb.getConversationWithMessages(id)
  })

  ipcMain.handle('db:conversations:recent', (_event, limit = 10) => {
    return conversationsDb.getRecentConversations(limit)
  })

  ipcMain.handle('db:conversations:messages', (_event, conversationId: string) => {
    return conversationsDb.getConversationMessages(conversationId)
  })

  // Search operations (with error handling)
  ipcMain.handle('search:documents', async (_event, { query, limit }: { query: string; limit?: number }) => {
    try {
      return await searchDb.searchDocuments(query, limit)
    } catch (error) {
      console.error('Search documents failed:', error)
      return []
    }
  })

  ipcMain.handle('search:interactions', async (_event, { query, limit }: { query: string; limit?: number }) => {
    try {
      return await searchDb.searchInteractions(query, limit)
    } catch (error) {
      console.error('Search interactions failed:', error)
      return []
    }
  })

  ipcMain.handle('search:concepts', async (_event, { query, limit }: { query: string; limit?: number }) => {
    try {
      return await searchDb.searchConcepts(query, limit)
    } catch (error) {
      console.error('Search concepts failed:', error)
      return []
    }
  })

  ipcMain.handle('search:all', async (_event, { query, limitPerType }: { query: string; limitPerType?: number }) => {
    try {
      return await searchDb.searchAll(query, limitPerType)
    } catch (error) {
      console.error('Search all failed:', error)
      return { documents: [], interactions: [], concepts: [] }
    }
  })

  ipcMain.handle('search:interactionsInDocument', async (_event, { documentId, query, limit }: { documentId: string; query: string; limit?: number }) => {
    try {
      return await searchDb.searchInteractionsInDocument(documentId, query, limit)
    } catch (error) {
      console.error('Search interactions in document failed:', error)
      return []
    }
  })

  // Database operations - Workspaces
  ipcMain.handle('db:workspaces:create', (_event, { name, description }: { name: string; description?: string }) => {
    return workspacesDb.createWorkspace(name, description)
  })

  ipcMain.handle('db:workspaces:list', () => {
    return workspacesDb.getWorkspacesWithDocumentCount()
  })

  ipcMain.handle('db:workspaces:get', (_event, id: string) => {
    return workspacesDb.getWorkspace(id)
  })

  ipcMain.handle('db:workspaces:update', (_event, { id, name, description }: { id: string; name?: string; description?: string }) => {
    return workspacesDb.updateWorkspace(id, { name, description })
  })

  ipcMain.handle('db:workspaces:delete', (_event, id: string) => {
    return workspacesDb.deleteWorkspace(id)
  })

  ipcMain.handle('db:workspaces:addDocument', (_event, { workspaceId, documentId }: { workspaceId: string; documentId: string }) => {
    return workspacesDb.addDocumentToWorkspace(workspaceId, documentId)
  })

  ipcMain.handle('db:workspaces:removeDocument', (_event, { workspaceId, documentId }: { workspaceId: string; documentId: string }) => {
    return workspacesDb.removeDocumentFromWorkspace(workspaceId, documentId)
  })

  ipcMain.handle('db:workspaces:getDocuments', (_event, workspaceId: string) => {
    return workspacesDb.getWorkspaceDocuments(workspaceId)
  })

  ipcMain.handle('db:workspaces:getForDocument', (_event, documentId: string) => {
    return workspacesDb.getDocumentWorkspaces(documentId)
  })

  ipcMain.handle('db:workspaces:isDocumentInWorkspace', (_event, { workspaceId, documentId }: { workspaceId: string; documentId: string }) => {
    return workspacesDb.isDocumentInWorkspace(workspaceId, documentId)
  })

  // Conversation sources for multi-document chat
  ipcMain.handle('db:conversationSources:add', (_event, { conversationId, documentId, quotedText, pageNumber }: { conversationId: string; documentId: string; quotedText?: string; pageNumber?: number }) => {
    return workspacesDb.addConversationSource(conversationId, documentId, quotedText, pageNumber)
  })

  ipcMain.handle('db:conversationSources:remove', (_event, id: string) => {
    return workspacesDb.removeConversationSource(id)
  })

  ipcMain.handle('db:conversationSources:removeByDocument', (_event, { conversationId, documentId }: { conversationId: string; documentId: string }) => {
    return workspacesDb.removeConversationSourceByDocument(conversationId, documentId)
  })

  ipcMain.handle('db:conversationSources:get', (_event, conversationId: string) => {
    return workspacesDb.getConversationSources(conversationId)
  })

  ipcMain.handle('db:conversations:setWorkspace', (_event, { conversationId, workspaceId }: { conversationId: string; workspaceId: string | null }) => {
    return workspacesDb.setConversationWorkspace(conversationId, workspaceId)
  })

  ipcMain.handle('db:workspaces:getConversations', (_event, workspaceId: string) => {
    return workspacesDb.getWorkspaceConversations(workspaceId)
  })

  // Concept extraction using current AI provider
  ipcMain.handle('db:concepts:extract', async (_event, { text, response }: { text: string; response: string }) => {
    try {
      const provider = providerManager.getCurrentProvider()
      if (!provider) {
        return []
      }

      const available = await provider.isAvailable()
      if (!available) {
        return []
      }

      const prompt = `Extract 3-5 key concepts/terms from the following text selection and AI response. Return ONLY a JSON array of strings with the concept names, nothing else. Example: ["concept1", "concept2", "concept3"]

Text selection:
"${text}"

AI Response:
"${response.slice(0, 500)}"`

      let result = ''
      for await (const chunk of provider.complete({ text: prompt })) {
        result += chunk
      }

      // Parse the JSON array from the response
      const match = result.match(/\[[\s\S]*?\]/)
      if (match) {
        const concepts = JSON.parse(match[0]) as string[]
        return concepts.filter(c => typeof c === 'string' && c.length > 0)
      }

      return []
    } catch (error) {
      console.error('Error extracting concepts:', error)
      return []
    }
  })
}

app.whenReady().then(() => {
  // Initialize database
  const database = getDatabase()
  verifyAndRepairSchema(database)

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

app.on('will-quit', () => {
  closeDatabase()
})
