import { LINUX_COMMAND_CATALOG } from '../data/commandCatalog'
import type {
  LinuxCommandCategory,
  LinuxCommandEntry,
  LinuxSearchHit,
  LinuxSearchQuery,
  LinuxSearchResponse,
} from '../models'

const CATEGORIES: Array<LinuxCommandCategory | 'all'> = [
  'all',
  'files',
  'process',
  'network',
  'system',
  'text',
  'permissions',
  'package',
  'other',
]

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_+.-]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function scoreEntry(entry: LinuxCommandEntry, tokens: string[]): LinuxSearchHit | null {
  if (tokens.length === 0) {
    return { entry, score: 0, matchedOn: [] }
  }

  let score = 0
  const matchedOn = new Set<LinuxSearchHit['matchedOn'][number]>()
  const name = entry.name.toLowerCase()
  const description = entry.description.toLowerCase()
  const tags = entry.tags.map((t) => t.toLowerCase())
  const examples = entry.examples.map((e) => e.toLowerCase())

  for (const token of tokens) {
    let tokenMatched = false

    if (name === token) {
      score += 100
      matchedOn.add('name')
      tokenMatched = true
    } else if (name.startsWith(token)) {
      score += 70
      matchedOn.add('name')
      tokenMatched = true
    } else if (name.includes(token)) {
      score += 40
      matchedOn.add('name')
      tokenMatched = true
    }

    if (tags.some((tag) => tag === token || tag.includes(token))) {
      score += 35
      matchedOn.add('tag')
      tokenMatched = true
    }

    if (description.includes(token)) {
      score += 20
      matchedOn.add('description')
      tokenMatched = true
    }

    if (examples.some((ex) => ex.includes(token))) {
      score += 15
      matchedOn.add('example')
      tokenMatched = true
    }

    if (!tokenMatched) {
      // Soft penalty so multi-token queries prefer entries matching more tokens
      score -= 5
    }
  }

  if (score <= 0 || matchedOn.size === 0) return null
  return { entry, score, matchedOn: Array.from(matchedOn) }
}

export function getLinuxCommandCategories(): Array<LinuxCommandCategory | 'all'> {
  return [...CATEGORIES]
}

export function getLinuxCommandCatalog(): LinuxCommandEntry[] {
  return LINUX_COMMAND_CATALOG
}

export function searchLinuxCommands(query: LinuxSearchQuery): LinuxSearchResponse {
  const text = (query.text || '').trim()
  const category = query.category && query.category !== 'all' ? query.category : undefined
  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100)
  const tokens = tokenize(text)

  let pool = LINUX_COMMAND_CATALOG
  if (category) {
    pool = pool.filter((entry) => entry.category === category)
  }

  let hits: LinuxSearchHit[]
  if (tokens.length === 0) {
    hits = pool.map((entry) => ({ entry, score: 0, matchedOn: [] }))
  } else {
    hits = pool
      .map((entry) => scoreEntry(entry, tokens))
      .filter((hit): hit is LinuxSearchHit => hit !== null)
      .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
  }

  return {
    query: text,
    total: hits.length,
    hits: hits.slice(0, limit),
  }
}
