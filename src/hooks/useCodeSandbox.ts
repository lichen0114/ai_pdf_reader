import { useState, useCallback, useRef } from 'react'
import type { CodeRuntime, OutputLine } from '../types/code'
import { detectRuntime } from '../types/code'
import { getRunner, type CodeRunner } from '../services/codeRunner'

interface UseCodeSandboxOptions {
  onSimulationStart?: () => void
  onSimulationEnd?: () => void
}

export function useCodeSandbox(options: UseCodeSandboxOptions = {}) {
  const { onSimulationStart, onSimulationEnd } = options

  const [isOpen, setIsOpen] = useState(false)
  const [originalCode, setOriginalCode] = useState('')
  const [editedCode, setEditedCode] = useState('')
  const [runtime, setRuntimeState] = useState<CodeRuntime>('javascript')
  const [output, setOutput] = useState<OutputLine[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRuntimeReady, setIsRuntimeReady] = useState(true)
  const [isLoadingRuntime, setIsLoadingRuntime] = useState(false)

  const runnerRef = useRef<CodeRunner | null>(null)

  /**
   * Open the code sandbox with initial code
   */
  const openSandbox = useCallback(async (code: string) => {
    // Clean the code (remove markdown code block markers)
    let cleanCode = code.trim()
    const codeBlockMatch = cleanCode.match(/^```(\w+)?\n([\s\S]+?)```$/m)
    if (codeBlockMatch) {
      cleanCode = codeBlockMatch[2].trim()
    }

    // Detect runtime
    const detectedRuntime = detectRuntime(cleanCode)

    setOriginalCode(cleanCode)
    setEditedCode(cleanCode)
    setRuntimeState(detectedRuntime)
    setOutput([])
    setError(null)
    setIsOpen(true)
    onSimulationStart?.()

    // Initialize the runner
    const runner = getRunner(detectedRuntime)
    runnerRef.current = runner

    if (!runner.isReady) {
      setIsRuntimeReady(false)
      setIsLoadingRuntime(true)
      try {
        await runner.initialize()
        setIsRuntimeReady(true)
      } catch (err) {
        setError(`Failed to load ${detectedRuntime} runtime: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setIsLoadingRuntime(false)
      }
    }
  }, [onSimulationStart])

  /**
   * Close the sandbox
   */
  const closeSandbox = useCallback(() => {
    // Interrupt any running code
    runnerRef.current?.interrupt()

    setIsOpen(false)
    setOriginalCode('')
    setEditedCode('')
    setOutput([])
    setError(null)
    setIsRunning(false)
    onSimulationEnd?.()
  }, [onSimulationEnd])

  /**
   * Update the code in the editor
   */
  const updateCode = useCallback((code: string) => {
    setEditedCode(code)
  }, [])

  /**
   * Switch runtime
   */
  const setRuntime = useCallback(async (newRuntime: CodeRuntime) => {
    if (newRuntime === runtime) return

    setRuntimeState(newRuntime)
    const runner = getRunner(newRuntime)
    runnerRef.current = runner

    if (!runner.isReady) {
      setIsRuntimeReady(false)
      setIsLoadingRuntime(true)
      try {
        await runner.initialize()
        setIsRuntimeReady(true)
      } catch (err) {
        setError(`Failed to load ${newRuntime} runtime: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setIsLoadingRuntime(false)
      }
    } else {
      setIsRuntimeReady(true)
    }
  }, [runtime])

  /**
   * Run the code
   */
  const runCode = useCallback(async () => {
    if (!runnerRef.current || !isRuntimeReady || isRunning) return

    setIsRunning(true)
    setError(null)
    setOutput([])

    // Add system message
    setOutput(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'system',
      content: `Running ${runtime}...`,
      timestamp: Date.now(),
    }])

    try {
      const result = await runnerRef.current.execute(editedCode, (line) => {
        setOutput(prev => [...prev, line])
      })

      // Add execution time
      setOutput(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'system',
        content: `Execution completed in ${result.executionTime.toFixed(1)}ms`,
        timestamp: Date.now(),
      }])

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setOutput(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'stderr',
        content: message,
        timestamp: Date.now(),
      }])
    } finally {
      setIsRunning(false)
    }
  }, [runtime, editedCode, isRuntimeReady, isRunning])

  /**
   * Stop running code
   */
  const stopCode = useCallback(() => {
    runnerRef.current?.interrupt()
    setIsRunning(false)
    setOutput(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'system',
      content: 'Execution interrupted',
      timestamp: Date.now(),
    }])
  }, [])

  /**
   * Clear output
   */
  const clearOutput = useCallback(() => {
    setOutput([])
    setError(null)
  }, [])

  /**
   * Reset code to original
   */
  const resetCode = useCallback(() => {
    setEditedCode(originalCode)
  }, [originalCode])

  return {
    // State
    isOpen,
    originalCode,
    editedCode,
    runtime,
    output,
    isRunning,
    error,
    isRuntimeReady,
    isLoadingRuntime,

    // Actions
    openSandbox,
    closeSandbox,
    updateCode,
    setRuntime,
    runCode,
    stopCode,
    clearOutput,
    resetCode,
  }
}
