import type { VariableExtractor } from './collectionVariables'
import { extractJsonPath } from './collectionVariables'

export interface ResponseVariableSuggestion {
  id: string
  name: string
  source: 'body' | 'header'
  path: string
  previewValue: string
}

const MAX_BODY_SUGGESTIONS = 40

function toVariableName(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '')
  if (!cleaned) return 'value'
  if (/^\d/.test(cleaned)) return `var_${cleaned}`
  return cleaned
}

function uniqueName(base: string, used: Set<string>): string {
  let candidate = base
  let index = 2
  while (used.has(candidate)) {
    candidate = `${base}${index}`
    index += 1
  }
  used.add(candidate)
  return candidate
}

function previewValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 100 ? `${text.slice(0, 100)}…` : text
}

function collectBodySuggestions(
  data: unknown,
  prefix = '',
  usedNames: Set<string>,
  results: ResponseVariableSuggestion[]
): void {
  if (results.length >= MAX_BODY_SUGGESTIONS) return

  if (data === null || data === undefined) {
    if (prefix) {
      const leaf = prefix.split(/\.|\[|\]/).filter(Boolean).pop() ?? 'value'
      const name = uniqueName(toVariableName(leaf), usedNames)
      results.push({
        id: `body:${prefix}`,
        name,
        source: 'body',
        path: prefix.startsWith('$.') ? prefix : prefix.includes('.') || prefix.includes('[') ? `$.${prefix}` : prefix,
        previewValue: previewValue(data),
      })
    }
    return
  }

  if (Array.isArray(data)) {
    if (data.length > 0) {
      collectBodySuggestions(data[0], `${prefix}[0]`, usedNames, results)
    }
    return
  }

  if (typeof data !== 'object') {
    if (prefix) {
      const leaf = prefix.split(/\.|\[|\]/).filter(Boolean).pop() ?? 'value'
      const name = uniqueName(toVariableName(leaf), usedNames)
      results.push({
        id: `body:${prefix}`,
        name,
        source: 'body',
        path: prefix.startsWith('$.') ? prefix : prefix.includes('.') || prefix.includes('[') ? `$.${prefix}` : prefix,
        previewValue: previewValue(data),
      })
    }
    return
  }

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (results.length >= MAX_BODY_SUGGESTIONS) break
    const nextPath = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === 'object') {
      collectBodySuggestions(value, nextPath, usedNames, results)
      continue
    }

    const name = uniqueName(toVariableName(key), usedNames)
    results.push({
      id: `body:${nextPath}`,
      name,
      source: 'body',
      path: nextPath.includes('.') || nextPath.includes('[') ? `$.${nextPath}` : nextPath,
      previewValue: previewValue(value),
    })
  }
}

export function suggestBodyResponseVariables(
  data: unknown,
  usedNames: Set<string> = new Set()
): ResponseVariableSuggestion[] {
  const suggestions: ResponseVariableSuggestion[] = []

  if (data === null || data === undefined) {
    return suggestions
  }

  let parsed: unknown = data
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data)
    } catch {
      parsed = data
    }
  }
  collectBodySuggestions(parsed, '', usedNames, suggestions)
  return suggestions
}

export function suggestHeaderResponseVariables(
  headers: Record<string, string>,
  usedNames: Set<string> = new Set()
): ResponseVariableSuggestion[] {
  const suggestions: ResponseVariableSuggestion[] = []

  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase()
    const name = uniqueName(toVariableName(lower.replace(/^x-/, '')), usedNames)
    suggestions.push({
      id: `header:${lower}`,
      name,
      source: 'header',
      path: lower,
      previewValue: previewValue(value),
    })
  }

  return suggestions.sort((left, right) => left.path.localeCompare(right.path))
}

export function suggestResponseVariables(
  data: unknown,
  headers: Record<string, string>
): ResponseVariableSuggestion[] {
  const usedNames = new Set<string>()
  return [
    ...suggestBodyResponseVariables(data, usedNames),
    ...suggestHeaderResponseVariables(headers, usedNames),
  ]
}

export function suggestionsToExtractors(
  suggestions: ResponseVariableSuggestion[],
  selectedIds: Set<string>
): VariableExtractor[] {
  return suggestions
    .filter((suggestion) => selectedIds.has(suggestion.id))
    .map((suggestion) => ({
      name: suggestion.name.trim(),
      source: suggestion.source,
      path: suggestion.path.trim(),
      enabled: true,
    }))
    .filter((extractor) => extractor.name && extractor.path)
}

export function suggestionsToVariableEntries(
  suggestions: ResponseVariableSuggestion[],
  selectedIds: Set<string>
): Array<{ name: string; value: string }> {
  return suggestions
    .filter((suggestion) => selectedIds.has(suggestion.id))
    .map((suggestion) => ({
      name: suggestion.name.trim(),
      value: suggestion.previewValue,
    }))
    .filter((entry) => entry.name.length > 0)
}

export function previewExtractorValue(
  data: unknown,
  headers: Record<string, string>,
  extractor: VariableExtractor
): string | undefined {
  if (extractor.source === 'header') {
    const lower = extractor.path.trim().toLowerCase()
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lower) return value
    }
    return undefined
  }
  return extractJsonPath(data, extractor.path)
}
