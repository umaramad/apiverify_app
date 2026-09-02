import { create } from 'zustand'
import type { AppErrorPayload } from '../../../shared/errors'
import { AppError, normalizeError } from '../../../shared/errors'

interface ErrorStore {
  globalError: AppError | null
  setGlobalError: (error: unknown) => void
  clearGlobalError: () => void
}

export const useErrorStore = create<ErrorStore>((set) => ({
  globalError: null,
  setGlobalError: (error) => set({ globalError: normalizeError(error) }),
  clearGlobalError: () => set({ globalError: null }),
}))

export function reportError(error: unknown): AppError {
  const appError = normalizeError(error)
  useErrorStore.getState().setGlobalError(appError)
  return appError
}

export type { AppErrorPayload }
