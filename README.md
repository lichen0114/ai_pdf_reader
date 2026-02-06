# ActivePaper

**AI-powered PDF reader with local and cloud AI support**

A desktop application that lets you select text in PDFs and get instant AI-powered explanations, summaries, and definitions. Supports both local AI (via Ollama) and cloud providers (Claude, OpenAI, Gemini).

## Features

- **AI-Powered Text Analysis** - Select any text and choose from Explain, Summarize, or Define actions
- **Multi-Provider Support** - Use local AI with Ollama or connect to Claude, OpenAI, or Gemini
- **Real-Time Streaming** - Responses stream in real-time as they're generated
- **Follow-Up Conversations** - Ask follow-up questions to dive deeper into topics
- **Secure Key Storage** - API keys are encrypted using the system's secure storage
- **Keyboard Shortcuts** - Quick access with Cmd+J (Mac) / Ctrl+J (Windows/Linux)

## Screenshots

*Coming soon*

## Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Ollama** (optional) - For local AI without cloud API keys

### Download Pre-Built Release

Download the latest release for your platform from the [Releases](../../releases) page:

- **macOS**: `.dmg` or `.zip`
- **Windows**: `.exe` installer or `.zip`
- **Linux**: `.AppImage` or `.deb`

### Build from Source

```bash
# Clone the repository
git clone <repository-url>
cd activepaper

# Install dependencies
npm install

# Build the application
npm run build

# Find built packages in the `release/` directory
```

## Usage

### Opening PDFs

- **Drag and drop** a PDF file onto the application window
- Use **File > Open** from the menu

### Using AI Actions

1. **Select text** in the PDF by clicking and dragging
2. A floating toolbar appears with three options:
   - **Explain** - Get a detailed explanation of the selected text
   - **Summarize** - Get a concise summary
   - **Define** - Get definitions for terms and concepts
3. Click an action or press **Cmd+J** (Mac) / **Ctrl+J** (Windows/Linux) for the default action
4. The response panel slides open on the right showing the AI response

### Follow-Up Questions

After receiving a response, you can ask follow-up questions in the response panel. The conversation history is maintained so the AI understands the context of your questions.

### Configuring AI Providers

1. Open **Settings** from the application menu
2. Choose your preferred AI provider:
   - **Ollama** (local) - No API key required, runs on your machine
   - **Claude** - Requires Anthropic API key
   - **OpenAI** - Requires OpenAI API key
   - **Gemini** - Requires Google AI API key
3. Enter your API key for cloud providers (stored securely)

## Configuration

### Setting Up Ollama (Local AI)

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2`
3. Ensure Ollama is running before using the app
4. Select "Ollama" as your provider in settings

### Cloud Provider API Keys

API keys are encrypted using your system's secure storage (Keychain on macOS, Credential Manager on Windows).

To obtain API keys:
- **Anthropic (Claude)**: [console.anthropic.com](https://console.anthropic.com)
- **OpenAI**: [platform.openai.com](https://platform.openai.com)
- **Google (Gemini)**: [aistudio.google.com](https://aistudio.google.com)

## Development

### Setup

```bash
# Clone and install
git clone <repository-url>
cd activepaper
npm install
```

### Commands

```bash
npm run dev        # Start development server with hot reload
npm run build      # Full production build
npm run typecheck  # TypeScript type checking
npm run preview    # Preview production build
```

### Testing

```bash
npm test                              # Run tests in watch mode
npm run test:run                      # Single test run
npm run test:coverage                 # Run tests with coverage
npx vitest run tests/path/to/file    # Run specific test file
```

### Project Structure

```
activepaper/
├── electron/           # Main process code
│   ├── main.ts         # Electron main entry
│   ├── preload.ts      # Context bridge for IPC
│   ├── providers/      # AI provider implementations
│   └── security/       # Secure key storage
├── src/                # Renderer process (React)
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   └── styles/         # CSS and Tailwind
├── tests/              # Test files (mirrors src/)
└── package.json
```

## Tech Stack

- **Core**: Electron, React 18, TypeScript, Vite
- **PDF Rendering**: PDF.js
- **Styling**: Tailwind CSS
- **Testing**: Vitest, Testing Library, MSW

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes.

## License

This project is licensed under the [MIT License](LICENSE).
