import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LinuxSearchOutputPanel, {
  type OutputViewMode,
} from '../src/modules/linuxSearchAssistant/renderer/components/LinuxSearchOutputPanel'

// happy-dom + React 19 need this for act(...) to be recognized.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const NGTS = [
  '8:default; /NGTS; 08/05/2026 15:27:53:809; MOBILE; ClassName; com.ngts.security.Filter.doFilter(); <COMMONS_ERROR>; error message with debug statements ; UniqueSessoinID; ; WebContainer : 11;',
  '8:default; /NGTS; 08/05/2026 15:27:54:100; MOBILE; ClassName; <COMMONS_ERROR>; second failure ; S2; ; WebContainer : 11;',
  '9:default; /OTHER; 08/05/2026 15:28:00:001; WEB; OtherClass; <COMMONS_WARN>; slow response ; S3; ; WebContainer : 7;',
].join('\n')

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

interface RenderOpts {
  text?: string | null
  viewMode?: OutputViewMode
  showViewToggle?: boolean
  onChange?: (mode: OutputViewMode) => void
}

function renderPanel(opts: RenderOpts = {}): void {
  act(() => {
    root.render(
      <LinuxSearchOutputPanel
        text={opts.text === undefined ? NGTS : opts.text}
        showViewToggle={opts.showViewToggle ?? true}
        viewMode={opts.viewMode ?? 'raw'}
        onViewModeChange={opts.onChange}
      />
    )
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

describe('LinuxSearchOutputPanel view toggle', () => {
  it('hides the toggle when showViewToggle is not set (default behavior preserved)', () => {
    renderPanel({ showViewToggle: false })
    expect(exactEl('Raw')).toBeUndefined()
    expect(exactEl('Analyze')).toBeUndefined()
    expect(hasText('error message with debug statements')).toBe(true)
  })

  it('shows the toggle next to the Output header and defaults to Raw', () => {
    renderPanel({})
    expect(exactEl('Raw')).toBeTruthy()
    expect(exactEl('Analyze')).toBeTruthy()
    expect(hasText('error message with debug statements')).toBe(true)
  })

  it('notifies onViewModeChange when Analyze is clicked', () => {
    const onChange = vi.fn()
    renderPanel({ onChange })
    const analyze = exactEl('Analyze')
    expect(analyze).toBeTruthy()
    act(() => {
      analyze!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('analyze')
  })

  it('swaps the raw body for the Log Analysis tree when viewMode is analyze', () => {
    renderPanel({ viewMode: 'analyze' })
    // raw body hidden
    expect(hasText('error message with debug statements')).toBe(false)
    // tree rendered, grouped by thread with parsed counts
    expect(hasText('WebContainer : 11')).toBe(true)
    expect(hasText('WebContainer : 7')).toBe(true)
    expect(hasText('3 parsed')).toBe(true)
    expect(hasText('2 ✕')).toBe(true)
    expect(hasText('1 ⚠')).toBe(true)
  })

  it('keeps showing the raw placeholder when there is no content yet', () => {
    renderPanel({ text: null, viewMode: 'analyze' })
    expect(hasText('Run an action to see results here.')).toBe(true)
    expect(hasText('WebContainer : 11')).toBe(false)
  })
})
