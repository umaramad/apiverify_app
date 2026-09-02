/**
 * Recent Actions store — logical history only (no paths/passwords/sessions).
 * Pinned favorites never expire; unpinned entries trim to configured history size.
 */
import { randomUUID } from 'crypto'
import { AppSettingsRepository } from '../../../main/db/repositories/AppSettingsRepository'
import {
  DEFAULT_RECENT_ACTIONS_HISTORY_SIZE,
  EMPTY_RECENT_ACTIONS_DOCUMENT,
  isRecentActionOperation,
  MAX_RECENT_ACTIONS_HISTORY_SIZE,
  MIN_RECENT_ACTIONS_HISTORY_SIZE,
  type RecentActionInput,
  type RecentActionRecord,
  type RecentActionsDocument,
  type RecentActionsPreferences,
} from '../models/recentActions'
import { LINUX_SEARCH_CONFIG_FORBIDDEN_FIELDS } from '../models/config'

export const RECENT_ACTIONS_SETTINGS_KEY = 'linuxSearchAssistant.recentActions'

const settingsRepo = new AppSettingsRepository()
let cached: RecentActionsDocument | null = null

function rejectSecrets(value: unknown): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach(rejectSecrets)
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((LINUX_SEARCH_CONFIG_FORBIDDEN_FIELDS as readonly string[]).includes(key)) {
      throw new Error(`Forbidden field "${key}" rejected in recent actions.`)
    }
    // Absolute path leakage guard
    if (key === 'path' || key === 'absolutePath' || key === 'remotePath') {
      throw new Error('Absolute paths must not be stored in recent actions.')
    }
    rejectSecrets(child)
  }
}

function clampHistorySize(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : DEFAULT_RECENT_ACTIONS_HISTORY_SIZE
  return Math.min(Math.max(n, MIN_RECENT_ACTIONS_HISTORY_SIZE), MAX_RECENT_ACTIONS_HISTORY_SIZE)
}

function normalizeAction(raw: unknown): RecentActionRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isRecentActionOperation(r.operation)) return null
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : randomUUID()
  const targetId = typeof r.targetId === 'string' ? r.targetId.trim() : ''
  const pathId = typeof r.pathId === 'string' ? r.pathId.trim() : ''
  const application = typeof r.application === 'string' ? r.application.trim() : ''
  if (!targetId || !pathId || !application) return null

  // Reject absolute paths if mistakenly stored in pathId/fileName
  if (pathId.startsWith('/')) return null
  const fileName = typeof r.fileName === 'string' ? r.fileName.trim() : undefined
  if (fileName?.includes('/') || fileName?.includes('\\')) return null

  return {
    id,
    operation: r.operation,
    keyword: typeof r.keyword === 'string' ? r.keyword : undefined,
    application,
    targetId,
    pathId,
    fileName: fileName || undefined,
    lines: typeof r.lines === 'number' && Number.isFinite(r.lines) ? r.lines : undefined,
    contextMode:
      r.contextMode === 'C' || r.contextMode === 'A' || r.contextMode === 'B' ? r.contextMode : undefined,
    contextLines:
      typeof r.contextLines === 'number' && Number.isFinite(r.contextLines)
        ? Math.min(Math.max(Math.trunc(r.contextLines), 1), 20)
        : undefined,
    pinned: r.pinned === true,
    timestamp: typeof r.timestamp === 'string' && r.timestamp ? r.timestamp : new Date().toISOString(),
  }
}

function trimUnpinned(actions: RecentActionRecord[], historySize: number): RecentActionRecord[] {
  const pinned = actions.filter((a) => a.pinned)
  const unpinned = actions.filter((a) => !a.pinned).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  return [...pinned, ...unpinned.slice(0, historySize)].sort((a, b) =>
    a.timestamp < b.timestamp ? 1 : -1
  )
}

function fingerprint(
  action: Pick<
    RecentActionRecord,
    'operation' | 'keyword' | 'targetId' | 'pathId' | 'fileName' | 'lines' | 'contextMode' | 'contextLines'
  >
): string {
  return [
    action.operation,
    action.keyword ?? '',
    action.targetId,
    action.pathId,
    action.fileName ?? '',
    action.lines ?? '',
    action.contextMode ?? '',
    action.contextLines ?? '',
  ].join('\0')
}

function normalizeDocument(raw: unknown): RecentActionsDocument {
  if (!raw || typeof raw !== 'object') {
    return {
      schemaVersion: 1,
      preferences: { historySize: DEFAULT_RECENT_ACTIONS_HISTORY_SIZE },
      actions: [],
    }
  }
  rejectSecrets(raw)
  const doc = raw as Partial<RecentActionsDocument>
  const historySize = clampHistorySize(doc.preferences?.historySize)
  const actions = Array.isArray(doc.actions)
    ? doc.actions.map(normalizeAction).filter((a): a is RecentActionRecord => Boolean(a))
    : []
  return {
    schemaVersion: 1,
    preferences: { historySize },
    actions: trimUnpinned(actions, historySize),
  }
}

function persist(doc: RecentActionsDocument): RecentActionsDocument {
  const next = {
    schemaVersion: 1 as const,
    preferences: { historySize: clampHistorySize(doc.preferences.historySize) },
    actions: trimUnpinned(doc.actions, clampHistorySize(doc.preferences.historySize)),
  }
  settingsRepo.set(RECENT_ACTIONS_SETTINGS_KEY, JSON.stringify(next))
  cached = next
  return next
}

export function getRecentActionsDocument(): RecentActionsDocument {
  if (cached) return cached
  const raw = settingsRepo.get(RECENT_ACTIONS_SETTINGS_KEY)
  if (!raw) {
    cached = { ...EMPTY_RECENT_ACTIONS_DOCUMENT, actions: [], preferences: { ...EMPTY_RECENT_ACTIONS_DOCUMENT.preferences } }
    return cached
  }
  try {
    cached = normalizeDocument(JSON.parse(raw))
  } catch {
    cached = {
      schemaVersion: 1,
      preferences: { historySize: DEFAULT_RECENT_ACTIONS_HISTORY_SIZE },
      actions: [],
    }
  }
  return cached
}

export function listRecentActions(filterText?: string): RecentActionRecord[] {
  const { actions } = getRecentActionsDocument()
  const q = (filterText || '').trim().toLowerCase()
  if (!q) return actions
  return actions.filter((a) => {
    const hay = [a.operation, a.keyword, a.application, a.pathId, a.fileName, a.targetId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function getRecentActionsPreferences(): RecentActionsPreferences {
  return getRecentActionsDocument().preferences
}

export function setRecentActionsHistorySize(size: unknown): RecentActionsDocument {
  const doc = getRecentActionsDocument()
  return persist({
    ...doc,
    preferences: { historySize: clampHistorySize(size) },
  })
}

/** Record a successful logical action. Dedupes identical unpinned entries. */
export function recordRecentAction(input: RecentActionInput): RecentActionRecord {
  const doc = getRecentActionsDocument()
  const record: RecentActionRecord = {
    id: randomUUID(),
    operation: input.operation,
    keyword: input.keyword,
    application: input.application,
    targetId: input.targetId,
    pathId: input.pathId,
    fileName: input.fileName,
    lines: input.lines,
    contextMode: input.contextMode,
    contextLines: input.contextLines,
    pinned: input.pinned === true,
    timestamp: new Date().toISOString(),
  }

  if (record.pathId.startsWith('/')) {
    throw new Error('pathId must not be an absolute path.')
  }

  const fp = fingerprint(record)
  const withoutDupes = doc.actions.filter((a) => a.pinned || fingerprint(a) !== fp)
  return persist({ ...doc, actions: [record, ...withoutDupes] }).actions.find((a) => a.id === record.id)!
}

export function setRecentActionPinned(actionId: string, pinned: boolean): RecentActionsDocument {
  const doc = getRecentActionsDocument()
  const actions = doc.actions.map((a) => (a.id === actionId ? { ...a, pinned } : a))
  return persist({ ...doc, actions })
}

export function removeRecentAction(actionId: string): RecentActionsDocument {
  const doc = getRecentActionsDocument()
  return persist({ ...doc, actions: doc.actions.filter((a) => a.id !== actionId) })
}

export function clearUnpinnedRecentActions(): RecentActionsDocument {
  const doc = getRecentActionsDocument()
  return persist({ ...doc, actions: doc.actions.filter((a) => a.pinned) })
}

export function clearRecentActionsCache(): void {
  cached = null
}
