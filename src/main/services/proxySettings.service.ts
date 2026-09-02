import {
  DEFAULT_PROXY_SETTINGS,
  type ProxySettings,
} from '../../shared/models/proxySettings'
import { AppSettingsRepository } from '../db/repositories/AppSettingsRepository'

const PROXY_SETTINGS_KEY = 'proxy'
const settingsRepo = new AppSettingsRepository()

let cachedSettings: ProxySettings | null = null

function normalizeProxySettings(raw: Partial<ProxySettings> | null | undefined): ProxySettings {
  const port =
    typeof raw?.port === 'number' && raw.port > 0 && raw.port <= 65535
      ? Math.trunc(raw.port)
      : DEFAULT_PROXY_SETTINGS.port

  return {
    enabled: raw?.enabled === true,
    host: typeof raw?.host === 'string' ? raw.host.trim() : '',
    port,
    username: typeof raw?.username === 'string' ? raw.username : '',
    password: typeof raw?.password === 'string' ? raw.password : '',
    bypassLocal: raw?.bypassLocal !== false,
  }
}

export function getProxySettings(): ProxySettings {
  if (cachedSettings) return cachedSettings

  const raw = settingsRepo.get(PROXY_SETTINGS_KEY)
  if (!raw) {
    cachedSettings = { ...DEFAULT_PROXY_SETTINGS }
    return cachedSettings
  }

  try {
    cachedSettings = normalizeProxySettings(JSON.parse(raw) as Partial<ProxySettings>)
  } catch {
    cachedSettings = { ...DEFAULT_PROXY_SETTINGS }
  }

  return cachedSettings
}

export function saveProxySettings(settings: ProxySettings): ProxySettings {
  const normalized = normalizeProxySettings(settings)
  settingsRepo.set(PROXY_SETTINGS_KEY, JSON.stringify(normalized))
  cachedSettings = normalized
  return normalized
}

export function clearProxySettingsCache(): void {
  cachedSettings = null
}
