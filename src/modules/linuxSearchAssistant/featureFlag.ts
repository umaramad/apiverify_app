/**
 * Feature flag for Linux Search Assistant.
 *
 * Priority:
 * 1. Env `LINUX_SEARCH_ASSISTANT` (`0`/`false`/`off` disables; `1`/`true`/`on` enables)
 * 2. Persisted setting value (when provided by caller)
 * 3. Default: enabled
 */
export const FEATURE_FLAG_SETTINGS_KEY = 'linuxSearchAssistant.enabled'

export function parseFeatureFlagValue(raw: string | null | undefined): boolean | null {
  if (raw == null || raw === '') return null
  const normalized = String(raw).trim().toLowerCase()
  if (['0', 'false', 'off', 'disabled', 'no'].includes(normalized)) return false
  if (['1', 'true', 'on', 'enabled', 'yes'].includes(normalized)) return true
  return null
}

export function resolveFeatureFlag(persistedValue?: string | null): {
  enabled: boolean
  source: 'env' | 'settings' | 'default'
} {
  const fromEnv = parseFeatureFlagValue(typeof process !== 'undefined' ? process.env?.LINUX_SEARCH_ASSISTANT : undefined)
  if (fromEnv !== null) {
    return { enabled: fromEnv, source: 'env' }
  }

  const fromSettings = parseFeatureFlagValue(persistedValue)
  if (fromSettings !== null) {
    return { enabled: fromSettings, source: 'settings' }
  }

  return { enabled: true, source: 'default' }
}

/** Sync check for renderer builds that only have import.meta.env-style flags. */
export function isLinuxSearchAssistantEnabledByEnv(): boolean {
  const fromEnv = parseFeatureFlagValue(
    typeof process !== 'undefined' ? process.env?.LINUX_SEARCH_ASSISTANT : undefined
  )
  return fromEnv !== false
}
