import type { AIProvider, CompletionRequest } from './index'

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

  private buildPrompt(request: CompletionRequest): string {
    let prompt = `You are a helpful AI assistant helping a user understand a PDF document.

The user has selected the following text and wants help understanding it:

Selected text:
"""
${request.text}
"""
`

    if (request.context) {
      prompt += `
Surrounding context from the document:
"""
${request.context}
"""
`
    }

    prompt += `
Please provide a clear, helpful explanation of the selected text. If it contains technical terms, explain them. If it's a concept, provide context and examples where helpful. Keep your response concise but thorough.`

    return prompt
  }
}
