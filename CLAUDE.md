# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev        # Start Vite dev server with Electron (hot reload enabled)
npm run build      # Full build: tsc + vite build + electron-builder
npm run typecheck  # TypeScript validation without emitting files
```

No test suite is currently configured.

## Architecture

AI PDF Reader is an Electron + React desktop app that lets users select text in PDFs and get AI-powered explanations via multiple providers.

### Process Model

- **Main process** (`electron/`): Window management, IPC handlers, AI provider orchestration, secure key storage
- **Renderer process** (`src/`): React UI with PDF viewing and response display
- **Preload script** (`electron/preload.ts`): Context-isolated IPC bridge exposing `window.api`

### Data Flow

1. User selects text in `PDFViewer` → `useSelection` hook captures text + page context
2. Cmd+J triggers AI query → `useAI` hook calls `window.api.askAI()`
3. IPC to main process → `ProviderManager` routes to selected AI provider
4. Provider streams response via AsyncIterable → chunks sent back via dynamic IPC channel
5. `ResponsePanel` renders streamed markdown in real-time

### AI Provider System

Providers implement a common interface with async generator pattern for streaming:

- `electron/providers/index.ts` - ProviderManager (routing, availability checks)
- `electron/providers/ollama.ts` - Local Ollama (localhost:11434)
- `electron/providers/openai.ts` - OpenAI API (gpt-4o-mini)
- `electron/providers/anthropic.ts` - Anthropic Claude (claude-3-5-haiku-latest)
- `electron/providers/gemini.ts` - Google Gemini (gemini-1.5-flash)

### Security

- API keys encrypted via Electron's `safeStorage` API (`electron/security/key-store.ts`)
- Context isolation enabled; renderer only accesses main process through preload bridge
- Keys cached in memory for session duration

### Key IPC Channels

- `ai:query` - Start streaming AI query
- `provider:list/getCurrent/setCurrent` - Provider management
- `keys:set/has/delete` - API key management

## Path Aliases

Configured in `vite.config.ts`:
- `@` → `src/`
- `@electron` → `electron/`
