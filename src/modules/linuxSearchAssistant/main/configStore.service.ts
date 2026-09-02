/**
 * Persist portable application target configs (no secrets).
 */
import { AppSettingsRepository } from '../../../main/db/repositories/AppSettingsRepository'
import {
  EMPTY_LINUX_SEARCH_CONFIG_DOCUMENT,
  LINUX_SEARCH_CONFIG_FORBIDDEN_FIELDS,
  normalizeLinuxSearchTargetConfig,
  type LinuxSearchAssistantConfigDocument,
  type LinuxSearchTargetConfig,
} from '../models/config'

export const LINUX_SEARCH_CONFIG_SETTINGS_KEY = 'linuxSearchAssistant.config'

const settingsRepo = new AppSettingsRepository()
let cached: LinuxSearchAssistantConfigDocument | null = null

function rejectSecrets(value: unknown, path = 'root'): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, i) => rejectSecrets(item, `${path}[${i}]`))
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((LINUX_SEARCH_CONFIG_FORBIDDEN_FIELDS as readonly string[]).includes(key)) {
      throw new Error(`Forbidden credential field "${key}" rejected in application configuration.`)
    }
    rejectSecrets(child, `${path}.${key}`)
  }
}

function pathFingerprint(doc: LinuxSearchAssistantConfigDocument): string {
  return JSON.stringify(
    doc.targets.map((t) => ({
      id: t.id,
      logs: (t.logPaths || []).map((p) => ({ id: p.id, path: p.path })),
      configs: (t.configPaths || []).map((p) => ({ id: p.id, path: p.path })),
      search: (t.searchPaths || []).map((p) => ({ id: p.id, path: p.path })),
    }))
  )
}

function normalizeDocument(raw: unknown): LinuxSearchAssistantConfigDocument {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_LINUX_SEARCH_CONFIG_DOCUMENT, targets: [] }
  rejectSecrets(raw)
  const doc = raw as Partial<LinuxSearchAssistantConfigDocument>
  const targets = Array.isArray(doc.targets) ? (doc.targets as LinuxSearchTargetConfig[]) : []
  return {
    schemaVersion: 1,
    targets: targets
      .filter((t) => t && typeof t.id === 'string' && t.id.trim())
      .map((t) => normalizeLinuxSearchTargetConfig(t)),
  }
}

export function getLinuxSearchConfigDocument(): LinuxSearchAssistantConfigDocument {
  if (cached) return cached
  const raw = settingsRepo.get(LINUX_SEARCH_CONFIG_SETTINGS_KEY)
  if (!raw) {
    cached = { schemaVersion: 1, targets: [] }
    return cached
  }
  try {
    const parsed = JSON.parse(raw)
    const before = typeof parsed === 'object' && parsed ? pathFingerprint({
      schemaVersion: 1,
      targets: Array.isArray((parsed as LinuxSearchAssistantConfigDocument).targets)
        ? (parsed as LinuxSearchAssistantConfigDocument).targets
        : [],
    }) : ''
    cached = normalizeDocument(parsed)
    // Persist repaired path ids (absolute path mistakenly stored as id).
    if (before && before !== pathFingerprint(cached)) {
      settingsRepo.set(LINUX_SEARCH_CONFIG_SETTINGS_KEY, JSON.stringify(cached))
    }
  } catch {
    cached = { schemaVersion: 1, targets: [] }
  }
  return cached
}

export function saveLinuxSearchConfigDocument(
  input: unknown
): LinuxSearchAssistantConfigDocument {
  const normalized = normalizeDocument(input)
  settingsRepo.set(LINUX_SEARCH_CONFIG_SETTINGS_KEY, JSON.stringify(normalized))
  cached = normalized
  return normalized
}

export function listLinuxSearchTargets(): LinuxSearchTargetConfig[] {
  return getLinuxSearchConfigDocument().targets
}

export function getLinuxSearchTargetById(targetId: string): LinuxSearchTargetConfig | null {
  const id = (targetId || '').trim()
  if (!id) return null
  return listLinuxSearchTargets().find((t) => t.id === id) ?? null
}

export function clearLinuxSearchConfigCache(): void {
  cached = null
}
