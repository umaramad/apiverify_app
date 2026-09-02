import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { ipcInvoke } from './ipcInvoke'
import { ALLOWED_IPC_EVENTS } from '../shared/ipc/channels'
import type {
  StartValidationRunInput,
  StartValidationRunOutput,
  ValidationRunProgressEvent,
} from '../shared/models/validationRunner'
import type { SchedulerUpdatedEvent } from '../shared/models/scheduler'

const electronBridge = {
  process: {
    versions: {
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node ?? '',
    },
  },
}

const api = {
  createProject: (project: unknown) => ipcInvoke('db:createProject', project),
  updateProject: (id: string, name: string) => ipcInvoke('db:updateProject', id, name),
  getProjects: (userId?: string | null) => ipcInvoke('db:getProjects', userId ?? null),
  deleteProject: (id: string) => ipcInvoke('db:deleteProject', id),

  createUser: (user: unknown) => ipcInvoke('db:createUser', user),
  updateUser: (id: string, name: string, email: string) => ipcInvoke('db:updateUser', id, name, email),
  getCurrentUser: () => ipcInvoke('db:getCurrentUser'),
  assignProjectsToUser: (userId: string) => ipcInvoke('db:assignProjectsToUser', userId),

  getSchedules: (userId: string) => ipcInvoke('db:getSchedules', userId),
  saveSchedule: (schedule: unknown) => ipcInvoke('db:saveSchedule', schedule),
  deleteSchedule: (id: string) => ipcInvoke('db:deleteSchedule', id),
  runScheduleNow: (id: string) => ipcInvoke('scheduler:runNow', id),

  saveSpec: (spec: unknown) => ipcInvoke('db:saveSpec', spec),
  getSpecsForProject: (projectId: string) => ipcInvoke('db:getSpecsForProject', projectId),
  deleteSpec: (id: string) => ipcInvoke('db:deleteSpec', id),

  saveEnvironment: (env: unknown) => ipcInvoke('db:saveEnvironment', env),
  getEnvironmentsForProject: (projectId: string) =>
    ipcInvoke('db:getEnvironmentsForProject', projectId),
  deleteEnvironment: (id: string) => ipcInvoke('db:deleteEnvironment', id),
  setActiveEnvironment: (projectId: string, activeId: string | null) =>
    ipcInvoke('db:setActiveEnvironment', projectId, activeId),

  addValidationRun: (run: unknown) => ipcInvoke('db:addValidationRun', run),
  getValidationRuns: (projectId: string) => ipcInvoke('db:getValidationRuns', projectId),
  clearValidationRuns: (projectId: string) => ipcInvoke('db:clearValidationRuns', projectId),
  deleteValidationRuns: (runIds: string[]) => ipcInvoke('db:deleteValidationRuns', runIds),
  addValidationResult: (result: unknown) => ipcInvoke('db:addValidationResult', result),
  getValidationResult: (runId: string) => ipcInvoke('db:getValidationResult', runId),

  parseSpecContent: (content: string) => ipcInvoke('api:parseSpecContent', content),

  pickSpecFile: () => ipcInvoke('api:pickSpecFile'),

  verifyOAuthToken: (input: {
    tokenUrl: string
    clientId: string
    clientSecret: string
  }) => ipcInvoke('api:verifyOAuthToken', input),

  prepareEnvironmentForRequests: (environmentId: string) =>
    ipcInvoke('api:prepareEnvironmentForRequests', environmentId),

  sendRequest: (reqData: {
    url: string
    method: string
    headers: Record<string, string>
    data: unknown
    timeout?: number
  }) => ipcInvoke('api:sendRequest', reqData),

  getProxySettings: () => ipcInvoke('settings:getProxy'),
  saveProxySettings: (settings: unknown) => ipcInvoke('settings:saveProxy', settings),

  linuxSearchAssistantGetStatus: () => ipcInvoke('linuxSearchAssistant:getStatus'),
  linuxSearchAssistantSetEnabled: (enabled: boolean) =>
    ipcInvoke('linuxSearchAssistant:setEnabled', enabled),
  linuxSearchAssistantSearch: (query: unknown) => ipcInvoke('linuxSearchAssistant:search', query),
  linuxSearchAssistantGetCategories: () => ipcInvoke('linuxSearchAssistant:getCategories'),
  linuxSearchAssistantSshConnect: (server: unknown, password: string) =>
    ipcInvoke('linuxSearchAssistant:sshConnect', server, password),
  linuxSearchAssistantSshDisconnect: (server: unknown) =>
    ipcInvoke('linuxSearchAssistant:sshDisconnect', server),
  linuxSearchAssistantSshIsConnected: (server: unknown) =>
    ipcInvoke('linuxSearchAssistant:sshIsConnected', server),
  linuxSearchAssistantSshListSessions: () => ipcInvoke('linuxSearchAssistant:sshListSessions'),
  linuxSearchAssistantRemoteSearch: (request: unknown) =>
    ipcInvoke('linuxSearchAssistant:remoteSearch', request),
  linuxSearchAssistantGetConfig: () => ipcInvoke('linuxSearchAssistant:getConfig'),
  linuxSearchAssistantSaveConfig: (document: unknown) =>
    ipcInvoke('linuxSearchAssistant:saveConfig', document),
  linuxSearchAssistantListRecentActions: (filterText?: string) =>
    ipcInvoke('linuxSearchAssistant:listRecentActions', filterText),
  linuxSearchAssistantGetRecentActionsPrefs: () =>
    ipcInvoke('linuxSearchAssistant:getRecentActionsPrefs'),
  linuxSearchAssistantSetRecentActionsHistorySize: (size: number) =>
    ipcInvoke('linuxSearchAssistant:setRecentActionsHistorySize', size),
  linuxSearchAssistantSetRecentActionPinned: (actionId: string, pinned: boolean) =>
    ipcInvoke('linuxSearchAssistant:setRecentActionPinned', actionId, pinned),
  linuxSearchAssistantRemoveRecentAction: (actionId: string) =>
    ipcInvoke('linuxSearchAssistant:removeRecentAction', actionId),
  linuxSearchAssistantClearUnpinnedRecentActions: () =>
    ipcInvoke('linuxSearchAssistant:clearUnpinnedRecentActions'),
  linuxSearchAssistantExecuteLogicalAction: (action: unknown) =>
    ipcInvoke('linuxSearchAssistant:executeLogicalAction', action),
  linuxSearchAssistantExecuteLogicalActionBatch: (actions: unknown) =>
    ipcInvoke('linuxSearchAssistant:executeLogicalActionBatch', actions),
  linuxSearchAssistantReplayRecentAction: (actionId: string) =>
    ipcInvoke('linuxSearchAssistant:replayRecentAction', actionId),
  linuxSearchAssistantGetDebugInfo: () => ipcInvoke('linuxSearchAssistant:getDebugInfo'),
  linuxSearchAssistantGetLogTail: (maxLines?: number) =>
    ipcInvoke('linuxSearchAssistant:getLogTail', maxLines),
  linuxSearchAssistantListRemoteFiles: (input: { targetId: string; pathId: string }) =>
    ipcInvoke('linuxSearchAssistant:listRemoteFiles', input),
  linuxSearchAssistantGetAskAiConfig: () => ipcInvoke('linuxSearchAssistant:getAskAiConfig'),
  linuxSearchAssistantSaveAskAiConfig: (document: unknown) =>
    ipcInvoke('linuxSearchAssistant:saveAskAiConfig', document),
  linuxSearchAssistantAnalyzeAskAi: (request: unknown) =>
    ipcInvoke('linuxSearchAssistant:analyzeAskAi', request),
  linuxSearchAssistantTestAskAiLlm: () => ipcInvoke('linuxSearchAssistant:testAskAiLlm'),
  linuxSearchAssistantTestAskAiMcp: (serverId: string) =>
    ipcInvoke('linuxSearchAssistant:testAskAiMcp', serverId),
  linuxSearchAssistantOpenLocalLogFiles: (existingCount?: number, opts?: unknown) =>
    ipcInvoke('linuxSearchAssistant:openLocalLogFiles', existingCount ?? 0, opts),
  linuxSearchAssistantReloadLocalLogFile: (filePath: string, opts?: unknown) =>
    ipcInvoke('linuxSearchAssistant:reloadLocalLogFile', filePath, opts),
  onLinuxSearchAssistantSessionExpired: (
    callback: (event: import('../modules/linuxSearchAssistant/models').SshSessionExpiredEvent) => void
  ): (() => void) => {
    const channel = 'linuxSearchAssistant:sessionExpired'
    if (!ALLOWED_IPC_EVENTS.has(channel)) {
      throw new Error(`Forbidden IPC event: ${channel}`)
    }
    const handler = (
      _: IpcRendererEvent,
      event: import('../modules/linuxSearchAssistant/models').SshSessionExpiredEvent
    ): void => callback(event)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onLinuxSearchAssistantConnectRequired: (
    callback: (event: import('../modules/linuxSearchAssistant/models').SearchConnectRequiredEvent) => void
  ): (() => void) => {
    const channel = 'linuxSearchAssistant:connectRequired'
    if (!ALLOWED_IPC_EVENTS.has(channel)) {
      throw new Error(`Forbidden IPC event: ${channel}`)
    }
    const handler = (
      _: IpcRendererEvent,
      event: import('../modules/linuxSearchAssistant/models').SearchConnectRequiredEvent
    ): void => callback(event)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onLinuxSearchAssistantConsoleLog: (
    callback: (event: import('../modules/linuxSearchAssistant/models').LinuxSearchConsoleLogEvent) => void
  ): (() => void) => {
    const channel = 'linuxSearchAssistant:consoleLog'
    if (!ALLOWED_IPC_EVENTS.has(channel)) {
      throw new Error(`Forbidden IPC event: ${channel}`)
    }
    const handler = (
      _: IpcRendererEvent,
      event: import('../modules/linuxSearchAssistant/models').LinuxSearchConsoleLogEvent
    ): void => callback(event)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  validateResponse: (
    specContent: string,
    path: string,
    method: string,
    status: number,
    responseData: unknown
  ) => ipcInvoke('api:validateResponse', specContent, path, method, status, responseData),

  startValidationRun: (input: StartValidationRunInput): Promise<StartValidationRunOutput> =>
    ipcInvoke('validation:start', input),

  cancelValidationRun: (): Promise<{ success: boolean }> => ipcInvoke('validation:cancel'),

  exportConfiguration: (input: unknown) => ipcInvoke('export:configuration', input),

  onValidationProgress: (
    callback: (event: ValidationRunProgressEvent) => void
  ): (() => void) => {
    const channel = 'validation:progress'
    if (!ALLOWED_IPC_EVENTS.has(channel)) {
      throw new Error(`Forbidden IPC event: ${channel}`)
    }
    const handler = (_: IpcRendererEvent, event: ValidationRunProgressEvent): void => callback(event)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  onSchedulerUpdated: (callback: (event: SchedulerUpdatedEvent) => void): (() => void) => {
    const channel = 'scheduler:updated'
    if (!ALLOWED_IPC_EVENTS.has(channel)) {
      throw new Error(`Forbidden IPC event: ${channel}`)
    }
    const handler = (_: IpcRendererEvent, event: SchedulerUpdatedEvent): void => callback(event)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  findInPage: (text: string, options?: any) => ipcInvoke('window:findInPage', text, options),
  stopFindInPage: (action: 'clearSelection' | 'keepSelection' | 'activateSelection') => 
    ipcInvoke('window:stopFindInPage', action),
  onFoundInPage: (callback: (result: any) => void): (() => void) => {
    const channel = 'window:foundInPage'
    if (!ALLOWED_IPC_EVENTS.has(channel)) {
      throw new Error(`Forbidden IPC event: ${channel}`)
    }
    const handler = (_: IpcRendererEvent, result: any): void => callback(result)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}

if (!process.contextIsolated) {
  throw new Error('contextIsolation must be enabled for a secure preload bridge.')
}

contextBridge.exposeInMainWorld('electron', electronBridge)
contextBridge.exposeInMainWorld('api', api)
