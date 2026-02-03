import { safeStorage } from 'electron'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const KEYS_FILE = 'api-keys.encrypted'

interface EncryptedKeys {
  [providerId: string]: string // base64 encoded encrypted data
}

export class KeyStore {
  private static keysPath: string | null = null
  private static cache: Map<string, string> = new Map()

  private static getKeysPath(): string {
    if (!this.keysPath) {
      const userDataPath = app.getPath('userData')
      this.keysPath = path.join(userDataPath, KEYS_FILE)
    }
    return this.keysPath
  }

  private static loadKeys(): EncryptedKeys {
    try {
      const keysPath = this.getKeysPath()
      if (fs.existsSync(keysPath)) {
        const data = fs.readFileSync(keysPath, 'utf-8')
        return JSON.parse(data)
      }
    } catch (error) {
      console.error('Error loading keys:', error)
    }
    return {}
  }

  private static saveKeys(keys: EncryptedKeys): void {
    try {
      const keysPath = this.getKeysPath()
      const dir = path.dirname(keysPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2))
    } catch (error) {
      console.error('Error saving keys:', error)
    }
  }

  static setKey(providerId: string, apiKey: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('Encryption not available, storing key in plain text')
      // Fallback: store in cache only (not persisted securely)
      this.cache.set(providerId, apiKey)
      return
    }

    const encrypted = safeStorage.encryptString(apiKey)
    const base64 = encrypted.toString('base64')

    const keys = this.loadKeys()
    keys[providerId] = base64
    this.saveKeys(keys)

    // Update cache
    this.cache.set(providerId, apiKey)
  }

  static getKey(providerId: string): string | null {
    // Check cache first
    if (this.cache.has(providerId)) {
      return this.cache.get(providerId) || null
    }

    if (!safeStorage.isEncryptionAvailable()) {
      return null
    }

    const keys = this.loadKeys()
    const encrypted = keys[providerId]

    if (!encrypted) {
      return null
    }

    try {
      const buffer = Buffer.from(encrypted, 'base64')
      const decrypted = safeStorage.decryptString(buffer)
      // Update cache
      this.cache.set(providerId, decrypted)
      return decrypted
    } catch (error) {
      console.error('Error decrypting key:', error)
      return null
    }
  }

  static hasKey(providerId: string): boolean {
    if (this.cache.has(providerId)) {
      return true
    }

    const keys = this.loadKeys()
    return !!keys[providerId]
  }

  static deleteKey(providerId: string): boolean {
    this.cache.delete(providerId)

    const keys = this.loadKeys()
    if (keys[providerId]) {
      delete keys[providerId]
      this.saveKeys(keys)
      return true
    }
    return false
  }

  static getAllProviderIds(): string[] {
    const keys = this.loadKeys()
    return Object.keys(keys)
  }
}
