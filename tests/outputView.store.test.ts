import { beforeEach, describe, expect, it } from 'vitest'
import {
  EMPTY_OUTPUT_VIEW,
  useOutputViewStore,
  type OutputPanelViewState,
} from '../src/modules/linuxSearchAssistant/renderer/store/outputView.store'

const { getState } = useOutputViewStore

beforeEach(() => {
  getState().views = {}
})

describe('useOutputViewStore', () => {
  it('returns the empty view for unknown keys', () => {
    expect(getState().getView('nope')).toBe(EMPTY_OUTPUT_VIEW)
  })

  it('round-trips a view for a key', () => {
    const view: OutputPanelViewState = {
      ...EMPTY_OUTPUT_VIEW,
      findQuery: 'ERROR',
      fontSize: 14,
      scrollTop: 4321,
    }
    getState().setView('tab-1', view)
    expect(getState().getView('tab-1')).toEqual(view)
  })

  it('keeps keys isolated', () => {
    getState().setView('tab-1', { ...EMPTY_OUTPUT_VIEW, findQuery: 'A' })
    getState().setView('tab-2', { ...EMPTY_OUTPUT_VIEW, findQuery: 'B' })
    expect(getState().getView('tab-1').findQuery).toBe('A')
    expect(getState().getView('tab-2').findQuery).toBe('B')
  })
})
