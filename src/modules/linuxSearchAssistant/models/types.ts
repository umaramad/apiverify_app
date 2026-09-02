/** Page id used in ActivePage / sidebar / router. */
export const LINUX_SEARCH_ASSISTANT_PAGE_ID = 'linuxSearchAssistant' as const

export type LinuxSearchAssistantPageId = typeof LINUX_SEARCH_ASSISTANT_PAGE_ID

export type LinuxCommandCategory =
  | 'files'
  | 'process'
  | 'network'
  | 'system'
  | 'text'
  | 'permissions'
  | 'package'
  | 'other'

export interface LinuxCommandEntry {
  id: string
  name: string
  synopsis: string
  description: string
  category: LinuxCommandCategory
  examples: string[]
  tags: string[]
}

export interface LinuxSearchQuery {
  text: string
  category?: LinuxCommandCategory | 'all'
  limit?: number
}

export interface LinuxSearchHit {
  entry: LinuxCommandEntry
  score: number
  matchedOn: Array<'name' | 'tag' | 'description' | 'example'>
}

export interface LinuxSearchResponse {
  query: string
  total: number
  hits: LinuxSearchHit[]
}

export interface LinuxSearchAssistantModuleStatus {
  enabled: boolean
  source: 'env' | 'settings' | 'default'
}
