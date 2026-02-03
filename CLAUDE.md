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

AI PDF Reader is an Electron + React desktop app that lets users select text in PDFs and get AI-powered explanations via multiple providers.

### Process Model

- **Main process** (`electron/`): Window management, IPC handlers, AI provider orchestration, secure key storage
- **Renderer process** (`src/`): React UI with PDF viewing and response display
- **Preload script** (`electron/preload.ts`): Context-isolated IPC bridge exposing `window.api`

### Data Flow

1. User selects text in `PDFViewer` → `useSelection` hook captures text + page context + selection position
2. User clicks floating "Ask AI" button (or Cmd+J) → `useAI` hook calls `window.api.askAI()`
3. IPC to main process → `ProviderManager` routes to selected AI provider
4. Provider streams response via AsyncIterable → chunks sent back via dynamic IPC channel
5. `ResponsePanel` renders streamed markdown in real-time

### AI Provider System

Providers in `electron/providers/` implement the `AIProvider` interface:

```typescript
interface AIProvider {
  id: string
  name: string
  type: 'local' | 'cloud'
  complete(request: CompletionRequest): AsyncIterable<string>  // Streaming via async generator
  isAvailable(): Promise<boolean>
}
```

Current providers: `ollama` (local), `gemini`, `openai`, `anthropic` (cloud).

To add a new provider: implement the interface with an async generator `complete()` method, then register in `ProviderManager.initializeProviders()`. Call `refreshProviders()` after API key changes to reinitialize providers with new keys.

### Security

- API keys encrypted via Electron's `safeStorage` API (`electron/security/key-store.ts`)
- Context isolation enabled; renderer only accesses main process through preload bridge
- Keys cached in memory for session duration

### Key IPC Channels

- `ai:query` - Start streaming AI query (returns `channelId` for streaming responses)
- `provider:list/getCurrent/setCurrent` - Provider management
- `keys:set/has/delete` - API key management
- `file:read` - Read file from disk (returns `ArrayBuffer`, not `Buffer`)

## Build Notes

- **Preload script**: Must output as `.mjs` (ESM) because Vite's Rollup configuration doesn't reliably convert ESM imports to CommonJS `require()` calls. The `.mjs` extension tells Node.js to treat the file as ESM regardless of package.json type. Configured via `entryFileNames: 'preload.mjs'` and `format: 'es'` in `vite.config.ts`.

- **PDF.js worker**: Use Vite's `?url` import suffix for worker paths (`import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`). This ensures correct path resolution in both dev and production builds.

- **PDF.js CMap configuration**: When calling `getDocument()`, always include `cMapUrl` and `cMapPacked` for proper CJK font rendering. Use CDN: `cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/'`. The CSP in `index.html` must include `https://cdn.jsdelivr.net` in `connect-src` for this to work.

- **IPC Buffer serialization**: With `contextIsolation: true`, Node.js `Buffer` objects are converted to `Uint8Array` during IPC. The main process should convert to `ArrayBuffer` before sending to avoid serialization issues.

## PDF.js and React Integration

PDF.js directly manipulates the DOM, which conflicts with React's virtual DOM. To avoid `removeChild` errors when React tries to unmount elements that PDF.js already removed:

1. **Separate render targets**: Use a nested structure where React manages the outer container and loading states, but PDF.js renders into a dedicated child div that React never updates
2. **Guard against re-renders**: Check `container.querySelector('canvas')` before rendering to skip already-rendered pages
3. **Clear on scale change**: When scale changes, manually clear PDF.js containers with `innerHTML = ''` before re-rendering

### PDFViewer Rendering Pattern

The PDF viewer uses virtualized rendering (only visible pages + buffer are rendered). Key pattern to avoid render cascades:

- Use a **ref** (`renderedPagesRef`) for synchronous render tracking in scroll handlers and render guards
- Use **state** (`renderedPages`) only for UI updates (hiding loading spinners)
- Update the ref *before* updating state to prevent duplicate renders within the same tick
- Keep `renderedPages` state out of `handleScroll` dependencies to avoid scroll listener recreation

Parent container dimensions must be set explicitly when rendering pages (PDF.js uses absolute positioning inside the render target, which doesn't contribute to parent height).

## Path Aliases

Configured in both `vite.config.ts` and `vitest.config.ts`:
- `@` → `src/`
- `@electron` → `electron/`

## Type Declarations

- `src/vite-env.d.ts` - Global types for renderer process (`Window.api` interface)
- `electron/preload.ts` - Contains duplicate `Window` interface declaration for preload context
