<div align="center">

# ActivePaper

**AI-powered PDF reader that thinks with you**

An intelligent desktop PDF reader with multi-provider AI, interactive STEM tools,
and a metacognitive learning dashboard — built for students, researchers, and curious readers.

[Download](#download) &middot; [Features](#features) &middot; [Quick Start](#quick-start) &middot; [Docs](#architecture) &middot; [Contributing](#contributing)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](#download)
[![CI](https://github.com/lichen0114/ai_pdf_reader/actions/workflows/ci.yml/badge.svg)](https://github.com/lichen0114/ai_pdf_reader/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/lichen0114/ai_pdf_reader?include_prereleases&label=Release)](https://github.com/lichen0114/ai_pdf_reader/releases)

</div>

---

## What is ActivePaper?

Most PDF readers are passive — you read, you highlight, you move on. ActivePaper turns reading into an active process. Select any text and get instant AI explanations, summaries, or definitions streamed in real time. Ask follow-up questions. Build a conversation around what you're reading.

But ActivePaper goes further than a chatbot stapled to a PDF viewer. Its STEM tools let you manipulate equations with live sliders and graphs, execute code snippets in a sandboxed environment, and recursively explore concepts down to first principles. An Investigate mode detects equations, code blocks, and technical terms on the page and makes them interactive with a single key press.

Everything you do is tracked in a metacognitive dashboard — a concept graph of what you've learned, a heatmap of where you struggled, and a spaced repetition system that resurfaces material before you forget it. Your data stays local in an encrypted SQLite database. Your API keys are stored in the system keychain. No telemetry, no cloud sync, no account required.

## Screenshots

> [!NOTE]
> **ActivePaper features a dark-themed glass-panel UI.** The reader view displays PDFs with a 400px response sidebar that streams AI responses in real-time markdown. A floating toolbar appears above text selections with action buttons. The dashboard view presents a force-directed concept graph, activity heatmap, and flashcard dock in a 70/30 grid layout. STEM tools open as overlays with interactive sliders, code editors, and breadcrumb navigation.
>
> Screenshots and a demo video will be added here once the UI is finalized.

## Features

<details open>
<summary><strong>AI-Powered Reading</strong></summary>

- **4 AI providers** — Ollama (local), Google Gemini, OpenAI, and Anthropic Claude
- **Real-time streaming** — responses appear word-by-word as they generate
- **Persistent conversations** — ask follow-up questions with full context retained
- **Custom actions** — create your own prompt templates beyond Explain / Summarize / Define
- **Response style control** — adjust tone (formal, casual, ELI5, academic), length, and format (prose, bullets, step-by-step)
- **Personas** — define a custom system prompt to shape how the AI responds
- **Per-document context** — give the AI background about what you're reading (e.g., "This is chapter 7 of a quantum mechanics textbook")
- **Per-provider model selection** — choose specific models and tune temperature / max tokens

</details>

<details>
<summary><strong>Interactive STEM Tools</strong></summary>

- **Equation Explorer** — AI parses LaTeX equations, extracts variables with ranges, and renders live graphs as you adjust sliders. Uses `mathjs` for safe evaluation.
- **Code Sandbox** — execute JavaScript or Python (via Pyodide) directly in the app with syntax highlighting and real-time output.
- **Deep Dive Explainer** — recursive first-principles exploration. Click bold terms to drill deeper. Stack-based navigation tracks your exploration path.
- **Investigate Mode** — hold Alt/Option to highlight all detected equations, code blocks, and technical terms on the current page. Click any zone to open the corresponding tool.

</details>

<details>
<summary><strong>Learning Analytics Dashboard</strong></summary>

- **Concept Constellation** — force-directed graph of extracted concepts and their relationships across documents
- **Struggle Heatmap** — visualize where and when you spent the most time asking questions
- **Spaced Repetition Dock** — SM-2 algorithm schedules flashcards generated from your AI interactions
- **Context Priming Cards** — quick-resume tiles for your 3 most recent documents

</details>

<details>
<summary><strong>Annotations and Organization</strong></summary>

- **Text highlights** — 5 colors (yellow, green, blue, pink, purple) with optional notes, stored as character offsets for scale-independent rendering
- **Page bookmarks** — mark pages with optional labels
- **Multi-tab reader** — open multiple PDFs simultaneously with instant tab switching (all viewers stay mounted)
- **Workspaces** — group related documents for cross-document AI conversations
- **Full-text search** — FTS5-powered search across documents, interactions, and concepts
- **Library view** — browse all previously opened documents

</details>

<details>
<summary><strong>Security and Privacy</strong></summary>

- **Encrypted API keys** — stored via Electron `safeStorage` (macOS Keychain, Windows Credential Manager). No plaintext fallback.
- **Context isolation** — renderer process communicates with main process only through a typed preload bridge
- **Content Security Policy** — `connect-src` restricted to Ollama localhost and specific cloud API domains
- **Electron fuses** — `RunAsNode`, `NodeOptions`, and CLI inspect disabled; ASAR-only loading enforced
- **Safe evaluation** — equations use `mathjs.evaluate()` instead of `new Function()`
- **File validation** — IPC file reads restricted to `.pdf` extension with path normalization

</details>

## Quick Start

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18+ | Required for building from source |
| npm | 9+ | Comes with Node.js |
| Ollama | Latest | Optional. For local AI without API keys. [Install](https://ollama.ai) |

### Download

Download the latest release for your platform from the [Releases](https://github.com/lichen0114/ai_pdf_reader/releases) page:

| Platform | File type |
|---|---|
| macOS | `.dmg` or `.zip` |
| Windows | `.exe` installer or `.zip` |
| Linux | `.AppImage` or `.deb` |

### Build from Source

```bash
git clone https://github.com/lichen0114/ai_pdf_reader.git
cd ai_pdf_reader
npm install        # Installs deps and rebuilds native modules (better-sqlite3)
npm run build      # Outputs packaged app to release/ directory
```

## Usage

### First Launch

On first launch, a setup wizard walks you through provider selection and optional API key configuration. You can skip it and configure everything later in Settings.

### Opening PDFs

- **Drag and drop** a PDF file onto the window
- **File > Open** from the menu bar
- **Cmd+O** (Mac) / **Ctrl+O** (Windows/Linux)

### AI Actions

1. **Select text** in the PDF
2. A floating toolbar appears with **Explain**, **Summarize**, **Define**, and any custom actions you've created
3. Click an action — or press **Cmd+J** / **Ctrl+J** for the default
4. The response panel opens on the right and streams the AI response
5. Type a follow-up question to continue the conversation with full context

### STEM Tools

- **Cmd+E** / **Ctrl+E** — open the Equation Explorer on selected LaTeX
- Hold **Alt/Option** to enter Investigate Mode — detected equations, code, and technical terms glow on the page. Click any highlighted zone to open the appropriate tool.
- Access all tools from the STEM toolbar at the top of the reader view

### Settings

Open Settings from the application menu or title bar. Six tabs are available:

| Tab | What it controls |
|---|---|
| **API Keys** | Enter and manage keys for Claude, OpenAI, and Gemini |
| **Response Style** | Tone, response length, and output format |
| **Persona** | Custom system prompt to shape AI behavior |
| **Custom Actions** | Create prompt templates with `{text}` and `{context}` placeholders |
| **Advanced** | Temperature, max tokens, and per-provider model selection |
| **Data** | Export all data as JSON or back up the SQLite database |

### API Key Sources

| Provider | Where to get a key |
|---|---|
| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | [platform.openai.com](https://platform.openai.com) |
| Google (Gemini) | [aistudio.google.com](https://aistudio.google.com) |
| Ollama (local) | No key required. [Install Ollama](https://ollama.ai), then `ollama pull llama3.2` |

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+O` | Open PDF |
| `Cmd+W` | Close current tab |
| `Cmd+J` | Explain selected text |
| `Cmd+E` | Open Equation Explorer |
| `Cmd+F` / `Cmd+Shift+F` | Search |
| `Cmd+Shift+[` / `]` | Previous / next tab |
| `Cmd+1`–`9` | Jump to tab by index |
| `Alt` (hold) | Investigate mode |
| `Escape` | Close active panel or tool |

Replace `Cmd` with `Ctrl` on Windows and Linux.

## Tech Stack

| Category | Technologies |
|---|---|
| **Core** | Electron, React 18, TypeScript, Vite |
| **UI** | Tailwind CSS, Recharts, react-force-graph |
| **PDF** | PDF.js (with CMap and text layer support) |
| **Database** | better-sqlite3 (WAL mode), FTS5 full-text search |
| **AI Providers** | Ollama, Google Gemini, OpenAI, Anthropic Claude |
| **Security** | Electron safeStorage, Electron Fuses, mathjs |
| **Testing** | Vitest, Testing Library, MSW |
| **Distribution** | electron-builder, electron-updater, code signing + notarization |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Main Process                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Providers│ │ Database │ │ KeyStore │ │Updater │ │
│  │ (AI)     │ │ (SQLite) │ │(safeStr.)│ │        │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                      │ IPC                          │
├──────────────────────┼──────────────────────────────┤
│              Preload │ Bridge                       │
│           (context-isolated window.api)             │
├──────────────────────┼──────────────────────────────┤
│                   Renderer                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │PDFViewer │ │ Response │ │Dashboard │ │Settings│ │
│  │(PDF.js)  │ │ Panel    │ │(Analytics│ │ Modal  │ │
│  │          │ │(Markdown)│ │+ Review) │ │        │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└─────────────────────────────────────────────────────┘
```

### Project Structure

```
ai_pdf_reader/
├── electron/                  # Main process
│   ├── main.ts                # Window management, IPC handlers
│   ├── preload.ts             # Context-isolated bridge (window.api)
│   ├── providers/             # AI provider implementations
│   │   ├── ollama.ts
│   │   ├── gemini.ts
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   ├── provider-manager.ts
│   │   └── prompt-builder.ts  # Centralized prompt construction
│   ├── database/
│   │   ├── index.ts           # Connection management (singleton, WAL)
│   │   ├── migrations.ts      # Schema versioning
│   │   └── queries/           # Query modules (documents, interactions, concepts, ...)
│   ├── security/
│   │   └── key-store.ts       # Encrypted API key storage
│   └── updater.ts             # Auto-update via electron-updater
├── src/                       # Renderer process (React)
│   ├── components/            # UI components
│   │   ├── PDFViewer.tsx      # Virtualized PDF rendering
│   │   ├── ResponsePanel.tsx  # Streaming AI response display
│   │   ├── ActivePaperDashboard.tsx  # Learning analytics
│   │   ├── SelectionPopover.tsx      # Floating action toolbar
│   │   └── settings/         # Settings modal tabs
│   ├── hooks/                 # Custom React hooks (useAI, useSelection, useTabs, ...)
│   ├── services/              # Content detection, utilities
│   ├── styles/                # Tailwind CSS
│   └── types/                 # TypeScript type definitions
├── tests/                     # Test files (mirrors src/ and electron/)
│   ├── mocks/                 # Test utilities (in-memory DB, mock window.api)
│   └── setup.ts               # Vitest setup (MSW, jsdom)
├── scripts/                   # Build scripts (fuses, notarization)
├── .github/workflows/         # CI and release workflows
├── CLAUDE.md                  # Detailed architecture documentation
└── package.json
```

For in-depth architecture documentation — IPC channels, data flow, database schema, performance patterns, and more — see [CLAUDE.md](CLAUDE.md).

## Development

### Setup

```bash
git clone https://github.com/lichen0114/ai_pdf_reader.git
cd ai_pdf_reader
npm install
npm run dev       # Starts Vite dev server + Electron with hot reload
```

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Full production build (tsc + Vite + electron-builder) |
| `npm run typecheck` | TypeScript validation without emitting |
| `npm run preview` | Preview the production build |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Single test run |
| `npm run test:coverage` | Tests with coverage report |

### Testing

```bash
# Run all tests
npm run test:run

# Run a specific test file
npx vitest run tests/hooks/useAI.test.ts

# Run tests matching a name pattern
npx vitest run -t "should stream response"

# Coverage report
npm run test:coverage
```

Tests use Vitest with jsdom (default) or node environment for database tests. MSW mocks HTTP requests to AI provider APIs.

### Build Notes

- **Native modules**: `better-sqlite3` requires rebuilding for Electron's Node version. The `postinstall` script runs `electron-rebuild` automatically.
- **Preload script**: Outputs as `.mjs` (ESM) because Vite's Rollup config doesn't reliably convert ESM imports to CJS.
- **PDF.js worker**: Uses Vite's `?url` import suffix for correct path resolution in dev and production.

## Contributing

Contributions are welcome. Please follow this workflow:

1. **Open an issue** first to discuss what you'd like to change
2. **Fork** the repository and create a feature branch (`git checkout -b feat/your-feature`)
3. **Make your changes** and verify:
   - `npm run typecheck` passes
   - `npm run test:run` passes
4. **Submit a pull request** against `main`

## FAQ

<details>
<summary><strong>Do I need an API key to use ActivePaper?</strong></summary>

No. You can use Ollama for fully local AI with no API key and no internet connection. Cloud providers (Claude, OpenAI, Gemini) require their respective API keys.

</details>

<details>
<summary><strong>How are my API keys stored?</strong></summary>

Keys are encrypted using Electron's `safeStorage` API, which delegates to the operating system's secure credential store (Keychain on macOS, Credential Manager on Windows, libsecret on Linux). Keys are never stored in plaintext. If encryption is unavailable, key storage will fail rather than fall back to insecure storage.

</details>

<details>
<summary><strong>Can I use ActivePaper offline?</strong></summary>

Yes, with Ollama as your provider. Cloud providers require an internet connection. The app detects when you're offline and prevents cloud AI requests with a notification.

</details>

<details>
<summary><strong>What PDF features are supported?</strong></summary>

ActivePaper renders PDFs via PDF.js with full text selection, CJK font support (via CMap), text layer overlay, and virtualized page rendering. It does not currently support PDF form filling or annotation embedding into the PDF file itself.

</details>

<details>
<summary><strong>How does spaced repetition work?</strong></summary>

When you use the Explain action, ActivePaper extracts key concepts via AI and creates review cards. The SM-2 algorithm schedules reviews at increasing intervals based on how well you recall the material. Access your review cards from the Dashboard.

</details>

<details>
<summary><strong>Can I export my data?</strong></summary>

Yes. Go to Settings > Data to export all interactions, concepts, highlights, and bookmarks as JSON, or create a full backup of the SQLite database file.

</details>

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

Built with [Electron](https://www.electronjs.org/), [React](https://react.dev/), [PDF.js](https://mozilla.github.io/pdf.js/), [Ollama](https://ollama.ai), and AI APIs from [Anthropic](https://www.anthropic.com/), [OpenAI](https://openai.com/), and [Google](https://ai.google.dev/).

<div align="center">

[Back to top](#activepaper)

</div>
