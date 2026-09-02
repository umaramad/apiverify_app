import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { buildProxyUrl, shouldUseProxyForUrl } from '../../shared/models/proxySettings'
import type { BuiltRequest, HttpClient, HttpResponse } from '../../shared/engine/types'
import { getProxySettings } from './proxySettings.service'

type ProxyAgents = {
  proxyUrl: string
  httpAgent: HttpProxyAgent<string>
  httpsAgent: HttpsProxyAgent<string>
}

let cachedAgents: ProxyAgents | null = null
let cachedProxySettingsKey = ''

function normalizeHeaders(raw: Record<string, unknown>): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue
    headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return headers
}

function getProxySettingsKey(): string {
  return JSON.stringify(getProxySettings())
}

function getProxyAgents(): { httpAgent: HttpProxyAgent<string>; httpsAgent: HttpsProxyAgent<string> } | null {
  const proxyUrl = buildProxyUrl(getProxySettings())
  if (!proxyUrl) return null

  const settingsKey = getProxySettingsKey()
  if (cachedAgents && cachedProxySettingsKey === settingsKey) {
    return {
      httpAgent: cachedAgents.httpAgent,
      httpsAgent: cachedAgents.httpsAgent,
    }
  }

  const httpAgent = new HttpProxyAgent(proxyUrl)
  const httpsAgent = new HttpsProxyAgent(proxyUrl)
  cachedAgents = { proxyUrl, httpAgent, httpsAgent }
  cachedProxySettingsKey = settingsKey

  return { httpAgent, httpsAgent }
}

export function clearProxyAgentsCache(): void {
  cachedAgents = null
  cachedProxySettingsKey = ''
}

export function applyProxyToAxiosConfig(config: AxiosRequestConfig): AxiosRequestConfig {
  const url = typeof config.url === 'string' ? config.url : ''
  if (!url) return { ...config, proxy: false }

  const settings = getProxySettings()
  if (!shouldUseProxyForUrl(url, settings)) {
    return { ...config, proxy: false }
  }

  const agents = getProxyAgents()
  if (!agents) {
    return { ...config, proxy: false }
  }

  return {
    ...config,
    proxy: false,
    httpAgent: agents.httpAgent,
    httpsAgent: agents.httpsAgent,
  }
}

export async function sendAxiosRequest<T = unknown>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  return axios(applyProxyToAxiosConfig(config))
}

export function createProxyAwareHttpClient(): HttpClient {
  return async (
    request: BuiltRequest,
    options: { timeoutMs: number; signal?: AbortSignal }
  ): Promise<HttpResponse> => {
    const response = await sendAxiosRequest({
      url: request.url,
      method: request.method,
      headers: request.headers,
      data: request.body,
      timeout: options.timeoutMs,
      signal: options.signal,
      validateStatus: () => true,
    })

    return {
      status: response.status,
      headers: normalizeHeaders(response.headers as Record<string, unknown>),
      data: response.data,
    }
  }
}
