export type {
  LinuxCommandCategory,
  LinuxCommandEntry,
  LinuxSearchHit,
  LinuxSearchQuery,
  LinuxSearchResponse,
  LinuxSearchAssistantModuleStatus,
  LinuxSearchAssistantPageId,
} from './types'
export { LINUX_SEARCH_ASSISTANT_PAGE_ID } from './types'
export {
  LOCAL_LOG_VIEWER_PAGE_ID,
  MAX_LOCAL_LOG_FILE_BYTES,
  MAX_LOCAL_LOG_OPEN_FILES,
  DEFAULT_LOCAL_LOG_WINDOW_BYTES,
  LOCAL_LOG_WINDOW_PRESETS_MB,
} from './localLogViewer'
export type {
  LocalLogViewerPageId,
  LocalLogFileContent,
  OpenLocalLogFilesResult,
  LocalLogReadMode,
  LocalLogReadOptions,
} from './localLogViewer'

export type {
  LinuxSearchEnvironmentName,
  LinuxSearchPathEntry,
  LinuxSearchTargetConfig,
  LinuxSearchAssistantConfigDocument,
  LinuxSearchTargetConfigField,
  LinuxSearchConfigForbiddenField,
} from './config'
export {
  LINUX_SEARCH_TARGET_CONFIG_FIELDS,
  LINUX_SEARCH_CONFIG_FORBIDDEN_FIELDS,
  DEFAULT_LINUX_SEARCH_SSH_PORT,
  EMPTY_LINUX_SEARCH_CONFIG_DOCUMENT,
  createEmptyLinuxSearchPathEntry,
  createEmptyLinuxSearchTargetConfig,
} from './config'

export type {
  SshServerIdentity,
  SshPasswordPrompt,
  PredefinedSshCommandKind,
  PredefinedSshCommand,
  SshCommandResult,
  SshConnectResult,
  SshSessionHandle,
  SshSessionExpiredEvent,
} from './ssh'
export { PREDEFINED_SSH_COMMAND_KINDS } from './ssh'
export { toSshServerIdentity } from './sshIdentity'

export type {
  RemoteSearchOperation,
  RemoteSearchRequest,
  RemoteSearchErrorCode,
  RemoteSearchSuccessResult,
  RemoteSearchErrorResult,
  RemoteSearchResult,
  SearchConnectRequiredEvent,
} from './remoteSearch'
export { REMOTE_SEARCH_OPERATIONS } from './remoteSearch'

export type {
  RecentActionOperation,
  RecentActionRecord,
  RecentActionInput,
  RecentActionsPreferences,
  RecentActionsDocument,
} from './recentActions'
export {
  RECENT_ACTION_OPERATIONS,
  DEFAULT_RECENT_ACTIONS_HISTORY_SIZE,
  MIN_RECENT_ACTIONS_HISTORY_SIZE,
  MAX_RECENT_ACTIONS_HISTORY_SIZE,
  EMPTY_RECENT_ACTIONS_DOCUMENT,
  isRecentActionOperation,
} from './recentActions'

export type { LinuxSearchConsoleLevel, LinuxSearchConsoleLogEvent } from './consoleLog'

export type {
  AskAiMode,
  AskAiLlmConfig,
  AskAiMcpServerConfig,
  AskAiConfig,
  AskAiAnalyzeRequest,
  AskAiAnalyzeResult,
  AskAiTestResult,
} from './aiAnalyze'
export {
  DEFAULT_ASK_AI_SYSTEM_PROMPT,
  EMPTY_ASK_AI_CONFIG,
  ASK_AI_MAX_PAYLOAD_CHARS,
  createEmptyMcpServer,
} from './aiAnalyze'
