import path from 'path'
import { appErrorFromCode } from '../errors/normalize'

const MAX_PATH_LENGTH = 4096

/**
 * Sanitizes a filesystem path for main-process reads only.
 * Rejects traversal, null bytes, and paths outside allowed roots.
 */
export function sanitizeSpecFilePath(filePath: string, allowedRoots: string[]): string {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw appErrorFromCode('VALIDATION', 'File path is required.', { retryable: false })
  }

  if (filePath.length > MAX_PATH_LENGTH || filePath.includes('\0')) {
    throw appErrorFromCode('VALIDATION', 'Invalid file path.', { retryable: false })
  }

  if (filePath.includes('..')) {
    throw appErrorFromCode('VALIDATION', 'Path traversal is not allowed.', { retryable: false })
  }

  const normalized = path.normalize(filePath)
  if (normalized.includes('..')) {
    throw appErrorFromCode('VALIDATION', 'Path traversal is not allowed.', { retryable: false })
  }

  const resolved = path.resolve(normalized)
  const allowed = allowedRoots.map((root) => path.resolve(root))

  const isAllowed = allowed.some(
    (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)
  )

  if (!isAllowed) {
    throw appErrorFromCode('VALIDATION', 'Access to this file path is not permitted.', {
      retryable: false,
    })
  }

  return resolved
}
