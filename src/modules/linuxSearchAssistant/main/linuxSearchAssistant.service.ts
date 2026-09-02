import { AppSettingsRepository } from '../../../main/db/repositories/AppSettingsRepository'
import {
  FEATURE_FLAG_SETTINGS_KEY,
  resolveFeatureFlag,
} from '../featureFlag'
import type { LinuxSearchAssistantModuleStatus, LinuxSearchQuery, LinuxSearchResponse } from '../models'
import { getLinuxCommandCategories, searchLinuxCommands } from '../services'

const settingsRepo = new AppSettingsRepository()

export function getLinuxSearchAssistantStatus(): LinuxSearchAssistantModuleStatus {
  const persisted = settingsRepo.get(FEATURE_FLAG_SETTINGS_KEY)
  const resolved = resolveFeatureFlag(persisted)
  return { enabled: resolved.enabled, source: resolved.source }
}

export function setLinuxSearchAssistantEnabled(enabled: boolean): LinuxSearchAssistantModuleStatus {
  settingsRepo.set(FEATURE_FLAG_SETTINGS_KEY, enabled ? 'true' : 'false')
  return getLinuxSearchAssistantStatus()
}

export function assertLinuxSearchAssistantEnabled(): void {
  const status = getLinuxSearchAssistantStatus()
  if (!status.enabled) {
    throw new Error('Linux Search Assistant is disabled. Enable it in Settings or via LINUX_SEARCH_ASSISTANT=1.')
  }
}

export function runLinuxSearch(query: LinuxSearchQuery): LinuxSearchResponse {
  assertLinuxSearchAssistantEnabled()
  return searchLinuxCommands(query)
}

export function listLinuxSearchCategories(): string[] {
  assertLinuxSearchAssistantEnabled()
  return getLinuxCommandCategories()
}
