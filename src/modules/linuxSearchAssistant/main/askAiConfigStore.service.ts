/**
 * Persist Ask AI settings (LLM + multi MCP servers).
 * API keys / auth headers are stored in app settings JSON — never logged.
 */
import { AppSettingsRepository } from '../../../main/db/repositories/AppSettingsRepository'
import {
  EMPTY_ASK_AI_CONFIG,
  createEmptyMcpServer,
  type AskAiConfig,
  type AskAiMcpServerConfig,
  type AskAiMode,
} from '../models/aiAnalyze'

export const ASK_AI_CONFIG_SETTINGS_KEY = 'linuxSearchAssistant.askAi'

const settingsRepo = new AppSettingsRepository()
let cached: AskAiConfig | null = null

function asMode(value: unknown): AskAiMode {
  return value === 'mcp' ? 'mcp' : 'llm'
}

function normalizeMcpServer(raw: unknown): AskAiMcpServerConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id.trim() : ''
  const url = typeof r.url === 'string' ? r.url.trim() : ''
  if (!id || !url) return null
  return createEmptyMcpServer({
    id,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'MCP Server',
    url,
    toolName: typeof r.toolName === 'string' && r.toolName.trim() ? r.toolName.trim() : 'analyze_logs',
    authHeader: typeof r.authHeader === 'string' ? r.authHeader : '',
    enabled: r.enabled !== false,
  })
}

export function normalizeAskAiConfig(raw: unknown): AskAiConfig {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(EMPTY_ASK_AI_CONFIG)
  }
  const r = raw as Record<string, unknown>
  const llmRaw = r.llm && typeof r.llm === 'object' ? (r.llm as Record<string, unknown>) : {}
  const mcpServers = Array.isArray(r.mcpServers)
    ? r.mcpServers.map(normalizeMcpServer).filter((s): s is AskAiMcpServerConfig => Boolean(s))
    : []

  return {
    enabled: r.enabled === true,
    mode: asMode(r.mode),
    llm: {
      baseUrl:
        typeof llmRaw.baseUrl === 'string' && llmRaw.baseUrl.trim()
          ? llmRaw.baseUrl.trim().replace(/\/+$/, '')
          : EMPTY_ASK_AI_CONFIG.llm.baseUrl,
      apiKey: typeof llmRaw.apiKey === 'string' ? llmRaw.apiKey : '',
      model:
        typeof llmRaw.model === 'string' && llmRaw.model.trim()
          ? llmRaw.model.trim()
          : EMPTY_ASK_AI_CONFIG.llm.model,
      systemPrompt:
        typeof llmRaw.systemPrompt === 'string' ? llmRaw.systemPrompt : EMPTY_ASK_AI_CONFIG.llm.systemPrompt,
    },
    mcpServers,
    lastMcpServerId: typeof r.lastMcpServerId === 'string' ? r.lastMcpServerId : undefined,
  }
}

export function getAskAiConfig(): AskAiConfig {
  if (cached) return cached
  const raw = settingsRepo.get(ASK_AI_CONFIG_SETTINGS_KEY)
  if (!raw) {
    cached = structuredClone(EMPTY_ASK_AI_CONFIG)
    return cached
  }
  try {
    cached = normalizeAskAiConfig(JSON.parse(raw))
  } catch {
    cached = structuredClone(EMPTY_ASK_AI_CONFIG)
  }
  return cached
}

export function saveAskAiConfig(input: unknown): AskAiConfig {
  const normalized = normalizeAskAiConfig(input)
  settingsRepo.set(ASK_AI_CONFIG_SETTINGS_KEY, JSON.stringify(normalized))
  cached = normalized
  return normalized
}

export function clearAskAiConfigCache(): void {
  cached = null
}

/** Public view for renderer lists — never strip keys here; UI masks display. */
export function getAskAiConfigPublic(): AskAiConfig {
  return getAskAiConfig()
}
