/**
 * Remote search request/response models (structured JSON).
 * Never include passwords or arbitrary shell strings.
 */
import type { LinuxSearchTargetConfig } from './config'

export const REMOTE_SEARCH_OPERATIONS = ['grep', 'find', 'cat', 'head', 'tail'] as const

export type RemoteSearchOperation = (typeof REMOTE_SEARCH_OPERATIONS)[number]

export type RemoteSearchRequest =
  | {
      operation: 'grep'
      serverId: string
      /** Portable target used only for path allowlisting (no secrets). */
      target: LinuxSearchTargetConfig
      path: string
      pattern: string
      /** Allowlisted grep context: -C / -A / -B */
      contextMode?: 'C' | 'A' | 'B'
      /** Context lines (clamped 1–20). */
      contextLines?: number
    }
  | {
      operation: 'find'
      serverId: string
      target: LinuxSearchTargetConfig
      path: string
      namePattern: string
    }
  | {
      operation: 'cat'
      serverId: string
      target: LinuxSearchTargetConfig
      path: string
    }
  | {
      operation: 'head'
      serverId: string
      target: LinuxSearchTargetConfig
      path: string
      lines?: number
    }
  | {
      operation: 'tail'
      serverId: string
      target: LinuxSearchTargetConfig
      path: string
      lines?: number
    }

export type RemoteSearchErrorCode =
  | 'SESSION_REQUIRED'
  | 'PATH_NOT_ALLOWED'
  | 'INVALID_REQUEST'
  | 'EXECUTION_FAILED'

export interface RemoteSearchSuccessResult {
  ok: true
  operation: RemoteSearchOperation
  serverId: string
  path: string
  exitCode: number
  /** Full stdout captured from the remote command. */
  stdout: string
  stderr: string
  /** stdout split into lines for UI consumption. */
  lines: string[]
}

export interface RemoteSearchErrorResult {
  ok: false
  code: RemoteSearchErrorCode
  message: string
  serverId?: string
  /** When true, UI should open the connection dialog. */
  connectRequired?: boolean
  operation?: RemoteSearchOperation
  path?: string
}

export type RemoteSearchResult = RemoteSearchSuccessResult | RemoteSearchErrorResult

/** Push event when SearchService needs an active SSH session. */
export interface SearchConnectRequiredEvent {
  type: 'connectRequired'
  serverId: string
  message: string
}
