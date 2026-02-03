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

Tests use Vitest with jsdom environment. Test files are in `tests/` mirroring the source structure. MSW is used for mocking HTTP requests to AI provider APIs.

## Architecture

ActivePaper is an Electron + React desktop app that lets users select text in PDFs and get AI-powered explanations via multiple providers. It includes a metacognitive "ActivePaper Dashboard" for tracking learning activity and STEM-focused tools for interactive exploration.

### Process Model

- **Main process** (`electron/`): Window management, IPC handlers, AI provider orchestration, secure key storage, SQLite database
- **Renderer process** (`src/`): React UI with PDF viewing, response display, and dashboard
- **Preload script** (`electron/preload.ts`): Context-isolated IPC bridge exposing `window.api`

### Data Flow

1. User selects text in `PDFViewer` → `useSelection` hook captures text + page context + selection position
2. User clicks action in floating toolbar (Explain/Summarize/Define) or presses Cmd+J → `useAI` hook calls `window.api.askAI()` with action type
3. IPC to main process → `ProviderManager` routes to selected AI provider with action-specific prompts
4. Provider streams response via AsyncIterable → chunks sent back via dynamic IPC channel
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

### Database Layer

SQLite database (`activepaper.db` in userData) via better-sqlite3 for persistent learning analytics:

- **`electron/database/index.ts`** - Connection management (singleton pattern)
- **`electron/database/migrations.ts`** - Schema versioning and migrations
- **`electron/database/queries/`** - Query modules:
  - `documents.ts` - Document tracking (filepath, scroll position, pages)
  - `interactions.ts` - AI query history with activity statistics
  - `concepts.ts` - Extracted concepts with graph relationships
  - `reviews.ts` - SM-2 spaced repetition algorithm

Schema relationships: documents → interactions → concepts (via junction tables), interactions → review_cards

### Security

- API keys encrypted via Electron's `safeStorage` API (`electron/security/key-store.ts`)
- Context isolation enabled; renderer only accesses main process through preload bridge
- Keys cached in memory for session duration

### Key IPC Channels

- `ai:query` - Start streaming AI query (returns `channelId` for streaming responses)
- `provider:list/getCurrent/setCurrent` - Provider management
- `keys:set/has/delete` - API key management
- `file:read` - Read file from disk (returns `ArrayBuffer`, not `Buffer`)
- `db:documents:*` - Document CRUD operations
- `db:interactions:*` - Interaction storage and statistics
- `db:concepts:*` - Concept graph and extraction
- `db:review:*` - Spaced repetition card management

### UI Layout

The app has two main views toggled via the title bar:

**Dashboard View** (`ActivePaperDashboard`):
- 70/30 grid layout
- Left: Context Priming Cards (3 recent docs) + Concept Constellation (force graph)
- Right: Struggle Heatmap (activity viz) + Spaced Repetition Dock (flashcards)

**Reader View**:
- PDF container: Flexes to fill available space, gets `mr-[400px]` margin when sidebar opens
- ResponsePanel: Fixed 400px right sidebar with glass aesthetic (`glass-panel` class)
- SelectionPopover: Floating toolbar above text selection
- STEMToolbar: Top bar buttons for STEM tools (always visible, enabled when text selected)

### Tab System

Multiple PDFs can be open simultaneously in tabs. Key design decisions:

- **All PDFViewers stay mounted**: Instead of using `key={activeTab.id}` which would force remounting, render all tabs with `tabs.map()` and use `className={tab.id === activeTabId ? 'block h-full' : 'hidden'}` to show/hide. This enables instant tab switching without PDF re-rendering.
- **State per tab**: Each tab stores its own `pdfData`, `scrollPosition`, `scale`, and `documentId` via `useTabs` hook
- **Keyboard navigation**: Cmd+Shift+[ / ] for prev/next tab, Cmd+1-9 for direct tab access

### UI Mode System

The app uses a three-mode system managed by `ModeContext`:

- **reading**: Default mode, normal PDF viewing
- **investigate**: Alt/Option key held, interactive zones glow (planned feature)
- **simulation**: A STEM tool is open (dims PDF background)

Mode transitions: `reading` ↔ `investigate` (Alt key), `reading`/`investigate` → `simulation` (tool opens), `simulation` → `reading` (tool closes/Escape)

### STEM Tools

Three interactive tools for STEM content, accessible via SelectionPopover (context-sensitive) or STEMToolbar (top bar):

**Equation Explorer** (`useEquationEngine`, `VariableManipulationModal`):
- Parses LaTeX equations using AI to extract variables with ranges
- Sliders to manipulate variable values in real-time
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

### React Hooks

- `useSelection` - Captures text selection, page context, and DOMRect position
- `useAI` - Manages AI query state, streaming responses, supports action types and conversation history
- `useConversation` - Manages follow-up conversation state (messages array, selected text context)
- `useHistory` - Tracks session query history (in-memory, cleared on app restart)
- `useTabs` - Tab state management (open, close, select, update tabs with per-tab scroll/scale)
- `useDashboard` - Fetches all dashboard data (recent docs, stats, concepts, review count)
- `useReviewCards` - Review card state, flip, and rating actions
- `useConceptGraph` - Concept graph data with node selection
- `useUIMode` - Access to UI mode system (reading/investigate/simulation)
- `useEquationEngine` - Equation parsing, variable manipulation, graph generation
- `useCodeSandbox` - Code execution, runtime management, output streaming
- `useConceptStack` - Recursive concept exploration with stack navigation

## Build Notes

- **Native modules**: better-sqlite3 requires rebuilding for Electron. Run `npm run postinstall` or `npx @electron/rebuild` after installing dependencies. The postinstall script handles this automatically.

- **Externalized modules**: `better-sqlite3` must be externalized in `vite.config.ts` rollup options to prevent bundling the native module.

- **Preload script**: Must output as `.mjs` (ESM) because Vite's Rollup configuration doesn't reliably convert ESM imports to CommonJS `require()` calls. Configured via `entryFileNames: 'preload.mjs'` and `format: 'es'` in `vite.config.ts`.

- **PDF.js worker**: Use Vite's `?url` import suffix for worker paths (`import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`). This ensures correct path resolution in both dev and production builds.

- **PDF.js CMap configuration**: When calling `getDocument()`, always include `cMapUrl` and `cMapPacked` for proper CJK font rendering. Use CDN: `cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/'`.

- **IPC Buffer serialization**: With `contextIsolation: true`, Node.js `Buffer` objects are converted to `Uint8Array` during IPC. The main process should convert to `ArrayBuffer` before sending to avoid serialization issues.

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
- Use **state** (`renderedPages`) only for UI updates (hiding loading spinners)
- Update the ref *before* updating state to prevent duplicate renders within the same tick
- Keep `renderedPages` state out of `handleScroll` dependencies to avoid scroll listener recreation

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
