/** Module-owned IPC channels (must also be allow-listed in shared/ipc/channels). */
export const LINUX_SEARCH_ASSISTANT_IPC = {
  search: 'linuxSearchAssistant:search',
  remoteSearch: 'linuxSearchAssistant:remoteSearch',
  getStatus: 'linuxSearchAssistant:getStatus',
  setEnabled: 'linuxSearchAssistant:setEnabled',
  getCategories: 'linuxSearchAssistant:getCategories',
  sshConnect: 'linuxSearchAssistant:sshConnect',
  sshDisconnect: 'linuxSearchAssistant:sshDisconnect',
  sshIsConnected: 'linuxSearchAssistant:sshIsConnected',
  sshListSessions: 'linuxSearchAssistant:sshListSessions',
  getConfig: 'linuxSearchAssistant:getConfig',
  saveConfig: 'linuxSearchAssistant:saveConfig',
  listRecentActions: 'linuxSearchAssistant:listRecentActions',
  getRecentActionsPrefs: 'linuxSearchAssistant:getRecentActionsPrefs',
  setRecentActionsHistorySize: 'linuxSearchAssistant:setRecentActionsHistorySize',
  setRecentActionPinned: 'linuxSearchAssistant:setRecentActionPinned',
  removeRecentAction: 'linuxSearchAssistant:removeRecentAction',
  clearUnpinnedRecentActions: 'linuxSearchAssistant:clearUnpinnedRecentActions',
  executeLogicalAction: 'linuxSearchAssistant:executeLogicalAction',
  executeLogicalActionBatch: 'linuxSearchAssistant:executeLogicalActionBatch',
  replayRecentAction: 'linuxSearchAssistant:replayRecentAction',
  getDebugInfo: 'linuxSearchAssistant:getDebugInfo',
  getLogTail: 'linuxSearchAssistant:getLogTail',
  listRemoteFiles: 'linuxSearchAssistant:listRemoteFiles',
  getAskAiConfig: 'linuxSearchAssistant:getAskAiConfig',
  saveAskAiConfig: 'linuxSearchAssistant:saveAskAiConfig',
  analyzeAskAi: 'linuxSearchAssistant:analyzeAskAi',
  testAskAiLlm: 'linuxSearchAssistant:testAskAiLlm',
  testAskAiMcp: 'linuxSearchAssistant:testAskAiMcp',
  openLocalLogFiles: 'linuxSearchAssistant:openLocalLogFiles',
  reloadLocalLogFile: 'linuxSearchAssistant:reloadLocalLogFile',
} as const

/** Main → renderer events owned by this module. */
export const LINUX_SEARCH_ASSISTANT_IPC_EVENTS = {
  sessionExpired: 'linuxSearchAssistant:sessionExpired',
  connectRequired: 'linuxSearchAssistant:connectRequired',
  consoleLog: 'linuxSearchAssistant:consoleLog',
} as const

export type LinuxSearchAssistantIpcChannel =
  (typeof LINUX_SEARCH_ASSISTANT_IPC)[keyof typeof LINUX_SEARCH_ASSISTANT_IPC]

export const LINUX_SEARCH_ASSISTANT_IPC_CHANNELS = Object.values(LINUX_SEARCH_ASSISTANT_IPC)
