export interface ProxySettings {
  enabled: boolean
  host: string
  port: number
  username: string
  password: string
  bypassLocal: boolean
}

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: false,
  host: '',
  port: 8080,
  username: '',
  password: '',
  bypassLocal: true,
}

export type AxiosProxyConfig =
  | false
  | {
      protocol: string
      host: string
      port: number
      auth?: { username: string; password: string }
    }

export interface ParsedProxyEndpoint {
  host: string
  port: number
  protocol: 'http' | 'https'
}

export function parseProxyEndpoint(host: string, port: number): ParsedProxyEndpoint {
  const trimmed = host.trim()
  if (!trimmed) return { host: '', port, protocol: 'http' }

  if (trimmed.includes('://')) {
    try {
      const url = new URL(trimmed)
      return {
        host: url.hostname,
        port: url.port ? Number(url.port) : port,
        protocol: url.protocol === 'https:' ? 'https' : 'http',
      }
    } catch {
      return { host: trimmed, port, protocol: 'http' }
    }
  }

  const lastColon = trimmed.lastIndexOf(':')
  if (lastColon > 0) {
    const maybePort = trimmed.slice(lastColon + 1)
    if (/^\d+$/.test(maybePort)) {
      return {
        host: trimmed.slice(0, lastColon),
        port: Number(maybePort),
        protocol: 'http',
      }
    }
  }

  return { host: trimmed, port, protocol: 'http' }
}

export function buildProxyUrl(settings: ProxySettings): string | null {
  if (!settings.enabled) return null

  const { host, port, protocol } = parseProxyEndpoint(settings.host, settings.port)
  if (!host) return null

  const username = settings.username.trim()
  const auth = username
    ? `${encodeURIComponent(username)}:${encodeURIComponent(settings.password)}@`
    : ''

  return `${protocol}://${auth}${host}:${port}`
}

export function shouldBypassProxy(url: string, settings: ProxySettings): boolean {
  if (!settings.bypassLocal) return false

  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

export function shouldUseProxyForUrl(url: string, settings: ProxySettings): boolean {
  if (!settings.enabled || !buildProxyUrl(settings)) return false
  return !shouldBypassProxy(url, settings)
}

/** @deprecated Use buildProxyUrl + proxy agents in the main process instead. */
export function buildAxiosProxyConfig(url: string, settings: ProxySettings): AxiosProxyConfig {
  if (!shouldUseProxyForUrl(url, settings)) return false

  const { host, port, protocol } = parseProxyEndpoint(settings.host, settings.port)
  const proxy: Exclude<AxiosProxyConfig, false> = {
    protocol,
    host,
    port,
  }

  const username = settings.username.trim()
  if (username) {
    proxy.auth = { username, password: settings.password }
  }

  return proxy
}
