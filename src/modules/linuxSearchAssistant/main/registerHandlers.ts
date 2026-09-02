import type { IpcMain } from 'electron'
import { registerSafeHandler } from '../../../main/ipc/safeHandler'
import { LINUX_SEARCH_ASSISTANT_IPC } from '../ipc/channels'
import type { LinuxSearchQuery } from '../models'
import {
  getLinuxSearchAssistantStatus,
  listLinuxSearchCategories,
  runLinuxSearch,
  setLinuxSearchAssistantEnabled,
} from './linuxSearchAssistant.service'
import {
  connectSshWithPassword,
  disconnectSsh,
  getLinuxSearchAssistantDebugInfo,
  getLinuxSearchAssistantLogTail,
  getSshConnectionStatus,
  listSshSessions,
} from './sshConnection.service'
import { getSessionManager } from './sessionManager'
import { runRemoteSearch } from './SearchService'
import {
  getLinuxSearchConfigDocument,
  saveLinuxSearchConfigDocument,
} from './configStore.service'
import {
  clearUnpinnedRecentActions,
  getRecentActionsPreferences,
  listRecentActions,
  removeRecentAction,
  setRecentActionPinned,
  setRecentActionsHistorySize,
} from './recentActionsStore.service'
import { executeLogicalAction, executeLogicalActionBatch, replayRecentAction } from './logicalAction.service'
import { listRemotePathFiles } from './listRemoteFiles.service'
import { assertLinuxSearchAssistantEnabled } from './linuxSearchAssistant.service'
import { getAskAiConfig, saveAskAiConfig } from './askAiConfigStore.service'
import { analyzeWithAskAi, testAskAiLlm, testAskAiMcp } from './aiAnalyze.service'
import { openLocalLogFiles, reloadLocalLogFile } from './localLogViewer.service'
import type { LocalLogReadOptions } from '../models/localLogViewer'

function asSearchQuery(input: unknown): LinuxSearchQuery {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const text = typeof raw.text === 'string' ? raw.text : ''
  const category =
    typeof raw.category === 'string' && raw.category.trim()
      ? (raw.category as LinuxSearchQuery['category'])
      : 'all'
  const limit = typeof raw.limit === 'number' && Number.isFinite(raw.limit) ? raw.limit : 25
  return { text, category, limit }
}

/**
 * Registers Linux Search Assistant IPC handlers.
 * Safe to call even when the module is disabled — status/setEnabled remain available.
 */
export function registerLinuxSearchAssistantHandlers(ipcMain: IpcMain): void {
  getSessionManager().ensureReady()

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.getStatus, () => getLinuxSearchAssistantStatus())

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.setEnabled, (enabled) => {
    if (typeof enabled !== 'boolean') {
      throw new Error('enabled must be a boolean')
    }
    return setLinuxSearchAssistantEnabled(enabled)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.search, (query) => runLinuxSearch(asSearchQuery(query)))

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.remoteSearch, (request) =>
    runRemoteSearch(request)
  )

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.getCategories, () => listLinuxSearchCategories())

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.sshConnect, (server, password) => {
    // Password is accepted only here for authentication, then cleared in connectSshWithPassword.
    // Never log password or return it on the session handle.
    return connectSshWithPassword(server, password)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.sshDisconnect, (server) => disconnectSsh(server))

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.sshIsConnected, (server) =>
    getSshConnectionStatus(server)
  )

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.sshListSessions, () => listSshSessions())

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.getConfig, () => {
    assertLinuxSearchAssistantEnabled()
    return getLinuxSearchConfigDocument()
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.saveConfig, (document) => {
    assertLinuxSearchAssistantEnabled()
    return saveLinuxSearchConfigDocument(document)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.listRecentActions, (filterText) => {
    assertLinuxSearchAssistantEnabled()
    return listRecentActions(typeof filterText === 'string' ? filterText : undefined)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.getRecentActionsPrefs, () => {
    assertLinuxSearchAssistantEnabled()
    return getRecentActionsPreferences()
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.setRecentActionsHistorySize, (size) => {
    assertLinuxSearchAssistantEnabled()
    return setRecentActionsHistorySize(size)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.setRecentActionPinned, (actionId, pinned) => {
    assertLinuxSearchAssistantEnabled()
    if (typeof actionId !== 'string' || typeof pinned !== 'boolean') {
      throw new Error('actionId (string) and pinned (boolean) are required.')
    }
    return setRecentActionPinned(actionId, pinned)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.removeRecentAction, (actionId) => {
    assertLinuxSearchAssistantEnabled()
    if (typeof actionId !== 'string') throw new Error('actionId is required.')
    return removeRecentAction(actionId)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.clearUnpinnedRecentActions, () => {
    assertLinuxSearchAssistantEnabled()
    return clearUnpinnedRecentActions()
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.executeLogicalAction, (action) => {
    assertLinuxSearchAssistantEnabled()
    return executeLogicalAction(action)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.executeLogicalActionBatch, (actions) => {
    assertLinuxSearchAssistantEnabled()
    return executeLogicalActionBatch(actions)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.replayRecentAction, (actionId) => {
    assertLinuxSearchAssistantEnabled()
    return replayRecentAction(actionId)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.getDebugInfo, () =>
    getLinuxSearchAssistantDebugInfo()
  )

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.getLogTail, (maxLines) =>
    getLinuxSearchAssistantLogTail(typeof maxLines === 'number' ? maxLines : 80)
  )

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.listRemoteFiles, (input) => {
    assertLinuxSearchAssistantEnabled()
    return listRemotePathFiles(input)
  })

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.getAskAiConfig, () => getAskAiConfig())

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.saveAskAiConfig, (document) =>
    saveAskAiConfig(document)
  )

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.analyzeAskAi, (request) =>
    analyzeWithAskAi(request)
  )

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.testAskAiLlm, () => testAskAiLlm())

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.testAskAiMcp, (serverId) =>
    testAskAiMcp(serverId)
  )

  // Local Log Viewer — available even when remote LSA features are unused.
  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.openLocalLogFiles, (existingCount, opts) =>
    openLocalLogFiles(
      typeof existingCount === 'number' ? existingCount : 0,
      opts && typeof opts === 'object' ? (opts as LocalLogReadOptions) : undefined
    )
  )

  registerSafeHandler(ipcMain, LINUX_SEARCH_ASSISTANT_IPC.reloadLocalLogFile, (filePath, opts) => {
    if (typeof filePath !== 'string') {
      throw new Error('filePath must be a string')
    }
    return reloadLocalLogFile(
      filePath,
      opts && typeof opts === 'object' ? (opts as LocalLogReadOptions) : undefined
    )
  })
}
