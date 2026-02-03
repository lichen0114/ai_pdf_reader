import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { server } from '../../setup'
import { http, HttpResponse } from 'msw'
import { OllamaProvider } from '@electron/providers/ollama'

describe('OllamaProvider', () => {
  let provider: OllamaProvider

  beforeEach(() => {
    provider = new OllamaProvider()
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('properties', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('ollama')
    })

    it('should have correct name', () => {
      expect(provider.name).toBe('Ollama (Local)')
    })

    it('should be a local provider', () => {
      expect(provider.type).toBe('local')
    })
  })

  describe('isAvailable', () => {
    it('should return true when Ollama service is running', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () => {
          return HttpResponse.json({ models: [{ name: 'llama3.2' }] })
        })
      )

      const result = await provider.isAvailable()

      expect(result).toBe(true)
    })

    it('should return false when Ollama service is not running', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () => {
          return HttpResponse.error()
        })
      )

      const result = await provider.isAvailable()

      expect(result).toBe(false)
    })

    it('should return false when request returns non-ok status', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () => {
          return HttpResponse.json({ error: 'Service error' }, { status: 500 })
        })
      )

      const result = await provider.isAvailable()

      expect(result).toBe(false)
    })
  })

  describe('complete', () => {
    it('should yield streamed response chunks', async () => {
      // Create a streaming response
      server.use(
        http.post('http://localhost:11434/api/generate', () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            async start(controller) {
              const chunks = [
                { response: 'Hello' },
                { response: ' world' },
                { response: '!' },
                { done: true },
              ]
              for (const chunk of chunks) {
                controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
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

      expect(chunks).toEqual(['Hello', ' world', '!'])
    })

    it('should include context in prompt when provided', async () => {
      let capturedBody: string | null = null

      server.use(
        http.post('http://localhost:11434/api/generate', async ({ request }) => {
          capturedBody = await request.text()
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(JSON.stringify({ response: 'ok' }) + '\n'))
              controller.close()
            },
          })
          return new Response(stream)
        })
      )

      const chunks: string[] = []
      for await (const chunk of provider.complete({
        text: 'selected text',
        context: 'surrounding context',
      })) {
        chunks.push(chunk)
      }

      expect(capturedBody).toContain('selected text')
      expect(capturedBody).toContain('surrounding context')
    })

    it('should throw error on non-ok response', async () => {
      server.use(
        http.post('http://localhost:11434/api/generate', () => {
          return HttpResponse.json({ error: 'Model not found' }, { status: 404 })
        })
      )

      await expect(async () => {
        for await (const _chunk of provider.complete({ text: 'test' })) {
          // consume
        }
      }).rejects.toThrow('Ollama error: 404')
    })

    it('should handle invalid JSON lines gracefully', async () => {
      server.use(
        http.post('http://localhost:11434/api/generate', () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('invalid json\n'))
              controller.enqueue(encoder.encode(JSON.stringify({ response: 'valid' }) + '\n'))
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
