import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  alignUtf8End,
  alignUtf8Start,
  clampWindowBytes,
  MIN_LOCAL_LOG_WINDOW_BYTES,
  readLocalLogWindow,
} from '../src/modules/linuxSearchAssistant/services/localLogReader'
import {
  DEFAULT_LOCAL_LOG_WINDOW_BYTES,
  MAX_LOCAL_LOG_FILE_BYTES,
} from '../src/modules/linuxSearchAssistant/models/localLogViewer'

const tmpFiles: string[] = []

function makeTmpFile(name: string, content: Buffer | string): string {
  const filePath = path.join(
    os.tmpdir(),
    `lsa-llv-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`
  )
  fs.writeFileSync(filePath, content)
  tmpFiles.push(filePath)
  return filePath
}

afterEach(() => {
  for (const file of tmpFiles.splice(0)) {
    try {
      fs.unlinkSync(file)
    } catch {
      // already gone
    }
  }
})

describe('alignUtf8Start', () => {
  it('drops a partial leading UTF-8 sequence', () => {
    const buf = Buffer.from([0x80, 0x80, 0x41, 0x42])
    expect(alignUtf8Start(buf).toString('utf8')).toBe('AB')
  })

  it('leaves an aligned start untouched', () => {
    const buf = Buffer.from([0xc3, 0xa9, 0x41]) // é + A
    expect(alignUtf8Start(buf).equals(buf)).toBe(true)
  })
})

describe('alignUtf8End', () => {
  it('trims a partial trailing UTF-8 sequence', () => {
    const buf = Buffer.from([0x41, 0xc3]) // 'A' + dangling lead byte
    expect(alignUtf8End(buf).toString('utf8')).toBe('A')
  })

  it('keeps a complete trailing sequence', () => {
    const buf = Buffer.from([0x41, 0xc3, 0xa9])
    expect(alignUtf8End(buf).equals(buf)).toBe(true)
  })

  it('keeps trailing ASCII untouched', () => {
    const buf = Buffer.from('hello')
    expect(alignUtf8End(buf).equals(buf)).toBe(true)
  })
})

describe('clampWindowBytes', () => {
  it('clamps to the configured min/max', () => {
    expect(clampWindowBytes(10)).toBe(MIN_LOCAL_LOG_WINDOW_BYTES)
    expect(clampWindowBytes(Number.MAX_SAFE_INTEGER)).toBe(MAX_LOCAL_LOG_FILE_BYTES)
  })

  it('falls back to the default for missing/invalid input', () => {
    expect(clampWindowBytes(undefined)).toBe(DEFAULT_LOCAL_LOG_WINDOW_BYTES)
    expect(clampWindowBytes(NaN)).toBe(DEFAULT_LOCAL_LOG_WINDOW_BYTES)
    expect(clampWindowBytes(1.5 * 1024 * 1024)).toBe(Math.floor(1.5 * 1024 * 1024)) // floor() applied
  })
})

describe('readLocalLogWindow', () => {
  it('reads a small file in full without a banner', () => {
    const p = makeTmpFile('small.log', 'line1\nline2\n')
    const r = readLocalLogWindow(p)
    expect(r.content).toBe('line1\nline2\n')
    expect(r.truncated).toBe(false)
    expect(r.readMode).toBe('tail')
    expect(r.fileName).toContain('small.log')
    expect(r.byteSize).toBe(12)
  })

  it('reads an empty file', () => {
    const p = makeTmpFile('empty.log', '')
    const r = readLocalLogWindow(p)
    expect(r.content).toBe('')
    expect(r.truncated).toBe(false)
  })

  it('tails a windowed file with a truncation banner', () => {
    const window = MIN_LOCAL_LOG_WINDOW_BYTES
    const file = Buffer.concat([Buffer.alloc(window + 4, 0x61), Buffer.from('ENDMARK')])
    const p = makeTmpFile('big.log', file)
    const r = readLocalLogWindow(p, { mode: 'tail', windowBytes: window })
    expect(r.truncated).toBe(true)
    expect(r.content.startsWith('[Local Log Viewer]')).toBe(true)
    expect(r.content).toContain('Showing last 1.0 MB (from end)')
    expect(r.content).toContain('ENDMARK')
  })

  it('reads the head of a windowed file', () => {
    const window = MIN_LOCAL_LOG_WINDOW_BYTES
    const file = Buffer.concat([Buffer.from('HEADMARK'), Buffer.alloc(window, 0x62)])
    const p = makeTmpFile('big.log', file)
    const r = readLocalLogWindow(p, { mode: 'head', windowBytes: window })
    expect(r.truncated).toBe(true)
    expect(r.content).toContain('Showing first 1.0 MB (from start)')
    expect(r.content).toContain('HEADMARK')
    expect(r.content.endsWith('\n…')).toBe(true)
  })

  it('does not render a partial UTF-8 char at a head window edge', () => {
    const window = MIN_LOCAL_LOG_WINDOW_BYTES
    // window-1 ASCII bytes + one full 2-byte char → the head window ends mid-char.
    const file = Buffer.concat([Buffer.alloc(window - 1, 0x61), Buffer.from([0xc3, 0xa9])])
    const p = makeTmpFile('head-split.log', file)
    const r = readLocalLogWindow(p, { mode: 'head', windowBytes: window })
    expect(r.truncated).toBe(true)
    expect(r.content.endsWith('\n…')).toBe(true)
    expect(r.content.includes('\ufffd')).toBe(false)
  })

  it('does not render a partial UTF-8 char at a tail window edge', () => {
    const window = MIN_LOCAL_LOG_WINDOW_BYTES
    // window ASCII bytes + one dangling lead byte → tail window ends mid-char.
    const file = Buffer.concat([Buffer.alloc(window, 0x61), Buffer.from([0xc3])])
    const p = makeTmpFile('split.log', file)
    const r = readLocalLogWindow(p, { mode: 'tail', windowBytes: window })
    expect(r.truncated).toBe(true)
    expect(r.content.endsWith('a')).toBe(true)
    expect(r.content.includes('\ufffd')).toBe(false)
  })

  it('throws for a missing file', () => {
    expect(() => readLocalLogWindow(path.join(os.tmpdir(), 'definitely-missing-xyz.log'))).toThrow(
      /File not found/
    )
  })

  it('throws for a non-file path', () => {
    expect(() => readLocalLogWindow(os.tmpdir())).toThrow(/Not a file/)
  })
})
