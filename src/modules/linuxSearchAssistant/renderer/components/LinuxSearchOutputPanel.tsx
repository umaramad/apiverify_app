/**
 * Output analysis panel — find/filter, copy/export, wrap/font, level chips,
 * Notepad++-style highlights, and session bookmarks.
 *
 * Bookmarks are session-only UI state (never SSH / Recent Actions / disk).
 * Scroll bookmarks jump within the current output; phrase bookmarks re-highlight & jump.
 */
import React, { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import DownloadIcon from '@mui/icons-material/Download'
import WrapTextIcon from '@mui/icons-material/WrapText'
import NotesIcon from '@mui/icons-material/Notes'
import TextIncreaseIcon from '@mui/icons-material/TextIncrease'
import TextDecreaseIcon from '@mui/icons-material/TextDecrease'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import type { AskAiMcpServerConfig, AskAiMode } from '../../models'
import { EMPTY_OUTPUT_VIEW, useOutputViewStore } from '../store/outputView.store'
import type {
  OutputBookmark,
  OutputHighlightColorId,
  OutputHighlightRule,
  OutputPanelViewState,
} from '../store/outputView.store'
import AskAiResultPanel from './AskAiResultPanel'
import LogAnalysisPanel from './LogAnalysisPanel'

export type OutputViewMode = 'raw' | 'analyze'

const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Yellow', bg: 'rgba(250, 204, 21, 0.55)', border: '#ca8a04' },
  { id: 'green', label: 'Green', bg: 'rgba(74, 222, 128, 0.45)', border: '#16a34a' },
  { id: 'cyan', label: 'Cyan', bg: 'rgba(34, 211, 238, 0.4)', border: '#0891b2' },
  { id: 'pink', label: 'Pink', bg: 'rgba(244, 114, 182, 0.45)', border: '#db2777' },
  { id: 'orange', label: 'Orange', bg: 'rgba(251, 146, 60, 0.5)', border: '#ea580c' },
  { id: 'violet', label: 'Violet', bg: 'rgba(167, 139, 250, 0.5)', border: '#7c3aed' },
] as const

type HighlightColorId = OutputHighlightColorId
type HighlightRule = OutputHighlightRule
type PanelBookmark = OutputBookmark

const LEVEL_CHIPS: Array<{ label: string; text: string; colorId: HighlightColorId }> = [
  { label: 'ERROR', text: 'ERROR', colorId: 'pink' },
  { label: 'WARN', text: 'WARN', colorId: 'orange' },
  { label: 'Exception', text: 'Exception', colorId: 'violet' },
  { label: 'INFO', text: 'INFO', colorId: 'cyan' },
]

interface TextSpan {
  text: string
  colorId?: HighlightColorId
  findHit?: boolean
}

function decodeOutputEscapes(raw: string): string {
  return raw
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function colorStyle(colorId: HighlightColorId): { backgroundColor: string; boxShadow: string } {
  const c = HIGHLIGHT_COLORS.find((x) => x.id === colorId) ?? HIGHLIGHT_COLORS[0]
  return {
    backgroundColor: c.bg,
    boxShadow: `inset 0 -2px 0 ${c.border}`,
  }
}

/** CSS Custom Highlight names (Chromium/Electron) — paint matches without React <mark> trees. */
const CSS_HL_FIND = 'lsa-find'
const cssHlColor = (id: HighlightColorId): string => `lsa-color-${id}`

const MAX_CSS_COLOR_RANGES = 600
const MAX_CSS_FIND_RANGES = 300
const MAX_FIND_OFFSETS = 500
/** Below this size, paint the full document; above, paint only the visible window. */
const VIEWPORT_HIGHLIGHT_CHARS = 400_000
const MAX_VIEWPORT_SLICE_CHARS = 250_000
/** Span fallback only when CSS.highlights is unavailable. */
const RICH_HIGHLIGHT_MAX_CHARS = 80_000
const MAX_RULE_MARKS = 400
const MAX_FIND_MARKS = 200
const MAX_SPANS = 700

type Mark = { start: number; end: number; colorId?: HighlightColorId; findHit?: boolean }

function supportsCssHighlights(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
}

function collectPhraseOffsets(
  text: string,
  phrase: string,
  limit: number,
  haystackLower?: string | null,
  caseSensitive = true
): number[] {
  const q = phrase
  if (!q || limit <= 0 || !text) return []
  const hay = caseSensitive ? text : haystackLower ?? text.toLowerCase()
  const needle = caseSensitive ? q : q.toLowerCase()
  const offsets: number[] = []
  let from = 0
  while (from < hay.length && offsets.length < limit) {
    const idx = hay.indexOf(needle, from)
    if (idx < 0) break
    offsets.push(idx)
    from = idx + Math.max(q.length, 1)
  }
  return offsets
}

function collectRuleMarks(text: string, rules: HighlightRule[]): Mark[] {
  const marks: Mark[] = []
  const sorted = [...rules].sort((a, b) => b.text.length - a.text.length)
  for (const rule of sorted) {
    if (!rule.text || marks.length >= MAX_RULE_MARKS) break
    let from = 0
    while (from < text.length && marks.length < MAX_RULE_MARKS) {
      const idx = text.indexOf(rule.text, from)
      if (idx < 0) break
      marks.push({ start: idx, end: idx + rule.text.length, colorId: rule.colorId })
      from = idx + Math.max(rule.text.length, 1)
    }
  }
  marks.sort((a, b) => a.start - b.start || b.end - a.end)
  const kept: Mark[] = []
  let lastEnd = 0
  for (const m of marks) {
    if (m.start < lastEnd) continue
    kept.push(m)
    lastEnd = m.end
  }
  return kept
}

function collectFindMarks(
  text: string,
  findQuery: string,
  findCaseSensitive: boolean,
  limit: number,
  haystackLower?: string | null
): Mark[] {
  const q = findQuery.trim()
  if (!q || limit <= 0) return []
  return collectPhraseOffsets(text, q, limit, haystackLower, findCaseSensitive).map((start) => ({
    start,
    end: start + q.length,
    findHit: true as const,
  }))
}

/** Span-tree fallback when CSS Highlight API is missing. */
function buildHighlightedSpans(
  text: string,
  rules: HighlightRule[],
  findQuery: string,
  findCaseSensitive: boolean,
  haystackLower?: string | null
): TextSpan[] | null {
  if (!text) return [{ text: '' }]
  if (text.length > RICH_HIGHLIGHT_MAX_CHARS) return null
  if (rules.length === 0 && !findQuery.trim()) return [{ text }]

  const ruleMarks = collectRuleMarks(text, rules)
  const findMarks = collectFindMarks(
    text,
    findQuery,
    findCaseSensitive,
    MAX_FIND_MARKS,
    haystackLower
  )
  const marks = [...ruleMarks, ...findMarks].sort((a, b) => a.start - b.start || b.end - a.end)

  const spans: TextSpan[] = []
  let cursor = 0
  for (const mark of marks) {
    if (mark.start < cursor) continue
    if (mark.start > cursor) spans.push({ text: text.slice(cursor, mark.start) })
    spans.push({
      text: text.slice(mark.start, mark.end),
      colorId: mark.colorId,
      findHit: mark.findHit,
    })
    cursor = mark.end
    if (spans.length >= MAX_SPANS) {
      if (cursor < text.length) spans.push({ text: text.slice(cursor) })
      return spans
    }
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor) })
  return spans.length ? spans : [{ text }]
}

function collectFindOffsets(
  text: string,
  query: string,
  caseSensitive: boolean,
  haystackLower?: string | null
): number[] {
  return collectPhraseOffsets(text, query.trim(), MAX_FIND_OFFSETS, haystackLower, caseSensitive)
}

function clearCssHighlights(): void {
  if (!supportsCssHighlights()) return
  CSS.highlights.delete(CSS_HL_FIND)
  for (const c of HIGHLIGHT_COLORS) {
    CSS.highlights.delete(cssHlColor(c.id))
  }
}

/** React/MUI often leaves whitespace text nodes; pick the real output node. */
function getBodyTextNode(el: HTMLElement): Text | null {
  let best: Text | null = null
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType !== Node.TEXT_NODE) continue
    const t = child as Text
    if (!best || t.length > best.length) best = t
  }
  return best
}

/** Approximate visible char window from scroll position (pre-wrap text bodies). */
function estimateVisibleCharWindow(
  el: HTMLElement,
  textLen: number
): { start: number; end: number } {
  if (textLen <= 0) return { start: 0, end: 0 }
  if (textLen <= VIEWPORT_HIGHLIGHT_CHARS) return { start: 0, end: textLen }

  const { scrollTop, scrollHeight, clientHeight } = el
  // Before layout settles, scrollHeight ≈ clientHeight — paint from the top of the content.
  if (scrollHeight <= clientHeight + 2) {
    return { start: 0, end: Math.min(textLen, MAX_VIEWPORT_SLICE_CHARS) }
  }

  const safeHeight = Math.max(scrollHeight, 1)
  const startRatio = Math.max(0, scrollTop / safeHeight)
  const endRatio = Math.min(1, (scrollTop + Math.max(clientHeight, 1)) / safeHeight)
  const pad = 0.25
  let start = Math.floor(Math.max(0, startRatio - pad) * textLen)
  let end = Math.ceil(Math.min(1, endRatio + pad) * textLen)
  // Keep the window anchored to the visible start (never jump to the file midpoint).
  if (end - start > MAX_VIEWPORT_SLICE_CHARS) {
    end = Math.min(textLen, start + MAX_VIEWPORT_SLICE_CHARS)
  }
  if (end <= start) {
    start = Math.max(0, Math.min(start, textLen - 1))
    end = Math.min(textLen, start + MAX_VIEWPORT_SLICE_CHARS)
  }
  return { start, end }
}

function snapWindowToLines(text: string, start: number, end: number): { start: number; end: number } {
  let s = Math.max(0, Math.min(start, text.length))
  let e = Math.max(s, Math.min(end, text.length))
  if (s > 0) {
    const prev = text.lastIndexOf('\n', s)
    s = prev >= 0 ? prev + 1 : 0
  }
  if (e < text.length) {
    const next = text.indexOf('\n', e)
    e = next >= 0 ? next : text.length
  }
  return { start: s, end: e }
}

function applyCssHighlights(
  textNode: Text,
  text: string,
  rules: HighlightRule[],
  findQuery: string,
  findCaseSensitive: boolean,
  haystackLower: string | null | undefined,
  windowStart: number,
  windowEnd: number
): void {
  if (!text || textNode.length === 0) {
    clearCssHighlights()
    return
  }

  // DOM text can briefly disagree with React state during large swaps — paint the overlap.
  const limit = Math.min(textNode.length, text.length)
  const source = limit === text.length ? text : text.slice(0, limit)

  const snapped = snapWindowToLines(source, windowStart, Math.min(windowEnd, limit))
  const slice = source.slice(snapped.start, snapped.end)
  if (!slice) {
    clearCssHighlights()
    return
  }

  clearCssHighlights()

  const sliceLower =
    !findCaseSensitive && findQuery.trim()
      ? haystackLower
        ? haystackLower.slice(snapped.start, snapped.end)
        : slice.toLowerCase()
      : null

  const byColor = new Map<HighlightColorId, Range[]>()
  const sorted = [...rules].sort((a, b) => b.text.length - a.text.length)
  let colorBudget = MAX_CSS_COLOR_RANGES

  for (const rule of sorted) {
    if (!rule.text || colorBudget <= 0) break
    const local = collectPhraseOffsets(slice, rule.text, colorBudget, null, true)
    const list = byColor.get(rule.colorId) ?? []
    for (const localStart of local) {
      const start = snapped.start + localStart
      const end = start + rule.text.length
      if (end > limit) continue
      try {
        const range = new Range()
        range.setStart(textNode, start)
        range.setEnd(textNode, end)
        list.push(range)
        colorBudget -= 1
      } catch {
        // ignore
      }
    }
    byColor.set(rule.colorId, list)
  }

  for (const [colorId, ranges] of byColor) {
    if (ranges.length === 0) continue
    const hl = new Highlight(...ranges)
    hl.priority = 1
    CSS.highlights.set(cssHlColor(colorId), hl)
  }

  const q = findQuery.trim()
  if (q) {
    const local = collectPhraseOffsets(
      slice,
      q,
      MAX_CSS_FIND_RANGES,
      sliceLower,
      findCaseSensitive
    )
    const ranges: Range[] = []
    for (const localStart of local) {
      const start = snapped.start + localStart
      const end = start + q.length
      if (end > limit) continue
      try {
        const range = new Range()
        range.setStart(textNode, start)
        range.setEnd(textNode, end)
        ranges.push(range)
      } catch {
        // ignore
      }
    }
    if (ranges.length > 0) {
      const hl = new Highlight(...ranges)
      hl.priority = 2
      CSS.highlights.set(CSS_HL_FIND, hl)
    }
  }
}

interface LinuxSearchOutputPanelProps {
  text: string | null
  busy?: boolean
  /** Live-tail indicator (output still editable for analysis). */
  following?: boolean
  /** Suggested download filename (e.g. grepped remote file basename). */
  exportFileName?: string | null
  /** When false/undefined, Ask AI controls are hidden. */
  askAiEnabled?: boolean
  askAiMode?: AskAiMode
  mcpServers?: AskAiMcpServerConfig[]
  selectedMcpServerId?: string
  onSelectedMcpServerIdChange?: (id: string) => void
  onAskAiModeChange?: (mode: AskAiMode) => void
  analyzeContext?: string
  /** Skip escape decoding (local files are plain UTF-8 — avoids copying multi‑MB strings). */
  decodeEscapes?: boolean
  /**
   * Store key for this document's view state (e.g. local log tab id).
   * Per-session find/filter/highlight/bookmark state is loaded from the output
   * view store on mount and persisted back on unmount — the parent should also
   * pass `key={sessionKey}` so each session gets a fresh panel instance.
   */
  sessionKey?: string | null
  /**
   * Show a Raw | Analyze toggle next to the header. Analyze swaps the raw
   * output for the shared Log Analysis tree view (parser + configurable
   * grouping) — the same component the Local Log Viewer uses.
   */
  showViewToggle?: boolean
  /** Current view mode when showViewToggle is enabled. */
  viewMode?: OutputViewMode
  onViewModeChange?: (mode: OutputViewMode) => void
}

export default function LinuxSearchOutputPanel({
  text,
  busy = false,
  following = false,
  exportFileName = null,
  askAiEnabled = false,
  askAiMode = 'llm',
  mcpServers = [],
  selectedMcpServerId = '',
  onSelectedMcpServerIdChange,
  onAskAiModeChange,
  analyzeContext,
  decodeEscapes = true,
  sessionKey = null,
  showViewToggle = false,
  viewMode = 'raw',
  onViewModeChange,
}: LinuxSearchOutputPanelProps): React.JSX.Element {
  const decoded = useMemo(() => {
    if (!text) return ''
    return decodeEscapes ? decodeOutputEscapes(text) : text
  }, [text, decodeEscapes])

  const hasContent = Boolean(text) && !(busy && !following)

  // Analyze swaps the raw output for the Log Analysis tree — only meaningful
  // once there is real content to parse.
  const analyzing = showViewToggle && viewMode === 'analyze' && hasContent

  // Session-scoped view state. The parent remounts this panel per tab (key=tabId),
  // so a session key is constant for an instance's lifetime: initialize from the
  // store on mount, persist on unmount — no mid-life restore/clear dance needed.
  const [initialView] = useState<OutputPanelViewState>(() =>
    sessionKey ? useOutputViewStore.getState().getView(sessionKey) : EMPTY_OUTPUT_VIEW
  )
  const [copied, setCopied] = useState(false)
  const [highlights, setHighlights] = useState<HighlightRule[]>(initialView.highlights)
  const [selectionPreview, setSelectionPreview] = useState('')
  const [findQuery, setFindQuery] = useState(initialView.findQuery)
  const [findCaseSensitive, setFindCaseSensitive] = useState(initialView.findCaseSensitive)
  const [filterMode, setFilterMode] = useState(initialView.filterMode)
  const [wrap, setWrap] = useState(initialView.wrap)
  const [fontSize, setFontSize] = useState(initialView.fontSize)
  const [bookmarks, setBookmarks] = useState<PanelBookmark[]>(initialView.bookmarks)
  const [findIndex, setFindIndex] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [askAiOpen, setAskAiOpen] = useState(false)
  const [askAiBusy, setAskAiBusy] = useState(false)
  const [askAiContent, setAskAiContent] = useState<string | null>(null)
  const [askAiError, setAskAiError] = useState<string | null>(null)
  const [askAiTruncated, setAskAiTruncated] = useState(false)
  const prevTextRef = useRef<string | null>(null)
  const paintGenRef = useRef(0)

  /** Defer heavy find/filter/highlight so typing stays responsive. */
  const deferredFindQuery = useDeferredValue(findQuery)
  const findPending = deferredFindQuery !== findQuery

  // Write view state through to the store as it changes (session-scoped tabs).
  // The store is external state, so this synchronizes without a render loop.
  useEffect(() => {
    if (!sessionKey) return
    useOutputViewStore.getState().setView(sessionKey, {
      highlights,
      findQuery,
      findCaseSensitive,
      filterMode,
      wrap,
      fontSize,
      bookmarks,
      scrollTop: bodyRef.current?.scrollTop ?? 0,
    })
  }, [sessionKey, highlights, findQuery, findCaseSensitive, filterMode, wrap, fontSize, bookmarks])

  // Capture the final scroll position when the panel unmounts (tab switch or close).
  useLayoutEffect(() => {
    const key = sessionKey
    return () => {
      if (!key) return
      const store = useOutputViewStore.getState()
      const current = store.getView(key)
      store.setView(key, {
        ...current,
        scrollTop: bodyRef.current?.scrollTop ?? current.scrollTop,
      })
    }
  }, [sessionKey])

  // Restore the saved scroll position on mount (before paint).
  useLayoutEffect(() => {
    if (sessionKey && bodyRef.current) {
      bodyRef.current.scrollTop = initialView.scrollTop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, [])

  // New remote/run output → clear ephemeral analysis.
  useEffect(() => {
    if (prevTextRef.current === null) {
      prevTextRef.current = text
      return
    }
    if (prevTextRef.current === text) return
    prevTextRef.current = text
    setHighlights([])
    setSelectionPreview('')
    setBookmarks([])
    setFindIndex(0)
  }, [text])

  // Only split lines when Filter is on — splitting a 20MB log into arrays is expensive.
  const filteredText = useMemo(() => {
    if (!decoded) return ''
    if (!filterMode || !deferredFindQuery.trim()) return decoded
    const q = deferredFindQuery.trim()
    const needle = findCaseSensitive ? q : q.toLowerCase()
    const lines = decoded.split('\n')
    return lines
      .filter((line) =>
        findCaseSensitive ? line.includes(q) : line.toLowerCase().includes(needle)
      )
      .join('\n')
  }, [decoded, filterMode, deferredFindQuery, findCaseSensitive])

  const displayText = useMemo(() => {
    if (busy && !following) return 'Running…'
    if (!text) return 'Run an action to see results here.'
    if (filterMode && deferredFindQuery.trim() && !filteredText) return '(no matching lines)'
    return filteredText || decoded
  }, [busy, following, text, filterMode, deferredFindQuery, filteredText, decoded])

  // Avoid duplicating multi‑MB strings unless case-insensitive find needs it.
  const needsLowerHay =
    !findCaseSensitive && Boolean(deferredFindQuery.trim()) && !filterMode
  const displayHayLower = useMemo(
    () => (needsLowerHay ? displayText.toLowerCase() : null),
    [displayText, needsLowerHay]
  )

  const findOffsets = useMemo(
    () => collectFindOffsets(displayText, deferredFindQuery, findCaseSensitive, displayHayLower),
    [displayText, deferredFindQuery, findCaseSensitive, displayHayLower]
  )

  useEffect(() => {
    setFindIndex(0)
  }, [deferredFindQuery, findCaseSensitive, filterMode, text])

  const activeRules = useMemo(() => {
    if (busy && !following) return [] as HighlightRule[]
    if (!text) return [] as HighlightRule[]
    return highlights
  }, [busy, following, text, highlights])

  const useCssHl = supportsCssHighlights()

  // ::highlight() must be a document-level rule (not nested under an element).
  useEffect(() => {
    if (!useCssHl) return
    const styleId = 'lsa-css-highlight-styles'
    if (document.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = [
      `::highlight(${CSS_HL_FIND}) { background-color: rgba(59, 130, 246, 0.45); color: inherit; }`,
      ...HIGHLIGHT_COLORS.map(
        (c) => `::highlight(${cssHlColor(c.id)}) { background-color: ${c.bg}; color: inherit; }`
      ),
    ].join('\n')
    document.head.appendChild(style)
  }, [useCssHl])

  // Prefer CSS Highlight API with viewport-scoped paint for large documents.
  useLayoutEffect(() => {
    if (!useCssHl) return
    const el = bodyRef.current
    if (!el) return

    let cancelled = false
    let raf = 0
    const gen = ++paintGenRef.current

    const paint = (): void => {
      if (cancelled || gen !== paintGenRef.current) return
      if (activeRules.length === 0 && !deferredFindQuery.trim()) {
        clearCssHighlights()
        return
      }
      const textNode = getBodyTextNode(el)
      if (!textNode) {
        clearCssHighlights()
        return
      }
      const win = estimateVisibleCharWindow(el, displayText.length)
      applyCssHighlights(
        textNode,
        displayText,
        activeRules,
        filterMode ? '' : deferredFindQuery,
        findCaseSensitive,
        displayHayLower,
        win.start,
        win.end
      )
    }

    const schedule = (): void => {
      if (raf) cancelAnimationFrame(raf)
      // Double-rAF: wait for layout so scrollHeight/text node match the content.
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          raf = 0
          paint()
        })
      })
    }

    schedule()
    el.addEventListener('scroll', schedule, { passive: true })

    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      el.removeEventListener('scroll', schedule)
      clearCssHighlights()
    }
  }, [
    useCssHl,
    analyzing,
    displayText,
    activeRules,
    deferredFindQuery,
    findCaseSensitive,
    filterMode,
    displayHayLower,
    fontSize,
    wrap,
    sessionKey,
  ])

  // DOM <mark> fallback only when CSS.highlights is unavailable.
  const spans = useMemo(() => {
    if (useCssHl) return null
    return buildHighlightedSpans(
      displayText,
      activeRules,
      filterMode ? '' : deferredFindQuery,
      findCaseSensitive,
      displayHayLower
    )
  }, [useCssHl, displayText, activeRules, deferredFindQuery, findCaseSensitive, filterMode, displayHayLower])

  const captureSelection = useCallback((): string => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !bodyRef.current) return ''
    if (!bodyRef.current.contains(sel.anchorNode) || !bodyRef.current.contains(sel.focusNode)) {
      return ''
    }
    return sel.toString()
  }, [])

  const refreshSelectionPreview = useCallback((): void => {
    setSelectionPreview(captureSelection().trim().slice(0, 80))
  }, [captureSelection])

  const scrollToOffset = useCallback((offset: number): void => {
    const el = bodyRef.current
    if (!el) return
    // Approximate: scroll so the match is near the top third using char ratio.
    const ratio = displayText.length > 0 ? offset / displayText.length : 0
    el.scrollTop = Math.max(0, ratio * el.scrollHeight - el.clientHeight * 0.25)
  }, [displayText.length])

  useEffect(() => {
    if (findPending || findOffsets.length === 0) return
    const idx = Math.min(findIndex, findOffsets.length - 1)
    scrollToOffset(findOffsets[idx])
  }, [findIndex, findOffsets, scrollToOffset, findPending])

  const handleCopy = async (): Promise<void> => {
    const payload = decoded || displayText
    if (!payload || (busy && !following)) return
    try {
      await navigator.clipboard.writeText(payload)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = payload
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const handleExport = (): void => {
    const payload = decoded
    if (!payload) return
    const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const suggested = (exportFileName || '').trim().replace(/[/\\?%*:|"<>]/g, '_')
    a.href = url
    a.download = suggested || `lsa-output-${stamp}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const applyHighlight = (colorId: HighlightColorId, phrase?: string): void => {
    // Prefer live selection; fall back to preview (click often clears the selection).
    const selected = (phrase || captureSelection() || selectionPreview).trim()
    if (!selected || selected.length > 200) return
    setHighlights((prev) => [
      ...prev.filter((h) => h.text !== selected),
      { id: `${Date.now()}-${colorId}`, text: selected, colorId },
    ])
  }

  const toggleLevelChip = (chip: (typeof LEVEL_CHIPS)[number]): void => {
    setHighlights((prev) => {
      const exists = prev.some((h) => h.text === chip.text && h.colorId === chip.colorId)
      if (exists) return prev.filter((h) => !(h.text === chip.text && h.colorId === chip.colorId))
      return [...prev, { id: `level-${chip.text}`, text: chip.text, colorId: chip.colorId }]
    })
  }

  const addBookmark = (): void => {
    if (!bodyRef.current || !text) return
    const phrase = captureSelection().trim().slice(0, 80) || undefined
    const label = phrase || `Line ~${Math.round((bodyRef.current.scrollTop / Math.max(bodyRef.current.scrollHeight, 1)) * 100)}%`
    setBookmarks((prev) => [
      ...prev,
      {
        id: `bm-${Date.now()}`,
        label,
        scrollTop: bodyRef.current!.scrollTop,
        phrase,
      },
    ])
  }

  const jumpBookmark = (bm: PanelBookmark): void => {
    if (!bodyRef.current) return
    if (bm.phrase) {
      const offsets = collectFindOffsets(displayText, bm.phrase, true)
      if (offsets.length > 0) {
        setFindQuery(bm.phrase)
        setFindIndex(0)
        scrollToOffset(offsets[0])
        return
      }
    }
    bodyRef.current.scrollTop = bm.scrollTop
  }

  const enabledMcpServers = useMemo(
    () => mcpServers.filter((s) => s.enabled),
    [mcpServers]
  )

  const handleAskAi = async (): Promise<void> => {
    if (!hasContent || askAiBusy) return
    const selected = captureSelection().trim()
    const payload = selected || decoded
    if (!payload.trim()) return

    setAskAiOpen(true)
    setAskAiBusy(true)
    setAskAiContent(null)
    setAskAiError(null)
    setAskAiTruncated(false)
    try {
      const result = await window.api.linuxSearchAssistantAnalyzeAskAi({
        text: payload,
        mode: askAiMode,
        mcpServerId: askAiMode === 'mcp' ? selectedMcpServerId : undefined,
        context: analyzeContext,
      })
      setAskAiTruncated(Boolean(result.truncated))
      if (result.ok && result.content) {
        setAskAiContent(result.content)
      } else {
        setAskAiError(result.message || 'Ask AI failed.')
      }
    } catch (err) {
      setAskAiError(err instanceof Error ? err.message : 'Ask AI failed.')
    } finally {
      setAskAiBusy(false)
    }
  }

  const askAiDisabled =
    !hasContent ||
    askAiBusy ||
    (askAiMode === 'mcp' && !enabledMcpServers.some((s) => s.id === selectedMcpServerId))

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <AskAiResultPanel
        open={askAiOpen}
        busy={askAiBusy}
        content={askAiContent}
        error={askAiError}
        truncated={askAiTruncated}
        modeLabel={askAiMode === 'mcp' ? 'MCP' : 'LLM'}
        onClose={() => setAskAiOpen(false)}
      />
      <Box
        sx={{
          px: 1.25,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Output
          </Typography>
          {following && (
            <Chip size="small" color="warning" label="Following…" sx={{ height: 22 }} />
          )}
          {showViewToggle && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={viewMode}
              onChange={(_, v) => {
                if (v) onViewModeChange?.(v as OutputViewMode)
              }}
              disabled={!hasContent}
              aria-label="View mode"
              sx={{
                ml: 0.5,
                '& .MuiToggleButton-root': { px: 1, py: 0.25, textTransform: 'none' },
              }}
            >
              <ToggleButton value="raw">Raw</ToggleButton>
              <ToggleButton value="analyze">Analyze</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>

        {!analyzing && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexWrap: 'wrap' }}>
          {HIGHLIGHT_COLORS.map((c) => (
            <Tooltip
              key={c.id}
              title={
                selectionPreview
                  ? `Highlight all “${selectionPreview}${selectionPreview.length >= 80 ? '…' : ''}”`
                  : 'Select text, then click a color'
              }
            >
              <span>
                <IconButton
                  size="small"
                  aria-label={`Highlight ${c.label}`}
                  disabled={!hasContent}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHighlight(c.id, selectionPreview || undefined)}
                  sx={{
                    width: 26,
                    height: 26,
                    border: '1px solid',
                    borderColor: c.border,
                    bgcolor: c.bg,
                    borderRadius: 0.75,
                  }}
                >
                  <FormatColorFillIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </span>
            </Tooltip>
          ))}

          <Tooltip title="Clear highlights">
            <span>
              <IconButton size="small" disabled={highlights.length === 0} onClick={() => setHighlights([])}>
                <HighlightOffIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={wrap ? 'No wrap' : 'Wrap lines'}>
            <IconButton size="small" onClick={() => setWrap((w) => !w)} aria-label="Toggle wrap">
              {wrap ? <WrapTextIcon fontSize="small" /> : <NotesIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Smaller font">
            <IconButton
              size="small"
              onClick={() => setFontSize((s) => Math.max(10, s - 1))}
              aria-label="Decrease font"
            >
              <TextDecreaseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Larger font">
            <IconButton
              size="small"
              onClick={() => setFontSize((s) => Math.min(20, s + 1))}
              aria-label="Increase font"
            >
              <TextIncreaseIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Bookmark current scroll / selection (session only)">
            <span>
              <IconButton size="small" disabled={!hasContent} onClick={addBookmark} aria-label="Add bookmark">
                <BookmarkBorderIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={copied ? 'Copied' : 'Copy entire output'}>
            <span>
              <IconButton size="small" disabled={!hasContent} onClick={() => void handleCopy()}>
                {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Export as .log">
            <span>
              <IconButton size="small" disabled={!hasContent} onClick={handleExport} aria-label="Export output">
                <DownloadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          {askAiEnabled && (
            <>
              <FormControl size="small" sx={{ minWidth: 88, ml: 0.5 }}>
                <Select
                  value={askAiMode}
                  onChange={(e) => onAskAiModeChange?.(e.target.value as AskAiMode)}
                  displayEmpty
                  sx={{ height: 30, fontSize: '0.75rem' }}
                >
                  <MenuItem value="llm">LLM</MenuItem>
                  <MenuItem value="mcp">MCP</MenuItem>
                </Select>
              </FormControl>
              {askAiMode === 'mcp' && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <Select
                    value={selectedMcpServerId}
                    displayEmpty
                    onChange={(e) => onSelectedMcpServerIdChange?.(e.target.value)}
                    sx={{ height: 30, fontSize: '0.75rem' }}
                  >
                    <MenuItem value="">
                      <em>MCP server…</em>
                    </MenuItem>
                    {enabledMcpServers.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Tooltip title="Ask AI about selection (or full output if nothing selected)">
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={askAiBusy ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeIcon />}
                    disabled={askAiDisabled}
                    onClick={() => void handleAskAi()}
                    sx={{ textTransform: 'none', ml: 0.25, height: 30 }}
                  >
                    Ask AI
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </Box>
        )}
      </Box>

      {analyzing ? (
        <LogAnalysisPanel text={decoded} />
      ) : (
        <>
      {/* Find / filter bar */}
      <Box
        sx={{
          px: 1.25,
          py: 0.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <TextField
          size="small"
          placeholder="Find in results…"
          value={findQuery}
          onChange={(e) => setFindQuery(e.target.value)}
          disabled={!hasContent}
          sx={{ flex: '1 1 160px', minWidth: 140, opacity: findPending ? 0.85 : 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <FilterAltIcon sx={{ fontSize: 16, mr: 0.75, color: 'text.secondary' }} />
              ),
            },
          }}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={findCaseSensitive}
              onChange={(_, v) => setFindCaseSensitive(v)}
              disabled={!hasContent}
            />
          }
          label={<Typography variant="caption">Aa</Typography>}
          sx={{ mr: 0.5 }}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={filterMode}
              onChange={(_, v) => setFilterMode(v)}
              disabled={!hasContent}
            />
          }
          label={<Typography variant="caption">Filter</Typography>}
          sx={{ mr: 0.5 }}
        />
        {!filterMode && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 48 }}>
              {findOffsets.length ? `${Math.min(findIndex + 1, findOffsets.length)}/${findOffsets.length}` : '0/0'}
            </Typography>
            <IconButton
              size="small"
              disabled={findOffsets.length === 0}
              onClick={() =>
                setFindIndex((i) => (i - 1 + findOffsets.length) % findOffsets.length)
              }
              aria-label="Previous match"
            >
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              disabled={findOffsets.length === 0}
              onClick={() => setFindIndex((i) => (i + 1) % findOffsets.length)}
              aria-label="Next match"
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>

      {/* Level chips */}
      <Box sx={{ px: 1.25, py: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5, flexShrink: 0 }}>
        {LEVEL_CHIPS.map((chip) => {
          const active = highlights.some((h) => h.text === chip.text)
          return (
            <Chip
              key={chip.label}
              size="small"
              label={chip.label}
              onClick={() => hasContent && toggleLevelChip(chip)}
              variant={active ? 'filled' : 'outlined'}
              sx={{
                height: 24,
                ...(active ? colorStyle(chip.colorId) : {}),
                cursor: hasContent ? 'pointer' : 'default',
                opacity: hasContent ? 1 : 0.5,
              }}
            />
          )
        })}
      </Box>

      {(highlights.length > 0 || bookmarks.length > 0) && (
        <Box
          sx={{
            px: 1.25,
            py: 0.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
            flexShrink: 0,
            maxHeight: 72,
            overflowY: 'auto',
          }}
        >
          {highlights.map((h) => (
            <Typography
              key={h.id}
              component="span"
              variant="caption"
              sx={{
                px: 0.75,
                py: 0.15,
                borderRadius: 0.5,
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                ...colorStyle(h.colorId),
              }}
              title={h.text}
            >
              {h.text}
            </Typography>
          ))}
          {bookmarks.map((bm) => (
            <Chip
              key={bm.id}
              size="small"
              icon={<BookmarkIcon sx={{ fontSize: '14px !important' }} />}
              label={bm.label}
              onClick={() => jumpBookmark(bm)}
              onDelete={() => setBookmarks((prev) => prev.filter((b) => b.id !== bm.id))}
              sx={{ height: 24, maxWidth: 180 }}
            />
          ))}
        </Box>
      )}

      <Box
        ref={bodyRef}
        onMouseUp={refreshSelectionPreview}
        onKeyUp={refreshSelectionPreview}
        sx={{
          m: 0,
          p: 1.5,
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          fontSize,
          lineHeight: 1.55,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          whiteSpace: wrap ? 'pre-wrap' : 'pre',
          tabSize: 4,
          wordBreak: wrap ? 'break-word' : 'normal',
          color: hasContent || busy ? 'text.primary' : 'text.secondary',
          userSelect: 'text',
        }}
      >
        {useCssHl || spans == null || (spans.length === 1 && !spans[0].colorId && !spans[0].findHit)
          ? displayText
          : spans.map((span, i) =>
              span.colorId || span.findHit ? (
                <mark
                  key={i}
                  style={{
                    color: 'inherit',
                    borderRadius: 2,
                    padding: '0 1px',
                    ...(span.colorId
                      ? colorStyle(span.colorId)
                      : {
                          backgroundColor: 'rgba(59, 130, 246, 0.35)',
                          boxShadow: 'inset 0 -2px 0 #2563eb',
                        }),
                  }}
                >
                  {span.text}
                </mark>
              ) : (
                <React.Fragment key={i}>{span.text}</React.Fragment>
              )
            )}
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 1.25, py: 0.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}
      >
        Find / Filter · level chips · select→color · bookmarks are session-only (not saved to disk)
      </Typography>
        </>
      )}
    </Box>
  )
}
