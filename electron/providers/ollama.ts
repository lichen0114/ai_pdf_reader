import type { AIProvider, CompletionRequest, ConversationMessage } from './index'

const OLLAMA_BASE_URL = 'http://localhost:11434'
const DEFAULT_MODEL = 'llama3.2'

export class OllamaProvider implements AIProvider {
  id = 'ollama'
  name = 'Ollama (Local)'
  type: 'local' = 'local'

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  async *complete(request: CompletionRequest): AsyncIterable<string> {
    // If there's conversation history, use chat endpoint
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      yield* this.completeChat(request)
      return
    }

    const prompt = this.buildPrompt(request)

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            if (json.response) {
              yield json.response
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private async *completeChat(request: CompletionRequest): AsyncIterable<string> {
    const messages = request.conversationHistory!.map((msg: ConversationMessage) => ({
      role: msg.role,
      content: msg.content
    }))

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            if (json.message?.content) {
              yield json.message.content
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private buildPrompt(request: CompletionRequest): string {
    const action = request.action || 'explain'
    let prompt = 'You are a helpful AI assistant helping a user understand a PDF document.\n\n'

    switch (action) {
      case 'summarize':
        prompt += `Summarize the key points of this text:\n\n"${request.text}"`
        break
      case 'define':
        prompt += `Define and explain this term or concept:\n\n"${request.text}"`
        if (request.context) {
          prompt += `\n\nContext from the document:\n"${request.context}"`
        }
        break
      case 'parse_equation':
        prompt = `Analyze this mathematical equation or formula and extract its variables. Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "variables": [
    {"name": "variable_symbol", "description": "what it represents", "range": [min, max], "unit": "optional_unit"}
  ],
  "formula": "the equation in readable form",
  "compute": "JavaScript expression to compute the dependent variable, using variable names"
}

For example, for "F = ma":
{
  "variables": [
    {"name": "m", "description": "mass", "range": [0, 100], "unit": "kg"},
    {"name": "a", "description": "acceleration", "range": [0, 20], "unit": "m/s²"}
  ],
  "formula": "F = ma",
  "compute": "m * a"
}

Equation to analyze: "${request.text}"`
        return prompt
      case 'explain_fundamental':
        prompt += `Explain this concept using first principles, starting from the most fundamental ideas. Make any technical terms you use **bold** so they can be clicked for further explanation.

Keep the explanation concise but thorough. Focus on building understanding from the ground up.

Concept: "${request.text}"`
        if (request.context) {
          prompt += `\n\nContext from the document:\n"${request.context}"`
        }
        break
      case 'extract_terms':
        prompt = `Extract the technical terms from this text that could benefit from further explanation. Return ONLY a JSON array of term objects (no markdown, no explanation):

[{"term": "technical_term", "description": "brief_description"}]

Text: "${request.text}"`
        return prompt
      case 'explain':
      default:
        prompt += `Explain this text in simple terms:\n\n"${request.text}"`
        if (request.context) {
          prompt += `\n\nSurrounding context from the document:\n"${request.context}"`
        }
        break
    }

    prompt += '\n\nKeep your response concise but thorough.'
    return prompt
  }
}
