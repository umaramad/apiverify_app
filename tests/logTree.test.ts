import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../src/modules/linuxSearchAssistant/services/logParser'
import {
  buildLogTree,
  dimensionValue,
  MISSING_VALUE_LABEL,
} from '../src/modules/linuxSearchAssistant/services/logTree'

let nextLine = 1

function mk(over: Partial<LogEntry> = {}): LogEntry {
  const e: LogEntry = {
    lineNo: nextLine,
    raw: '',
    timestamp: '2025-01-01 00:00:00',
    businessId: 'B',
    className: 'c.C',
    level: 'INFO',
    message: 'm',
    thread: 't1',
    sessionId: 's1',
    continuation: [],
    ...over,
  }
  nextLine += 1
  return e
}

describe('dimensionValue', () => {
  it('falls back to the missing label for empty values', () => {
    expect(dimensionValue(mk({ thread: undefined }), 'thread')).toBe(MISSING_VALUE_LABEL)
    expect(dimensionValue(mk({ thread: '  ' }), 'thread')).toBe(MISSING_VALUE_LABEL)
    expect(dimensionValue(mk({ thread: 'http-nio-1' }), 'thread')).toBe('http-nio-1')
  })
})

describe('buildLogTree', () => {
  it('groups by the primary dimension with counts, sorted by size', () => {
    const tree = buildLogTree(
      [mk({ thread: 't1' }), mk({ thread: 't2' }), mk({ thread: 't1' })],
      'thread',
      'sessionId'
    )
    expect(tree.map((n) => n.label)).toEqual(['t1', 't2'])
    expect(tree[0].count).toBe(2)
    expect(tree[1].count).toBe(1)
  })

  it('aggregates error/warn counts per node (FATAL counts as error)', () => {
    const tree = buildLogTree(
      [
        mk({ thread: 't1', level: 'ERROR' }),
        mk({ thread: 't1', level: 'WARN' }),
        mk({ thread: 't1', level: 'INFO' }),
        mk({ thread: 't1', level: 'FATAL' }),
      ],
      'thread',
      'sessionId'
    )
    const node = tree[0]
    expect(node.count).toBe(4)
    expect(node.errorCount).toBe(2)
    expect(node.warnCount).toBe(1)
  })

  it('groups secondaries and sorts them by size', () => {
    const tree = buildLogTree(
      [
        mk({ thread: 't1', sessionId: 's1' }),
        mk({ thread: 't1', sessionId: 's1' }),
        mk({ thread: 't1', sessionId: 's2' }),
      ],
      'thread',
      'sessionId'
    )
    const children = tree[0].children
    expect(children.map((c) => c.label)).toEqual(['s1', 's2'])
    expect(children[0].count).toBe(2)
    expect(children[0].entries).toHaveLength(2)
  })

  it('preserves file order for message leaves', () => {
    const a = mk({ thread: 't1', sessionId: 's1', lineNo: 1 })
    const b = mk({ thread: 't1', sessionId: 's1', lineNo: 2 })
    const tree = buildLogTree([a, b], 'thread', 'sessionId')
    expect(tree[0].children[0].entries.map((e) => e.lineNo)).toEqual([1, 2])
  })

  it('buckets missing values under the missing label', () => {
    const tree = buildLogTree(
      [mk({ thread: undefined }), mk({ thread: 't1' })],
      'thread',
      'sessionId'
    )
    expect(tree.map((n) => n.label)).toEqual([MISSING_VALUE_LABEL, 't1'])
  })

  it('supports the NGTS dimensions (server, parentGroup, businessGroup, errorCode)', () => {
    const entries = [
      mk({ server: '8:default', parentGroup: '/NGTS', businessGroup: 'MOBILE', errorCode: '<COMMONS_ERROR>' }),
      mk({ server: '8:default', parentGroup: '/NGTS', businessGroup: 'MOBILE', errorCode: '<COMMONS_ERROR>' }),
      mk({ server: '9:default', parentGroup: '/OTHER', businessGroup: 'WEB', errorCode: '<IO_ERROR>' }),
    ]
    const byServer = buildLogTree(entries, 'server', 'businessGroup')
    expect(byServer.map((n) => n.label)).toEqual(['8:default', '9:default'])
    expect(byServer[0].count).toBe(2)

    const byError = buildLogTree(entries, 'errorCode', 'parentGroup')
    expect(byError.map((n) => n.label)).toEqual(['<COMMONS_ERROR>', '<IO_ERROR>'])
    expect(byError[0].children.map((c) => c.label)).toEqual(['/NGTS'])
  })

  it('supports level and className dimensions', () => {
    const entries = [
      mk({ level: 'ERROR', className: 'com.a.X' }),
      mk({ level: 'INFO', className: 'com.a.X' }),
      mk({ level: 'ERROR', className: 'com.b.Y' }),
    ]
    const byLevel = buildLogTree(entries, 'level', 'className')
    expect(byLevel.map((n) => n.label)).toEqual(['ERROR', 'INFO'])
    expect(byLevel[0].children.map((c) => c.label)).toEqual(['com.a.X', 'com.b.Y'])

    const byClass = buildLogTree(entries, 'className', 'level')
    expect(byClass.map((n) => n.label)).toEqual(['com.a.X', 'com.b.Y'])
  })

  it('handles an empty entry list', () => {
    expect(buildLogTree([], 'thread', 'sessionId')).toEqual([])
  })
})
