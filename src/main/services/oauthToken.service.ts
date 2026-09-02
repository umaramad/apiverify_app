import { normalizeHttpError } from '../../shared/errors/normalize'
import { sendAxiosRequest } from './httpTransport'

export interface VerifyOAuthTokenInput {
  tokenUrl: string
  clientId: string
  clientSecret: string
}

export interface VerifyOAuthTokenResult {
  success: boolean
  accessToken?: string
  expiresIn?: number
  error?: string
}

export async function verifyClientCredentialsToken(
  input: VerifyOAuthTokenInput
): Promise<VerifyOAuthTokenResult> {
  const tokenUrl = input.tokenUrl.trim()
  const clientId = input.clientId.trim()
  const clientSecret = input.clientSecret ?? ''

  if (!tokenUrl || !clientId) {
    return { success: false, error: 'Token endpoint URI and client ID are required.' }
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const response = await sendAxiosRequest({
      url: tokenUrl,
      method: 'POST',
      data: 'grant_type=client_credentials',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      validateStatus: () => true,
      timeout: 15000,
    })

    if (response.status < 200 || response.status >= 300) {
      const message =
        typeof response.data === 'object' && response.data !== null
          ? String(
              (response.data as Record<string, unknown>).error_description ||
                (response.data as Record<string, unknown>).error ||
                `Token request failed with HTTP ${response.status}`
            )
          : `Token request failed with HTTP ${response.status}`
      return { success: false, error: message }
    }

    const accessToken =
      typeof response.data === 'object' && response.data !== null
        ? String((response.data as Record<string, unknown>).access_token ?? '')
        : ''

    if (!accessToken) {
      return { success: false, error: 'Token endpoint did not return an access_token.' }
    }

    const expiresInRaw = (response.data as Record<string, unknown>).expires_in
    const expiresIn =
      typeof expiresInRaw === 'number'
        ? expiresInRaw
        : typeof expiresInRaw === 'string'
          ? Number.parseInt(expiresInRaw, 10)
          : undefined

    return {
      success: true,
      accessToken,
      expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
    }
  } catch (error) {
    const appError = normalizeHttpError(error)
    return { success: false, error: appError.message }
  }
}
