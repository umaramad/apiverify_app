import type { CollectionVariable } from './collectionVariables'

export type VariableSource = 'environment' | 'collection' | 'runtime'

export interface AvailableVariable {
  name: string
  source: VariableSource
  preview?: string
}

export function listAvailableVariables(input: {
  environmentVariables?: Record<string, string>
  collectionVariables?: CollectionVariable[]
  runtimeVariables?: Record<string, string>
}): AvailableVariable[] {
  const seen = new Set<string>()
  const results: AvailableVariable[] = []

  const add = (name: string, source: VariableSource, preview?: string): void => {
    const trimmed = name.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    results.push({ name: trimmed, source, preview })
  }

  for (const [name, value] of Object.entries(input.environmentVariables ?? {})) {
    if (name === 'baseUrl') continue
    add(name, 'environment', value)
  }

  for (const variable of input.collectionVariables ?? []) {
    if (variable.enabled === false || !variable.key.trim()) continue
    add(variable.key.trim(), 'collection', variable.value)
  }

  for (const [name, value] of Object.entries(input.runtimeVariables ?? {})) {
    add(name, 'runtime', value)
  }

  return results.sort((left, right) => left.name.localeCompare(right.name))
}

export function variableToken(name: string): string {
  return `{{${name.trim()}}}`
}

export function insertAtCursor(
  text: string,
  insertion: string,
  selectionStart: number,
  selectionEnd: number
): { value: string; cursor: number } {
  const start = Math.max(0, Math.min(selectionStart, text.length))
  const end = Math.max(start, Math.min(selectionEnd, text.length))
  const value = `${text.slice(0, start)}${insertion}${text.slice(end)}`
  return { value, cursor: start + insertion.length }
}
