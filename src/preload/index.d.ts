import type {
  Project,
  User,
  Environment,
  ApiSpec,
  ValidationRun,
  ValidationResult,
} from '../shared/models'
import type {
  StartValidationRunInput,
  StartValidationRunOutput,
  ValidationRunProgressEvent,
} from '../shared/models/validationRunner'
import type { SaveValidationScheduleInput, SchedulerUpdatedEvent, ValidationSchedule } from '../shared/models/scheduler'
import type { ExportConfigurationInput, ExportSaveResult } from '../shared/models/export'
import type { ProxySettings } from '../shared/models/proxySettings'
import type { AppErrorPayload } from '../shared/errors/types'
import type {
  AskAiAnalyzeRequest,
  AskAiAnalyzeResult,
  AskAiConfig,
  AskAiTestResult,
  LinuxSearchAssistantConfigDocument,
  LinuxSearchAssistantModuleStatus,
  LinuxSearchQuery,
  LinuxSearchResponse,
  RecentActionInput,
  RecentActionRecord,
  RecentActionsDocument,
  RecentActionsPreferences,
  RemoteSearchRequest,
  RemoteSearchResult,
  SearchConnectRequiredEvent,
  SshServerIdentity,
  SshSessionExpiredEvent,
  SshSessionHandle,
  LinuxSearchConsoleLogEvent,
  LocalLogFileContent,
  OpenLocalLogFilesResult,
  LocalLogReadOptions,
} from '../modules/linuxSearchAssistant/models'

export interface ElectronBridge {
  process: {
    versions: {
      electron: string
      chrome: string
      node: string
    }
  }
}

export interface ApiBridge {
  // Projects
  createProject: (project: Project) => Promise<void>
  updateProject: (id: string, name: string) => Promise<void>
  getProjects: (userId?: string | null) => Promise<Project[]>
  deleteProject: (id: string) => Promise<void>

  createUser: (user: User) => Promise<void>
  updateUser: (id: string, name: string, email: string) => Promise<User | null>
  getCurrentUser: () => Promise<User | null>
  assignProjectsToUser: (userId: string) => Promise<Project[]>

  getSchedules: (userId: string) => Promise<ValidationSchedule[]>
  saveSchedule: (schedule: SaveValidationScheduleInput) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>
  runScheduleNow: (id: string) => Promise<{ success: boolean }>

  // Specs
  saveSpec: (spec: ApiSpec) => Promise<void>
  getSpecsForProject: (projectId: string) => Promise<ApiSpec[]>
  deleteSpec: (id: string) => Promise<void>

  // Environments
  saveEnvironment: (env: Environment) => Promise<void>
  getEnvironmentsForProject: (projectId: string) => Promise<Environment[]>
  deleteEnvironment: (id: string) => Promise<void>
  setActiveEnvironment: (projectId: string, activeId: string | null) => Promise<void>

  // Validation Runs
  addValidationRun: (run: ValidationRun) => Promise<void>
  getValidationRuns: (projectId: string) => Promise<ValidationRun[]>
  clearValidationRuns: (projectId: string) => Promise<void>
  deleteValidationRuns: (runIds: string[]) => Promise<void>

  // Validation Results
  addValidationResult: (result: ValidationResult) => Promise<void>
  getValidationResult: (runId: string) => Promise<ValidationResult | null>

  // Spec parsing (content only — no filesystem access from renderer)
  parseSpecContent: (content: string) => Promise<{
    valid: boolean
    spec?: unknown
    error?: string
    errorPayload?: AppErrorPayload
  }>

  pickSpecFile: () => Promise<
    | { canceled: true }
    | {
        canceled: false
        fileName: string
        content: string
      }
  >

  verifyOAuthToken: (input: {
    tokenUrl: string
    clientId: string
    clientSecret: string
  }) => Promise<{
    success: boolean
    accessToken?: string
    expiresIn?: number
    error?: string
  }>

  prepareEnvironmentForRequests: (environmentId: string) => Promise<Environment>

  getProxySettings: () => Promise<ProxySettings>
  saveProxySettings: (settings: ProxySettings) => Promise<ProxySettings>

  linuxSearchAssistantGetStatus: () => Promise<LinuxSearchAssistantModuleStatus>
  linuxSearchAssistantSetEnabled: (enabled: boolean) => Promise<LinuxSearchAssistantModuleStatus>
  linuxSearchAssistantSearch: (query: LinuxSearchQuery) => Promise<LinuxSearchResponse>
  linuxSearchAssistantGetCategories: () => Promise<string[]>
  linuxSearchAssistantSshConnect: (
    server: SshServerIdentity & { server?: string },
    password: string
  ) => Promise<SshSessionHandle>
  linuxSearchAssistantSshDisconnect: (server: Pick<SshServerIdentity, 'id'> | SshServerIdentity) => Promise<{
    disconnected: true
  }>
  linuxSearchAssistantSshIsConnected: (
    server: Pick<SshServerIdentity, 'id'> | SshServerIdentity
  ) => Promise<{ connected: boolean; session: SshSessionHandle | null }>
  linuxSearchAssistantSshListSessions: () => Promise<SshSessionHandle[]>
  linuxSearchAssistantRemoteSearch: (request: RemoteSearchRequest) => Promise<RemoteSearchResult>
  linuxSearchAssistantGetConfig: () => Promise<LinuxSearchAssistantConfigDocument>
  linuxSearchAssistantSaveConfig: (
    document: LinuxSearchAssistantConfigDocument
  ) => Promise<LinuxSearchAssistantConfigDocument>
  linuxSearchAssistantListRecentActions: (filterText?: string) => Promise<RecentActionRecord[]>
  linuxSearchAssistantGetRecentActionsPrefs: () => Promise<RecentActionsPreferences>
  linuxSearchAssistantSetRecentActionsHistorySize: (size: number) => Promise<RecentActionsDocument>
  linuxSearchAssistantSetRecentActionPinned: (
    actionId: string,
    pinned: boolean
  ) => Promise<RecentActionsDocument>
  linuxSearchAssistantRemoveRecentAction: (actionId: string) => Promise<RecentActionsDocument>
  linuxSearchAssistantClearUnpinnedRecentActions: () => Promise<RecentActionsDocument>
  linuxSearchAssistantExecuteLogicalAction: (action: RecentActionInput) => Promise<{
    ok: boolean
    operation?: string
    recorded?: RecentActionRecord
    search?: RemoteSearchResult
    download?: { localPath: string; remotePath: string }
    code?: string
    message?: string
    connectRequired?: boolean
    serverId?: string
  }>
  linuxSearchAssistantExecuteLogicalActionBatch: (actions: RecentActionInput[]) => Promise<{
    ok: boolean
    results: Array<{
      ok: boolean
      operation?: string
      recorded?: RecentActionRecord
      search?: RemoteSearchResult
      download?: { localPath: string; remotePath: string }
      code?: string
      message?: string
      connectRequired?: boolean
      serverId?: string
    }>
  }>
  linuxSearchAssistantReplayRecentAction: (actionId: string) => Promise<{
    ok: boolean
    operation?: string
    recorded?: RecentActionRecord
    search?: RemoteSearchResult
    download?: { localPath: string; remotePath: string }
    code?: string
    message?: string
    connectRequired?: boolean
    serverId?: string
  }>
  linuxSearchAssistantGetDebugInfo: () => Promise<{
    logFilePath: string
    userDataPath: string
    platform: string
    arch: string
  }>
  linuxSearchAssistantGetLogTail: (maxLines?: number) => Promise<{
    logFilePath: string
    lines: string[]
  }>
  linuxSearchAssistantListRemoteFiles: (input: {
    targetId: string
    pathId: string
  }) => Promise<{
    ok: boolean
    targetId?: string
    pathId?: string
    files?: string[]
    code?: string
    message?: string
    connectRequired?: boolean
    serverId?: string
  }>
  linuxSearchAssistantGetAskAiConfig: () => Promise<AskAiConfig>
  linuxSearchAssistantSaveAskAiConfig: (document: AskAiConfig) => Promise<AskAiConfig>
  linuxSearchAssistantAnalyzeAskAi: (request: AskAiAnalyzeRequest) => Promise<AskAiAnalyzeResult>
  linuxSearchAssistantTestAskAiLlm: () => Promise<AskAiTestResult>
  linuxSearchAssistantTestAskAiMcp: (serverId: string) => Promise<AskAiTestResult>
  linuxSearchAssistantOpenLocalLogFiles: (
    existingCount?: number,
    opts?: LocalLogReadOptions
  ) => Promise<OpenLocalLogFilesResult>
  linuxSearchAssistantReloadLocalLogFile: (
    filePath: string,
    opts?: LocalLogReadOptions
  ) => Promise<LocalLogFileContent>
  onLinuxSearchAssistantSessionExpired: (
    callback: (event: SshSessionExpiredEvent) => void
  ) => () => void
  onLinuxSearchAssistantConnectRequired: (
    callback: (event: SearchConnectRequiredEvent) => void
  ) => () => void
  onLinuxSearchAssistantConsoleLog: (
    callback: (event: LinuxSearchConsoleLogEvent) => void
  ) => () => void

  // HTTP and Validation
  sendRequest: (reqData: {
    url: string
    method: string
    headers: Record<string, string>
    data: unknown
    timeout?: number
  }) => Promise<{
    status: number
    statusText: string
    headers: Record<string, string>
    data: unknown
    error?: string
    errorPayload?: AppErrorPayload
  }>

  validateResponse: (
    specContent: string,
    path: string,
    method: string,
    status: number,
    responseData: unknown
  ) => Promise<{
    valid: boolean
    errors?: Array<{
      instancePath: string
      schemaPath: string
      keyword: string
      params: Record<string, unknown>
      message?: string
    }>
    message?: string
  }>

  startValidationRun: (input: StartValidationRunInput) => Promise<StartValidationRunOutput>
  cancelValidationRun: () => Promise<{ success: boolean }>
  exportConfiguration: (input: ExportConfigurationInput) => Promise<ExportSaveResult>
  onValidationProgress: (callback: (event: ValidationRunProgressEvent) => void) => () => void
  onSchedulerUpdated: (callback: (event: SchedulerUpdatedEvent) => void) => () => void
  findInPage: (text: string, options?: any) => Promise<number>
  stopFindInPage: (action: 'clearSelection' | 'keepSelection' | 'activateSelection') => Promise<void>
  onFoundInPage: (callback: (result: any) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronBridge
    api: ApiBridge
  }
}

export {}
