import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import LogAnalysisPanel from '../src/modules/linuxSearchAssistant/renderer/components/LogAnalysisPanel'

// happy-dom + React 19 need this for act(...) to be recognized.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SAMPLE = [
  '2025-08-05 14:23:45.123; ORD-1; com.acme.OrderService; INFO; Processing order 42; http-nio-8080-exec-3; sess-aaa',
  '2025-08-05 14:23:46.001; ORD-2; com.acme.OrderService; ERROR; Order failed; http-nio-8080-exec-7; sess-bbb',
  '2025-08-05 14:23:47.500; ORD-3; com.acme.PaymentService; WARN; Retrying payment; http-nio-8080-exec-3; sess-aaa',
].join('\n')

const BANNER = `[Local Log Viewer] Showing last 1.0 MB of big.log (100.0 MB on disk). Change Head/Tail or window size, then Reload.

…
${SAMPLE}`

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function renderPanel(text: string): void {
  act(() => {
    root.render(<LogAnalysisPanel text={text} />)
  })
}

function hasText(text: string): boolean {
  return (container.textContent ?? '').includes(text)
}

function exactEl(text: string): Element | undefined {
  return Array.from(container.querySelectorAll('*')).find(
    (n) => n.textContent?.trim() === text
  )
}

function clickExact(text: string, opts: { chip?: boolean } = {}): void {
  const el = exactEl(text)
  expect(el, `expected an element with exact text "${text}"`).toBeTruthy()
  const target = opts.chip ? (el!.closest('.MuiChip-root') ?? el!) : (el!.parentElement ?? el!)
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

/** Number of expanded (down-chevron) group rows — state-driven, happy-dom-safe. */
function openIconCount(): number {
  return container.querySelectorAll('[data-testid="ExpandMoreIcon"]').length
}

describe('LogAnalysisPanel', () => {
  it('renders thread groups open by default; secondaries visible, messages collapsed', () => {
    renderPanel(SAMPLE)
    expect(hasText('http-nio-8080-exec-3')).toBe(true)
    expect(hasText('http-nio-8080-exec-7')).toBe(true)
    // both primary groups start expanded…
    expect(openIconCount()).toBe(2)
    // …their session rows are visible (primary is open)…
    expect(hasText('sess-aaa')).toBe(true)
    // …but message rows are collapsed (not mounted)
    expect(hasText('Processing order 42')).toBe(false)
    // stats line
    expect(hasText('3 parsed')).toBe(true)
    expect(hasText('1 ✕')).toBe(true)
    expect(hasText('1 ⚠')).toBe(true)
  })

  it('drills down session → message', () => {
    renderPanel(SAMPLE)
    clickExact('sess-aaa')
    expect(hasText('Processing order 42')).toBe(true)
    expect(hasText('Retrying payment')).toBe(true)
    expect(hasText('Order failed')).toBe(false)
  })

  it('collapses a primary group on click', () => {
    renderPanel(SAMPLE)
    expect(openIconCount()).toBe(2)
    clickExact('http-nio-8080-exec-3')
    expect(openIconCount()).toBe(1)
  })

  it('filters by level chip', () => {
    renderPanel(SAMPLE)
    clickExact('ERROR 1', { chip: true })
    expect(hasText('http-nio-8080-exec-7')).toBe(true)
    expect(hasText('http-nio-8080-exec-3')).toBe(false)
    expect(hasText('1 / 3 parsed')).toBe(true)
  })

  it('strips the Local Log Viewer truncation banner before parsing', () => {
    renderPanel(BANNER)
    expect(hasText('3 parsed')).toBe(true)
    expect(hasText('Local Log Viewer')).toBe(false)
    expect(hasText('http-nio-8080-exec-3')).toBe(true)
  })

  it('shows an empty state for unstructured input', () => {
    renderPanel('just some random text\nwith no timestamps')
    expect(hasText('No structured lines matched')).toBe(true)
  })

  it('parses and groups the server-first NGTS format', () => {
    const ngts = [
      '8:default; /NGTS; 08/05/2026 15:27:53:809; MOBILE; ClassName; com.ngts.security.Filter.doFilter(); <COMMONS_ERROR>; error message with debug statements ; UniqueSessoinID; ; WebContainer : 11;',
      '8:default; /NGTS; 08/05/2026 15:27:54:100; MOBILE; ClassName; <COMMONS_ERROR>; second failure ; S2; ; WebContainer : 11;',
      '9:default; /OTHER; 08/05/2026 15:28:00:001; WEB; OtherClass; <COMMONS_WARN>; slow response ; S3; ; WebContainer : 7;',
    ].join('\n')
    renderPanel(ngts)
    // grouped by thread (default) → WebContainer groups
    expect(hasText('WebContainer : 11')).toBe(true)
    expect(hasText('WebContainer : 7')).toBe(true)
    // error codes visible at drill-down; error inference drives the counts
    expect(hasText('2 ✕')).toBe(true)
    expect(hasText('1 ⚠')).toBe(true)
    expect(hasText('3 parsed')).toBe(true)
  })
})
