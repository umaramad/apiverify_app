/**
 * Recent Actions — logical user operations only.
 * Never store absolute paths, passwords, SSH sessions, or raw Linux commands.
 */
export const RECENT_ACTION_OPERATIONS = [
  'SEARCH_TEXT',
  'FIND_FILE',
  'VIEW_FILE',
  'TAIL_LOG',
  'DOWNLOAD_FILE',
] as const

export type RecentActionOperation = (typeof RECENT_ACTION_OPERATIONS)[number]

export const DEFAULT_RECENT_ACTIONS_HISTORY_SIZE = 20
export const MIN_RECENT_ACTIONS_HISTORY_SIZE = 1
export const MAX_RECENT_ACTIONS_HISTORY_SIZE = 200

/**
 * Portable logical action. Paths are referenced by pathId only;
 * absolute paths are resolved at execution time from current application config.
 */
export interface RecentActionRecord {
  /** Stable id for list editing / pin / replay. */
  id: string
  operation: RecentActionOperation
  /** Search/find keyword or pattern (logical, not a shell command). */
  keyword?: string
  /** Application display name from the portable target config. */
  application: string
  /** Target config id (not a host/session). */
  targetId: string
  /** Path entry id from logPaths / configPaths / searchPaths (never an absolute path). */
  pathId: string
  /**
   * Optional file name relative to the path entry root (basename only).
   * Used for VIEW_FILE / TAIL_LOG / DOWNLOAD_FILE when targeting a single file.
   */
  fileName?: string
  /** Optional line count for TAIL_LOG / VIEW_FILE (head). */
  lines?: number
  /**
   * Grep context mode (allowlisted -C / -A / -B).
   * Only meaningful for SEARCH_TEXT.
   */
  contextMode?: 'C' | 'A' | 'B'
  /** Context line count for grep (1–20). */
  contextLines?: number
  /** Pinned favorites never expire when history is trimmed. */
  pinned: boolean
  timestamp: string
}

export interface RecentActionsPreferences {
  /** Max unpinned recent entries (pinned are excluded from this cap). Default 20. */
  historySize: number
}

export interface RecentActionsDocument {
  schemaVersion: 1
  preferences: RecentActionsPreferences
  actions: RecentActionRecord[]
}

/** Input used to record a successful logical action (id/timestamp assigned by store). */
export type RecentActionInput = Omit<RecentActionRecord, 'id' | 'timestamp' | 'pinned'> & {
  pinned?: boolean
}

export const EMPTY_RECENT_ACTIONS_DOCUMENT: RecentActionsDocument = {
  schemaVersion: 1,
  preferences: { historySize: DEFAULT_RECENT_ACTIONS_HISTORY_SIZE },
  actions: [],
}

export function isRecentActionOperation(value: unknown): value is RecentActionOperation {
  return typeof value === 'string' && (RECENT_ACTION_OPERATIONS as readonly string[]).includes(value)
}
