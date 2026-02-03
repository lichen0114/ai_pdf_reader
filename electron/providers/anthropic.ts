import type { AIProvider, CompletionRequest, ActionType, ConversationMessage } from './index'

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

    const { systemPrompt, messages } = this.buildMessages(request)

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
        messages,
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

  private buildMessages(request: CompletionRequest): { systemPrompt: string; messages: Array<{ role: string; content: string }> } {
    const systemPrompt = `You are a helpful AI assistant helping a user understand a PDF document. Keep your responses concise but thorough.`

    const action = request.action || 'explain'
    const userMessage = this.buildUserMessage(request.text, request.context, action)

    // If there's conversation history (follow-up), include it
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      const messages = request.conversationHistory.map((msg: ConversationMessage) => ({
        role: msg.role,
        content: msg.content
      }))
      return { systemPrompt, messages }
    }

    return { systemPrompt, messages: [{ role: 'user', content: userMessage }] }
  }

  private buildUserMessage(text: string, context: string | undefined, action: ActionType): string {
    let prompt = ''

    switch (action) {
      case 'summarize':
        prompt = `Summarize the key points of this text from a PDF document:\n\n"${text}"`
        break
      case 'define':
        prompt = `Define and explain this term or concept from a PDF document:\n\n"${text}"`
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
        break
      case 'explain_fundamental':
        prompt = `Explain this concept using first principles, starting from the most fundamental ideas. Make any technical terms you use **bold** so they can be clicked for further explanation.

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
        break
      case 'explain':
      default:
        prompt = `Explain this text from a PDF document in simple terms:\n\n"${text}"`
        if (context) {
          prompt += `\n\nSurrounding context from the document:\n"${context}"`
        }
        break
    }

    return prompt
  }
}
