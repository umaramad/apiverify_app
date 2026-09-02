/**
 * List immediate files under a configured path (pathId → absolute from current config).
 * Uses allowlisted find -maxdepth 1; never accepts free-form shell.
 */
import { basename } from 'path'
import { BrowserWindow } from 'electron'
import type { LinuxSearchTargetConfig } from '../models/config'
import { LINUX_SEARCH_ASSISTANT_IPC_EVENTS } from '../ipc/channels'
import {
  ActionResolveError,
  assertSafeFileName,
  findTargetById,
  resolveAbsolutePath,
  resolveLogicalPathId,
} from '../services/actionResolve'
import { getLinuxSearchTargetById, listLinuxSearchTargets } from './configStore.service'
import { getSessionManager } from './sessionManager'
import { SshServiceError } from './sshService'
import { broadcastLinuxSearchConsole } from './consoleBroadcast'

const MAX_FILES = 500

export type ListRemoteFilesResult =
  | { ok: true; targetId: string; pathId: string; files: string[] }
  | {
      ok: false
      code: 'SESSION_REQUIRED' | 'CONFIG_MISSING' | 'INVALID_REQUEST' | 'EXECUTION_FAILED'
      message: string
      connectRequired?: boolean
      serverId?: string
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

function resolveTarget(targetId: string): LinuxSearchTargetConfig | null {
  return getLinuxSearchTargetById(targetId) || findTargetById(listLinuxSearchTargets(), targetId)
}

function toBasenames(dirPath: string, stdout: string): string[] {
  const prefix = dirPath.replace(/\/+$/, '')
  const seen = new Set<string>()
  const files: string[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '.' || trimmed === '..') continue
    let name = trimmed
    if (trimmed.startsWith('./')) {
      name = trimmed.slice(2)
    } else if (trimmed.startsWith(prefix + '/')) {
      name = trimmed.slice(prefix.length + 1)
    } else {
      name = basename(trimmed)
    }
    // Only immediate children (no nested relative paths).
    if (!name || name.includes('/') || name.includes('\\')) continue
    try {
      const safe = assertSafeFileName(name)
      if (!safe || seen.has(safe)) continue
      seen.add(safe)
      files.push(safe)
      if (files.length >= MAX_FILES) break
    } catch {
      // skip unsafe names
    }
  }
  files.sort((a, b) => a.localeCompare(b))
  return files
}

/**
 * List files in a configured path for the File dropdown (View Files / Tail / Download / Grep).
 */
export async function listRemotePathFiles(input: unknown): Promise<ListRemoteFilesResult> {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const targetId = typeof raw.targetId === 'string' ? raw.targetId.trim() : ''
  const pathId = typeof raw.pathId === 'string' ? raw.pathId.trim() : ''
  if (!targetId || !pathId) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'targetId and pathId are required.' }
  }

  const target = resolveTarget(targetId)
  if (!target) {
    return {
      ok: false,
      code: 'CONFIG_MISSING',
      message: 'Application configuration not found. Update targets in Settings.',
    }
  }

  let logicalPathId = pathId
  try {
    logicalPathId = resolveLogicalPathId(target, pathId)
  } catch (error) {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: error instanceof Error ? error.message : 'Invalid path selection.',
    }
  }

  const session = getSessionManager().getSession(target.id)
  if (!session) {
    const message = 'No active SSH session. Connect to the server to list files.'
    notifyConnectRequired(target.id, message)
    return {
      ok: false,
      code: 'SESSION_REQUIRED',
      message,
      connectRequired: true,
      serverId: target.id,
    }
  }

  let absolute: string
  try {
    absolute = resolveAbsolutePath(target, logicalPathId)
  } catch (error) {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: error instanceof Error ? error.message : 'Could not resolve path.',
    }
  }

  try {
    broadcastLinuxSearchConsole('info', `Listing files in path ${logicalPathId}…`, 'action')
    const result = await getSessionManager().executePredefined({
      kind: 'list_dir_files',
      serverId: target.id,
      cwd: absolute,
      path: '.',
    })
    const files = toBasenames(absolute, result.stdout)
    broadcastLinuxSearchConsole('info', `Found ${files.length} file(s)`, 'action')
    return { ok: true, targetId: target.id, pathId: logicalPathId, files }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list remote files.'
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
