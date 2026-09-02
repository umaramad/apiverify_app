import type { AuthApplyInput, AuthApplyResult } from './types'

/** Append a query parameter to a URL, preserving existing search params. */
export function appendQueryParam(url: string, key: string, value: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

export function setHeader(headers: Record<string, string>, key: string, value: string): void {
  headers[key.toLowerCase()] = value
}

export function encodeBase64(value: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(value)
  }
  return Buffer.from(value).toString('base64')
}

export function passthroughResult(input: AuthApplyInput, warnings: string[] = []): AuthApplyResult {
  return {
    url: input.url,
    headers: input.headers,
    warnings,
  }
}
