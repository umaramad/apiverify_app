/**
 * Ask AI analyze — OpenAI-compatible LLM or remote MCP tools/call (HTTP).
 * Never logs API keys or auth headers.
 */
import {
  ASK_AI_MAX_PAYLOAD_CHARS,
  DEFAULT_ASK_AI_SYSTEM_PROMPT,
  type AskAiAnalyzeRequest,
  type AskAiAnalyzeResult,
  type AskAiConfig,
  type AskAiMcpServerConfig,
  type AskAiTestResult,
} from '../models/aiAnalyze'
import { getAskAiConfig, saveAskAiConfig } from './askAiConfigStore.service'
import { broadcastLinuxSearchConsole } from './consoleBroadcast'

function redactSecrets(text: string): string {
  return text
    .replace(/password[=:]\s*\S+/gi, 'password=[redacted]')
    .replace(/passphrase[=:]\s*\S+/gi, 'passphrase=[redacted]')
    .replace(/authorization[=:]\s*\S+/gi, 'authorization=[redacted]')
    .replace(/bearer\s+[a-z0-9._\-]+/gi, 'Bearer [redacted]')
    .replace(/api[_-]?key[=:]\s*\S+/gi, 'api_key=[redacted]')
}

function preparePayload(text: string): { text: string; truncated: boolean } {
  const cleaned = redactSecrets((text || '').trim())
  if (cleaned.length <= ASK_AI_MAX_PAYLOAD_CHARS) {
    return { text: cleaned, truncated: false }
  }
  return {
    text: `${cleaned.slice(0, ASK_AI_MAX_PAYLOAD_CHARS)}\n\n…[truncated for Ask AI payload limit]`,
    truncated: true,
  }
}

function authHeaders(authHeader?: string): Record<string, string> {
  const raw = (authHeader || '').trim()
  if (!raw) return {}
  if (/^authorization\s*:/i.test(raw)) {
    const value = raw.replace(/^authorization\s*:\s*/i, '').trim()
    return value ? { Authorization: value } : {}
  }
  if (/^bearer\s+/i.test(raw)) return { Authorization: raw }
  return { Authorization: `Bearer ${raw}` }
}

async function callLlm(
  config: AskAiConfig,
  text: string,
  context?: string
): Promise<AskAiAnalyzeResult> {
  const baseUrl = config.llm.baseUrl.replace(/\/+$/, '')
  const url = `${baseUrl}/chat/completions`
  if (!config.llm.model.trim()) {
    return { ok: false, mode: 'llm', message: 'LLM model is required in Settings → Ask AI.' }
  }

  const system = (config.llm.systemPrompt || DEFAULT_ASK_AI_SYSTEM_PROMPT).trim()
  const userParts = [
    context ? `Context:\n${context}` : '',
    'Logs / errors to analyze:',
    text,
  ].filter(Boolean)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.llm.apiKey.trim() ? { Authorization: `Bearer ${config.llm.apiKey.trim()}` } : {}),
      },
      body: JSON.stringify({
        model: config.llm.model.trim(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userParts.join('\n\n') },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    })
    const raw = await response.text()
    if (!response.ok) {
      const safe = raw.slice(0, 400).replace(config.llm.apiKey, '[redacted]')
      return {
        ok: false,
        mode: 'llm',
        message: `LLM request failed (${response.status}): ${safe || response.statusText}`,
      }
    }
    let parsed: { choices?: Array<{ message?: { content?: string } }> }
    try {
      parsed = JSON.parse(raw) as typeof parsed
    } catch {
      return { ok: false, mode: 'llm', message: 'LLM returned invalid JSON.' }
    }
    const content = parsed.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return { ok: false, mode: 'llm', message: 'LLM returned an empty response.' }
    }
    return { ok: true, mode: 'llm', content }
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'LLM request timed out.'
        : error instanceof Error
          ? error.message
          : 'LLM request failed.'
    return { ok: false, mode: 'llm', message }
  } finally {
    clearTimeout(timer)
  }
}

function extractMcpText(result: unknown): string {
  if (!result || typeof result !== 'object') return String(result ?? '')
  const r = result as Record<string, unknown>
  if (typeof r.content === 'string') return r.content
  if (Array.isArray(r.content)) {
    return r.content
      .map((item) => {
        if (!item || typeof item !== 'object') return String(item)
        const row = item as Record<string, unknown>
        if (typeof row.text === 'string') return row.text
        return JSON.stringify(row)
      })
      .join('\n')
  }
  if (typeof r.result === 'string') return r.result
  return JSON.stringify(result, null, 2)
}

async function mcpJsonRpc(
  server: AskAiMcpServerConfig,
  method: string,
  params: Record<string, unknown>
): Promise<{ ok: true; result: unknown } | { ok: false; message: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...authHeaders(server.authHeader),
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)
  try {
    const response = await fetch(server.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    })
    const raw = await response.text()
    if (!response.ok) {
      return {
        ok: false,
        message: `MCP HTTP ${response.status}: ${raw.slice(0, 400) || response.statusText}`,
      }
    }

    // SSE-ish: take last data: JSON line if present
    let jsonText = raw.trim()
    if (jsonText.includes('data:')) {
      const lines = jsonText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.replace(/^data:\s*/, ''))
      jsonText = lines[lines.length - 1] || jsonText
    }

    let parsed: { result?: unknown; error?: { message?: string } }
    try {
      parsed = JSON.parse(jsonText) as typeof parsed
    } catch {
      // Some gateways return plain text success bodies
      if (response.ok && raw.trim()) {
        return { ok: true, result: { content: [{ type: 'text', text: raw.trim() }] } }
      }
      return { ok: false, message: 'MCP returned non-JSON response.' }
    }
    if (parsed.error) {
      return { ok: false, message: parsed.error.message || 'MCP tool error.' }
    }
    return { ok: true, result: parsed.result }
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'MCP request timed out.'
        : error instanceof Error
          ? error.message
          : 'MCP request failed.'
    return { ok: false, message }
  } finally {
    clearTimeout(timer)
  }
}

async function callMcp(
  server: AskAiMcpServerConfig,
  text: string,
  context?: string
): Promise<AskAiAnalyzeResult> {
  if (!server.url.trim()) {
    return { ok: false, mode: 'mcp', message: 'MCP server URL is missing.' }
  }
  if (!server.toolName.trim()) {
    return { ok: false, mode: 'mcp', message: 'MCP tool name is missing.' }
  }

  const invoked = await mcpJsonRpc(server, 'tools/call', {
    name: server.toolName.trim(),
    arguments: {
      text,
      context: context || undefined,
      instruction: DEFAULT_ASK_AI_SYSTEM_PROMPT,
    },
  })
  if (!invoked.ok) {
    return { ok: false, mode: 'mcp', message: invoked.message }
  }
  const content = extractMcpText(invoked.result).trim()
  if (!content) {
    return { ok: false, mode: 'mcp', message: 'MCP tool returned empty content.' }
  }
  return { ok: true, mode: 'mcp', content }
}

export async function analyzeWithAskAi(input: unknown): Promise<AskAiAnalyzeResult> {
  const config = getAskAiConfig()
  if (!config.enabled) {
    return { ok: false, message: 'Ask AI is disabled. Enable it under Settings → Feature Modules → Ask AI.' }
  }

  const raw = (input && typeof input === 'object' ? input : {}) as AskAiAnalyzeRequest
  const prepared = preparePayload(typeof raw.text === 'string' ? raw.text : '')
  if (!prepared.text) {
    return { ok: false, message: 'No output text to analyze.' }
  }

  const mode = raw.mode === 'mcp' || raw.mode === 'llm' ? raw.mode : config.mode
  const context = typeof raw.context === 'string' ? raw.context.slice(0, 2000) : undefined

  broadcastLinuxSearchConsole('info', `Ask AI (${mode})…`, 'action')

  if (mode === 'llm') {
    const result = await callLlm(config, prepared.text, context)
    return { ...result, truncated: prepared.truncated || undefined }
  }

  const serverId = (raw.mcpServerId || config.lastMcpServerId || '').trim()
  const server = config.mcpServers.find((s) => s.id === serverId && s.enabled)
  if (!server) {
    return {
      ok: false,
      mode: 'mcp',
      message: 'Select an enabled MCP server (or add one in Settings → Ask AI).',
    }
  }

  // Remember last choice (non-secret).
  if (config.lastMcpServerId !== server.id) {
    saveAskAiConfig({ ...config, lastMcpServerId: server.id })
  }

  const result = await callMcp(server, prepared.text, context)
  return { ...result, truncated: prepared.truncated || undefined }
}

export async function testAskAiLlm(): Promise<AskAiTestResult> {
  const config = getAskAiConfig()
  const result = await callLlm(config, 'Reply with exactly: ok', 'connectivity test')
  if (!result.ok) return { ok: false, message: result.message || 'LLM test failed.' }
  return { ok: true, message: 'LLM connection succeeded.' }
}

export async function testAskAiMcp(serverId: unknown): Promise<AskAiTestResult> {
  const id = typeof serverId === 'string' ? serverId.trim() : ''
  const config = getAskAiConfig()
  const server = config.mcpServers.find((s) => s.id === id)
  if (!server) return { ok: false, message: 'MCP server not found.' }

  const listed = await mcpJsonRpc(server, 'tools/list', {})
  if (listed.ok) {
    const toolsRaw = listed.result as { tools?: Array<{ name?: string }> } | undefined
    const tools = Array.isArray(toolsRaw?.tools)
      ? toolsRaw!.tools!.map((t) => t.name || '').filter(Boolean)
      : []
    if (server.toolName && tools.length > 0 && !tools.includes(server.toolName)) {
      return {
        ok: false,
        message: `Connected, but tool "${server.toolName}" was not listed. Available: ${tools.slice(0, 12).join(', ') || '(none)'}`,
        tools,
      }
    }
    return {
      ok: true,
      message: tools.length
        ? `MCP reachable. Tools: ${tools.slice(0, 12).join(', ')}`
        : 'MCP reachable (tools/list returned no names).',
      tools,
    }
  }

  // Fallback: try configured tool with a tiny ping
  const ping = await callMcp(server, 'ping', 'connectivity test')
  if (ping.ok) return { ok: true, message: 'MCP tool call succeeded.' }
  return { ok: false, message: listed.message || ping.message || 'MCP test failed.' }
}
