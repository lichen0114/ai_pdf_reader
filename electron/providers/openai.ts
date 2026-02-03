import type { AIProvider, CompletionRequest } from './index'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

export class OpenAIProvider implements AIProvider {
  id = 'openai'
  name = 'OpenAI'
  type: 'cloud' = 'cloud'

  constructor(private apiKey: string) {}

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0
  }

  async *complete(request: CompletionRequest): AsyncIterable<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const messages = this.buildMessages(request)

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        stream: true,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI error: ${response.status} - ${error}`)
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
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const content = json.choices?.[0]?.delta?.content
              if (content) {
                yield content
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

  private buildMessages(request: CompletionRequest): Array<{ role: string; content: string }> {
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

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]
  }
}
