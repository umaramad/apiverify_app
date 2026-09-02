/**
 * Public surface for the Linux Search Assistant module.
 * App shell imports only from here (or from renderer/pages for lazy loading).
 */
export { LINUX_SEARCH_ASSISTANT_PAGE_ID } from './models'
export {
  LOCAL_LOG_VIEWER_PAGE_ID,
  MAX_LOCAL_LOG_FILE_BYTES,
  MAX_LOCAL_LOG_OPEN_FILES,
  DEFAULT_LOCAL_LOG_WINDOW_BYTES,
  LOCAL_LOG_WINDOW_PRESETS_MB,
} from './models'
export type {
  LocalLogViewerPageId,
  LocalLogFileContent,
  OpenLocalLogFilesResult,
  LocalLogReadMode,
  LocalLogReadOptions,
} from './models'
export type {
  LinuxCommandCategory,
  LinuxCommandEntry,
  LinuxSearchHit,
  LinuxSearchQuery,
  LinuxSearchResponse,
  LinuxSearchAssistantModuleStatus,
  LinuxSearchEnvironmentName,
  LinuxSearchPathEntry,
  LinuxSearchTargetConfig,
  LinuxSearchAssistantConfigDocument,
  LinuxSearchTargetConfigField,
  LinuxSearchConfigForbiddenField,
  SshServerIdentity,
  SshPasswordPrompt,
  PredefinedSshCommandKind,
  PredefinedSshCommand,
  SshCommandResult,
  SshConnectResult,
  SshSessionHandle,
  SshSessionExpiredEvent,
  RemoteSearchOperation,
  RemoteSearchRequest,
  RemoteSearchErrorCode,
  RemoteSearchSuccessResult,
  RemoteSearchErrorResult,
  RemoteSearchResult,
  SearchConnectRequiredEvent,
  RecentActionOperation,
  RecentActionRecord,
  RecentActionInput,
  RecentActionsPreferences,
  RecentActionsDocument,
} from './models'
export {
  LINUX_SEARCH_TARGET_CONFIG_FIELDS,
  LINUX_SEARCH_CONFIG_FORBIDDEN_FIELDS,
  DEFAULT_LINUX_SEARCH_SSH_PORT,
  EMPTY_LINUX_SEARCH_CONFIG_DOCUMENT,
  createEmptyLinuxSearchPathEntry,
  createEmptyLinuxSearchTargetConfig,
  PREDEFINED_SSH_COMMAND_KINDS,
  toSshServerIdentity,
  REMOTE_SEARCH_OPERATIONS,
  RECENT_ACTION_OPERATIONS,
  DEFAULT_RECENT_ACTIONS_HISTORY_SIZE,
  MIN_RECENT_ACTIONS_HISTORY_SIZE,
  MAX_RECENT_ACTIONS_HISTORY_SIZE,
  EMPTY_RECENT_ACTIONS_DOCUMENT,
  isRecentActionOperation,
} from './models'

export {
  FEATURE_FLAG_SETTINGS_KEY,
  resolveFeatureFlag,
  isLinuxSearchAssistantEnabledByEnv,
  parseFeatureFlagValue,
} from './featureFlag'

export {
  LINUX_SEARCH_ASSISTANT_IPC,
  LINUX_SEARCH_ASSISTANT_IPC_CHANNELS,
  LINUX_SEARCH_ASSISTANT_IPC_EVENTS,
} from './ipc/channels'

export {
  searchLinuxCommands,
  getLinuxCommandCategories,
  getLinuxCommandCatalog,
  buildPredefinedRemoteCommand,
  assertPredefinedCommand,
  PredefinedCommandError,
  collectAllowedRoots,
  isPathAllowed,
  assertPathAllowed,
  PathAllowlistError,
  toPredefinedSearchCommand,
  RemoteSearchCommandError,
  buildRemoteSearchFromAction,
  resolveAbsolutePath,
  ActionResolveError,
} from './services'
