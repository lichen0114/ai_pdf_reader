import type { CodeRuntime, CodeExecutionResult, OutputLine } from '../types/code'

/**
 * Abstract code runner interface
 */
export interface CodeRunner {
  runtime: CodeRuntime
  isReady: boolean
  initialize(): Promise<void>
  execute(code: string, onOutput?: (line: OutputLine) => void): Promise<CodeExecutionResult>
  interrupt(): void
}

/**
 * JavaScript code runner using sandboxed eval
 */
export class JavaScriptRunner implements CodeRunner {
  runtime: CodeRuntime = 'javascript'
  isReady = true
  private currentExecution: { aborted: boolean } | null = null

  async initialize(): Promise<void> {
    // JavaScript runner is always ready
    this.isReady = true
  }

  async execute(code: string, onOutput?: (line: OutputLine) => void): Promise<CodeExecutionResult> {
    const execution = { aborted: false }
    this.currentExecution = execution
    const startTime = performance.now()
    const outputs: string[] = []

    try {
      // Create a sandboxed console
      const sandboxedConsole = {
        log: (...args: unknown[]) => {
          const content = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ')
          outputs.push(content)
          onOutput?.({
            id: crypto.randomUUID(),
            type: 'stdout',
            content,
            timestamp: Date.now(),
          })
        },
        error: (...args: unknown[]) => {
          const content = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ')
          outputs.push(`[Error] ${content}`)
          onOutput?.({
            id: crypto.randomUUID(),
            type: 'stderr',
            content,
            timestamp: Date.now(),
          })
        },
        warn: (...args: unknown[]) => {
          const content = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ')
          outputs.push(`[Warning] ${content}`)
          onOutput?.({
            id: crypto.randomUUID(),
            type: 'stdout',
            content: `[Warning] ${content}`,
            timestamp: Date.now(),
          })
        },
      }

      // Create a sandboxed function with limited globals
      const sandboxedGlobals = {
        console: sandboxedConsole,
        Math,
        JSON,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        String,
        Number,
        Boolean,
        Array,
        Object,
        Date,
        RegExp,
        Map,
        Set,
        Promise,
        setTimeout: (fn: () => void, ms: number) => {
          if (ms > 5000) ms = 5000 // Cap timeout at 5 seconds
          return setTimeout(() => {
            if (!execution.aborted) fn()
          }, ms)
        },
      }

      // Execute in a new Function scope
      const fn = new Function(
        ...Object.keys(sandboxedGlobals),
        `"use strict";\n${code}`
      )

      const result = await Promise.race([
        Promise.resolve(fn(...Object.values(sandboxedGlobals))),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout (10s)')), 10000)
        ),
      ])

      // If there's a return value, output it
      if (result !== undefined) {
        const resultStr = typeof result === 'object'
          ? JSON.stringify(result, null, 2)
          : String(result)
        outputs.push(`=> ${resultStr}`)
        onOutput?.({
          id: crypto.randomUUID(),
          type: 'stdout',
          content: `=> ${resultStr}`,
          timestamp: Date.now(),
        })
      }

      const executionTime = performance.now() - startTime
      return {
        output: outputs.join('\n'),
        executionTime,
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      const executionTime = performance.now() - startTime
      onOutput?.({
        id: crypto.randomUUID(),
        type: 'stderr',
        content: error,
        timestamp: Date.now(),
      })
      return {
        output: outputs.join('\n'),
        error,
        executionTime,
      }
    } finally {
      this.currentExecution = null
    }
  }

  interrupt(): void {
    if (this.currentExecution) {
      this.currentExecution.aborted = true
    }
  }
}

/**
 * Python code runner using Pyodide (loaded lazily)
 */
export class PythonRunner implements CodeRunner {
  runtime: CodeRuntime = 'python'
  isReady = false
  private pyodide: unknown = null
  private loadingPromise: Promise<void> | null = null
  private currentExecution: { aborted: boolean } | null = null

  async initialize(): Promise<void> {
    if (this.isReady) return
    if (this.loadingPromise) return this.loadingPromise

    this.loadingPromise = this._loadPyodide()
    return this.loadingPromise
  }

  private async _loadPyodide(): Promise<void> {
    try {
      // Load Pyodide from CDN
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js'
      document.head.appendChild(script)

      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Pyodide'))
      })

      // Initialize Pyodide
      // @ts-expect-error - Pyodide is loaded globally
      this.pyodide = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
      })

      this.isReady = true
    } catch (err) {
      console.error('Failed to initialize Pyodide:', err)
      throw err
    }
  }

  async execute(code: string, onOutput?: (line: OutputLine) => void): Promise<CodeExecutionResult> {
    if (!this.isReady || !this.pyodide) {
      throw new Error('Python runtime not initialized. Call initialize() first.')
    }

    const execution = { aborted: false }
    this.currentExecution = execution
    const startTime = performance.now()
    const outputs: string[] = []

    try {
      const pyodide = this.pyodide as {
        runPythonAsync: (code: string) => Promise<unknown>
        setStdout: (opts: { batched: (msg: string) => void }) => void
        setStderr: (opts: { batched: (msg: string) => void }) => void
      }

      // Redirect stdout/stderr
      pyodide.setStdout({
        batched: (msg: string) => {
          if (execution.aborted) return
          outputs.push(msg)
          onOutput?.({
            id: crypto.randomUUID(),
            type: 'stdout',
            content: msg,
            timestamp: Date.now(),
          })
        },
      })

      pyodide.setStderr({
        batched: (msg: string) => {
          if (execution.aborted) return
          outputs.push(msg)
          onOutput?.({
            id: crypto.randomUUID(),
            type: 'stderr',
            content: msg,
            timestamp: Date.now(),
          })
        },
      })

      // Execute with timeout
      const result = await Promise.race([
        pyodide.runPythonAsync(code),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout (30s)')), 30000)
        ),
      ])

      // If there's a return value, output it
      if (result !== undefined && result !== null) {
        const resultStr = String(result)
        outputs.push(`=> ${resultStr}`)
        onOutput?.({
          id: crypto.randomUUID(),
          type: 'stdout',
          content: `=> ${resultStr}`,
          timestamp: Date.now(),
        })
      }

      const executionTime = performance.now() - startTime
      return {
        output: outputs.join('\n'),
        executionTime,
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      const executionTime = performance.now() - startTime
      onOutput?.({
        id: crypto.randomUUID(),
        type: 'stderr',
        content: error,
        timestamp: Date.now(),
      })
      return {
        output: outputs.join('\n'),
        error,
        executionTime,
      }
    } finally {
      this.currentExecution = null
    }
  }

  interrupt(): void {
    if (this.currentExecution) {
      this.currentExecution.aborted = true
    }
    // Note: Pyodide doesn't support true interruption, this only stops output capture
  }
}

/**
 * Code runner factory
 */
const runners: Map<CodeRuntime, CodeRunner> = new Map()

export function getRunner(runtime: CodeRuntime): CodeRunner {
  let runner = runners.get(runtime)
  if (!runner) {
    runner = runtime === 'python' ? new PythonRunner() : new JavaScriptRunner()
    runners.set(runtime, runner)
  }
  return runner
}
