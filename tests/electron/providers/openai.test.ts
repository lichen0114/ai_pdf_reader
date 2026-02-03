import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { server } from '../../setup'
import { http, HttpResponse } from 'msw'
import { OpenAIProvider } from '@electron/providers/openai'

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider
  const testApiKey = 'sk-test-api-key-12345'

  beforeEach(() => {
    provider = new OpenAIProvider(testApiKey)
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('properties', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('openai')
    })

    it('should have correct name', () => {
      expect(provider.name).toBe('OpenAI')
    })

    it('should be a cloud provider', () => {
      expect(provider.type).toBe('cloud')
    })
  })

  describe('isAvailable', () => {
    it('should return true when API key is provided', async () => {
      const result = await provider.isAvailable()

      expect(result).toBe(true)
    })

    it('should return false when API key is empty', async () => {
      const providerWithoutKey = new OpenAIProvider('')

      const result = await providerWithoutKey.isAvailable()

      expect(result).toBe(false)
    })

    it('should return false when API key is undefined', async () => {
      const providerWithoutKey = new OpenAIProvider(undefined as unknown as string)

      const result = await providerWithoutKey.isAvailable()

      expect(result).toBe(false)
    })
  })

  describe('complete', () => {
    it('should yield streamed response chunks', async () => {
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            async start(controller) {
              const chunks = [
                'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }) + '\n\n',
                'data: ' + JSON.stringify({ choices: [{ delta: { content: ' from' } }] }) + '\n\n',
                'data: ' + JSON.stringify({ choices: [{ delta: { content: ' OpenAI' } }] }) + '\n\n',
                'data: [DONE]\n\n',
              ]
              for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk))
              }
              controller.close()
            },
          })
          return new Response(stream)
        })
      )

      const chunks: string[] = []
      for await (const chunk of provider.complete({ text: 'test query' })) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['Hello', ' from', ' OpenAI'])
    })

    it('should include Authorization header with Bearer token', async () => {
      let capturedAuth: string | null = null

      server.use(
        http.post('https://api.openai.com/v1/chat/completions', ({ request }) => {
          capturedAuth = request.headers.get('Authorization')
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            },
          })
          return new Response(stream)
        })
      )

      for await (const _chunk of provider.complete({ text: 'test' })) {
        // consume
      }

      expect(capturedAuth).toBe(`Bearer ${testApiKey}`)
    })

    it('should throw error when API key is not configured', async () => {
      const providerWithoutKey = new OpenAIProvider('')

      await expect(async () => {
        for await (const _chunk of providerWithoutKey.complete({ text: 'test' })) {
          // consume
        }
      }).rejects.toThrow('OpenAI API key not configured')
    })

    it('should throw error on API error response', async () => {
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json(
            { error: { message: 'Rate limit exceeded' } },
            { status: 429 }
          )
        })
      )

      await expect(async () => {
        for await (const _chunk of provider.complete({ text: 'test' })) {
          // consume
        }
      }).rejects.toThrow('OpenAI error: 429')
    })

    it('should include context in messages when provided', async () => {
      let capturedBody: unknown = null

      server.use(
        http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
          capturedBody = await request.json()
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            },
          })
          return new Response(stream)
        })
      )

      for await (const _chunk of provider.complete({
        text: 'selected text',
        context: 'surrounding context',
      })) {
        // consume
      }

      const body = capturedBody as { messages: Array<{ content: string }> }
      const userMessage = body.messages.find((m) => m.content.includes('selected text'))
      expect(userMessage?.content).toContain('selected text')
      expect(userMessage?.content).toContain('surrounding context')
    })

    it('should request streaming mode', async () => {
      let capturedBody: unknown = null

      server.use(
        http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
          capturedBody = await request.json()
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            },
          })
          return new Response(stream)
        })
      )

      for await (const _chunk of provider.complete({ text: 'test' })) {
        // consume
      }

      expect((capturedBody as { stream: boolean }).stream).toBe(true)
    })

    it('should skip [DONE] markers', async () => {
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: 'text' } }] }) + '\n\n'))
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            },
          })
          return new Response(stream)
        })
      )

      const chunks: string[] = []
      for await (const chunk of provider.complete({ text: 'test' })) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['text'])
    })
  })
})
