import type { AIProvider, CompletionRequest } from './index'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

export class AnthropicProvider implements AIProvider {
  id = 'anthropic'
  name = 'Claude'
  type: 'cloud' = 'cloud'

  constructor(private apiKey: string) {}

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0
  }

  async *complete(request: CompletionRequest): AsyncIterable<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured')
    }

    const { systemPrompt, userMessage } = this.buildMessages(request)

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic error: ${response.status} - ${error}`)
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
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6))
              if (json.type === 'content_block_delta' && json.delta?.text) {
                yield json.delta.text
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private buildMessages(request: CompletionRequest): { systemPrompt: string; userMessage: string } {
    const systemPrompt = `You are a helpful AI assistant helping a user understand a PDF document. When the user selects text from the document, you provide clear, helpful explanations. If the text contains technical terms, explain them. If it's a concept, provide context and examples where helpful. Keep your responses concise but thorough.`

    let userMessage = `I've selected the following text from a PDF document and would like help understanding it:

Selected text:
"""
${request.text}
"""`

    if (request.context) {
      userMessage += `

Surrounding context from the document:
"""
${request.context}
"""`
    }

    return { systemPrompt, userMessage }
  }
}
