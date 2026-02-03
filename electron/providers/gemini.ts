import type { AIProvider, CompletionRequest, ActionType, ConversationMessage } from './index'

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

    const contents = this.buildContents(request)

    const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}&alt=sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
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

  private buildContents(request: CompletionRequest): Array<{ role: string; parts: Array<{ text: string }> }> {
    const action = request.action || 'explain'

    // If there's conversation history (follow-up), include it
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      return request.conversationHistory.map((msg: ConversationMessage) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))
    }

    const prompt = this.buildPrompt(request.text, request.context, action)
    return [{ role: 'user', parts: [{ text: prompt }] }]
  }

  private buildPrompt(text: string, context: string | undefined, action: ActionType): string {
    let prompt = 'You are a helpful AI assistant helping a user understand a PDF document.\n\n'

    switch (action) {
      case 'summarize':
        prompt += `Summarize the key points of this text:\n\n"${text}"`
        break
      case 'define':
        prompt += `Define and explain this term or concept:\n\n"${text}"`
        if (context) {
          prompt += `\n\nContext from the document:\n"${context}"`
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

Equation to analyze: "${text}"`
        return prompt
      case 'explain_fundamental':
        prompt += `Explain this concept using first principles, starting from the most fundamental ideas. Make any technical terms you use **bold** so they can be clicked for further explanation.

Keep the explanation concise but thorough. Focus on building understanding from the ground up.

Concept: "${text}"`
        if (context) {
          prompt += `\n\nContext from the document:\n"${context}"`
        }
        break
      case 'extract_terms':
        prompt = `Extract the technical terms from this text that could benefit from further explanation. Return ONLY a JSON array of term objects (no markdown, no explanation):

[{"term": "technical_term", "description": "brief_description"}]

Text: "${text}"`
        return prompt
      case 'explain':
      default:
        prompt += `Explain this text in simple terms:\n\n"${text}"`
        if (context) {
          prompt += `\n\nSurrounding context from the document:\n"${context}"`
        }
        break
    }

    prompt += '\n\nKeep your response concise but thorough.'
    return prompt
  }
}
