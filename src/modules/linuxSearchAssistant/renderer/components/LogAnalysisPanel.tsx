/**
 * Log Analysis Panel — structured triage of `;`-separated log windows.
 *
 * Groups parsed entries into a collapsible tree with fully configurable
 * group-by dimensions (thread → session → message by default), per-node
 * counts + error/warn aggregation, level + text filters, an adjustable field
 * separator, and click-to-copy of a message's raw line (with its stack trace).
 *
 * Pure React + MUI — no chart / D3 dependencies.
 */
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckIcon from '@mui/icons-material/Check'
import type { LogEntry } from '../../services/logParser'
import { DEFAULT_LOG_SEPARATOR, parseStructuredLog } from '../../services/logParser'
import {
  buildLogTree,
  LOG_DIMENSIONS,
  LOG_DIMENSION_LABELS,
  type LogDimension,
  type LogTreeNode,
} from '../../services/logTree'

const LEVEL_COLORS: Record<string, string> = {
  FATAL: '#ef4444',
  ERROR: '#f87171',
  WARN: '#fbbf24',
  INFO: '#60a5fa',
  DEBUG: '#94a3b8',
  TRACE: '#94a3b8',
}

const LEVEL_FILTERS = ['ERROR', 'WARN', 'INFO', 'DEBUG'] as const

/** Cap message rows rendered per expanded group — the rest need a click. */
const MAX_LEAVES_PER_GROUP = 200
/** Cap group rows per level so high-cardinality dimensions stay renderable. */
const MAX_GROUPS_PER_LEVEL = 200

const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

/** Strip the Local Log Viewer truncation banner before parsing. */
function stripViewerBanner(text: string): string {
  // Only touch the text when the banner is actually present — a legitimate
  // log line ending in "…" must never be dropped.
  if (!text.startsWith('[Local Log Viewer]')) return text
  return text
    .replace(/^\[Local Log Viewer\][^\n]*\n+/, '')
    .replace(/^…\n/, '')
    .replace(/\n…$/, '')
}

interface GroupRowProps {
  node: LogTreeNode
  depth: number
  open: boolean
  onToggle: () => void
}

function GroupRow({ node, depth, open, onToggle }: GroupRowProps): React.JSX.Element {
  const levelColor = LEVEL_COLORS[node.label.toUpperCase()]
  return (
    <Box
      onClick={onToggle}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        py: 0.35,
        px: 1,
        pl: 1 + depth * 1.75,
        cursor: 'pointer',
        borderRadius: 0.5,
        '&:hover': { bgcolor: 'action.hover' },
        userSelect: 'none',
      }}
    >
      <IconButton size="small" sx={{ p: 0.15, mr: 0.1 }} tabIndex={-1} aria-hidden>
        {open ? (
          <ExpandMoreIcon sx={{ fontSize: 16 }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 16 }} />
        )}
      </IconButton>
      <Typography
        variant="body2"
        noWrap
        title={node.label}
        sx={{ fontWeight: 600, flexShrink: 1, minWidth: 0, ...(levelColor ? { color: levelColor } : {}) }}
      >
        {node.label}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {node.count} {node.count === 1 ? 'line' : 'lines'}
      </Typography>
      {node.errorCount > 0 && (
        <Typography variant="caption" sx={{ flexShrink: 0, color: '#f87171' }}>
          {node.errorCount}✕
        </Typography>
      )}
      {node.warnCount > 0 && (
        <Typography variant="caption" sx={{ flexShrink: 0, color: '#fbbf24' }}>
          {node.warnCount}⚠
        </Typography>
      )}
    </Box>
  )
}

interface MessageRowProps {
  entry: LogEntry
  copied: boolean
  indent: number
  onCopy: (entry: LogEntry) => void
}

function MessageRow({ entry, copied, indent, onCopy }: MessageRowProps): React.JSX.Element {
  const color = entry.level ? LEVEL_COLORS[entry.level] ?? null : null
  return (
    <Box
      onClick={() => onCopy(entry)}
      title={`${entry.raw}${entry.continuation.length ? `\n+ ${entry.continuation.length} continuation line(s)` : ''} — click to copy`}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.75,
        px: 1,
        py: 0.4,
        pl: 2 + indent * 1.75,
        borderRadius: 0.5,
        cursor: 'copy',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {entry.timestamp && (
        <Typography
          variant="caption"
          sx={{ fontFamily: MONO_FONT, color: 'text.secondary', flexShrink: 0, pt: 0.15 }}
        >
          {entry.timestamp}
        </Typography>
      )}
      {entry.level && (
        <Chip
          size="small"
          label={entry.level}
          sx={{
            height: 16,
            fontSize: '0.6rem',
            flexShrink: 0,
            bgcolor: color ? `${color}22` : 'action.selected',
            color: color ?? 'text.secondary',
            border: `1px solid ${color ? `${color}55` : 'divider'}`,
          }}
        />
      )}
      {entry.errorCode && (
        <Chip
          size="small"
          label={entry.errorCode}
          title={entry.errorCode}
          sx={{
            height: 16,
            fontSize: '0.6rem',
            flexShrink: 0,
            bgcolor: (color ? `${color}18` : 'action.selected'),
            color: color ?? 'text.secondary',
            border: `1px solid ${color ? `${color}44` : 'divider'}`,
            maxWidth: 160,
            '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
          }}
        />
      )}
      {entry.className && (
        <Typography
          variant="caption"
          noWrap
          title={entry.className}
          sx={{ color: 'text.secondary', flexShrink: 0, maxWidth: 220, pt: 0.15 }}
        >
          {entry.className}
        </Typography>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{ fontFamily: MONO_FONT, minWidth: 0, wordBreak: 'break-word', fontSize: '0.78rem', lineHeight: 1.4 }}
        >
          {entry.message || entry.raw}
        </Typography>
        {entry.continuation.length > 0 && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontFamily: MONO_FONT,
              color: 'text.secondary',
              whiteSpace: 'pre',
              fontSize: '0.7rem',
              lineHeight: 1.35,
            }}
          >
            {entry.continuation.join('\n')}
          </Typography>
        )}
      </Box>
      {copied && <CheckIcon sx={{ fontSize: 13, color: 'success.main', flexShrink: 0, mt: 0.3 }} />}
    </Box>
  )
}

function EmptyState({ text }: { text: string }): React.JSX.Element {
  if (!text.trim()) {
    return (
      <Box sx={{ p: 2.5, color: 'text.secondary' }}>
        <Typography variant="body2">No content to analyze — open a file first.</Typography>
      </Box>
    )
  }
  return (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75, color: 'text.secondary' }}>
      <Typography variant="body2">No structured lines matched.</Typography>
      <Typography variant="caption">
        Expected formats:{' '}
        <Typography component="span" variant="caption" sx={{ fontFamily: MONO_FONT, color: 'text.primary' }}>
          timestamp; businessId; class; level; message; thread; sessionId
        </Typography>
        {' or '}
        <Typography component="span" variant="caption" sx={{ fontFamily: MONO_FONT, color: 'text.primary' }}>
          server; parentGroup; timestamp; businessGroup; className; error; message; sessionId; ; threadId
        </Typography>
      </Typography>
      <Typography variant="caption">
        Unparsed lines are listed at the bottom — adjust the separator or check the format.
      </Typography>
    </Box>
  )
}

interface LogAnalysisPanelProps {
  text: string
}

export default function LogAnalysisPanel({ text }: LogAnalysisPanelProps): React.JSX.Element {
  const [primary, setPrimary] = useState<LogDimension>('thread')
  const [secondary, setSecondary] = useState<LogDimension>('sessionId')
  const [separator, setSeparator] = useState(DEFAULT_LOG_SEPARATOR)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<ReadonlySet<string>>(new Set())
  const [openPaths, setOpenPaths] = useState<ReadonlySet<string>>(new Set())
  const [showAll, setShowAll] = useState<ReadonlySet<string>>(new Set())
  const [showAllRoots, setShowAllRoots] = useState(false)
  const [unparsedOpen, setUnparsedOpen] = useState(false)
  const [copiedLine, setCopiedLine] = useState<number | null>(null)

  const deferredSearch = useDeferredValue(search)

  const cleanText = useMemo(() => stripViewerBanner(text), [text])

  const parsed = useMemo(
    () => parseStructuredLog(cleanText, { separator: separator || DEFAULT_LOG_SEPARATOR }),
    [cleanText, separator]
  )

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of parsed.entries) {
      if (e.level) counts[e.level] = (counts[e.level] ?? 0) + 1
    }
    return counts
  }, [parsed])

  const totals = useMemo(() => {
    let errors = 0
    let warns = 0
    for (const e of parsed.entries) {
      if (e.level === 'ERROR' || e.level === 'FATAL') errors += 1
      else if (e.level === 'WARN') warns += 1
    }
    return { errors, warns }
  }, [parsed])

  const filteredEntries = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    const hasLevels = levelFilter.size > 0
    if (!q && !hasLevels) return parsed.entries
    return parsed.entries.filter((e) => {
      if (hasLevels && !(e.level && levelFilter.has(e.level))) return false
      if (!q) return true
      return (
        e.message.toLowerCase().includes(q) ||
        e.raw.toLowerCase().includes(q) ||
        (e.thread ?? '').toLowerCase().includes(q) ||
        (e.sessionId ?? '').toLowerCase().includes(q) ||
        (e.businessId ?? '').toLowerCase().includes(q) ||
        (e.className ?? '').toLowerCase().includes(q) ||
        (e.server ?? '').toLowerCase().includes(q) ||
        (e.parentGroup ?? '').toLowerCase().includes(q) ||
        (e.businessGroup ?? '').toLowerCase().includes(q) ||
        (e.errorCode ?? '').toLowerCase().includes(q)
      )
    })
  }, [parsed, deferredSearch, levelFilter])

  const tree = useMemo(
    () => buildLogTree(filteredEntries, primary, secondary),
    [filteredEntries, primary, secondary]
  )

  // Seed expand state on mount and whenever the group-by dimensions change:
  // all primary groups start open so the file's shape is visible at a glance.
  const dimsKey = `${primary}|${secondary}`
  // null on first mount so the effect below seeds the initially-open groups.
  const prevDimsRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevDimsRef.current === dimsKey) return
    prevDimsRef.current = dimsKey
    setOpenPaths(new Set(tree.map((n) => n.key)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tree follows dimsKey
  }, [dimsKey])

  const togglePath = (key: string): void => {
    setOpenPaths((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleLevel = (level: string): void => {
    setLevelFilter((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  const copyRaw = async (entry: LogEntry): Promise<void> => {
    try {
      await navigator.clipboard.writeText([entry.raw, ...entry.continuation].join('\n'))
    } catch {
      // clipboard unavailable — ignore
    }
    setCopiedLine(entry.lineNo)
    window.setTimeout(() => setCopiedLine((l) => (l === entry.lineNo ? null : l)), 1200)
  }

  const filtered = filteredEntries.length !== parsed.entries.length

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          px: 1.25,
          py: 0.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mr: 0.25 }}>
          Analyze
        </Typography>

        <FormControl size="small" sx={{ minWidth: 108 }}>
          <Select
            value={primary}
            onChange={(e) => setPrimary(e.target.value as LogDimension)}
            displayEmpty
            inputProps={{ 'aria-label': 'Group by' }}
            sx={{ height: 30, fontSize: '0.8rem' }}
          >
            {LOG_DIMENSIONS.map((d) => (
              <MenuItem key={d} value={d}>
                {LOG_DIMENSION_LABELS[d]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          then
        </Typography>
        <FormControl size="small" sx={{ minWidth: 108 }}>
          <Select
            value={secondary}
            onChange={(e) => setSecondary(e.target.value as LogDimension)}
            displayEmpty
            inputProps={{ 'aria-label': 'Then group by' }}
            sx={{ height: 30, fontSize: '0.8rem' }}
          >
            {LOG_DIMENSIONS.map((d) => (
              <MenuItem key={d} value={d} disabled={d === primary}>
                {LOG_DIMENSION_LABELS[d]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          placeholder="Sep"
          value={separator}
          onChange={(e) => setSeparator(e.target.value.slice(0, 2))}
          title={`Field separator (default "${DEFAULT_LOG_SEPARATOR}")`}
          sx={{ width: 64 }}
          slotProps={{ htmlInput: { style: { fontSize: '0.8rem', textAlign: 'center' }, 'aria-label': 'Field separator' } }}
        />

        <TextField
          size="small"
          placeholder="Filter lines…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '1 1 160px', minWidth: 140 }}
          slotProps={{ htmlInput: { style: { fontSize: '0.8rem' } } }}
        />
      </Box>

      {/* Level chips + stats */}
      <Box
        sx={{
          px: 1.25,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {LEVEL_FILTERS.map((lv) => {
          const active = levelFilter.has(lv)
          const color = LEVEL_COLORS[lv] ?? '#94a3b8'
          const count = levelCounts[lv] ?? 0
          return (
            <Chip
              key={lv}
              size="small"
              label={`${lv} ${count}`}
              onClick={() => toggleLevel(lv)}
              variant={active ? 'filled' : 'outlined'}
              title={`${active ? 'Show all levels' : `Show only ${lv}`}`}
              sx={{
                height: 22,
                fontSize: '0.68rem',
                ...(active ? { bgcolor: `${color}26`, border: `1px solid ${color}66`, color } : {}),
              }}
            />
          )
        })}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {filtered ? `${filteredEntries.length} / ` : ''}
          {parsed.entries.length} parsed · {totals.errors} ✕ · {totals.warns} ⚠
          {parsed.unparsed.length > 0 ? ` · ${parsed.unparsed.length} unparsed` : ''}
        </Typography>
      </Box>

      {/* Tree */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', py: 0.5 }}>
        {parsed.entries.length === 0 ? (
          <EmptyState text={cleanText} />
        ) : filteredEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No lines match the current filter.
          </Typography>
        ) : (
          <>
            {(showAllRoots ? tree : tree.slice(0, MAX_GROUPS_PER_LEVEL)).map((node) => {
              const open = openPaths.has(node.key)
              const childrenCapped =
                node.children.length > MAX_GROUPS_PER_LEVEL && !showAll.has(node.key)
              const visibleChildren = childrenCapped
                ? node.children.slice(0, MAX_GROUPS_PER_LEVEL)
                : node.children
              return (
                <React.Fragment key={node.key}>
                  <GroupRow node={node} depth={0} open={open} onToggle={() => togglePath(node.key)} />
                  <Collapse in={open} unmountOnExit>
                    {visibleChildren.map((child) => {
                      const childOpen = openPaths.has(child.key)
                      const leaves = child.entries
                      const capped = leaves.length > MAX_LEAVES_PER_GROUP && !showAll.has(child.key)
                      const shown = capped ? leaves.slice(0, MAX_LEAVES_PER_GROUP) : leaves
                      return (
                        <React.Fragment key={child.key}>
                          <GroupRow
                            node={child}
                            depth={1}
                            open={childOpen}
                            onToggle={() => togglePath(child.key)}
                          />
                          <Collapse in={childOpen} unmountOnExit>
                            {shown.map((e) => (
                              <MessageRow
                                key={e.lineNo}
                                entry={e}
                                copied={copiedLine === e.lineNo}
                                indent={2}
                                onCopy={(en) => void copyRaw(en)}
                              />
                            ))}
                            {capped && (
                              <Box
                                onClick={() => setShowAll((prev) => new Set(prev).add(child.key))}
                                sx={{ cursor: 'pointer', pl: 4.5, py: 0.5 }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'primary.main', fontWeight: 600, pl: 1 }}
                                >
                                  … show all {leaves.length} messages
                                </Typography>
                              </Box>
                            )}
                          </Collapse>
                        </React.Fragment>
                      )
                    })}
                    {childrenCapped && (
                      <Box
                        onClick={() => setShowAll((prev) => new Set(prev).add(node.key))}
                        sx={{ cursor: 'pointer', pl: 3, py: 0.5 }}
                      >
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, pl: 1 }}>
                          … show all {node.children.length}{' '}
                          {LOG_DIMENSION_LABELS[secondary].toLowerCase()} groups
                        </Typography>
                      </Box>
                    )}
                  </Collapse>
                </React.Fragment>
              )
            })}
            {tree.length > MAX_GROUPS_PER_LEVEL && !showAllRoots && (
              <Box
                onClick={() => setShowAllRoots(true)}
                sx={{ cursor: 'pointer', px: 2, py: 0.5 }}
              >
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, pl: 1 }}>
                  … show all {tree.length} {LOG_DIMENSION_LABELS[primary].toLowerCase()} groups
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Unparsed lines */}
      {parsed.unparsed.length > 0 && (
        <Box
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
            maxHeight: 200,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            onClick={() => setUnparsedOpen((v) => !v)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.4,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <IconButton size="small" sx={{ p: 0.15 }} tabIndex={-1} aria-hidden>
              {unparsedOpen ? (
                <ExpandMoreIcon sx={{ fontSize: 16 }} />
              ) : (
                <ChevronRightIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Unparsed lines ({parsed.unparsed.length})
            </Typography>
          </Box>
          <Collapse in={unparsedOpen} unmountOnExit>
            <Box
              sx={{
                px: 2,
                pb: 1,
                maxHeight: 130,
                overflow: 'auto',
                fontFamily: MONO_FONT,
                fontSize: '0.7rem',
                color: 'text.secondary',
                whiteSpace: 'pre',
              }}
            >
              {parsed.unparsed
                .slice(0, 50)
                .map((u) => `L${u.lineNo}: ${u.text}`)
                .join('\n')}
              {parsed.unparsed.length > 50
                ? `\n… and ${parsed.unparsed.length - 50} more`
                : ''}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  )
}
