import { http, HttpResponse } from 'msw'

// Helper to create a streaming response
function createStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
        // Small delay to simulate real streaming
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

// Ollama handlers
const ollamaHandlers = [
  // Check availability
  http.get('http://localhost:11434/api/tags', () => {
    return HttpResponse.json({
      models: [{ name: 'llama3.2' }],
    })
  }),

  // Generate completion (streaming)
  http.post('http://localhost:11434/api/generate', () => {
    const chunks = [
      JSON.stringify({ response: 'Hello' }) + '\n',
      JSON.stringify({ response: ' world' }) + '\n',
      JSON.stringify({ response: '!' }) + '\n',
      JSON.stringify({ done: true }) + '\n',
    ]
    return createStreamResponse(chunks)
  }),
]

// OpenAI handlers
const openaiHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const chunks = [
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }) + '\n\n',
      'data: ' + JSON.stringify({ choices: [{ delta: { content: ' from' } }] }) + '\n\n',
      'data: ' + JSON.stringify({ choices: [{ delta: { content: ' OpenAI' } }] }) + '\n\n',
      'data: [DONE]\n\n',
    ]
    return createStreamResponse(chunks)
  }),
]

// Anthropic handlers
const anthropicHandlers = [
  http.post('https://api.anthropic.com/v1/messages', ({ request }) => {
    const apiKey = request.headers.get('x-api-key')
    const version = request.headers.get('anthropic-version')

    if (!apiKey) {
      return HttpResponse.json({ error: 'Missing API key' }, { status: 401 })
    }
    if (!version) {
      return HttpResponse.json({ error: 'Missing version header' }, { status: 400 })
    }

    const chunks = [
      'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: 'Hello' } }) + '\n\n',
      'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: ' from' } }) + '\n\n',
      'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: ' Claude' } }) + '\n\n',
      'data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n',
    ]
    return createStreamResponse(chunks)
  }),
]

// Gemini handlers
const geminiHandlers = [
  http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent', ({ request }) => {
    const url = new URL(request.url)
    const apiKey = url.searchParams.get('key')

    if (!apiKey) {
      return HttpResponse.json({ error: 'Missing API key' }, { status: 401 })
    }

    const chunks = [
      'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello' }] } }] }) + '\n\n',
      'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: ' from' }] } }] }) + '\n\n',
      'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: ' Gemini' }] } }] }) + '\n\n',
    ]
    return createStreamResponse(chunks)
  }),
]

// Export all handlers
export const handlers = [
  ...ollamaHandlers,
  ...openaiHandlers,
  ...anthropicHandlers,
  ...geminiHandlers,
]

// Export individual handler groups for selective testing
export { ollamaHandlers, openaiHandlers, anthropicHandlers, geminiHandlers }

// Helper handlers for error scenarios
export const errorHandlers = {
  ollamaUnavailable: http.get('http://localhost:11434/api/tags', () => {
    return HttpResponse.error()
  }),

  ollamaTimeout: http.get('http://localhost:11434/api/tags', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    return HttpResponse.json({})
  }),

  openaiError: http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json(
      { error: { message: 'Rate limit exceeded' } },
      { status: 429 }
    )
  }),

  anthropicError: http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json(
      { error: { message: 'Invalid API key' } },
      { status: 401 }
    )
  }),

  geminiError: http.post(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent',
    () => {
      return HttpResponse.json(
        { error: { message: 'Quota exceeded' } },
        { status: 403 }
      )
    }
  ),
}
