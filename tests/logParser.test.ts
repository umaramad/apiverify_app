import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOG_SEPARATOR,
  inferLevelFromErrorCode,
  normalizeLevel,
  parseStructuredLog,
} from '../src/modules/linuxSearchAssistant/services/logParser'

// NGTS-style server-first line: server; parentGroup; timestamp; businessGroup; className; error; message; sessionId; ; threadId
const NGTS =
  '8:default; /NGTS; 08/05/2026 15:27:53:809; MOBILE; ClassName; com.ngts.security.Filter.doFilter(); <COMMONS_ERROR>; error message with debug statements ; UniqueSessoinID; ; WebContainer : 11;'

const CANONICAL =
  '2025-08-05 14:23:45.123; ORD-1001; com.acme.service.OrderService; INFO; Processing order 42; http-nio-8080-exec-3; a1b2c3d4-e5f6-7890'

describe('parseStructuredLog', () => {
  it('parses a canonical 7-field line', () => {
    const { entries, unparsed } = parseStructuredLog(CANONICAL)
    expect(entries).toHaveLength(1)
    expect(unparsed).toHaveLength(0)
    const e = entries[0]
    expect(e.lineNo).toBe(1)
    expect(e.timestamp).toBe('2025-08-05 14:23:45.123')
    expect(e.businessId).toBe('ORD-1001')
    expect(e.className).toBe('com.acme.service.OrderService')
    expect(e.level).toBe('INFO')
    expect(e.message).toBe('Processing order 42')
    expect(e.thread).toBe('http-nio-8080-exec-3')
    expect(e.sessionId).toBe('a1b2c3d4-e5f6-7890')
    expect(e.continuation).toEqual([])
  })

  it('keeps a message that itself contains the separator', () => {
    const line =
      '2025-08-05 14:23:45; B1; com.x.Y; WARN; Failed; reason=timeout; detail=retry; http-nio-1; s1'
    const e = parseStructuredLog(line).entries[0]
    expect(e.message).toBe('Failed; reason=timeout; detail=retry')
    expect(e.thread).toBe('http-nio-1')
    expect(e.sessionId).toBe('s1')
  })

  it('handles missing tail fields', () => {
    // 6 fields: session id missing
    const six = parseStructuredLog('2025-01-01 00:00:00; B; c.C; INFO; m; t1').entries[0]
    expect(six.message).toBe('m')
    expect(six.thread).toBe('t1')
    expect(six.sessionId).toBeUndefined()

    // 5 fields: thread + session missing
    const five = parseStructuredLog('2025-01-01 00:00:00; B; c.C; ERROR; boom').entries[0]
    expect(five.level).toBe('ERROR')
    expect(five.message).toBe('boom')
    expect(five.thread).toBeUndefined()
    expect(five.sessionId).toBeUndefined()

    // 4 fields: no level — the 4th field is the message
    const four = parseStructuredLog('2025-01-01 00:00:00; B; c.C; free text').entries[0]
    expect(four.level).toBeUndefined()
    expect(four.message).toBe('free text')
  })

  it('normalizes levels', () => {
    expect(normalizeLevel('[ERROR]')).toBe('ERROR')
    expect(normalizeLevel(' info ')).toBe('INFO')
    expect(normalizeLevel('')).toBeUndefined()
    expect(normalizeLevel(undefined)).toBeUndefined()
  })

  it('accepts common timestamp variants', () => {
    const variants = [
      '2025-08-05 14:23:45.123',
      '2025-08-05T14:23:45,456',
      '2025-08-05 14:23:45Z',
      '2025-08-05 14:23:45+05:30',
    ]
    for (const ts of variants) {
      const e = parseStructuredLog(`${ts}; B; c.C; INFO; m; t; s`).entries[0]
      expect(e.timestamp).toBe(ts)
    }
  })

  it('attaches stack-trace continuation lines to the previous entry', () => {
    const text = [
      '2025-08-05 14:23:45; B; c.C; ERROR; boom; t; s',
      '        at com.acme.service.OrderService.check(OrderService.java:12)',
      '        at com.acme.Main.main(Main.java:8)',
      'Caused by: java.net.SocketTimeoutException: timed out',
      '        at java.net.SocketInputStream.read(SocketInputStream.java:140)',
      '',
      '2025-08-05 14:23:46; B2; c.D; INFO; next; t2; s2',
    ].join('\n')
    const { entries, unparsed } = parseStructuredLog(text)
    expect(entries).toHaveLength(2)
    expect(unparsed).toHaveLength(0)
    expect(entries[0].continuation).toHaveLength(4)
    expect(entries[0].continuation[2]).toContain('Caused by:')
    expect(entries[1].continuation).toEqual([])
  })

  it('reports non-log lines as unparsed with line numbers', () => {
    const text = ['--- file starts ---', CANONICAL, 'not a log line'].join('\n')
    const { entries, unparsed } = parseStructuredLog(text)
    expect(entries).toHaveLength(1)
    expect(unparsed).toEqual([
      { lineNo: 1, text: '--- file starts ---' },
      { lineNo: 3, text: 'not a log line' },
    ])
  })

  it('skips blank lines', () => {
    const { entries, unparsed } = parseStructuredLog(
      '\n\n2025-08-05 14:23:45; B; c.C; INFO; m; t; s\n\n\n'
    )
    expect(entries).toHaveLength(1)
    expect(unparsed).toHaveLength(0)
  })

  it('supports a custom separator', () => {
    const line = '2025-08-05 14:23:45|B1|com.x.Y|WARN|msg|http-nio-1|sess-9'
    const e = parseStructuredLog(line, { separator: '|' }).entries[0]
    expect(e.businessId).toBe('B1')
    expect(e.thread).toBe('http-nio-1')
    expect(e.sessionId).toBe('sess-9')
  })

  it('exposes the default separator', () => {
    expect(DEFAULT_LOG_SEPARATOR).toBe(';')
  })

  it('parses an empty document', () => {
    expect(parseStructuredLog('')).toEqual({ entries: [], unparsed: [] })
  })
})

describe('server-first NGTS format', () => {
  it('parses the full server-first layout with thread and session from the back', () => {
    const { entries, unparsed } = parseStructuredLog(NGTS)
    expect(entries).toHaveLength(1)
    expect(unparsed).toHaveLength(0)
    const e = entries[0]
    expect(e.server).toBe('8:default')
    expect(e.parentGroup).toBe('/NGTS')
    expect(e.timestamp).toBe('08/05/2026 15:27:53:809')
    expect(e.businessGroup).toBe('MOBILE')
    expect(e.className).toBe('ClassName')
    expect(e.errorCode).toBe('<COMMONS_ERROR>')
    expect(e.level).toBe('ERROR')
    expect(e.message).toContain('error message with debug statements')
    expect(e.sessionId).toBe('UniqueSessoinID')
    expect(e.thread).toBe('WebContainer : 11')
    expect(e.businessId).toBeUndefined()
  })

  it('folds separator-containing messages into the message field', () => {
    const line =
      '8:default; /NGTS; 08/05/2026 15:27:53:809; MOBILE; ClassName; <COMMONS_ERROR>; part one; part two ; S1; ; WC-11;'
    const e = parseStructuredLog(line).entries[0]
    expect(e.errorCode).toBe('<COMMONS_ERROR>')
    // the full middle region is kept (errorCode included) so nothing is lost
    expect(e.message).toBe('<COMMONS_ERROR>; part one; part two')
    expect(e.thread).toBe('WC-11')
    expect(e.sessionId).toBe('S1')
  })

  it('does not mislabel tail fields on truncated lines', () => {
    // Only server + parentGroup + timestamp + businessGroup + className + message
    const line =
      '8:default; /NGTS; 08/05/2026 15:27:53:809; MOBILE; ClassName; just a message'
    const e = parseStructuredLog(line).entries[0]
    expect(e.thread).toBeUndefined()
    expect(e.sessionId).toBeUndefined()
    expect(e.message).toBe('just a message')
    expect(e.className).toBe('ClassName')
  })

  it('keeps non-timestamp non-continuation lines unparsed', () => {
    const text = ['server; parentGroup; 08/05/2026 15:27:53:809; G; C; <ERR>; m; S; ; T', '----'].join('\n')
    const { entries, unparsed } = parseStructuredLog(text)
    expect(entries).toHaveLength(1)
    expect(unparsed).toEqual([{ lineNo: 2, text: '----' }])
  })

  it('infers level from angle-bracket error codes', () => {
    expect(inferLevelFromErrorCode('<COMMONS_ERROR>')).toBe('ERROR')
    expect(inferLevelFromErrorCode('<COMMONS_WARN>')).toBe('WARN')
    expect(inferLevelFromErrorCode('<COMMONS_FATAL>')).toBe('FATAL')
    expect(inferLevelFromErrorCode('<COMMONS_INFO>')).toBe('INFO')
    expect(inferLevelFromErrorCode(undefined)).toBeUndefined()
    expect(inferLevelFromErrorCode('<NOT_A_LEVEL>')).toBeUndefined()
  })

  it('mixes legacy and server-first lines in one file', () => {
    const text = [
      '2025-08-05 14:23:45; B; c.C; INFO; m; t; s',
      '8:default; /NGTS; 08/05/2026 15:27:53:809; MOBILE; ClassName; <COMMONS_ERROR>; msg; S1; ; WC-11;',
    ].join('\n')
    const { entries } = parseStructuredLog(text)
    expect(entries).toHaveLength(2)
    expect(entries[0].businessId).toBe('B')
    expect(entries[1].server).toBe('8:default')
    expect(entries[1].thread).toBe('WC-11')
  })
})
