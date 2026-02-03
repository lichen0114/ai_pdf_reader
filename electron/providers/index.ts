import { OllamaProvider } from './ollama'
import { GeminiProvider } from './gemini'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'
import { KeyStore } from '../security/key-store'

export interface CompletionRequest {
  text: string
  context?: string
}

export interface AIProvider {
  id: string
  name: string
  type: 'local' | 'cloud'
  complete(request: CompletionRequest): AsyncIterable<string>
  isAvailable(): Promise<boolean>
}

export class ProviderManager {
  private providers: Map<string, AIProvider> = new Map()
  private currentProviderId: string = 'ollama'

  constructor() {
    this.initializeProviders()
  }

  private initializeProviders() {
    // Local providers (always available to register)
    this.providers.set('ollama', new OllamaProvider())

    // Cloud providers (need API keys)
    const geminiKey = KeyStore.getKey('gemini')
    if (geminiKey) {
      this.providers.set('gemini', new GeminiProvider(geminiKey))
    } else {
      this.providers.set('gemini', new GeminiProvider(''))
    }

    const openaiKey = KeyStore.getKey('openai')
    if (openaiKey) {
      this.providers.set('openai', new OpenAIProvider(openaiKey))
    } else {
      this.providers.set('openai', new OpenAIProvider(''))
    }

    const anthropicKey = KeyStore.getKey('anthropic')
    if (anthropicKey) {
      this.providers.set('anthropic', new AnthropicProvider(anthropicKey))
    } else {
      this.providers.set('anthropic', new AnthropicProvider(''))
    }
  }

  refreshProviders() {
    this.initializeProviders()
  }

  getProvider(id?: string): AIProvider | undefined {
    const providerId = id || this.currentProviderId
    return this.providers.get(providerId)
  }

  getCurrentProvider(): AIProvider | undefined {
    return this.providers.get(this.currentProviderId)
  }

  setCurrentProvider(id: string): boolean {
    if (this.providers.has(id)) {
      this.currentProviderId = id
      return true
    }
    return false
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values())
  }
}
