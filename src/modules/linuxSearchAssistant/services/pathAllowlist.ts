/**
 * Allowlist helpers: remote search may only touch configured target paths.
 */
import type { LinuxSearchPathEntry, LinuxSearchTargetConfig } from '../models/config'

const UNSAFE = /[\0\n\r;|&`$<>(){}[\]\\]/

export class PathAllowlistError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathAllowlistError'
  }
}

function normalizePath(path: string): string {
  const trimmed = (path || '').trim()
  if (!trimmed) throw new PathAllowlistError('Path is required.')
  if (!trimmed.startsWith('/')) {
    throw new PathAllowlistError('Paths must be absolute.')
  }
  if (UNSAFE.test(trimmed) || trimmed.includes('..')) {
    throw new PathAllowlistError('Path contains unsafe characters.')
  }
  // Collapse duplicate slashes; strip trailing slash except root
  const collapsed = trimmed.replace(/\/+/g, '/')
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1)
  }
  return collapsed
}

function enabledPaths(entries: LinuxSearchPathEntry[]): string[] {
  return entries.filter((e) => e.enabled && e.path.trim()).map((e) => normalizePath(e.path))
}

/** Roots from the portable target config (application home + enabled path lists). */
export function collectAllowedRoots(target: LinuxSearchTargetConfig): string[] {
  const roots = new Set<string>()
  if (target.applicationHome?.trim()) {
    roots.add(normalizePath(target.applicationHome))
  }
  for (const path of [
    ...enabledPaths(target.logPaths || []),
    ...enabledPaths(target.configPaths || []),
    ...enabledPaths(target.searchPaths || []),
  ]) {
    roots.add(path)
  }
  return Array.from(roots)
}

/**
 * True when `candidate` equals an allowed root or is nested under one.
 * Example: root `/var/log/app` allows `/var/log/app` and `/var/log/app/error.log`.
 */
export function isPathAllowed(candidate: string, allowedRoots: string[]): boolean {
  const path = normalizePath(candidate)
  return allowedRoots.some((root) => path === root || path.startsWith(root + '/'))
}

export function assertPathAllowed(candidate: string, target: LinuxSearchTargetConfig): string {
  const path = normalizePath(candidate)
  const roots = collectAllowedRoots(target)
  if (roots.length === 0) {
    throw new PathAllowlistError('No configured paths are available for search on this target.')
  }
  if (!isPathAllowed(path, roots)) {
    throw new PathAllowlistError('Path is outside the configured search roots for this target.')
  }
  return path
}

export function assertSafeLiteral(value: string, field: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) throw new PathAllowlistError(`${field} is required.`)
  if (UNSAFE.test(trimmed) || trimmed.includes("'") || trimmed.includes('"')) {
    throw new PathAllowlistError(`${field} contains unsafe characters.`)
  }
  return trimmed
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
