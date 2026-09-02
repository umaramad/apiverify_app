/**
 * Portable configuration models for Linux Search Assistant.
 *
 * Intentionally stores only non-secret connection and path metadata so
 * configs can be exported/imported across machines without credentials.
 *
 * DO NOT add: passwords, SSH keys, private key paths, tokens, or any secret material.
 */

/** Logical environment label (free-form; not an OS environment variable dump). */
export type LinuxSearchEnvironmentName = string

/** Named filesystem path entry used for logs, configs, or search roots. */
export interface LinuxSearchPathEntry {
  /** Stable id for list editing / persistence (UUID or equivalent). */
  id: string
  /** Human-readable label (e.g. "app access log"). */
  label: string
  /** Absolute or portable path on the remote/local host. */
  path: string
  /** Optional note; never store secrets here. */
  notes?: string
  enabled: boolean
}

/**
 * One portable target used by Linux Search Assistant.
 * Contains host identity and path inventories only — no credentials.
 */
export interface LinuxSearchTargetConfig {
  /** Schema version for forward-compatible import/export. */
  schemaVersion: 1
  /** Unique id for this target config. */
  id: string
  /** Environment (e.g. "dev", "staging", "prod"). */
  environment: LinuxSearchEnvironmentName
  /** Application display name. */
  applicationName: string
  /** Logical server name (inventory / CMDB style). */
  serverName: string
  /** Hostname or IP address used to reach the server. */
  hostNameOrIp: string
  /** SSH port (typically 22). */
  sshPort: number
  /** SSH / OS username (identity only — never a password). */
  username: string
  /** Application home directory on the host. */
  applicationHome: string
  /** One or more log file/directory paths. */
  logPaths: LinuxSearchPathEntry[]
  /** One or more configuration file/directory paths. */
  configPaths: LinuxSearchPathEntry[]
  /** One or more additional roots to search. */
  searchPaths: LinuxSearchPathEntry[]
  /** ISO timestamps for portable sync / merge. */
  createdAt: string
  updatedAt: string
}

/**
 * Collection of portable targets. Suitable for JSON export/import.
 * Must never contain credential fields.
 */
export interface LinuxSearchAssistantConfigDocument {
  schemaVersion: 1
  targets: LinuxSearchTargetConfig[]
}

/** Keys allowed on {@link LinuxSearchTargetConfig} (documentation / validation aid). */
export const LINUX_SEARCH_TARGET_CONFIG_FIELDS = [
  'schemaVersion',
  'id',
  'environment',
  'applicationName',
  'serverName',
  'hostNameOrIp',
  'sshPort',
  'username',
  'applicationHome',
  'logPaths',
  'configPaths',
  'searchPaths',
  'createdAt',
  'updatedAt',
] as const

export type LinuxSearchTargetConfigField = (typeof LINUX_SEARCH_TARGET_CONFIG_FIELDS)[number]

/**
 * Explicit denylist of secret-related field names.
 * Import/export and validators must reject these if present in raw JSON.
 */
export const LINUX_SEARCH_CONFIG_FORBIDDEN_FIELDS = [
  'password',
  'passphrase',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'sshKey',
  'privateKey',
  'privateKeyPath',
  'publicKey',
  'publicKeyPath',
  'identityFile',
  'keyPath',
  'credentials',
  'auth',
] as const

export type LinuxSearchConfigForbiddenField = (typeof LINUX_SEARCH_CONFIG_FORBIDDEN_FIELDS)[number]

export const DEFAULT_LINUX_SEARCH_SSH_PORT = 22

export const EMPTY_LINUX_SEARCH_CONFIG_DOCUMENT: LinuxSearchAssistantConfigDocument = {
  schemaVersion: 1,
  targets: [],
}

export function createEmptyLinuxSearchPathEntry(
  overrides?: Partial<Omit<LinuxSearchPathEntry, 'id'>> & { id?: string }
): LinuxSearchPathEntry {
  return {
    id: overrides?.id ?? '',
    label: overrides?.label ?? '',
    path: overrides?.path ?? '',
    notes: overrides?.notes,
    enabled: overrides?.enabled ?? true,
  }
}

function newOfflinePathId(label: string): string {
  const slug = (label || 'path')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24)
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10)
  return `log_${slug || 'path'}_${rand}`
}

/**
 * Ensure path entries have a logical (non-absolute) id and an absolute path.
 * Fixes older configs where users put `/var/log/...` into the path id field.
 */
export function normalizeLinuxSearchPathEntry(entry: LinuxSearchPathEntry): LinuxSearchPathEntry {
  let path = (entry.path || '').trim()
  let id = (entry.id || '').trim()
  const label = (entry.label || '').trim() || 'App logs'

  // Mistaken absolute path stored as id — recover into path when needed.
  if (id.startsWith('/')) {
    if (!path) path = id
    id = newOfflinePathId(label)
  }
  if (!id || id.includes('/') || id.includes('\\')) {
    id = newOfflinePathId(label)
  }

  return {
    ...entry,
    id,
    label,
    path,
    enabled: entry.enabled !== false,
  }
}

export function normalizeLinuxSearchTargetConfig(target: LinuxSearchTargetConfig): LinuxSearchTargetConfig {
  return {
    ...target,
    logPaths: (target.logPaths || []).map(normalizeLinuxSearchPathEntry),
    configPaths: (target.configPaths || []).map(normalizeLinuxSearchPathEntry),
    searchPaths: (target.searchPaths || []).map(normalizeLinuxSearchPathEntry),
  }
}

export function createEmptyLinuxSearchTargetConfig(
  overrides?: Partial<Omit<LinuxSearchTargetConfig, 'schemaVersion'>> & { id?: string }
): LinuxSearchTargetConfig {
  const now = new Date().toISOString()
  return normalizeLinuxSearchTargetConfig({
    schemaVersion: 1,
    id: overrides?.id ?? '',
    environment: overrides?.environment ?? '',
    applicationName: overrides?.applicationName ?? '',
    serverName: overrides?.serverName ?? '',
    hostNameOrIp: overrides?.hostNameOrIp ?? '',
    sshPort: overrides?.sshPort ?? DEFAULT_LINUX_SEARCH_SSH_PORT,
    username: overrides?.username ?? '',
    applicationHome: overrides?.applicationHome ?? '',
    logPaths: overrides?.logPaths ?? [],
    configPaths: overrides?.configPaths ?? [],
    searchPaths: overrides?.searchPaths ?? [],
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
  })
}
