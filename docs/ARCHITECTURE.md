# ActivePaper Architecture Documentation

## Executive Summary

ActivePaper is an Electron + React desktop application that provides AI-powered PDF reading with intelligent text explanation, STEM tools for interactive exploration, and comprehensive learning analytics. Users can select text in PDFs to get AI explanations via multiple providers, track their learning progress through a metacognitive dashboard, and use specialized tools for equations, code, and technical concepts.

---

## Table of Contents

1. [Application Architecture](#1-application-architecture)
2. [Electron Main Process](#2-electron-main-process)
3. [React Renderer Process](#3-react-renderer-process)
4. [PDF Viewing System](#4-pdf-viewing-system)
5. [AI Provider System](#5-ai-provider-system)
6. [Database Layer](#6-database-layer)
7. [STEM Tools](#7-stem-tools)
8. [Highlights & Annotations](#8-highlights--annotations)
9. [Search System](#9-search-system)
10. [Tab System](#10-tab-system)
11. [Conversation System](#11-conversation-system)
12. [Workspace System](#12-workspace-system)
13. [Security](#13-security)
14. [Performance Optimizations](#14-performance-optimizations)
15. [Key Files Reference](#15-key-files-reference)

---

## 1. Application Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ActivePaper Desktop App                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   RENDERER PROCESS (React)                   │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │    │
│  │  │  Dashboard  │  │   Library   │  │      Reader         │  │    │
│  │  │  - Stats    │  │  - Doc List │  │  - PDFViewer        │  │    │
│  │  │  - Concepts │  │  - Search   │  │  - ResponsePanel    │  │    │
│  │  │  - Reviews  │  │             │  │  - SelectionPopover │  │    │
│  │  └─────────────┘  └─────────────┘  │  - STEM Tools       │  │    │
│  │                                     │  - Highlights       │  │    │
│  │                                     └─────────────────────┘  │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │ IPC (window.api)                       │
│  ┌──────────────────────────┴──────────────────────────────────┐    │
│  │                    PRELOAD SCRIPT                            │    │
│  │              Context-isolated bridge (50+ APIs)              │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│  ┌──────────────────────────┴──────────────────────────────────┐    │
│  │                   MAIN PROCESS (Electron)                    │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │    │
│  │  │  Providers │  │  Database  │  │      Key Store         │ │    │
│  │  │  - Ollama  │  │  - SQLite  │  │  - safeStorage         │ │    │
│  │  │  - OpenAI  │  │  - FTS5    │  │  - Encrypted keys      │ │    │
│  │  │  - Gemini  │  │  - Queries │  └────────────────────────┘ │    │
│  │  │  - Claude  │  └────────────┘                              │    │
│  │  └────────────┘                                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Process Model

| Process | Location | Responsibilities |
|---------|----------|-----------------|
| **Main** | `electron/` | Window management, IPC handlers, AI providers, database, security |
| **Preload** | `electron/preload.ts` | Context-isolated bridge exposing `window.api` |
| **Renderer** | `src/` | React UI, PDF viewing, user interactions |

### Three Main Views

1. **Dashboard** - Learning analytics with concept visualization, spaced repetition cards
2. **Library** - Document management and browsing
3. **Reader** - PDF viewing with AI interaction, STEM tools, and annotations

---

## 2. Electron Main Process

### Entry Point (`electron/main.ts`)

The main process handles:

- **Window Creation**: BrowserWindow with context isolation enabled
- **Menu Setup**: Application menu with File, Edit, View options
- **IPC Handlers**: 50+ handlers for AI, database, file operations
- **Database Init**: SQLite initialization and migrations on startup
- **Stream Management**: AbortController for canceling AI streams

### Key IPC Channels

| Category | Channels | Purpose |
|----------|----------|---------|
| **AI** | `ai:query`, `ai:cancel` | Start/stop streaming AI queries |
| **Providers** | `provider:list/getCurrent/setCurrent` | Manage AI providers |
| **Keys** | `keys:set/has/delete` | API key management |
| **Files** | `file:read`, `file:openDialog` | File system access |
| **Database** | `db:documents:*`, `db:interactions:*`, etc. | CRUD operations |
| **Search** | `search:*` | Full-text search |

### Preload Script (`electron/preload.ts`)

Exposes `window.api` object with 60+ methods organized by domain:

```typescript
window.api = {
  // AI Operations
  askAI(request, onChunk, onDone, onError),

  // Provider Management
  getProviders(),
  getCurrentProvider(),
  setCurrentProvider(id),

  // Database Operations
  getOrCreateDocument(filepath, filename, totalPages),
  saveInteraction(docId, text, response, action, pageContext, pageNum),
  createHighlight(docId, page, startOffset, endOffset, text, color),
  // ... 50+ more methods
}
```

---

## 3. React Renderer Process

### Component Hierarchy

```
src/components/
├── App.tsx                    # Main orchestrator (~1,165 lines)
├── PDFViewer.tsx              # Core PDF rendering
├── ResponsePanel.tsx          # AI response sidebar
├── SelectionPopover.tsx       # Floating action toolbar
├── TabBar.tsx                 # Tab management UI
│
├── dashboard/                 # Learning analytics (lazy-loaded)
│   ├── ActivePaperDashboard.tsx
│   ├── ConceptConstellation.tsx  # Force graph visualization
│   ├── ContextPrimingCards.tsx   # Recent documents
│   ├── SpacedRepetitionDock.tsx  # Flashcard reviews
│   └── StruggleHeatmap.tsx       # Activity visualization
│
├── highlights/                # Annotation system
│   ├── HighlightLayer.tsx     # Renders highlights over text
│   ├── HighlightPopover.tsx   # Edit/delete UI
│   └── BookmarkIndicator.tsx  # Page bookmarks
│
├── search/                    # Full-text search
│   ├── SearchModal.tsx
│   └── SearchResults.tsx
│
├── equation/                  # Equation Explorer (lazy-loaded)
│   ├── VariableManipulationModal.tsx
│   └── EquationGraph.tsx
│
├── code/                      # Code Sandbox (lazy-loaded)
│   ├── CodeSandboxDrawer.tsx
│   └── TerminalOutput.tsx
│
└── explainer/                 # Deep Dive (lazy-loaded)
    ├── ConceptStackPanel.tsx
    └── BreadcrumbNav.tsx
```

### Custom Hooks (17 hooks)

| Hook | Purpose |
|------|---------|
| `useAI` | AI query streaming with RAF batching |
| `useSelection` | Captures text selection with character offsets |
| `useConversation` | Multi-turn conversation persistence |
| `useTabs` | Tab state management |
| `useHighlights` | Text highlight CRUD |
| `useBookmarks` | Page bookmark management |
| `useSearch` | Full-text search state |
| `useWorkspace` | Multi-document workspace management |
| `useEquationEngine` | LaTeX parsing and variable manipulation |
| `useCodeSandbox` | JS/Python code execution |
| `useConceptStack` | Recursive concept exploration |
| `useUIMode` | Reading/investigate/simulation mode |
| `useContentDetection` | Detects equations, code, technical terms |
| `useDashboard` | Dashboard data fetching |
| `useReviewCards` | Spaced repetition card management |
| `useConceptGraph` | Concept relationship data |
| `useHistory` | In-memory query history |

### UI Mode System

Three modes managed by `ModeContext`:

```
reading ←→ investigate ←→ simulation
   ↑           (Alt key)        ↑
   └─────────────────────────────┘
         (tool open/close)
```

- **reading**: Default PDF viewing mode
- **investigate**: Alt key held, interactive zones glow
- **simulation**: STEM tool open, PDF dimmed

---

## 4. PDF Viewing System

### PDFViewer Component

**Location**: `src/components/PDFViewer.tsx`

The PDFViewer implements virtualized rendering with PDF.js:

```
┌─────────────────────────────────────────────────────────────┐
│                    PDF Container                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Page 1 (rendered)                                      │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ Canvas Layer (PDF content)                        │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ Text Layer (invisible spans for selection)       │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ Highlight Layer (colored overlays)               │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Page 2 (skeleton placeholder - not yet visible)        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Rendering Strategy

| Feature | Implementation |
|---------|----------------|
| **Virtualization** | Only visible pages + buffer zone render |
| **Direction-aware buffer** | 2.5x ahead, 0.5x behind when scrolling |
| **Canvas cache** | 15 pages LRU cache for instant scroll-back |
| **Text cache** | 50 pages LRU cache for text content |
| **Scale range** | 0.5x to 3.0x zoom |

### Text Layer & Selection

1. PDF.js renders invisible `<span>` elements over canvas
2. CSS variable `--scale-factor` ensures proper sizing
3. `useSelection` hook captures text selection events
4. Character offsets (startOffset/endOffset) stored for scale-independence

---

## 5. AI Provider System

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ProviderManager                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  currentProvider: string                                 ││
│  │  providers: Map<string, AIProvider>                      ││
│  │                                                          ││
│  │  getProvider(id): AIProvider                             ││
│  │  listProviders(): ProviderInfo[]                         ││
│  │  refreshProviders(): void                                ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
  ┌──────────┐         ┌──────────┐          ┌──────────┐
  │  Ollama  │         │  OpenAI  │          │  Gemini  │
  │  (local) │         │  (cloud) │          │  (cloud) │
  └──────────┘         └──────────┘          └──────────┘
```

### Provider Interface

```typescript
interface AIProvider {
  id: string
  name: string
  type: 'local' | 'cloud'
  complete(request: CompletionRequest): AsyncIterable<string>
  isAvailable(): Promise<boolean>
}

interface CompletionRequest {
  text: string
  context?: string
  action?: 'explain' | 'summarize' | 'define' | 'parse_equation' | ...
  conversationHistory?: ConversationMessage[]
}
```

### Supported Providers

| Provider | Model | Notes |
|----------|-------|-------|
| **Ollama** | llama3.2 | Local, requires Ollama running |
| **OpenAI** | gpt-4o-mini | Cloud, needs API key |
| **Gemini** | gemini-3-pro-preview | Cloud, needs API key |
| **Anthropic** | claude-3-5-haiku | Cloud, needs API key |

### Streaming Response Flow

```
User Selection → askAI() → IPC 'ai:query'
    ↓
Main Process → ProviderManager.getProvider()
    ↓
Provider.complete() → AsyncIterable<string>
    ↓
Chunk buffering (50ms or 500 chars)
    ↓
IPC streaming channel (ai:stream:${channelId})
    ↓
Renderer: onChunk → RAF batching → UI update
```

---

## 6. Database Layer

### Schema Overview

**Database**: SQLite with FTS5 (`activepaper.db` in user data directory)

```
┌──────────────┐     ┌──────────────────┐     ┌────────────┐
│  documents   │────→│   interactions   │────→│  concepts  │
│              │     │                  │     │            │
│  - filepath  │     │  - selected_text │     │  - name    │
│  - filename  │     │  - response      │     │  - def     │
│  - scroll    │     │  - action        │     │            │
│  - pages     │     │  - page_context  │     │            │
└──────────────┘     └──────────────────┘     └────────────┘
       │                     │
       │                     ↓
       │              ┌──────────────────┐
       │              │  review_cards    │
       │              │  (SM-2 spaced    │
       │              │   repetition)    │
       │              └──────────────────┘
       │
       ├─────────────→ highlights
       │               (color, offsets, notes)
       │
       ├─────────────→ bookmarks
       │               (page, label)
       │
       └─────────────→ conversations
                       │
                       ├→ conversation_messages
                       └→ conversation_sources (multi-doc)

┌──────────────┐
│  workspaces  │───→ workspace_documents (junction)
└──────────────┘
```

### Query Modules

| Module | File | Key Operations |
|--------|------|----------------|
| **documents** | `queries/documents.ts` | getOrCreate, update, getRecent |
| **interactions** | `queries/interactions.ts` | save, getByDocument, getActivityByDay |
| **concepts** | `queries/concepts.ts` | saveForInteraction, getGraph |
| **reviews** | `queries/reviews.ts` | create, getNext, update (SM-2) |
| **highlights** | `queries/highlights.ts` | create, update, delete, byPage |
| **bookmarks** | `queries/bookmarks.ts` | toggle, updateLabel |
| **conversations** | `queries/conversations.ts` | create, addMessage, getWithMessages |
| **workspaces** | `queries/workspaces.ts` | create, addDocument, getSources |
| **search** | `queries/search.ts` | searchAll, searchDocuments, FTS5 |

### Full-Text Search (FTS5)

Three virtual tables with automatic sync triggers:

- `documents_fts` - Search by filename
- `interactions_fts` - Search selected_text + response
- `concepts_fts` - Search concept names

---

## 7. STEM Tools

### Equation Explorer

**Files**: `src/hooks/useEquationEngine.ts`, `src/components/equation/`

**Workflow**:
1. User selects LaTeX equation
2. AI parses equation, extracts variables with ranges
3. Sliders allow variable manipulation
4. Graph updates in real-time

```typescript
interface ParsedEquation {
  variables: EquationVariable[]  // { name, min, max, value, unit }
  formula: string                // Original LaTeX
  computeExpression: string      // JavaScript expression
}
```

### Code Sandbox

**Files**: `src/hooks/useCodeSandbox.ts`, `src/components/code/`

**Features**:
- JavaScript execution (sandboxed eval)
- Python execution (via Pyodide in browser)
- Runtime auto-detection from code block markers
- Real-time output streaming

### Deep Dive / First Principles

**Files**: `src/hooks/useConceptStack.ts`, `src/components/explainer/`

**Stack Navigation**:
- Click technical term → AI explains recursively
- Bold terms are clickable for deeper exploration
- Breadcrumb trail shows exploration history
- Max depth enforced to prevent infinite drilling

---

## 8. Highlights & Annotations

### Character Offset Model

Highlights are stored as character offsets within page text, making them scale-independent:

```typescript
interface HighlightData {
  start_offset: number    // Character position in page text
  end_offset: number      // Character position in page text
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple'
  note: string | null
}
```

### Rendering Pipeline

```
HighlightData (offsets) → PDFViewer text layer rendered
    ↓
HighlightLayer.calculateHighlightRects()
    ↓
Walk text layer spans, match character ranges
    ↓
Convert to DOM rects via Range API
    ↓
Render semi-transparent colored divs
```

---

## 9. Search System

### Search Scopes

| Scope | Source | Implementation |
|-------|--------|----------------|
| `all` | Everything | Database FTS5 |
| `documents` | PDF files | `searchDocuments()` |
| `interactions` | AI Q&A history | `searchInteractions()` |
| `concepts` | Extracted concepts | `searchConcepts()` |
| `currentPdf` | Current PDF only | Client-side regex |

### Search Modal Features

- Scope selector (radio buttons)
- 300ms debounce on query changes
- Keyboard navigation (Enter/Shift+Enter)
- Result highlighting with context

---

## 10. Tab System

### Design Decisions

1. **All PDFViewers Stay Mounted**
   - Hidden tabs use `display: none`
   - Enables instant tab switching without PDF re-rendering

2. **Per-Tab State**
   ```typescript
   interface TabState {
     id: string
     filePath: string
     pdfData: ArrayBuffer | null
     scrollPosition: number
     scale: number
     isLoading: boolean
     loadError: string | null
   }
   ```

3. **Memory Management**
   - `closeTab()` nullifies pdfData before removal
   - Frees 10-100MB per PDF

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+O` | Open file |
| `Cmd+W` | Close current tab |
| `Cmd+Shift+[` | Previous tab |
| `Cmd+Shift+]` | Next tab |
| `Cmd+1-9` | Jump to tab by index |

---

## 11. Conversation System

### Multi-Turn Conversations

```
┌─────────────────────────────────────────────┐
│              Conversation                    │
│  - id, title, document_id, workspace_id     │
│                                              │
│  ┌───────────────────────────────────────┐  │
│  │  Message 1 (user)                      │  │
│  │  "Explain quantum entanglement"        │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │  Message 2 (assistant)                 │  │
│  │  "Quantum entanglement is..."          │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │  Message 3 (user)                      │  │
│  │  "Can you give an example?"            │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Hook: `useConversation`

- `startConversation()` - Create new thread
- `loadConversation(id)` - Load existing thread
- `addMessage(role, content)` - Append message
- History passed to AI provider for context

---

## 12. Workspace System

### Multi-Document Chat

Workspaces group related documents for cross-document AI conversations:

```
┌─────────────────────────────────────────────┐
│              Workspace                       │
│  "Research Project"                          │
│                                              │
│  Documents:                                  │
│  ├── paper1.pdf                             │
│  ├── paper2.pdf                             │
│  └── notes.pdf                              │
│                                              │
│  Conversations:                              │
│  └── "Compare methodologies" (sources all 3)│
└─────────────────────────────────────────────┘
```

### Database Tables

- `workspaces` - Workspace metadata
- `workspace_documents` - Junction with position
- `conversation_sources` - Links conversations to multiple documents

---

## 13. Security

### API Key Storage

**Location**: `electron/security/key-store.ts`

- Uses Electron's `safeStorage` API (OS-level encryption)
- Keys encrypted before writing to disk
- In-memory cache for session duration
- Graceful fallback if encryption unavailable

### Security Features

- Context isolation enabled (no direct Node.js access)
- All IPC goes through preload bridge
- No plaintext keys on disk
- Per-provider key isolation

---

## 14. Performance Optimizations

### React/Component Level

| Optimization | Benefit |
|--------------|---------|
| **Lazy loading** | Dashboard, STEM tools load on-demand |
| **Ref stability** | App.tsx uses refs for stable keyboard handler |
| **RAF batching** | AI chunks accumulated efficiently |

### Data Processing

| Optimization | Benefit |
|--------------|---------|
| **Virtual rendering** | Only visible pages + buffer render |
| **LRU caches** | Text (50 pages), canvas (15 pages) |
| **Bounded history** | 100 entries max |
| **Chunk buffering** | 50ms or 500 chars before IPC send |

### Database

| Optimization | Benefit |
|--------------|---------|
| **FTS5 indexes** | Fast full-text search |
| **Critical indexes** | Concept lookups, review timing |
| **Transaction batching** | Concept extraction in single TX |
| **Provider cache** | 30-second availability TTL |

---

## 15. Key Files Reference

### Main Process

| File | Purpose |
|------|---------|
| `electron/main.ts` | Entry point, IPC handlers |
| `electron/preload.ts` | Context bridge (50+ APIs) |
| `electron/providers/index.ts` | ProviderManager |
| `electron/providers/*.ts` | Individual providers |
| `electron/database/index.ts` | DB connection |
| `electron/database/migrations.ts` | Schema versioning |
| `electron/database/queries/*.ts` | Query modules |
| `electron/security/key-store.ts` | Encrypted key storage |

### Renderer Process

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main orchestrator |
| `src/components/PDFViewer.tsx` | PDF rendering |
| `src/components/ResponsePanel.tsx` | AI response display |
| `src/hooks/useAI.ts` | AI streaming |
| `src/hooks/useSelection.ts` | Text selection |
| `src/hooks/useTabs.ts` | Tab management |
| `src/hooks/useConversation.ts` | Conversation persistence |
| `src/services/contentDetector.ts` | STEM content detection |
| `src/services/codeRunner.ts` | JS/Python execution |
| `src/types/` | TypeScript definitions |

---

## Data Flow Summary

```
User selects text in PDF
    ↓
useSelection captures: text, offsets, pageContext, pageNumber
    ↓
User clicks action (Explain/Summarize/Define)
    ↓
useAI.askAI() → IPC to main process
    ↓
ProviderManager routes to selected AI provider
    ↓
Provider streams response (AsyncIterable)
    ↓
Chunks buffered, sent via IPC channel
    ↓
ResponsePanel renders streamed markdown
    ↓
On complete:
├── saveInteraction() → SQLite
├── extractConcepts() → AI extracts terms
├── createReviewCard() → Spaced repetition
└── Update dashboard stats
```
