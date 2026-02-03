import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { server } from '../../setup'
import { http, HttpResponse } from 'msw'
import { GeminiProvider } from '@electron/providers/gemini'

describe('GeminiProvider', () => {
  let provider: GeminiProvider
  const testApiKey = 'test-gemini-api-key-12345'

  beforeEach(() => {
    provider = new GeminiProvider(testApiKey)
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('properties', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('gemini')
    })

    it('should have correct name', () => {
      expect(provider.name).toBe('Gemini')
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
      const providerWithoutKey = new GeminiProvider('')

      const result = await providerWithoutKey.isAvailable()

      expect(result).toBe(false)
    })

    it('should return false when API key is undefined', async () => {
      const providerWithoutKey = new GeminiProvider(undefined as unknown as string)

      const result = await providerWithoutKey.isAvailable()

      expect(result).toBe(false)
    })
  })

  describe('complete', () => {
    it('should yield streamed response chunks', async () => {
      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent', () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            async start(controller) {
              const chunks = [
                'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello' }] } }] }) + '\n\n',
                'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: ' from' }] } }] }) + '\n\n',
                'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: ' Gemini' }] } }] }) + '\n\n',
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

      expect(chunks).toEqual(['Hello', ' from', ' Gemini'])
    })

    it('should include API key as query parameter', async () => {
      let capturedUrl: string | null = null

      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent', ({ request }) => {
          capturedUrl = request.url
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ candidates: [] }) + '\n\n'))
              controller.close()
            },
          })
          return new Response(stream)
        })
      )

      for await (const _chunk of provider.complete({ text: 'test' })) {
        // consume
      }

      expect(capturedUrl).toContain(`key=${testApiKey}`)
    })

    it('should include alt=sse query parameter', async () => {
      let capturedUrl: string | null = null

      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent', ({ request }) => {
          capturedUrl = request.url
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ candidates: [] }) + '\n\n'))
              controller.close()
            },
          })
          return new Response(stream)
        })
      )

      for await (const _chunk of provider.complete({ text: 'test' })) {
        // consume
      }

      expect(capturedUrl).toContain('alt=sse')
    })

    it('should throw error when API key is not configured', async () => {
      const providerWithoutKey = new GeminiProvider('')

      await expect(async () => {
        for await (const _chunk of providerWithoutKey.complete({ text: 'test' })) {
          // consume
        }
      }).rejects.toThrow('Gemini API key not configured')
    })

    it('should throw error on API error response', async () => {
      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent', () => {
          return HttpResponse.json(
            { error: { message: 'Quota exceeded' } },
            { status: 403 }
          )
        })
      )

      await expect(async () => {
        for await (const _chunk of provider.complete({ text: 'test' })) {
          // consume
        }
      }).rejects.toThrow('Gemini error: 403')
    })

    it('should include context in prompt when provided', async () => {
      let capturedBody: unknown = null

      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent', async ({ request }) => {
          capturedBody = await request.json()
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ candidates: [] }) + '\n\n'))
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

      const body = capturedBody as { contents: Array<{ parts: Array<{ text: string }> }> }
      const prompt = body.contents[0].parts[0].text
      expect(prompt).toContain('selected text')
      expect(prompt).toContain('surrounding context')
    })

    it('should handle empty candidates array', async () => {
      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent', () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ candidates: [] }) + '\n\n'))
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

      expect(chunks).toEqual([])
    })

    it('should handle malformed JSON gracefully', async () => {
      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent', () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: invalid json\n\n'))
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'valid' }] } }] }) + '\n\n'))
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

      expect(chunks).toEqual(['valid'])
    })
  })
})
