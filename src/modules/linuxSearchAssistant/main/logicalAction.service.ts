/**
 * Execute logical Recent Actions using the active SSH session and current config.
 * Rebuilds remote commands from pathId — never uses stored absolute paths.
 * Records successful actions automatically (logical metadata only).
 */
import { BrowserWindow, dialog } from 'electron'
import { basename } from 'path'
import type { RecentActionInput, RecentActionOperation, RecentActionRecord } from '../models/recentActions'
import { isRecentActionOperation } from '../models/recentActions'
import type { RemoteSearchResult } from '../models/remoteSearch'
import {
  ActionResolveError,
  buildRemoteSearchFromAction,
  findTargetById,
  logicalOperationToRemote,
  resolveAbsolutePath,
  resolveLogicalPathId,
} from '../services/actionResolve'
import { toPredefinedSearchCommand } from '../services/remoteSearchCommands'
import { getLinuxSearchTargetById, listLinuxSearchTargets } from './configStore.service'
import { listRecentActions, recordRecentAction } from './recentActionsStore.service'
import { getSearchService } from './SearchService'
import { getSessionManager } from './sessionManager'
import { LINUX_SEARCH_ASSISTANT_IPC_EVENTS } from '../ipc/channels'
import { SshServiceError } from './sshService'
import { broadcastLinuxSearchConsole } from './consoleBroadcast'

export type LogicalActionResult =
  | {
      ok: true
      operation: RecentActionOperation
      recorded: RecentActionRecord
      search?: RemoteSearchResult & { ok: true }
      download?: { localPath: string; remotePath: string }
    }
  | {
      ok: false
      code: 'SESSION_REQUIRED' | 'CONFIG_MISSING' | 'INVALID_REQUEST' | 'EXECUTION_FAILED'
      message: string
      connectRequired?: boolean
      serverId?: string
    }

function asActionInput(input: unknown): RecentActionInput {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  if (!isRecentActionOperation(raw.operation)) {
    throw new ActionResolveError('Unsupported logical operation.')
  }
  const targetId = typeof raw.targetId === 'string' ? raw.targetId.trim() : ''
  const pathId = typeof raw.pathId === 'string' ? raw.pathId.trim() : ''
  const application = typeof raw.application === 'string' ? raw.application.trim() : ''
  if (!targetId || !pathId) {
    throw new ActionResolveError('targetId and pathId are required.')
  }
  return {
    operation: raw.operation,
    keyword: typeof raw.keyword === 'string' ? raw.keyword : undefined,
    application: application || targetId,
    targetId,
    pathId,
    fileName: typeof raw.fileName === 'string' ? raw.fileName : undefined,
    lines: typeof raw.lines === 'number' ? raw.lines : undefined,
    contextMode:
      raw.contextMode === 'C' || raw.contextMode === 'A' || raw.contextMode === 'B'
        ? raw.contextMode
        : undefined,
    contextLines:
      typeof raw.contextLines === 'number' && Number.isFinite(raw.contextLines)
        ? Math.min(Math.max(Math.trunc(raw.contextLines), 1), 20)
        : undefined,
  }
}

function notifyConnectRequired(serverId: string, message: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(LINUX_SEARCH_ASSISTANT_IPC_EVENTS.connectRequired, {
        type: 'connectRequired',
        serverId,
        message,
      })
    }
  }
}

async function pickDownloadDestination(defaultName: string): Promise<string | null> {
  // Prefer the grepped / remote basename so the Save dialog suggests that name.
  const safeName = basename((defaultName || 'download.bin').trim()) || 'download.bin'
  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const result = parent
    ? await dialog.showSaveDialog(parent, {
        title: 'Save remote file',
        defaultPath: safeName,
      })
    : await dialog.showSaveDialog({
        title: 'Save remote file',
        defaultPath: safeName,
      })
  if (result.canceled || !result.filePath) return null
  return result.filePath
}

function toRecordInput(action: RecentActionInput, applicationName: string): RecentActionInput {
  return {
    ...action,
    application: applicationName || action.application,
  }
}

/**
 * Run a logical action (form submit or Recent Actions replay).
 * Uses SessionManager; never prompts for passwords itself.
 */
export async function executeLogicalAction(input: unknown): Promise<LogicalActionResult> {
  let action: RecentActionInput
  try {
    action = asActionInput(input)
  } catch (error) {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: error instanceof Error ? error.message : 'Invalid action.',
    }
  }

  const target =
    getLinuxSearchTargetById(action.targetId) ||
    findTargetById(listLinuxSearchTargets(), action.targetId)
  if (!target) {
    return {
      ok: false,
      code: 'CONFIG_MISSING',
      message:
        'Application configuration not found for this action. Update Linux Search Assistant targets in Settings.',
    }
  }

  // Normalize path reference to a logical path id (never store absolute paths in history).
  try {
    action = { ...action, pathId: resolveLogicalPathId(target, action.pathId) }
  } catch (error) {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: error instanceof Error ? error.message : 'Invalid path selection.',
    }
  }

  const session = getSessionManager().getSession(target.id)
  if (!session) {
    const message = 'No active SSH session. Connect to the server to run this action.'
    broadcastLinuxSearchConsole('warn', message, 'action')
    notifyConnectRequired(target.id, message)
    return {
      ok: false,
      code: 'SESSION_REQUIRED',
      message,
      connectRequired: true,
      serverId: target.id,
    }
  }

  const mapped = logicalOperationToRemote(action.operation)
  broadcastLinuxSearchConsole(
    'info',
    `Running ${action.operation} on ${target.applicationName} (${action.pathId})…`,
    'action'
  )

  try {
    if (mapped === 'download') {
      const remotePath = resolveAbsolutePath(target, action.pathId, action.fileName)
      const localPath = await pickDownloadDestination(action.fileName || basename(remotePath))
      if (!localPath) {
        broadcastLinuxSearchConsole('warn', 'Download cancelled.', 'action')
        return { ok: false, code: 'INVALID_REQUEST', message: 'Download cancelled.' }
      }
      broadcastLinuxSearchConsole('info', `Downloading ${action.pathId}/${action.fileName || ''}…`, 'action')
      const downloaded = await getSessionManager().downloadFile(target.id, remotePath, localPath)
      const recorded = recordRecentAction(toRecordInput(action, target.applicationName))
      broadcastLinuxSearchConsole(
        'info',
        `Download complete → ${downloaded.localPath}`,
        'action'
      )
      return {
        ok: true,
        operation: action.operation,
        recorded,
        download: { localPath: downloaded.localPath, remotePath: downloaded.remotePath },
      }
    }

    const request = buildRemoteSearchFromAction(action, target)
    const searchResult = await getSearchService().search(request)
    if (!searchResult.ok) {
      return {
        ok: false,
        code: searchResult.code === 'SESSION_REQUIRED' ? 'SESSION_REQUIRED' : 'EXECUTION_FAILED',
        message: searchResult.message,
        connectRequired: searchResult.connectRequired,
        serverId: searchResult.serverId,
      }
    }

    const recorded = recordRecentAction(toRecordInput(action, target.applicationName))
    return {
      ok: true,
      operation: action.operation,
      recorded,
      search: searchResult,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action failed.'
    broadcastLinuxSearchConsole('error', message, 'action')
    if (error instanceof SshServiceError && /no active ssh session/i.test(message)) {
      notifyConnectRequired(target.id, message)
      return {
        ok: false,
        code: 'SESSION_REQUIRED',
        message,
        connectRequired: true,
        serverId: target.id,
      }
    }
    if (error instanceof ActionResolveError) {
      return { ok: false, code: 'INVALID_REQUEST', message }
    }
    return { ok: false, code: 'EXECUTION_FAILED', message }
  }
}

export async function replayRecentAction(actionId: unknown): Promise<LogicalActionResult> {
  const id = typeof actionId === 'string' ? actionId.trim() : ''
  if (!id) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'actionId is required.' }
  }
  const found = listRecentActions().find((a) => a.id === id)
  if (!found) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'Recent action not found.' }
  }
  return executeLogicalAction({
    operation: found.operation,
    keyword: found.keyword,
    application: found.application,
    targetId: found.targetId,
    pathId: found.pathId,
    fileName: found.fileName,
    lines: found.lines,
    contextMode: found.contextMode,
    contextLines: found.contextLines,
  })
}

export type LogicalActionBatchResult = {
  ok: boolean
  results: LogicalActionResult[]
}

/**
 * Run multiple logical actions on one server without dropping the SSH session between them.
 * Multi-file SEARCH_TEXT uses a single session lock (executePredefinedBatch).
 */
export async function executeLogicalActionBatch(input: unknown): Promise<LogicalActionBatchResult> {
  const list = Array.isArray(input) ? input : [input]
  if (list.length === 0) {
    return { ok: false, results: [{ ok: false, code: 'INVALID_REQUEST', message: 'No actions provided.' }] }
  }

  let actions: RecentActionInput[]
  try {
    actions = list.map((item) => asActionInput(item))
  } catch (error) {
    return {
      ok: false,
      results: [
        {
          ok: false,
          code: 'INVALID_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid action.',
        },
      ],
    }
  }

  const sameTarget = actions.every((a) => a.targetId === actions[0].targetId)
  const allSearch = actions.every((a) => a.operation === 'SEARCH_TEXT')

  if (actions.length > 1 && sameTarget && allSearch) {
    return executeSearchTextBatch(actions)
  }

  const results: LogicalActionResult[] = []
  for (const action of actions) {
    const result = await executeLogicalAction(action)
    results.push(result)
    if (!result.ok && result.connectRequired) break
  }
  return { ok: results.every((r) => r.ok), results }
}

async function executeSearchTextBatch(actions: RecentActionInput[]): Promise<LogicalActionBatchResult> {
  const target =
    getLinuxSearchTargetById(actions[0].targetId) ||
    findTargetById(listLinuxSearchTargets(), actions[0].targetId)
  if (!target) {
    return {
      ok: false,
      results: actions.map(() => ({
        ok: false as const,
        code: 'CONFIG_MISSING' as const,
        message: 'Application target not found in Settings. Reconfigure and try again.',
      })),
    }
  }

  const session = getSessionManager().getSession(target.id)
  if (!session) {
    const message = 'No active SSH session. Connect to the server to run this action.'
    broadcastLinuxSearchConsole('warn', message, 'action')
    notifyConnectRequired(target.id, message)
    return {
      ok: false,
      results: actions.map(() => ({
        ok: false as const,
        code: 'SESSION_REQUIRED' as const,
        message,
        connectRequired: true,
        serverId: target.id,
      })),
    }
  }

  let prepared: Array<{
    action: RecentActionInput
    path: string
    command: import('../models/ssh').PredefinedSshCommand
  }>
  try {
    prepared = actions.map((action) => {
      const request = buildRemoteSearchFromAction(action, target)
      const built = toPredefinedSearchCommand(request)
      return { action, path: built.path, command: built.command }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid search request.'
    return {
      ok: false,
      results: actions.map(() => ({
        ok: false as const,
        code: 'INVALID_REQUEST' as const,
        message,
      })),
    }
  }

  broadcastLinuxSearchConsole(
    'info',
    `Running SEARCH_TEXT batch (${prepared.length} file(s)) on ${target.applicationName}…`,
    'action'
  )

  try {
    const sshResults = await getSessionManager().executePredefinedBatch(prepared.map((p) => p.command))
    const results: LogicalActionResult[] = prepared.map((item, index) => {
      const ssh = sshResults[index]
      const stdout = ssh?.stdout ?? ''
      const stderr = ssh?.stderr ?? ''
      const lines = stdout ? stdout.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n') : []
      const recorded = recordRecentAction(toRecordInput(item.action, target.applicationName))
      broadcastLinuxSearchConsole(
        ssh?.exitCode === 0 ? 'info' : 'warn',
        `exit ${ssh?.exitCode ?? '?'} · ${lines.length} line(s) · ${item.action.fileName || item.path}`,
        'search'
      )
      return {
        ok: true as const,
        operation: 'SEARCH_TEXT' as const,
        recorded,
        search: {
          ok: true as const,
          operation: 'grep' as const,
          serverId: target.id,
          path: item.path,
          exitCode: ssh?.exitCode ?? 1,
          stdout,
          stderr,
          lines,
        },
      }
    })
    return { ok: true, results }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action failed.'
    broadcastLinuxSearchConsole('error', message, 'action')
    if (error instanceof SshServiceError && /no active ssh session|reconnect/i.test(message)) {
      notifyConnectRequired(target.id, message)
      return {
        ok: false,
        results: actions.map(() => ({
          ok: false as const,
          code: 'SESSION_REQUIRED' as const,
          message,
          connectRequired: true,
          serverId: target.id,
        })),
      }
    }
    return {
      ok: false,
      results: actions.map(() => ({
        ok: false as const,
        code: 'EXECUTION_FAILED' as const,
        message,
      })),
    }
  }
}
