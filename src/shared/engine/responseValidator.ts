import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import type { HttpMethod, ValidationError } from '../models'
import { matchPath, extractPathname } from './pathMatcher'
import type { ResponseValidationOutcome } from './types'

let sharedAjv: Ajv | null = null

function getAjv(): Ajv {
  if (!sharedAjv) {
    sharedAjv = new Ajv({ allErrors: true, strict: false, logger: false })
    addFormats(sharedAjv)
  }
  return sharedAjv
}

function generateErrorId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `err-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toValidationErrors(
  ajvErrors: Array<{
    instancePath?: string
    keyword?: string
    message?: string
    data?: unknown
  }>
): ValidationError[] {
  return ajvErrors.map((err) => ({
    id: generateErrorId(),
    path: err.instancePath || undefined,
    keyword: err.keyword,
    message: err.message || 'Validation failed',
    severity: 'high' as const,
    receivedValue: err.data,
  }))
}

function getMethodObject(
  parsedSpec: Record<string, unknown>,
  matchedPath: string,
  method: HttpMethod
): Record<string, unknown> | null {
  const paths = parsedSpec.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths?.[matchedPath]) return null
  return (paths[matchedPath][method.toLowerCase()] as Record<string, unknown>) || null
}

function getDefinedStatusCodes(methodObj: Record<string, unknown>): string[] {
  const responses = methodObj.responses as Record<string, unknown> | undefined
  if (!responses) return []
  return Object.keys(responses)
}

function resolveResponseForStatus(
  methodObj: Record<string, unknown>,
  status: number
): { responseObj: Record<string, unknown> | null; matchedCode: string | null } {
  const responses = methodObj.responses as Record<string, unknown> | undefined
  if (!responses) return { responseObj: null, matchedCode: null }

  const statusStr = String(status)
  if (responses[statusStr]) {
    return { responseObj: responses[statusStr] as Record<string, unknown>, matchedCode: statusStr }
  }

  for (const [code, responseObj] of Object.entries(responses)) {
    if (code !== 'default' && statusCodeMatchesDefined(status, code)) {
      return { responseObj: responseObj as Record<string, unknown>, matchedCode: code }
    }
  }

  // POST/create endpoints often return 201 while specs document only 200 (and vice versa).
  if (status === 201 && responses['200']) {
    return { responseObj: responses['200'] as Record<string, unknown>, matchedCode: '200' }
  }
  if (status === 200 && responses['201']) {
    return { responseObj: responses['201'] as Record<string, unknown>, matchedCode: '201' }
  }

  if (responses.default) {
    return { responseObj: responses.default as Record<string, unknown>, matchedCode: 'default' }
  }
  return { responseObj: null, matchedCode: null }
}

function isDocumentedSuccessStatus(expectedStatusCodes: string[], status: number): boolean {
  if (status !== 200 && status !== 201) return false
  return expectedStatusCodes.some(
    (code) => code === '200' || code === '201' || code === '2XX' || code === 'default'
  )
}

function isStatusCodeValid(
  status: number,
  expectedStatusCodes: string[],
  matchedCode: string | null
): boolean {
  if (expectedStatusCodes.some((code) => statusCodeMatchesDefined(status, code))) {
    return true
  }

  if (isDocumentedSuccessStatus(expectedStatusCodes, status)) {
    return true
  }

  if (matchedCode === null) return false

  return (
    matchedCode === String(status) ||
    matchedCode === 'default' ||
    statusCodeMatchesDefined(status, matchedCode)
  )
}

function statusCodeMatchesDefined(actual: number, definedCode: string): boolean {
  if (definedCode === 'default') return true
  if (definedCode === '1XX' && actual >= 100 && actual < 200) return true
  if (definedCode === '2XX' && actual >= 200 && actual < 300) return true
  if (definedCode === '3XX' && actual >= 300 && actual < 400) return true
  if (definedCode === '4XX' && actual >= 400 && actual < 500) return true
  if (definedCode === '5XX' && actual >= 500 && actual < 600) return true
  return definedCode === String(actual)
}

/**
 * Validates HTTP response status code and JSON body against an OpenAPI specification.
 */
export function validateResponse(
  parsedSpec: Record<string, unknown> | null,
  requestUrl: string,
  specPath: string,
  method: HttpMethod,
  status: number,
  responseData: unknown
): ResponseValidationOutcome {
  const errors: ValidationError[] = []

  if (!parsedSpec?.paths) {
    return {
      statusCodeValid: false,
      schemaValid: false,
      expectedStatusCodes: [],
      matchedStatusCode: null,
      errors: [
        {
          id: generateErrorId(),
          message: 'No OpenAPI specification provided for validation',
          severity: 'high',
        },
      ],
      skippedSchema: true,
      skipReason: 'Missing specification',
    }
  }

  if (status === 0) {
    return {
      statusCodeValid: false,
      schemaValid: false,
      expectedStatusCodes: [],
      matchedStatusCode: null,
      errors: [
        {
          id: generateErrorId(),
          message: 'No HTTP response received (network error or timeout)',
          severity: 'high',
        },
      ],
      skippedSchema: true,
      skipReason: 'No response',
    }
  }

  const paths = parsedSpec.paths as Record<string, unknown>
  const pathname = extractPathname(requestUrl)
  const matchedPath = matchPath(pathname, Object.keys(paths)) ?? specPath

  const methodObj = getMethodObject(parsedSpec, matchedPath, method)
  if (!methodObj) {
    return {
      statusCodeValid: false,
      schemaValid: false,
      expectedStatusCodes: [],
      matchedStatusCode: null,
      errors: [
        {
          id: generateErrorId(),
          message: `Method ${method} is not defined for endpoint ${matchedPath}`,
          severity: 'high',
        },
      ],
      skippedSchema: true,
      skipReason: 'Method not in spec',
    }
  }

  const expectedStatusCodes = getDefinedStatusCodes(methodObj)
  const { responseObj, matchedCode } = resolveResponseForStatus(methodObj, status)

  const statusCodeValid = isStatusCodeValid(status, expectedStatusCodes, matchedCode)

  if (!statusCodeValid) {
    errors.push({
      id: generateErrorId(),
      message: `Status code ${status} is not defined for ${method} ${matchedPath}. Expected: ${expectedStatusCodes.join(', ') || 'none'}`,
      severity: 'high',
    })
  }

  if (!responseObj) {
    return {
      statusCodeValid,
      schemaValid: statusCodeValid,
      expectedStatusCodes,
      matchedStatusCode: matchedCode,
      errors,
      skippedSchema: true,
      skipReason: 'No matching response definition',
    }
  }

  const content = responseObj.content as Record<string, Record<string, unknown>> | undefined

  if (!content) {
    return {
      statusCodeValid,
      schemaValid: statusCodeValid,
      expectedStatusCodes,
      matchedStatusCode: matchedCode,
      errors,
      skippedSchema: true,
      skipReason: 'No response body defined',
    }
  }

  const mediaTypes = Object.keys(content)
  const jsonMediaType = mediaTypes.find((t) => t.includes('json'))

  if (!jsonMediaType) {
    return {
      statusCodeValid,
      schemaValid: statusCodeValid,
      expectedStatusCodes,
      matchedStatusCode: matchedCode,
      errors,
      skippedSchema: true,
      skipReason: `No JSON content type (available: ${mediaTypes.join(', ')})`,
    }
  }

  const contentObj = content[jsonMediaType]
  const schema = contentObj?.schema as Record<string, unknown> | undefined

  if (!schema) {
    return {
      statusCodeValid,
      schemaValid: statusCodeValid,
      expectedStatusCodes,
      matchedStatusCode: matchedCode,
      errors,
      skippedSchema: true,
      skipReason: 'Empty schema definition',
    }
  }

  try {
    const ajv = getAjv()
    const validate = ajv.compile(schema)
    const valid = validate(responseData)

    if (!valid && validate.errors) {
      errors.push(...toValidationErrors(validate.errors))
      return {
        statusCodeValid,
        schemaValid: false,
        expectedStatusCodes,
        matchedStatusCode: matchedCode,
        errors,
        skippedSchema: false,
      }
    }

    return {
      statusCodeValid,
      schemaValid: statusCodeValid,
      expectedStatusCodes,
      matchedStatusCode: matchedCode,
      errors,
      skippedSchema: false,
    }
  } catch (schemaErr) {
    errors.push({
      id: generateErrorId(),
      message: `Failed to compile JSON schema: ${schemaErr instanceof Error ? schemaErr.message : 'unknown error'}`,
      severity: 'high',
    })
    return {
      statusCodeValid,
      schemaValid: false,
      expectedStatusCodes,
      matchedStatusCode: matchedCode,
      errors,
      skippedSchema: false,
    }
  }
}

export function isValidationPassed(outcome: ResponseValidationOutcome): boolean {
  return outcome.statusCodeValid && outcome.schemaValid && outcome.errors.length === 0
}

/** @internal Resets cached AJV instance (for tests) */
export function resetAjvCache(): void {
  sharedAjv = null
}
