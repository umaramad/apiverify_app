import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { ValidationEngine, buildRequest, getSpecParametersForEndpoint, getSpecServerBaseUrl } from '../../shared/engine'
import { createProxyAwareHttpClient } from './httpTransport'
import { createConsoleLog, redactHeadersForLog, truncateForLog } from '../../shared/engine/consoleLog'
import { appErrorFromCode, normalizeError } from '../../shared/errors'
import type { ApiEndpoint, ApiAuthConfig, Environment, Project } from '../../shared/models'
import type {
  StartValidationRunInput,
  StartValidationRunOutput,
  ValidationRunProgressEvent,
  ValidationRunProgressResult,
} from '../../shared/models/validationRunner'
import { ValidationRunRepository } from '../db/repositories/ValidationRunRepository'
import { ValidationResultRepository } from '../db/repositories/ValidationResultRepository'
import { resolveEnvironmentForRequests } from './environmentAuth.service'

const runRepo = new ValidationRunRepository()
const resultRepo = new ValidationResultRepository()

function sendProgress(event: ValidationRunProgressEvent): void {
  const window = BrowserWindow.getAllWindows()[0]
  window?.webContents.send('validation:progress', event)
}

function toProgressResult(result: {
  endpointId: string
  endpointName: string
  endpointPath: string
  method: ApiEndpoint['method']
  passed: boolean
  result: { responseStatus: number; responseTimeMs?: number }
  requestError?: string
}): ValidationRunProgressResult {
  return {
    endpointId: result.endpointId,
    endpointName: result.endpointName,
    endpointPath: result.endpointPath,
    method: result.method,
    passed: result.passed,
    responseStatus: result.result.responseStatus,
    responseTimeMs: result.result.responseTimeMs ?? 0,
    requestError: result.requestError,
  }
}

export class ValidationRunnerService {
  private abortController: AbortController | null = null
  private running = false

  isRunning(): boolean {
    return this.running
  }

  cancel(): void {
    this.abortController?.abort()
  }

  async run(input: StartValidationRunInput): Promise<StartValidationRunOutput> {
    if (this.running) {
      throw appErrorFromCode(
        'VALIDATION',
        'A validation run is already in progress. Wait for it to finish or cancel it first.',
        { retryable: false }
      )
    }

    this.running = true
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    const project: Project = {
      id: input.project.id,
      name: input.project.name,
      createdAt: new Date().toISOString(),
    }

    const resolvedEnvironment = await resolveEnvironmentForRequests({ id: input.environment.id })

    const environment: Environment = {
      id: resolvedEnvironment.id,
      projectId: resolvedEnvironment.projectId,
      name: resolvedEnvironment.name,
      variables: resolvedEnvironment.variables,
      type: resolvedEnvironment.type as Environment['type'],
      baseUrl: resolvedEnvironment.baseUrl,
      defaultHeaders: resolvedEnvironment.defaultHeaders,
      authConfig: resolvedEnvironment.authConfig as unknown as ApiAuthConfig,
      isActive: resolvedEnvironment.isActive,
    }

    const endpoints = input.endpoints.map((endpoint) => ({
      ...endpoint,
      authConfig: endpoint.authConfig as unknown as ApiAuthConfig,
    })) as ApiEndpoint[]
    const total = endpoints.length
    let passed = 0
    let totalTime = 0
    let completed = 0
    let cancelled = false

    sendProgress({ type: 'started', current: 0, total })
    sendProgress({
      type: 'log',
      log: createConsoleLog('info', `Validation run started — ${total} endpoint${total === 1 ? '' : 's'}`),
    })

    const engine = new ValidationEngine(createProxyAwareHttpClient())
    const batchId = randomUUID()
    const specBaseUrl = input.parsedSpec ? getSpecServerBaseUrl(input.parsedSpec) : undefined

    try {
      for (let i = 0; i < endpoints.length; i++) {
        if (signal.aborted) {
          cancelled = true
          break
        }

        const endpoint = endpoints[i]
        const specParameters = input.parsedSpec
          ? getSpecParametersForEndpoint(input.parsedSpec, endpoint.path, endpoint.method)
          : undefined
        const builtRequest = buildRequest(environment, endpoint, { specParameters, specBaseUrl })

        sendProgress({
          type: 'log',
          current: i + 1,
          total,
          log: createConsoleLog(
            'request',
            `→ ${builtRequest.method} ${builtRequest.url}`,
            [
              `Headers: ${JSON.stringify(redactHeadersForLog(builtRequest.headers), null, 2)}`,
              builtRequest.body != null && builtRequest.body !== ''
                ? `Body: ${truncateForLog(builtRequest.body, 800)}`
                : null,
            ]
              .filter(Boolean)
              .join('\n\n')
          ),
        })

        const endpointResult = await engine.validateEndpoint(
          project.id,
          environment,
          endpoint,
          input.parsedSpec,
          { timeoutMs: input.timeoutMs, signal }
        )

        runRepo.create({ ...endpointResult.run, runSource: input.runSource ?? 'manual', batchId })
        resultRepo.create(endpointResult.result)

        if (endpointResult.passed) passed++
        totalTime += endpointResult.result.responseTimeMs ?? 0
        completed++

        const status = endpointResult.result.responseStatus
        const responseLevel = endpointResult.requestError
          ? 'error'
          : endpointResult.passed
            ? 'success'
            : 'warn'

        sendProgress({
          type: 'log',
          current: completed,
          total,
          log: createConsoleLog(
            responseLevel,
            endpointResult.requestError
              ? `✗ ${endpoint.method} ${endpoint.path} — ${endpointResult.requestError}`
              : `← ${status} ${endpoint.method} ${endpoint.path} (${endpointResult.result.responseTimeMs ?? 0}ms)`,
            endpointResult.result.responseBody
              ? truncateForLog(endpointResult.result.responseBody, 800)
              : undefined
          ),
        })

        sendProgress({
          type: 'progress',
          current: completed,
          total,
          result: toProgressResult(endpointResult),
        })
      }

      const summary = {
        total: completed,
        passed,
        failed: completed - passed,
        avgResponseTimeMs: completed > 0 ? Math.round(totalTime / completed) : 0,
      }

      sendProgress({
        type: 'log',
        log: createConsoleLog(
          cancelled ? 'warn' : 'info',
          cancelled
            ? `Validation run cancelled — ${completed}/${total} completed`
            : `Validation run complete — ${summary.passed} passed, ${summary.failed} failed`
        ),
      })

      sendProgress({
        type: cancelled ? 'cancelled' : 'complete',
        current: completed,
        total,
        summary,
      })

      return { cancelled, summary }
    } catch (error) {
      const appError = normalizeError(error)
      sendProgress({
        type: 'log',
        log: createConsoleLog('error', `Validation run failed — ${appError.message}`),
      })
      sendProgress({ type: 'error', error: appError.message })
      throw appError
    } finally {
      this.running = false
      this.abortController = null
    }
  }
}

export const validationRunnerService = new ValidationRunnerService()
