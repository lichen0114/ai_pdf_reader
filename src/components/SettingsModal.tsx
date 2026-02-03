import { useState, useEffect } from 'react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onKeyChange?: () => void
}

interface ProviderConfig {
  id: string
  name: string
  type: 'local' | 'cloud'
  hasKey: boolean
  placeholder: string
}

const CLOUD_PROVIDERS: Omit<ProviderConfig, 'hasKey'>[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'cloud',
    placeholder: 'Enter your Gemini API key',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    placeholder: 'Enter your OpenAI API key (sk-...)',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    type: 'cloud',
    placeholder: 'Enter your Anthropic API key (sk-ant-...)',
  },
]

function SettingsModal({ isOpen, onClose, onKeyChange }: SettingsModalProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyValue, setKeyValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadKeyStatus()
    }
  }, [isOpen])

  const loadKeyStatus = async () => {
    if (!window.api) {
      setProviders(CLOUD_PROVIDERS.map(p => ({ ...p, hasKey: false })))
      return
    }
    const configs = await Promise.all(
      CLOUD_PROVIDERS.map(async (p) => ({
        ...p,
        hasKey: await window.api.hasApiKey(p.id),
      }))
    )
    setProviders(configs)
  }

  const handleSaveKey = async (providerId: string) => {
    if (!keyValue.trim()) {
      setError('Please enter an API key')
      return
    }
    if (!window.api) {
      setError('API not available')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await window.api.setApiKey(providerId, keyValue.trim())
      await loadKeyStatus()
      setEditingKey(null)
      setKeyValue('')
      onKeyChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKey = async (providerId: string) => {
    if (!window.api) return
    try {
      await window.api.deleteApiKey(providerId)
      await loadKeyStatus()
      onKeyChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key')
    }
  }

  const handleCancel = () => {
    setEditingKey(null)
    setKeyValue('')
    setError(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-200">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Local provider info */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Local AI</h3>
            <div className="p-4 bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-provider-local" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Ollama</p>
                  <p className="text-xs text-gray-400">
                    Runs locally on your machine. No API key required.
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Make sure Ollama is running at http://localhost:11434
              </p>
            </div>
          </div>

          {/* Cloud providers */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Cloud AI Providers</h3>
            <div className="space-y-3">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="p-4 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-3 h-3 rounded-full ${
                          provider.hasKey ? 'bg-provider-cloud' : 'bg-gray-500'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-200">{provider.name}</p>
                        <p className="text-xs text-gray-400">
                          {provider.hasKey ? 'API key configured' : 'No API key'}
                        </p>
                      </div>
                    </div>

                    {editingKey !== provider.id && (
                      <div className="flex items-center gap-2">
                        {provider.hasKey && (
                          <button
                            onClick={() => handleDeleteKey(provider.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingKey(provider.id)
                            setKeyValue('')
                            setError(null)
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          {provider.hasKey ? 'Update' : 'Add key'}
                        </button>
                      </div>
                    )}
                  </div>

                  {editingKey === provider.id && (
                    <div className="mt-3">
                      <input
                        type="password"
                        value={keyValue}
                        onChange={(e) => setKeyValue(e.target.value)}
                        placeholder={provider.placeholder}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                      {error && (
                        <p className="mt-2 text-xs text-red-400">{error}</p>
                      )}
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveKey(provider.id)}
                          disabled={saving}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Security note */}
          <div className="mt-6 p-3 bg-gray-700/30 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <p className="text-xs text-gray-400">
                API keys are encrypted and stored securely on your device using your operating
                system's secure storage. They are never sent anywhere except to the respective
                AI provider.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
