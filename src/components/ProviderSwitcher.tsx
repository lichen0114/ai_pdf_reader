import { useState, useEffect, useRef } from 'react'

interface ProviderInfo {
  id: string
  name: string
  type: 'local' | 'cloud'
  available?: boolean
}

interface ProviderSwitcherProps {
  onSettingsClick: () => void
  refreshKey?: number
}

function ProviderSwitcher({ onSettingsClick, refreshKey }: ProviderSwitcherProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [currentProvider, setCurrentProvider] = useState<ProviderInfo | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.api) {
      loadProviders()
    }
  }, [refreshKey])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadProviders = async () => {
    if (!window.api) return
    try {
      const [providerList, current] = await Promise.all([
        window.api.getProviders(),
        window.api.getCurrentProvider(),
      ])
      setProviders(providerList as ProviderInfo[])

      if (current) {
        const currentWithAvailability = providerList.find((p) => p.id === current.id) as ProviderInfo | undefined

        // If current provider is unavailable, auto-select the first available one
        if (currentWithAvailability && !currentWithAvailability.available) {
          const firstAvailable = providerList.find((p) => p.available) as ProviderInfo | undefined
          if (firstAvailable) {
            await window.api.setCurrentProvider(firstAvailable.id)
            setCurrentProvider(firstAvailable)
            return
          }
        }

        setCurrentProvider((currentWithAvailability || current) as ProviderInfo)
      }
    } catch (err) {
      console.error('Failed to load providers:', err)
    }
  }

  const selectProvider = async (provider: ProviderInfo) => {
    if (!window.api) return
    try {
      await window.api.setCurrentProvider(provider.id)
      setCurrentProvider(provider)
      setIsOpen(false)
    } catch (err) {
      console.error('Failed to set provider:', err)
    }
  }

  const getStatusColor = (provider: ProviderInfo) => {
    if (!provider.available) return 'bg-gray-500'
    return provider.type === 'local' ? 'bg-provider-local' : 'bg-provider-cloud'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm"
      >
        {currentProvider && (
          <>
            <span
              className={`w-2 h-2 rounded-full ${getStatusColor(currentProvider)}`}
            />
            <span className="text-gray-200">{currentProvider.name}</span>
          </>
        )}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">AI Provider</p>
          </div>

          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => selectProvider(provider)}
              disabled={!provider.available}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-700 ${
                !provider.available ? 'opacity-50 cursor-not-allowed' : ''
              } ${currentProvider?.id === provider.id ? 'bg-gray-700' : ''}`}
            >
              <span className={`w-2 h-2 rounded-full ${getStatusColor(provider)}`} />
              <div className="flex-1">
                <p className="text-sm text-gray-200">{provider.name}</p>
                <p className="text-xs text-gray-500">
                  {provider.type === 'local' ? 'Local' : 'Cloud'}
                  {!provider.available && ' · Not configured'}
                </p>
              </div>
              {currentProvider?.id === provider.id && (
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}

          <div className="border-t border-gray-700 mt-1 pt-1">
            <button
              onClick={() => {
                setIsOpen(false)
                onSettingsClick()
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-700"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm text-gray-200">Settings</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProviderSwitcher
