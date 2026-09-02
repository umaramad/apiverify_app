/**
 * Session-only view state for LinuxSearchOutputPanel, keyed by session id
 * (e.g. Local Log Viewer tab id). In-memory only — never persisted to disk.
 *
 * The panel writes its view through here as it changes and the parent remounts
 * it per session (key=tabId), loading the entry on mount and capturing the
 * final scroll position on unmount — so per-tab find/filter/highlight/bookmark
 * state survives tab switches.
 *
 * Entries are not explicitly evicted when a tab closes — the panel owns its
 * lifecycle — but they are session-only, in-memory, and bounded by the number
 * of files opened, so leftovers are negligible.
 */
import { create } from 'zustand'

export type OutputHighlightColorId =
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'pink'
  | 'orange'
  | 'violet'

export interface OutputHighlightRule {
  id: string
  text: string
  colorId: OutputHighlightColorId
}

export interface OutputBookmark {
  id: string
  label: string
  /** Scroll position in the current output body. */
  scrollTop: number
  /** Optional phrase to re-find after minor output refresh. */
  phrase?: string
}

export interface OutputPanelViewState {
  highlights: OutputHighlightRule[]
  findQuery: string
  findCaseSensitive: boolean
  filterMode: boolean
  wrap: boolean
  fontSize: number
  bookmarks: OutputBookmark[]
  scrollTop: number
}

export const EMPTY_OUTPUT_VIEW: OutputPanelViewState = {
  highlights: [],
  findQuery: '',
  findCaseSensitive: false,
  filterMode: false,
  wrap: true,
  fontSize: 12,
  bookmarks: [],
  scrollTop: 0,
}

interface OutputViewStore {
  views: Record<string, OutputPanelViewState>
  getView: (key: string) => OutputPanelViewState
  setView: (key: string, state: OutputPanelViewState) => void
}

export const useOutputViewStore = create<OutputViewStore>((set, get) => ({
  views: {},
  getView: (key) => get().views[key] ?? EMPTY_OUTPUT_VIEW,
  setView: (key, state) => set((s) => ({ views: { ...s.views, [key]: state } })),
}))
