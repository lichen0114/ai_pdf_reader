# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev        # Start Vite dev server with Electron (hot reload enabled)
npm run build      # Full build: tsc + vite build + electron-builder
npm run typecheck  # TypeScript validation without emitting files
npm run preview    # Preview production build
```

## Test Commands

```bash
npm test                              # Run tests in watch mode
npm run test:run                      # Single test run
npm run test:coverage                 # Run tests with coverage report
npx vitest run tests/path/to/file    # Run a specific test file
npx vitest run -t "test name"        # Run tests matching a pattern
```

Tests use Vitest with jsdom environment (default) or node environment for database tests. Test files are in `tests/` mirroring the source structure. MSW is used for mocking HTTP requests to AI provider APIs.

**Test Infrastructure**:
- `tests/mocks/database.ts` - In-memory SQLite utilities (`createTestDatabase()`, `seedTestData()`)
- `tests/mocks/window-api.ts` - Mock `window.api` IPC methods for renderer tests
- Database query tests require `@vitest-environment node` directive at file top

**Known Pre-existing Test Failures**:
- Provider tests (gemini, openai, anthropic, ollama) fail due to MSW setup issue — `server` imported from `tests/setup.ts` is only initialized in jsdom, but provider tests run in jsdom where MSW has configuration mismatches with the provider URLs
- Migration test expects schema version 2 but schema is at version 3
- Key-store tests use `vi.resetModules()` for fresh static state on each test — necessary because `KeyStore` has static cache

## Architecture

ActivePaper is an Electron + React desktop app that lets users select text in PDFs and get AI-powered explanations via multiple providers. It includes a metacognitive "ActivePaper Dashboard" for tracking learning activity and STEM-focused tools for interactive exploration.

### Process Model

- **Main process** (`electron/`): Window management, IPC handlers, AI provider orchestration, secure key storage, SQLite database, auto-updater
- **Renderer process** (`src/`): React UI with PDF viewing, response display, and dashboard
- **Preload script** (`electron/preload.ts`): Context-isolated IPC bridge exposing `window.api`

### Data Flow

1. User selects text in `PDFViewer` → `useSelection` hook captures text + page context + selection position
2. User clicks action in floating toolbar (Explain/Summarize/Define) or presses Cmd+J → `useAI` hook calls `window.api.askAI()` with action type
3. IPC to main process → `ProviderManager` routes to selected AI provider with action-specific prompts
4. Provider streams response via AsyncIterable → chunks buffered (50ms/500 chars) → sent via dynamic IPC channel → preload listener with 90s cleanup timeout
5. `ResponsePanel` (right sidebar) renders streamed markdown in real-time
6. Interaction saved to SQLite database → concepts extracted via AI → review card created for 'explain' actions
7. User can send follow-up questions → conversation history is passed to provider for context

### AI Provider System

Providers in `electron/providers/` implement the `AIProvider` interface:

```typescript
type ActionType = 'explain' | 'summarize' | 'define'

interface CompletionRequest {
  text: string
  context?: string
  action?: ActionType
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

interface AIProvider {
  id: string
  name: string
  type: 'local' | 'cloud'
  complete(request: CompletionRequest): AsyncIterable<string>  // Streaming via async generator
  isAvailable(): Promise<boolean>
}
```

Current providers: `ollama` (local), `gemini`, `openai`, `anthropic` (cloud).

To add a new provider: implement the interface with an async generator `complete()` method, then register in `ProviderManager.initializeProviders()`. Call `refreshProviders()` after API key changes to reinitialize providers with new keys. Each provider should implement action-specific prompt templates in a `buildUserMessage()` or similar method.

**AI stream safety**: Streams have a 60s inactivity timeout, 2MB max response size cap, and preload IPC listeners auto-cleanup after 90s. Active streams are cancelled on app quit via `AbortController`.

### Database Layer

SQLite database (`activepaper.db` in userData) via better-sqlite3 with WAL mode for concurrent read/write performance:

- **`electron/database/index.ts`** - Connection management (singleton pattern), WAL mode, foreign keys
- **`electron/database/migrations.ts`** - Schema versioning and migrations
- **`electron/database/queries/`** - Query modules:
  - `documents.ts` - Document tracking (filepath, scroll position, pages)
  - `interactions.ts` - AI query history with activity statistics
  - `concepts.ts` - Extracted concepts with graph relationships
  - `reviews.ts` - SM-2 spaced repetition algorithm
  - `highlights.ts` - Text highlights with colors and notes
  - `bookmarks.ts` - Page-level bookmarks
  - `conversations.ts` - Persistent AI conversation threads
  - `search.ts` - FTS5 full-text search across documents, interactions, concepts
  - `workspaces.ts` - Workspace management for multi-document chat

Schema relationships: documents → interactions → concepts (via junction tables), interactions → review_cards, documents → highlights, documents → conversations → conversation_messages, workspaces → workspace_documents → documents, conversations → conversation_sources → documents

### Security

- **API key encryption**: Keys encrypted via Electron's `safeStorage` API (`electron/security/key-store.ts`). `KeyStore.setKey()` throws if encryption is unavailable — it does NOT fall back to plaintext.
- **Context isolation**: Renderer only accesses main process through preload bridge
- **File read validation**: `file:read` IPC handler validates `.pdf` extension and normalizes path to prevent arbitrary file reads
- **Gemini API key**: Sent via `x-goog-api-key` HTTP header (not URL query parameter)
- **Equation evaluation**: Uses `mathjs.evaluate()` (sandboxed) instead of `new Function()` in `useEquationEngine.ts`
- **DevTools**: Only opened in development (`!app.isPackaged` guard)
- **CSP**: Configured in `index.html` — `connect-src` narrowed to `localhost:11434` (Ollama), specific cloud API domains, and CDN
- **Electron fuses**: `scripts/fuses.js` disables `RunAsNode`, `NodeOptions`, CLI inspect, and enforces ASAR-only loading (applied post-build)

### Key IPC Channels

- `ai:query` - Start streaming AI query (returns `channelId` for streaming responses)
- `ai:cancel` - Cancel an ongoing stream by channelId
- `provider:list/getCurrent/setCurrent` - Provider management (list uses 30s availability cache)
- `keys:set/has/delete` - API key management
- `file:read` - Read file from disk (returns `ArrayBuffer`, not `Buffer`; validates `.pdf` extension)
- `app:info` - Returns `{ version, dataPath }`
- `data:export` - Export all data as JSON (shows save dialog)
- `data:backup` - Backup SQLite database file (shows save dialog)
- `db:documents:*` - Document CRUD operations
- `db:interactions:*` - Interaction storage and statistics
- `db:concepts:*` - Concept graph and extraction
- `db:review:*` - Spaced repetition card management
- `db:highlights:*` - Highlight CRUD (create, update, delete, byDocument, byPage)
- `db:bookmarks:*` - Bookmark toggle and listing
- `db:conversations:*` - Conversation threads with messages
- `db:workspaces:*` - Workspace CRUD and document membership
- `db:conversationSources:*` - Multi-document conversation sources
- `search:*` - Full-text search (documents, interactions, concepts, all)

### UI Layout

The app has three main views toggled via the title bar:

**Dashboard View** (`ActivePaperDashboard`):
- 70/30 grid layout
- Left: Context Priming Cards (3 recent docs) + Concept Constellation (force graph)
- Right: Struggle Heatmap (activity viz) + Spaced Repetition Dock (flashcards)

**Library View** (`LibraryView`):
- Shows all documents in the database
- Click a document to open it in Reader view

**Reader View**:
- PDF container: Flexes to fill available space, gets `mr-[400px]` margin when sidebar opens
- ResponsePanel: Fixed 400px right sidebar with glass aesthetic (`glass-panel` class)
- SelectionPopover: Floating toolbar above text selection
- STEMToolbar: Top bar buttons for STEM tools (always visible, enabled when text selected)

**First-Run Wizard** (`FirstRunWizard`):
- Shown on first launch (tracked via `localStorage 'activepaper:setup-complete'`)
- Welcome screen → provider selection with optional API key setup

### UX Infrastructure

- **Toast notifications**: `react-hot-toast` via `<Toaster>` in App.tsx. Use `toast.success()` / `toast.error()` for user feedback on key operations (key save, highlight create, export, etc.)
- **Confirmation dialogs**: `ConfirmDialog` component for destructive actions (e.g., conversation deletion). Uses `showConfirm(title, message, onConfirm)` pattern in App.tsx.
- **Offline detection**: `useOfflineDetection` hook monitors `navigator.onLine`. Offline banner shown in App.tsx. AI requests blocked with toast when offline.
- **Error boundary**: `ErrorBoundary` component wraps the app in `main.tsx`. Shows crash recovery UI with "Try Again" button.

### Tab System

Multiple PDFs can be open simultaneously in tabs. Key design decisions:

- **All PDFViewers stay mounted**: Instead of using `key={activeTab.id}` which would force remounting, render all tabs with `tabs.map()` and use `className={tab.id === activeTabId ? 'block h-full' : 'hidden'}` to show/hide. This enables instant tab switching without PDF re-rendering.
- **State per tab**: Each tab stores its own `pdfData`, `scrollPosition`, `scale`, `documentId`, `isLoading`, and `loadError` via `useTabs` hook
- **Keyboard navigation**: Cmd+Shift+[ / ] for prev/next tab, Cmd+1-9 for direct tab access
- **Error handling**: Render condition checks `loadError` FIRST before `pdfData` to ensure error UI always shows. Stale tabs (with `loadError` set) are removed and recreated when reopening the same file.

### Keyboard Shortcuts

- `Cmd+O` - Open PDF file
- `Cmd+W` - Close current tab
- `Cmd+J` - Explain selected text
- `Cmd+E` - Open equation explorer (when text selected)
- `Cmd+F` - Open search modal
- `Cmd+Shift+F` - Open search modal (global)
- `Cmd+Shift+[` / `]` - Previous/next tab
- `Cmd+1-9` - Jump to tab by index
- `Escape` - Close active panel/modal/STEM tool
- `Alt` (hold) - Enter investigate mode

### UI Mode System

The app uses a three-mode system managed by `ModeContext`:

- **reading**: Default mode, normal PDF viewing
- **investigate**: Alt/Option key held, interactive zones glow with content detection highlighting equations, code, and technical terms
- **simulation**: A STEM tool is open (dims PDF background)

Mode transitions: `reading` ↔ `investigate` (Alt key), `reading`/`investigate` → `simulation` (tool opens), `simulation` → `reading` (tool closes/Escape)

When in investigate mode, `useContentDetection` hook scans rendered pages for STEM content and `InteractiveZoneOverlay` renders clickable highlights. Clicking a zone opens the corresponding STEM tool.

### STEM Tools

Three interactive tools for STEM content, accessible via SelectionPopover (context-sensitive) or STEMToolbar (top bar):

**Equation Explorer** (`useEquationEngine`, `VariableManipulationModal`):
- Parses LaTeX equations using AI to extract variables with ranges
- Sliders to manipulate variable values in real-time
- Uses `mathjs.evaluate()` for safe expression evaluation (no `new Function()`)
- Live graph generation showing relationships between variables
- Detection: `containsLatex()` in `contentDetector.ts`

**Code Sandbox** (`useCodeSandbox`, `CodeSandboxDrawer`):
- Executes JavaScript/Python code in-browser via Pyodide
- Editor with syntax highlighting, real-time output
- Runtime auto-detection from code block language markers
- Detection: `containsCode()` in `contentDetector.ts`

**Deep Dive / First Principles Explainer** (`useConceptStack`, `ConceptStackPanel`):
- Recursive concept explanation with breadcrumb navigation
- Click bold terms to drill deeper (max depth enforced)
- Stack-based navigation for exploration history
- Detection: `containsTechnicalTerm()` in `contentDetector.ts`

Content detection uses regex patterns in `src/services/contentDetector.ts` for LaTeX (`$...$`, `$$...$$`, `\command{}`), code blocks (``` markers), and technical terms (STEM vocabulary patterns).

### Highlights & Annotations

Text highlights are stored as character offsets (start/end) within a page, making them scale-independent:

- `useSelection` captures `startOffset` and `endOffset` when text is selected
- `HighlightLayer` component renders highlight rectangles by walking text layer spans and matching offsets
- Highlights support 5 colors (yellow, green, blue, pink, purple) and optional notes
- `HighlightPopover` provides edit/delete UI on click

Bookmarks are page-level markers with optional labels, shown as indicators in the top-right of each page.

### Workspaces & Multi-Document Chat

Workspaces group related documents for cross-document AI conversations:

- **WorkspaceSwitcher** in title bar allows creating/selecting workspaces
- **useWorkspace** hook manages workspace state with localStorage persistence for current workspace
- **Conversation sources** track multiple documents contributing context to a single conversation thread
- **useConversation** extended with `sourceDocuments`, `addSourceDocument()`, `removeSourceDocument()` for multi-doc context

Database tables: `workspaces`, `workspace_documents` (junction), `conversation_sources`. The `conversations` table has optional `workspace_id` foreign key.

### React Hooks

- `useSelection` - Captures text selection, page context, character offsets, and DOMRect position
- `useAI` - Manages AI query state, streaming responses, supports action types and conversation history
- `useConversation` - Persistent conversation threads with database storage
- `useHistory` - Tracks session query history (in-memory, cleared on app restart)
- `useTabs` - Tab state management (open, close, select, update, reload tabs with per-tab scroll/scale/error state)
- `useDashboard` - Fetches all dashboard data (recent docs, stats, concepts, review count)
- `useReviewCards` - Review card state, flip, and rating actions
- `useConceptGraph` - Concept graph data with node selection
- `useUIMode` - Access to UI mode system (reading/investigate/simulation)
- `useContentDetection` - Detects STEM content (equations, code, terms) in page text for investigate mode
- `useEquationEngine` - Equation parsing, variable manipulation, graph generation (uses mathjs)
- `useCodeSandbox` - Code execution, runtime management, output streaming
- `useConceptStack` - Recursive concept exploration with stack navigation
- `useHighlights` - Persistent text highlights with colors and notes
- `useBookmarks` - Page-level bookmarks
- `useSearch` - Full-text search with scope filtering (all, current PDF, library, interactions, concepts)
- `useWorkspace` - Workspace state management with localStorage persistence for multi-document chat
- `useOfflineDetection` - Monitors `navigator.onLine` for connectivity status

## Build Notes

- **Native modules**: better-sqlite3 requires rebuilding for Electron. Run `npm run postinstall` or `npx @electron/rebuild` after installing dependencies. The postinstall script handles this automatically.

- **Externalized modules**: `better-sqlite3` must be externalized in `vite.config.ts` rollup options to prevent bundling the native module.

- **Preload script**: Must output as `.mjs` (ESM) because Vite's Rollup configuration doesn't reliably convert ESM imports to CommonJS `require()` calls. Configured via `entryFileNames: 'preload.mjs'` and `format: 'es'` in `vite.config.ts`.

- **PDF.js worker**: Use Vite's `?url` import suffix for worker paths (`import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`). This ensures correct path resolution in both dev and production builds.

- **PDF.js CMap configuration**: When calling `getDocument()`, always include `cMapUrl` and `cMapPacked` for proper CJK font rendering. Use CDN: `cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/'`.

- **IPC Buffer serialization**: With `contextIsolation: true`, Node.js `Buffer` objects are converted to `Uint8Array` during IPC. The main process should convert to `ArrayBuffer` before sending to avoid serialization issues.

## Distribution & CI/CD

- **Auto-updater**: `electron-updater` configured in `electron/updater.ts`. Checks for updates 5s after launch in packaged builds. "Check for Updates" menu item in File menu. Publishes to GitHub Releases.
- **Code signing**: macOS uses `build/entitlements.mac.plist` with hardened runtime. Notarization via `scripts/notarize.js` (afterSign hook). Requires `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` env vars.
- **Electron fuses**: `scripts/fuses.js` applies security fuses post-build (run manually on packaged binary).
- **CI**: `.github/workflows/ci.yml` — typecheck + test on push/PR to main.
- **Release**: `.github/workflows/release.yml` — cross-platform build + sign + publish on `v*` tags. Requires GitHub secrets for signing certificates.

## PDF.js and React Integration

PDF.js directly manipulates the DOM, which conflicts with React's virtual DOM. To avoid `removeChild` errors when React tries to unmount elements that PDF.js already removed:

1. **Separate render targets**: Use a nested structure where React manages the outer container and loading states, but PDF.js renders into a dedicated child div that React never updates
2. **Guard against re-renders**: Check `container.querySelector('canvas')` before rendering to skip already-rendered pages
3. **Clear on scale change**: When scale changes, manually clear PDF.js containers with `innerHTML = ''` before re-rendering

### TextLayer CSS Requirements

For proper text selection behavior, the `.textLayer` element requires:

- **`--scale-factor` CSS variable**: Set via `textLayer.style.setProperty('--scale-factor', scale.toString())` before rendering. PDF.js uses this for proper span sizing.
- **`.endOfContent` styles**: PDF.js creates this element to terminate selection. Without proper CSS, selections extend too far right. See `src/styles/index.css` for required styles.

### PDFViewer Rendering Pattern

The PDF viewer uses virtualized rendering (only visible pages + buffer are rendered). Key pattern to avoid render cascades:

- Use a **ref** (`renderedPagesRef`) for synchronous render tracking in scroll handlers and render guards
- Use **state** (`renderedPages`) only for UI updates (hiding skeleton placeholders)
- Update the ref *before* updating state to prevent duplicate renders within the same tick
- Keep `renderedPages` state out of `handleScroll` dependencies to avoid scroll listener recreation
- **Scroll-direction-aware buffering**: Buffer zones adjust based on scroll direction (2.5x ahead, 0.5x behind when scrolling down; reversed when scrolling up)
- **PDF load cleanup**: The useEffect cleanup cancels `loadingTaskRef.current.destroy()` to prevent orphaned PDF objects during rapid tab switching

**Zoom scroll adjustment**: When scale changes, `scrollTop` must be adjusted proportionally (`scrollTop * newScale / prevScale`) to maintain the same viewport position.

## Path Aliases

Configured in both `vite.config.ts` and `vitest.config.ts`:
- `@` → `src/`
- `@electron` → `electron/`

## Type Declarations

- `src/vite-env.d.ts` - Global types for renderer process (`Window.api` interface with all IPC methods)
- `src/types/modes.ts` - UI mode system types
- `src/types/equation.ts` - Equation engine types
- `src/types/code.ts` - Code sandbox types
- `src/types/explainer.ts` - Concept stack types
- `src/types/tabs.ts` - Tab state types
- `src/types/pdf.ts` - PDF outline and navigation types

## Performance Patterns

### AI Streaming
The `useAI` hook uses array accumulation with RAF batching to avoid O(n²) string concatenation:
```typescript
const chunksRef = useRef<string[]>([])
// In onChunk: chunksRef.current.push(chunk), then batch with requestAnimationFrame
// Final response: chunksRef.current.join('')
```

### React Callback Stability
Heavy components use refs to avoid callback recreation that causes unnecessary re-renders:
- **PDFViewer**: `scaleRef`, `totalPagesRef` for stable `renderPage` and `handleScroll`
- **useTabs**: `tabsRef`, `activeTabIdRef` for stable tab operations
- **App.tsx**: `keyboardStateRef`, `keyboardCallbacksRef` for stable keyboard handler (avoids 17+ dependencies)
- **ModeContext**: Refs for state in event handlers with empty `[]` deps

### Memory Management
- **Tab cleanup**: `closeTab` sets `tab.pdfData = null` before removal to free 10-100MB per PDF
- **Text content LRU cache**: `PDFViewer` limits `textContentCache` to 50 pages with LRU eviction
- **Canvas LRU cache**: `PDFViewer` caches up to 15 rendered canvases (`canvasCacheRef`) for instant scroll-back to previously viewed pages. Cache is cleared on scale change or PDF change.
- **History bound**: `useHistory` limits array to 100 entries

### Code Splitting
Heavy components are lazy-loaded to reduce initial bundle (83 kB gzip vs ~486 kB):
- `ActivePaperDashboard` (includes recharts, force-graph)
- `VariableManipulationModal` (recharts)
- `CodeSandboxDrawer`
- `ConceptStackPanel`

Wrap with `<Suspense fallback={...}>` and conditionally render only when `isOpen`.

### IPC Optimization
- **Chunk buffering**: AI streaming buffers chunks for 50ms or 500 chars before IPC send
- **Provider cache**: `provider:list` caches availability for 30 seconds
- **Batch DB operations**: `saveConceptsForInteraction` runs all queries in single transaction

### Database Indexes
Critical indexes for performance (added in migration1):
- `idx_interaction_concepts_concept` - concept junction lookups
- `idx_document_concepts_concept` - document-concept lookups
- `idx_concepts_name_lower` - case-insensitive concept name queries
