import type { ApiAuthConfig } from '../models'

/** Refresh the token this many milliseconds before it expires. */
export const TOKEN_REFRESH_BUFFER_MS = 60_000

export type OAuthTokenExpiryKind =
  | 'missing_token'
  | 'missing_expiry'
  | 'invalid_expiry'
  | 'expired'
  | 'active'

export interface OAuthTokenExpiryInfo {
  kind: OAuthTokenExpiryKind
  expiresAtMs?: number
  remainingMs?: number
  elapsedSinceExpiryMs?: number
}

export interface OAuthTokenExpiryDisplay {
  severity: 'info' | 'warning' | 'error' | 'success'
  title: string
  detail?: string
}

export function usesClientCredentialsToken(authConfig: ApiAuthConfig): boolean {
  return authConfig.type === 'basic' && Boolean(authConfig.tokenUrl?.trim())
}

export function getOAuthTokenExpiryInfo(
  authConfig: ApiAuthConfig,
  now = Date.now()
): OAuthTokenExpiryInfo {
  if (!authConfig.token?.trim()) {
    return { kind: 'missing_token' }
  }

  const expiresAt = authConfig.tokenExpiresAt
  if (expiresAt === undefined || expiresAt === null) {
    return { kind: 'missing_expiry' }
  }

  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return { kind: 'invalid_expiry' }
  }

  if (now >= expiresAt) {
    return {
      kind: 'expired',
      expiresAtMs: expiresAt,
      elapsedSinceExpiryMs: now - expiresAt,
    }
  }

  return {
    kind: 'active',
    expiresAtMs: expiresAt,
    remainingMs: expiresAt - now,
  }
}

export function formatTokenDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? '' : 's'}`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) {
    if (seconds === 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`
    return `${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${hours} hour${hours === 1 ? '' : 's'} ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`
}

export function formatTokenExpiryTimestamp(expiresAtMs: number): string {
  try {
    return new Date(expiresAtMs).toLocaleString()
  } catch {
    return 'Unknown time'
  }
}

export function formatOAuthTokenExpiryDisplay(
  info: OAuthTokenExpiryInfo
): OAuthTokenExpiryDisplay {
  switch (info.kind) {
    case 'missing_token':
      return {
        severity: 'info',
        title: 'No access token stored.',
        detail: 'Use Verify Token to obtain one.',
      }
    case 'missing_expiry':
      return {
        severity: 'info',
        title: 'Access token stored.',
        detail: 'Expiry time is unknown. Verify the token to record when it expires.',
      }
    case 'invalid_expiry':
      return {
        severity: 'warning',
        title: 'Access token stored.',
        detail: 'Expiry metadata is invalid. Verify the token again.',
      }
    case 'expired':
      return {
        severity: 'error',
        title: `Token expired ${formatTokenDuration(info.elapsedSinceExpiryMs ?? 0)} ago.`,
        detail: info.expiresAtMs
          ? `Expired at ${formatTokenExpiryTimestamp(info.expiresAtMs)}`
          : undefined,
      }
    case 'active': {
      const remainingMs = info.remainingMs ?? 0
      const remainingSeconds = Math.ceil(remainingMs / 1000)
      return {
        severity: remainingSeconds <= 60 ? 'warning' : 'success',
        title: `Token expires in ${formatTokenDuration(remainingMs)}.`,
        detail: info.expiresAtMs
          ? `Expires at ${formatTokenExpiryTimestamp(info.expiresAtMs)}`
          : undefined,
      }
    }
  }
}

export function isOAuthTokenExpired(authConfig: ApiAuthConfig, now = Date.now()): boolean {
  if (!authConfig.token?.trim()) return true
  if (authConfig.tokenExpiresAt === undefined) return false
  return now >= authConfig.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS
}

export function authConfigWithNewToken(
  authConfig: ApiAuthConfig,
  accessToken: string,
  expiresIn?: number
): ApiAuthConfig {
  const tokenExpiresAt =
    expiresIn !== undefined && Number.isFinite(expiresIn)
      ? Date.now() + expiresIn * 1000
      : authConfig.tokenExpiresAt

  return {
    ...authConfig,
    token: accessToken,
    ...(tokenExpiresAt !== undefined ? { tokenExpiresAt } : {}),
  }
}
