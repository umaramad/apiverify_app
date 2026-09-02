/**
 * Resolve logical Recent Actions against the current portable application config.
 * Rebuilds remote operations dynamically — never trusts stored absolute paths.
 */
import type { LinuxSearchPathEntry, LinuxSearchTargetConfig } from '../models/config'
import type { RecentActionOperation, RecentActionRecord } from '../models/recentActions'
import type { RemoteSearchRequest } from '../models/remoteSearch'
import { assertPathAllowed } from './pathAllowlist'

export class ActionResolveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActionResolveError'
  }
}

const UNSAFE_FILE = /[\0\n\r;|&`$<>(){}[\]\\\/]/

function allPathEntries(target: LinuxSearchTargetConfig): LinuxSearchPathEntry[] {
  return [...(target.logPaths || []), ...(target.configPaths || []), ...(target.searchPaths || [])]
}

function stripTrailingSlash(path: string): string {
  const trimmed = (path || '').trim()
  if (trimmed.length > 1 && trimmed.endsWith('/')) return trimmed.slice(0, -1)
  return trimmed
}

export function findTargetById(
  targets: LinuxSearchTargetConfig[],
  targetId: string
): LinuxSearchTargetConfig | null {
  const id = (targetId || '').trim()
  if (!id) return null
  return targets.find((t) => t.id === id) ?? null
}

export function findPathEntry(
  target: LinuxSearchTargetConfig,
  pathId: string
): LinuxSearchPathEntry | null {
  const id = (pathId || '').trim()
  if (!id) return null
  const all = allPathEntries(target).filter((p) => p.enabled)
  const byId = all.find((p) => p.id === id)
  if (byId) return byId

  // Compat: older configs / UI mistakes used the absolute path as pathId.
  if (id.startsWith('/')) {
    const wanted = stripTrailingSlash(id)
    return all.find((p) => stripTrailingSlash(p.path) === wanted) ?? null
  }
  return null
}

/**
 * Map a UI/runtime path reference to the stable logical path id used in Recent Actions.
 * Accepts either a logical id or a configured absolute path.
 */
export function resolveLogicalPathId(target: LinuxSearchTargetConfig, pathRef: string): string {
  const entry = findPathEntry(target, pathRef)
  if (!entry) {
    throw new ActionResolveError(
      'Configured path was not found or is disabled. Update application configuration.'
    )
  }
  return entry.id
}

/** Basename-only file name; rejects path traversal and separators. */
export function assertSafeFileName(fileName: string | undefined): string | undefined {
  if (fileName == null || fileName === '') return undefined
  const trimmed = fileName.trim()
  if (!trimmed) return undefined
  if (trimmed === '.' || trimmed === '..' || UNSAFE_FILE.test(trimmed) || trimmed.includes('..')) {
    throw new ActionResolveError('fileName must be a plain file name without path separators.')
  }
  return trimmed
}

export function resolveAbsolutePath(
  target: LinuxSearchTargetConfig,
  pathId: string,
  fileName?: string
): string {
  const entry = findPathEntry(target, pathId)
  if (!entry) {
    throw new ActionResolveError(
      'Configured path was not found or is disabled. Update application configuration.'
    )
  }
  const safeName = assertSafeFileName(fileName)
  const absolute = safeName
    ? `${entry.path.replace(/\/+$/, '')}/${safeName}`
    : entry.path
  return assertPathAllowed(absolute, target)
}

export function logicalOperationToRemote(
  operation: RecentActionOperation
): 'grep' | 'find' | 'cat' | 'tail' | 'download' {
  switch (operation) {
    case 'SEARCH_TEXT':
      return 'grep'
    case 'FIND_FILE':
      return 'find'
    case 'VIEW_FILE':
      return 'cat'
    case 'TAIL_LOG':
      return 'tail'
    case 'DOWNLOAD_FILE':
      return 'download'
    default: {
      const _exhaustive: never = operation
      throw new ActionResolveError(`Unsupported logical operation: ${String(_exhaustive)}`)
    }
  }
}

/**
 * Rebuild a RemoteSearchRequest from a logical action + current target config.
 * DOWNLOAD_FILE is not a remote search op — callers handle it separately.
 */
export function buildRemoteSearchFromAction(
  action: Pick<
    RecentActionRecord,
    'operation' | 'keyword' | 'pathId' | 'fileName' | 'lines' | 'targetId' | 'contextMode' | 'contextLines'
  >,
  target: LinuxSearchTargetConfig
): RemoteSearchRequest {
  if (action.targetId && action.targetId !== target.id) {
    throw new ActionResolveError('Action target does not match the provided configuration.')
  }

  const path = resolveAbsolutePath(target, action.pathId, action.fileName)
  const remote = logicalOperationToRemote(action.operation)

  switch (remote) {
    case 'grep': {
      const keyword = (action.keyword || '').trim()
      if (!keyword) throw new ActionResolveError('keyword is required for SEARCH_TEXT.')
      return {
        operation: 'grep',
        serverId: target.id,
        target,
        path,
        pattern: keyword,
        contextMode: action.contextMode,
        contextLines: action.contextLines,
      }
    }
    case 'find': {
      const keyword = (action.keyword || '').trim()
      if (!keyword) throw new ActionResolveError('keyword is required for FIND_FILE.')
      return {
        operation: 'find',
        serverId: target.id,
        target,
        path,
        namePattern: keyword,
      }
    }
    case 'cat':
      return {
        operation: 'cat',
        serverId: target.id,
        target,
        path,
      }
    case 'tail':
      return {
        operation: 'tail',
        serverId: target.id,
        target,
        path,
        lines: action.lines,
      }
    case 'download':
      throw new ActionResolveError('DOWNLOAD_FILE is not a remote search operation.')
    default: {
      const _exhaustive: never = remote
      throw new ActionResolveError(`Unsupported remote mapping: ${String(_exhaustive)}`)
    }
  }
}
