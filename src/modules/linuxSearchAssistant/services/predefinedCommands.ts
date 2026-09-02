/**
 * Build allowlisted remote argv/shell lines for predefined SSH commands.
 * Commands run inside an allowlisted working directory (`cd <cwd> && …`) so a missing
 * SSH home directory does not block grep/view/find.
 * Never accepts arbitrary shell input. Write operations are not expressible.
 */
import {
  PREDEFINED_SSH_COMMAND_KINDS,
  type PredefinedSshCommand,
  type PredefinedSshCommandKind,
} from '../models/ssh'

const UNSAFE = /[\0\n\r;|&`$<>(){}[\]\\]/
const KNOWN_KINDS = new Set<string>(PREDEFINED_SSH_COMMAND_KINDS)

/** Tokens that must never be the primary executable of an allowlisted remote line. */
const FORBIDDEN_WRITE_COMMAND_TOKENS = new Set([
  'rm',
  'mv',
  'cp',
  'chmod',
  'chown',
  'mkdir',
  'rmdir',
  'touch',
  'truncate',
  'dd',
  'tee',
  'sed',
  'awk',
  'sh',
  'bash',
  'python',
  'perl',
  'ruby',
  'node',
])

export class PredefinedCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PredefinedCommandError'
  }
}

/**
 * Reject unsafe operator injection. Allows only our generated `cd '…' && <cmd>` wrapper.
 */
function looksLikeWriteOrShellEscape(commandLine: string): boolean {
  let line = (commandLine || '').trim()
  if (!line) return true

  const cdPrefix = /^cd\s+'[^']*'\s+&&\s+/
  if (cdPrefix.test(line)) {
    line = line.replace(cdPrefix, '')
  }

  if (/[;|&`$<>()]/.test(line)) return true
  if (/\s(-delete|--delete|-exec\b|-execdir\b)/i.test(line)) return true
  const first = line.split(/\s+/)[0]?.toLowerCase() ?? ''
  return FORBIDDEN_WRITE_COMMAND_TOKENS.has(first)
}

function assertSafeRemotePath(path: string): string {
  const trimmed = (path || '').trim()
  if (!trimmed) throw new PredefinedCommandError('A remote path is required.')
  if (!trimmed.startsWith('/')) {
    throw new PredefinedCommandError('Remote paths must be absolute.')
  }
  if (UNSAFE.test(trimmed) || trimmed.includes('..')) {
    throw new PredefinedCommandError('Remote path contains unsafe characters.')
  }
  return trimmed
}

/** Relative path under cwd: `.`, `file.log`, or `subdir/file` (no leading slash / traversal). */
function assertSafeRelativePath(path: string): string {
  const trimmed = (path || '').trim()
  if (!trimmed) throw new PredefinedCommandError('A relative path is required.')
  if (trimmed.startsWith('/')) {
    throw new PredefinedCommandError('Relative path must not be absolute.')
  }
  if (UNSAFE.test(trimmed) || trimmed.includes('..') || trimmed.includes("'") || trimmed.includes('"')) {
    throw new PredefinedCommandError('Relative path contains unsafe characters.')
  }
  return trimmed
}

function assertSafeLiteral(value: string, field: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) throw new PredefinedCommandError(`${field} is required.`)
  if (UNSAFE.test(trimmed) || trimmed.includes("'") || trimmed.includes('"')) {
    throw new PredefinedCommandError(`${field} contains unsafe characters.`)
  }
  return trimmed
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function withWorkingDir(cwd: string, inner: string): string {
  const safeCwd = assertSafeRemotePath(cwd)
  return `cd ${shellQuote(safeCwd)} && ${inner}`
}

function assertKnownKind(kind: unknown): asserts kind is PredefinedSshCommandKind {
  if (typeof kind !== 'string' || !KNOWN_KINDS.has(kind)) {
    throw new PredefinedCommandError('Unknown or unsupported command rejected.')
  }
}

function readCwdAndPath(raw: Record<string, unknown>): { cwd: string; path: string } {
  const cwdRaw = typeof raw.cwd === 'string' ? raw.cwd.trim() : ''
  const pathRaw = typeof raw.path === 'string' ? raw.path.trim() : ''
  if (cwdRaw) {
    return {
      cwd: assertSafeRemotePath(cwdRaw),
      path: assertSafeRelativePath(pathRaw || '.'),
    }
  }
  // Backward compat: absolute path only — treat parent as cwd when possible.
  const absolute = assertSafeRemotePath(pathRaw)
  if (absolute === '/') {
    return { cwd: '/', path: '.' }
  }
  const idx = absolute.lastIndexOf('/')
  const cwd = idx <= 0 ? '/' : absolute.slice(0, idx)
  const rel = idx < 0 ? absolute : absolute.slice(idx + 1)
  return { cwd: assertSafeRemotePath(cwd), path: assertSafeRelativePath(rel || '.') }
}

/**
 * Runtime validation for untrusted IPC-shaped payloads.
 * Rejects unknown kinds and malformed command objects before execution.
 */
export function assertPredefinedCommand(input: unknown): PredefinedSshCommand {
  if (!input || typeof input !== 'object') {
    throw new PredefinedCommandError('Command payload is required.')
  }
  const raw = input as Record<string, unknown>
  assertKnownKind(raw.kind)
  const serverId = typeof raw.serverId === 'string' ? raw.serverId.trim() : ''
  if (!serverId) throw new PredefinedCommandError('serverId is required.')

  switch (raw.kind) {
    case 'test_connection':
      return { kind: 'test_connection', serverId }
    case 'list_path':
    case 'list_dir_files':
    case 'read_cat': {
      const { cwd, path } = readCwdAndPath(raw)
      return { kind: raw.kind, serverId, cwd, path }
    }
    case 'read_head':
    case 'read_tail': {
      const { cwd, path } = readCwdAndPath(raw)
      return {
        kind: raw.kind,
        serverId,
        cwd,
        path,
        lines: typeof raw.lines === 'number' ? raw.lines : undefined,
      }
    }
    case 'grep_path': {
      const { cwd, path } = readCwdAndPath(raw)
      const contextMode =
        raw.contextMode === 'C' || raw.contextMode === 'A' || raw.contextMode === 'B'
          ? raw.contextMode
          : undefined
      const contextLines =
        typeof raw.contextLines === 'number' && Number.isFinite(raw.contextLines)
          ? Math.min(Math.max(Math.trunc(raw.contextLines), 1), 20)
          : undefined
      return {
        kind: 'grep_path',
        serverId,
        cwd,
        path,
        pattern: assertSafeLiteral(typeof raw.pattern === 'string' ? raw.pattern : '', 'pattern'),
        contextMode,
        contextLines,
      }
    }
    case 'find_files': {
      const { cwd, path } = readCwdAndPath(raw)
      return {
        kind: 'find_files',
        serverId,
        cwd,
        path,
        namePattern: assertSafeLiteral(
          typeof raw.namePattern === 'string' ? raw.namePattern : '',
          'namePattern'
        ),
      }
    }
    default:
      throw new PredefinedCommandError('Unknown or unsupported command rejected.')
  }
}

/**
 * Returns a single remote command line assembled only from allowlisted templates.
 * Path-based ops always `cd` into the selected configured directory first.
 */
export function buildPredefinedRemoteCommand(command: PredefinedSshCommand): string {
  assertKnownKind(command.kind)

  let remote: string
  switch (command.kind) {
    case 'test_connection':
      // Avoid depending on HOME — stay in /.
      remote = withWorkingDir('/', 'printf ok')
      break

    case 'list_path': {
      const cwd = assertSafeRemotePath(command.cwd)
      const path = assertSafeRelativePath(command.path)
      remote = withWorkingDir(cwd, `ls -la -- ${shellQuote(path)}`)
      break
    }

    case 'list_dir_files': {
      const cwd = assertSafeRemotePath(command.cwd)
      remote = withWorkingDir(cwd, 'find . -maxdepth 1 -type f')
      break
    }

    case 'read_cat': {
      const cwd = assertSafeRemotePath(command.cwd)
      const path = assertSafeRelativePath(command.path)
      remote = withWorkingDir(cwd, `cat -- ${shellQuote(path)}`)
      break
    }

    case 'read_head': {
      const cwd = assertSafeRemotePath(command.cwd)
      const path = assertSafeRelativePath(command.path)
      const lines = Math.min(Math.max(command.lines ?? 100, 1), 2000)
      remote = withWorkingDir(cwd, `head -n ${lines} -- ${shellQuote(path)}`)
      break
    }

    case 'read_tail': {
      const cwd = assertSafeRemotePath(command.cwd)
      const path = assertSafeRelativePath(command.path)
      const lines = Math.min(Math.max(command.lines ?? 100, 1), 2000)
      remote = withWorkingDir(cwd, `tail -n ${lines} -- ${shellQuote(path)}`)
      break
    }

    case 'grep_path': {
      const cwd = assertSafeRemotePath(command.cwd)
      const path = assertSafeRelativePath(command.path)
      const pattern = assertSafeLiteral(command.pattern, 'pattern')
      const ctxN = Math.min(Math.max(command.contextLines ?? 3, 1), 20)
      const ctxFlag =
        command.contextMode === 'C'
          ? `-C ${ctxN}`
          : command.contextMode === 'A'
            ? `-A ${ctxN}`
            : command.contextMode === 'B'
              ? `-B ${ctxN}`
              : ''
      const ctxPart = ctxFlag ? `${ctxFlag} ` : ''
      // Directory search uses recursive fixed-string grep; file search is single-file.
      const inner =
        path === '.'
          ? `grep -n ${ctxPart}-R -F -- ${shellQuote(pattern)} .`
          : `grep -n ${ctxPart}-F -- ${shellQuote(pattern)} ${shellQuote(path)}`
      remote = withWorkingDir(cwd, inner)
      break
    }

    case 'find_files': {
      const cwd = assertSafeRemotePath(command.cwd)
      const path = assertSafeRelativePath(command.path)
      const namePattern = assertSafeLiteral(command.namePattern, 'namePattern')
      const scope = path === '.' ? '.' : shellQuote(path)
      remote = withWorkingDir(cwd, `find ${scope} -type f -name ${shellQuote(namePattern)}`)
      break
    }

    default: {
      const _exhaustive: never = command
      throw new PredefinedCommandError(`Unsupported command: ${JSON.stringify(_exhaustive)}`)
    }
  }

  if (looksLikeWriteOrShellEscape(remote)) {
    throw new PredefinedCommandError('Write or unsafe command rejected.')
  }
  return remote
}
