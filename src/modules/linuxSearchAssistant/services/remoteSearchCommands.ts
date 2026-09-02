/**
 * Map SearchService operations to allowlisted {@link PredefinedSshCommand} values.
 * Paths are validated against the portable target config before command construction.
 * Commands are scoped to the configured path (cwd) so they run inside the selected folder/file.
 * Never accepts arbitrary shell input.
 */
import type { PredefinedSshCommand } from '../models/ssh'
import type { LinuxSearchTargetConfig } from '../models/config'
import type { RemoteSearchRequest } from '../models/remoteSearch'
import {
  assertPathAllowed,
  assertSafeLiteral,
  collectAllowedRoots,
  PathAllowlistError,
} from './pathAllowlist'

export class RemoteSearchCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RemoteSearchCommandError'
  }
}

function clampLines(lines: number | undefined, fallback: number): number {
  const n = typeof lines === 'number' && Number.isFinite(lines) ? lines : fallback
  return Math.min(Math.max(Math.trunc(n), 1), 2000)
}

/**
 * Split an allowlisted absolute path into configured working directory + relative target.
 * Example: root `/var/log/app`, path `/var/log/app/error.log` → cwd `/var/log/app`, rel `error.log`
 */
export function splitWorkingDir(
  absolutePath: string,
  target: LinuxSearchTargetConfig
): { cwd: string; relative: string; absolute: string } {
  const path = assertPathAllowed(absolutePath, target)
  const roots = collectAllowedRoots(target).sort((a, b) => b.length - a.length)
  for (const root of roots) {
    if (path === root) {
      return { cwd: root, relative: '.', absolute: path }
    }
    if (path.startsWith(`${root}/`)) {
      const relative = path.slice(root.length + 1)
      if (!relative || relative.includes('..')) {
        throw new RemoteSearchCommandError('Invalid path under configured root.')
      }
      return { cwd: root, relative, absolute: path }
    }
  }
  throw new PathAllowlistError('Path is outside the configured search roots for this target.')
}

export function toPredefinedSearchCommand(request: RemoteSearchRequest): {
  path: string
  command: PredefinedSshCommand
} {
  try {
    switch (request.operation) {
      case 'grep': {
        const { cwd, relative, absolute } = splitWorkingDir(request.path, request.target)
        const pattern = assertSafeLiteral(request.pattern, 'pattern')
        return {
          path: absolute,
          command: {
            kind: 'grep_path',
            serverId: request.serverId,
            cwd,
            path: relative,
            pattern,
            contextMode: request.contextMode,
            contextLines: request.contextLines,
          },
        }
      }
      case 'find': {
        const { cwd, relative, absolute } = splitWorkingDir(request.path, request.target)
        const namePattern = assertSafeLiteral(request.namePattern, 'namePattern')
        return {
          path: absolute,
          command: {
            kind: 'find_files',
            serverId: request.serverId,
            cwd,
            path: relative,
            namePattern,
          },
        }
      }
      case 'cat': {
        const { cwd, relative, absolute } = splitWorkingDir(request.path, request.target)
        return {
          path: absolute,
          command: {
            kind: 'read_cat',
            serverId: request.serverId,
            cwd,
            path: relative,
          },
        }
      }
      case 'head': {
        const { cwd, relative, absolute } = splitWorkingDir(request.path, request.target)
        return {
          path: absolute,
          command: {
            kind: 'read_head',
            serverId: request.serverId,
            cwd,
            path: relative,
            lines: clampLines(request.lines, 100),
          },
        }
      }
      case 'tail': {
        const { cwd, relative, absolute } = splitWorkingDir(request.path, request.target)
        return {
          path: absolute,
          command: {
            kind: 'read_tail',
            serverId: request.serverId,
            cwd,
            path: relative,
            lines: clampLines(request.lines, 100),
          },
        }
      }
      default: {
        const _exhaustive: never = request
        throw new RemoteSearchCommandError(`Unsupported operation: ${JSON.stringify(_exhaustive)}`)
      }
    }
  } catch (error) {
    if (error instanceof PathAllowlistError || error instanceof RemoteSearchCommandError) {
      throw error
    }
    throw new RemoteSearchCommandError('Invalid search request.')
  }
}
