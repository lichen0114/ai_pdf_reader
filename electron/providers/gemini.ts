import type { AIProvider, CompletionRequest } from './index'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent'

export class GeminiProvider implements AIProvider {
  id = 'gemini'
  name = 'Gemini'
  type: 'cloud' = 'cloud'

  constructor(private apiKey: string) {}

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0
  }

  async *complete(request: CompletionRequest): AsyncIterable<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured')
    }

    const prompt = this.buildPrompt(request)

    const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}&alt=sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini error: ${response.status} - ${error}`)
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
              const content = json.candidates?.[0]?.content?.parts?.[0]?.text
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
