import type { AxiosRequestConfig } from 'axios'
import { normalizeHttpError } from '../../shared/errors/normalize'
import type { AppErrorPayload } from '../../shared/errors/types'
import { sendAxiosRequest } from './httpTransport'

export interface RequestData {
  url: string
  method: string
  headers: Record<string, string>
  data: unknown
  timeout?: number
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  data: unknown
  /** User-facing error message when status is 0 */
  error?: string
  /** Structured error for UI (friendly message, retry hint, technical details) */
  errorPayload?: AppErrorPayload
}

export async function sendHttpRequest(req: RequestData): Promise<ResponseData> {
  const config: AxiosRequestConfig = {
    url: req.url,
    method: req.method,
    headers: req.headers,
    data: req.method.toLowerCase() !== 'get' ? req.data : undefined,
    timeout: req.timeout || 15000,
    validateStatus: () => true,
    responseType: 'json',
  }

  try {
    const response = await sendAxiosRequest(config)

    const headers: Record<string, string> = {}
    Object.keys(response.headers).forEach((key) => {
      const val = response.headers[key]
      headers[key] = Array.isArray(val) ? val.join(', ') : String(val)
    })

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      data: response.data,
    }
  } catch (error) {
    const appError = normalizeHttpError(error)
    const payload = appError.toPayload()
    return {
      status: 0,
      statusText: 'Request Failed',
      headers: {},
      data: null,
      error: payload.message,
      errorPayload: payload,
    }
  }
}
