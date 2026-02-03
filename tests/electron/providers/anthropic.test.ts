import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { server } from '../../setup'
import { http, HttpResponse } from 'msw'
import { AnthropicProvider } from '@electron/providers/anthropic'

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider
  const testApiKey = 'sk-ant-test-api-key-12345'

  beforeEach(() => {
    provider = new AnthropicProvider(testApiKey)
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('properties', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('anthropic')
    })

    it('should have correct name', () => {
      expect(provider.name).toBe('Claude')
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
      const providerWithoutKey = new AnthropicProvider('')

      const result = await providerWithoutKey.isAvailable()

      expect(result).toBe(false)
    })

    it('should return false when API key is undefined', async () => {
      const providerWithoutKey = new AnthropicProvider(undefined as unknown as string)

      const result = await providerWithoutKey.isAvailable()

      expect(result).toBe(false)
    })
  })

  describe('complete', () => {
    it('should yield streamed response chunks', async () => {
      server.use(
        http.post('https://api.anthropic.com/v1/messages', () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            async start(controller) {
              const chunks = [
                'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: 'Hello' } }) + '\n\n',
                'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: ' from' } }) + '\n\n',
                'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: ' Claude' } }) + '\n\n',
                'data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n',
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

      expect(chunks).toEqual(['Hello', ' from', ' Claude'])
    })

    it('should include x-api-key header', async () => {
      let capturedApiKey: string | null = null

      server.use(
        http.post('https://api.anthropic.com/v1/messages', ({ request }) => {
          capturedApiKey = request.headers.get('x-api-key')
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n'))
              controller.close()
            },
          })
          return new Response(stream)
        })
      )

      for await (const _chunk of provider.complete({ text: 'test' })) {
        // consume
      }

      expect(capturedApiKey).toBe(testApiKey)
    })

    it('should include anthropic-version header', async () => {
      let capturedVersion: string | null = null

      server.use(
        http.post('https://api.anthropic.com/v1/messages', ({ request }) => {
          capturedVersion = request.headers.get('anthropic-version')
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n'))
              controller.close()
            },
          })
          return new Response(stream)
        })
      )

      for await (const _chunk of provider.complete({ text: 'test' })) {
        // consume
      }

      expect(capturedVersion).toBe('2023-06-01')
    })

    it('should throw error when API key is not configured', async () => {
      const providerWithoutKey = new AnthropicProvider('')

      await expect(async () => {
        for await (const _chunk of providerWithoutKey.complete({ text: 'test' })) {
          // consume
        }
      }).rejects.toThrow('Anthropic API key not configured')
    })

    it('should throw error on API error response', async () => {
      server.use(
        http.post('https://api.anthropic.com/v1/messages', () => {
          return HttpResponse.json(
            { error: { message: 'Invalid API key' } },
            { status: 401 }
          )
        })
      )

      await expect(async () => {
        for await (const _chunk of provider.complete({ text: 'test' })) {
          // consume
        }
      }).rejects.toThrow('Anthropic error: 401')
    })

    it('should include context in message when provided', async () => {
      let capturedBody: unknown = null

      server.use(
        http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
          capturedBody = await request.json()
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n'))
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
      expect(body.messages[0].content).toContain('selected text')
      expect(body.messages[0].content).toContain('surrounding context')
    })

    it('should only yield content from content_block_delta events', async () => {
      server.use(
        http.post('https://api.anthropic.com/v1/messages', () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              // Various event types - only content_block_delta should yield
              const chunks = [
                'data: ' + JSON.stringify({ type: 'message_start' }) + '\n\n',
                'data: ' + JSON.stringify({ type: 'content_block_start' }) + '\n\n',
                'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: 'actual content' } }) + '\n\n',
                'data: ' + JSON.stringify({ type: 'content_block_stop' }) + '\n\n',
                'data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n',
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
      for await (const chunk of provider.complete({ text: 'test' })) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['actual content'])
    })

    it('should request streaming mode', async () => {
      let capturedBody: unknown = null

      server.use(
        http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
          capturedBody = await request.json()
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n'))
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
  })
})
