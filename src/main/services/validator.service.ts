import { matchPath, extractPathname } from '../../shared/engine/pathMatcher'
import {
  validateResponse as validateEngineResponse,
  isValidationPassed,
} from '../../shared/engine/responseValidator'
import type { HttpMethod } from '../../shared/models'

export { matchPath }

export interface ValidationError {
  instancePath: string
  schemaPath: string
  keyword: string
  params: Record<string, unknown>
  message?: string
}

export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
  message?: string
}

/**
 * IPC-facing adapter around the shared validation engine.
 * Preserves the legacy { valid, errors?, message? } response shape.
 */
export async function validateResponse(
  specContent: string | object,
  urlPath: string,
  method: string,
  status: number,
  responseData: unknown
): Promise<ValidationResult> {
  try {
    let spec: Record<string, unknown>
    if (typeof specContent === 'string') {
      spec = JSON.parse(specContent) as Record<string, unknown>
    } else {
      spec = specContent as Record<string, unknown>
    }

    if (!spec.paths) {
      return { valid: false, message: 'Invalid OpenAPI specification: missing "paths" object.' }
    }

    const paths = spec.paths as Record<string, unknown>
    const pathname = extractPathname(urlPath)
    const matchedPathKey = matchPath(pathname, Object.keys(paths))

    if (!matchedPathKey) {
      return {
        valid: false,
        message: `Endpoint "${pathname}" not found in the OpenAPI specification.`,
      }
    }

    const outcome = validateEngineResponse(
      spec,
      urlPath,
      matchedPathKey,
      method.toUpperCase() as HttpMethod,
      status,
      responseData
    )

    if (isValidationPassed(outcome)) {
      if (outcome.skippedSchema && outcome.skipReason) {
        return { valid: true, message: `Validation skipped: ${outcome.skipReason}` }
      }
      return { valid: true }
    }

    const schemaErrors = outcome.errors.filter((e) => e.keyword)
    if (schemaErrors.length > 0) {
      return {
        valid: false,
        errors: schemaErrors.map((err) => ({
          instancePath: err.path || '',
          schemaPath: '',
          keyword: err.keyword || '',
          params: {},
          message: err.message,
        })),
      }
    }

    return {
      valid: false,
      message: outcome.errors[0]?.message || 'Validation failed',
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return {
      valid: false,
      message: `Validation Engine Error: ${message}`,
    }
  }
}
