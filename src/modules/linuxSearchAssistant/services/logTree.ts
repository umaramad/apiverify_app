/**
 * Configurable grouping tree over parsed log entries.
 *
 *   root
 *   └─ primary groups (thread / sessionId / businessId / level / className)
 *      └─ secondary groups
 *         └─ message leaves (one per entry, file order)
 *
 * Every node aggregates entry count + error/warn counts so a file can be
 * triaged without expanding anything. Pure module (no React) — unit-tested.
 */
import type { LogEntry } from './logParser'

export const LOG_DIMENSIONS = [
  'thread',
  'sessionId',
  'businessId',
  'level',
  'className',
  'server',
  'parentGroup',
  'businessGroup',
  'errorCode',
] as const
export type LogDimension = (typeof LOG_DIMENSIONS)[number]

export const LOG_DIMENSION_LABELS: Record<LogDimension, string> = {
  thread: 'Thread',
  sessionId: 'Session ID',
  businessId: 'Business ID',
  level: 'Level',
  className: 'Class',
  server: 'Server',
  parentGroup: 'Parent Group',
  businessGroup: 'Business Group',
  errorCode: 'Error Code',
}

/** Label for entries missing a value for a dimension. */
export const MISSING_VALUE_LABEL = '—'

export interface LogTreeNode {
  /** Stable key used for expand/collapse state (includes parent values). */
  key: string
  label: string
  /** Number of entries in this subtree. */
  count: number
  errorCount: number
  warnCount: number
  /** Entries directly under this node (leaves). Only meaningful on secondary nodes. */
  entries: LogEntry[]
  children: LogTreeNode[]
}

/** Value of a dimension for an entry, falling back to the missing-label bucket. */
export function dimensionValue(entry: LogEntry, dim: LogDimension): string {
  const v = entry[dim]
  return v && v.trim() ? v : MISSING_VALUE_LABEL
}

function makeNode(key: string, label: string): LogTreeNode {
  return { key, label, count: 0, errorCount: 0, warnCount: 0, entries: [], children: [] }
}

function bump(node: LogTreeNode, entry: LogEntry): void {
  node.count += 1
  if (entry.level === 'ERROR' || entry.level === 'FATAL') node.errorCount += 1
  else if (entry.level === 'WARN') node.warnCount += 1
}

export function buildLogTree(
  entries: LogEntry[],
  primary: LogDimension,
  secondary: LogDimension
): LogTreeNode[] {
  const groups = new Map<
    string,
    { node: LogTreeNode; secondaries: Map<string, LogTreeNode> }
  >()

  for (const entry of entries) {
    const pValue = dimensionValue(entry, primary)
    let group = groups.get(pValue)
    if (!group) {
      group = { node: makeNode(pValue, pValue), secondaries: new Map() }
      groups.set(pValue, group)
    }
    bump(group.node, entry)

    const sValue = dimensionValue(entry, secondary)
    let child = group.secondaries.get(sValue)
    if (!child) {
      child = makeNode(`${pValue}/${sValue}`, sValue)
      group.secondaries.set(sValue, child)
    }
    bump(child, entry)
    child.entries.push(entry) // file order preserved
  }

  const roots: LogTreeNode[] = []
  for (const group of groups.values()) {
    const children = [...group.secondaries.values()].sort((a, b) => b.count - a.count)
    roots.push({ ...group.node, children })
  }
  roots.sort((a, b) => b.count - a.count)
  return roots
}
