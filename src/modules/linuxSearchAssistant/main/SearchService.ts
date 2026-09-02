/**
 * SearchService — read-only remote search over an active SSH session.
 *
 * - Never asks for / handles passwords
 * - Requests session from SessionManager; notifies UI when missing
 * - Operations: grep | find | cat | head | tail
 * - Paths must be within the portable target configuration
 * - No write operations; no arbitrary commands
 * - Returns structured JSON only
 */
import { BrowserWindow } from 'electron'
import type { LinuxSearchTargetConfig } from '../models/config'
import type {
  RemoteSearchRequest,
  RemoteSearchResult,
  SearchConnectRequiredEvent,
} from '../models/remoteSearch'
import { REMOTE_SEARCH_OPERATIONS } from '../models/remoteSearch'
import { PathAllowlistError } from '../services/pathAllowlist'
import {
  RemoteSearchCommandError,
  toPredefinedSearchCommand,
} from '../services/remoteSearchCommands'
import { getSessionManager } from './sessionManager'
import { SshServiceError } from './sshService'
import { LINUX_SEARCH_ASSISTANT_IPC_EVENTS } from '../ipc/channels'
import { broadcastLinuxSearchConsole } from './consoleBroadcast'

const CONNECT_REQUIRED_EVENT = LINUX_SEARCH_ASSISTANT_IPC_EVENTS.connectRequired

function isTargetConfig(value: unknown): value is LinuxSearchTargetConfig {
  if (!value || typeof value !== 'object') return false
  const raw = value as Record<string, unknown>
  return (
    typeof raw.id === 'string' &&
    typeof raw.hostNameOrIp === 'string' &&
    Array.isArray(raw.logPaths) &&
    Array.isArray(raw.configPaths) &&
    Array.isArray(raw.searchPaths)
  )
}

function asRemoteSearchRequest(input: unknown): RemoteSearchRequest {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const operation = raw.operation
  if (typeof operation !== 'string' || !REMOTE_SEARCH_OPERATIONS.includes(operation as never)) {
    throw new RemoteSearchCommandError(
      `Operation must be one of: ${REMOTE_SEARCH_OPERATIONS.join(', ')}.`
    )
  }
  const serverId = typeof raw.serverId === 'string' ? raw.serverId.trim() : ''
  if (!serverId) throw new RemoteSearchCommandError('serverId is required.')
  if (!isTargetConfig(raw.target)) {
    throw new RemoteSearchCommandError(
      'A portable target configuration is required for path allowlisting.'
    )
  }

  const path = typeof raw.path === 'string' ? raw.path : ''
  const base = { serverId, target: raw.target, path }

  switch (operation) {
    case 'grep':
      return {
        ...base,
        operation: 'grep',
        pattern: typeof raw.pattern === 'string' ? raw.pattern : '',
        contextMode:
          raw.contextMode === 'C' || raw.contextMode === 'A' || raw.contextMode === 'B'
            ? raw.contextMode
            : undefined,
        contextLines:
          typeof raw.contextLines === 'number' && Number.isFinite(raw.contextLines)
            ? Math.min(Math.max(Math.trunc(raw.contextLines), 1), 20)
            : undefined,
      }
    case 'find':
      return {
        ...base,
        operation: 'find',
        namePattern: typeof raw.namePattern === 'string' ? raw.namePattern : '',
      }
    case 'cat':
      return { ...base, operation: 'cat' }
    case 'head':
      return {
        ...base,
        operation: 'head',
        lines: typeof raw.lines === 'number' ? raw.lines : undefined,
      }
    case 'tail':
      return {
        ...base,
        operation: 'tail',
        lines: typeof raw.lines === 'number' ? raw.lines : undefined,
      }
    default:
      throw new RemoteSearchCommandError('Unsupported operation.')
  }
}

function notifyConnectRequired(serverId: string, message: string): void {
  const event: SearchConnectRequiredEvent = {
    type: 'connectRequired',
    serverId,
    message,
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(CONNECT_REQUIRED_EVENT, event)
    }
  }
}

function toLines(stdout: string): string[] {
  if (!stdout) return []
  return stdout.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

export class SearchService {
  /**
   * Run a read-only remote search. Never prompts for passwords.
   * Returns structured JSON; when no session exists, notifies UI to connect.
   */
  async search(input: unknown): Promise<RemoteSearchResult> {
    let request: RemoteSearchRequest
    try {
      request = asRemoteSearchRequest(input)
    } catch (error) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : 'Invalid search request.',
      }
    }

    const session = getSessionManager().getSession(request.serverId)
    if (!session) {
      const message = 'No active SSH session. Connect to the server to run this search.'
      notifyConnectRequired(request.serverId, message)
      return {
        ok: false,
        code: 'SESSION_REQUIRED',
        message,
        serverId: request.serverId,
        connectRequired: true,
        operation: request.operation,
        path: request.path,
      }
    }

    let built: ReturnType<typeof toPredefinedSearchCommand>
    try {
      built = toPredefinedSearchCommand(request)
    } catch (error) {
      if (error instanceof PathAllowlistError) {
        return {
          ok: false,
          code: 'PATH_NOT_ALLOWED',
          message: error.message,
          serverId: request.serverId,
          operation: request.operation,
          path: request.path,
        }
      }
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : 'Invalid search request.',
        serverId: request.serverId,
        operation: request.operation,
        path: request.path,
      }
    }

    try {
      const result = await getSessionManager().executePredefined(built.command)
      const lineCount = toLines(result.stdout).length
      broadcastLinuxSearchConsole(
        result.exitCode === 0 ? 'info' : 'warn',
        `exit ${result.exitCode} · ${lineCount} line(s)`,
        'search'
      )
      return {
        ok: true,
        operation: request.operation,
        serverId: request.serverId,
        path: built.path,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        lines: toLines(result.stdout),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Remote search failed.'
      broadcastLinuxSearchConsole('error', `Remote ${request.operation} failed: ${message}`, 'search')
      const sessionMissing =
        error instanceof SshServiceError &&
        (/no active ssh session/i.test(message) || /reconnect/i.test(message))

      if (sessionMissing) {
        notifyConnectRequired(request.serverId, message)
        return {
          ok: false,
          code: 'SESSION_REQUIRED',
          message,
          serverId: request.serverId,
          connectRequired: true,
          operation: request.operation,
          path: built.path,
        }
      }

      return {
        ok: false,
        code: 'EXECUTION_FAILED',
        message,
        serverId: request.serverId,
        operation: request.operation,
        path: built.path,
      }
    }
  }
}

export const SEARCH_CONNECT_REQUIRED_EVENT = CONNECT_REQUIRED_EVENT

let searchService: SearchService | null = null

export function getSearchService(): SearchService {
  if (!searchService) searchService = new SearchService()
  return searchService
}

export function runRemoteSearch(input: unknown): Promise<RemoteSearchResult> {
  return getSearchService().search(input)
}
