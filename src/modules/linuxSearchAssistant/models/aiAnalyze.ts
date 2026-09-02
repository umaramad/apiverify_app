/**
 * Ask AI / Send to MCP — analyze LSA output via LLM or remote MCP tool.
 * Secrets (apiKey / authHeader) must never be logged or stored in Recent Actions.
 */

export type AskAiMode = 'llm' | 'mcp'

export interface AskAiLlmConfig {
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt?: string
}

export interface AskAiMcpServerConfig {
  id: string
  name: string
  url: string
  toolName: string
  /** Bearer token or full Authorization header value (masked in UI). */
  authHeader?: string
  enabled: boolean
}

export interface AskAiConfig {
  enabled: boolean
  mode: AskAiMode
  llm: AskAiLlmConfig
  mcpServers: AskAiMcpServerConfig[]
  lastMcpServerId?: string
}

export interface AskAiAnalyzeRequest {
  text: string
  mode?: AskAiMode
  mcpServerId?: string
  /** Optional context shown to the model (app / path / file). */
  context?: string
}

export interface AskAiAnalyzeResult {
  ok: boolean
  mode?: AskAiMode
  content?: string
  message?: string
  truncated?: boolean
}

export interface AskAiTestResult {
  ok: boolean
  message: string
  tools?: string[]
}

export const DEFAULT_ASK_AI_SYSTEM_PROMPT =
  'You are a senior engineer. Given remote Linux/application logs, explain the likely root cause and propose a concrete fix. Be concise and actionable.'

export const EMPTY_ASK_AI_CONFIG: AskAiConfig = {
  enabled: false,
  mode: 'llm',
  llm: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    systemPrompt: DEFAULT_ASK_AI_SYSTEM_PROMPT,
  },
  mcpServers: [],
}

export const ASK_AI_MAX_PAYLOAD_CHARS = 80_000

export function createEmptyMcpServer(partial?: Partial<AskAiMcpServerConfig>): AskAiMcpServerConfig {
  return {
    id: partial?.id || `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: partial?.name || 'MCP Server',
    url: partial?.url || '',
    toolName: partial?.toolName || 'analyze_logs',
    authHeader: partial?.authHeader || '',
    enabled: partial?.enabled !== false,
  }
}
