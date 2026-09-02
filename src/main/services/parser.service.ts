import SwaggerParser from '@apidevtools/swagger-parser'
import YAML from 'yaml'
import fs from 'fs'
import { normalizeOpenApiError } from '../../shared/errors/normalize'
import { sanitizeSpecFilePath } from '../../shared/security/sanitizePath'

export interface ParseResult {
  valid: boolean
  spec?: unknown
  error?: string
  /** Structured error when valid is false */
  errorPayload?: ReturnType<ReturnType<typeof normalizeOpenApiError>['toPayload']>
}

export async function parseSpecContent(content: string): Promise<ParseResult> {
  try {
    const parsedInput = parseContent(content)
    const dereferencedSpec = await SwaggerParser.dereference(
      parsedInput as Parameters<typeof SwaggerParser.dereference>[0]
    )

    return {
      valid: true,
      spec: dereferencedSpec,
    }
  } catch (error) {
    const appError = normalizeOpenApiError(error)
    const payload = appError.toPayload()
    return {
      valid: false,
      error: payload.message,
      errorPayload: payload,
    }
  }
}

/** Main-process only: read and parse a spec file from an allowed directory. */
export async function parseSpecFromFile(
  filePath: string,
  allowedRoots: string[]
): Promise<ParseResult> {
  try {
    const safePath = sanitizeSpecFilePath(filePath, allowedRoots)
    if (!fs.existsSync(safePath)) {
      const err = normalizeOpenApiError(new Error('Specification file not found.'))
      const payload = err.toPayload()
      return { valid: false, error: payload.message, errorPayload: payload }
    }
    const content = fs.readFileSync(safePath, 'utf-8')
    return parseSpecContent(content)
  } catch (error) {
    const appError = normalizeOpenApiError(error)
    const payload = appError.toPayload()
    return {
      valid: false,
      error: payload.message,
      errorPayload: payload,
    }
  }
}

function parseContent(content: string): unknown {
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('Specification content is empty')
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(content)
    } catch (error) {
      throw new Error(
        `Invalid JSON: ${error instanceof Error ? error.message : 'parse error'}`
      )
    }
  }

  try {
    return YAML.parse(content)
  } catch (error) {
    throw new Error(`Invalid YAML: ${error instanceof Error ? error.message : 'parse error'}`)
  }
}
