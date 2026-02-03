// Code Sandbox types for ActivePaper STEM Edition

export type CodeRuntime = 'python' | 'javascript'

export interface CodeExecutionResult {
  output: string
  error?: string
  executionTime: number
}

export interface CodeSandboxState {
  isOpen: boolean
  originalCode: string
  editedCode: string
  runtime: CodeRuntime
  output: OutputLine[]
  isRunning: boolean
  error: string | null
}

export interface OutputLine {
  id: string
  type: 'stdout' | 'stderr' | 'system'
  content: string
  timestamp: number
}

// Runtime detection patterns
export const RUNTIME_PATTERNS: Record<CodeRuntime, RegExp[]> = {
  python: [
    /\bdef\s+\w+\s*\(/,
    /\bimport\s+\w+/,
    /\bprint\s*\(/,
    /\bclass\s+\w+:/,
    /^\s*#.*$/m,
    /\bfor\s+\w+\s+in\s+/,
    /:\s*$/m,
  ],
  javascript: [
    /\bfunction\s+\w+\s*\(/,
    /\bconst\s+\w+\s*=/,
    /\blet\s+\w+\s*=/,
    /\bvar\s+\w+\s*=/,
    /\bconsole\.(log|error|warn)\(/,
    /=>\s*{/,
    /\bnew\s+\w+\(/,
  ],
}

/**
 * Detect the likely runtime for a code snippet
 */
export function detectRuntime(code: string): CodeRuntime {
  let pythonScore = 0
  let jsScore = 0

  for (const pattern of RUNTIME_PATTERNS.python) {
    if (pattern.test(code)) pythonScore++
  }

  for (const pattern of RUNTIME_PATTERNS.javascript) {
    if (pattern.test(code)) jsScore++
  }

  return pythonScore > jsScore ? 'python' : 'javascript'
}
