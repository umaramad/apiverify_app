import { BrowserWindow } from 'electron'
import { extractEndpointsFromSpec } from '../../shared/engine/endpointExtractor'
import { normalizeError } from '../../shared/errors'
import type { ValidationSchedule } from '../../shared/models/scheduler'
import { ApiSpecRepository } from '../db/repositories/ApiSpecRepository'
import { EnvironmentRepository } from '../db/repositories/EnvironmentRepository'
import { ProjectRepository } from '../db/repositories/ProjectRepository'
import { ValidationScheduleRepository } from '../db/repositories/ValidationScheduleRepository'
import { computeNextScheduledAt } from '../../shared/scheduler/recurrence'
import { parseSpecContent } from './parser.service'
import { validationRunnerService } from './validationRunner.service'

const scheduleRepo = new ValidationScheduleRepository()
const projectRepo = new ProjectRepository()
const envRepo = new EnvironmentRepository()
const specRepo = new ApiSpecRepository()

const TICK_MS = 15_000

function sendSchedulerUpdated(scheduleId: string, status: ValidationSchedule['status']): void {
  const window = BrowserWindow.getAllWindows()[0]
  window?.webContents.send('scheduler:updated', { scheduleId, status })
}

function isAppInForeground(): boolean {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window) return false
  return window.isVisible() && !window.isMinimized()
}

export class SchedulerService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private ticking = false

  start(): void {
    if (this.intervalId) return
    this.intervalId = setInterval(() => {
      void this.tick()
    }, TICK_MS)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  async tick(): Promise<void> {
    if (this.ticking || !isAppInForeground() || validationRunnerService.isRunning()) {
      return
    }

    this.ticking = true
    try {
      const due = scheduleRepo.findDuePending(new Date().toISOString())
      for (const schedule of due) {
        if (!isAppInForeground() || validationRunnerService.isRunning()) break
        await this.executeSchedule(schedule)
      }
    } finally {
      this.ticking = false
    }
  }

  async executeSchedule(schedule: ValidationSchedule): Promise<void> {
    scheduleRepo.updateStatus(schedule.id, 'running')
    sendSchedulerUpdated(schedule.id, 'running')

    try {
      const project = projectRepo.findById(schedule.projectId)
      const environment = envRepo.findById(schedule.environmentId)
      const spec = specRepo.findById(schedule.specId)

      if (!project || !environment || !spec) {
        throw new Error('Schedule references a project, environment, or specification that no longer exists.')
      }

      const parseResult = await parseSpecContent(spec.content)
      if (!parseResult.valid || !parseResult.spec) {
        throw new Error(parseResult.error || 'Failed to parse API specification for scheduled run.')
      }

      const parsedSpec = parseResult.spec as Record<string, unknown>
      const endpointIdSet = new Set(schedule.endpointIds)
      const endpoints = extractEndpointsFromSpec(schedule.projectId, parsedSpec).filter((endpoint) =>
        endpointIdSet.has(endpoint.id)
      )

      if (endpoints.length === 0) {
        throw new Error('No matching API endpoints were found for this schedule.')
      }

      await validationRunnerService.run({
        project: { id: project.id, name: project.name },
        environment: {
          id: environment.id,
          projectId: environment.projectId,
          name: environment.name,
          variables: environment.variables,
          type: environment.type,
          baseUrl: environment.baseUrl,
          defaultHeaders: environment.defaultHeaders,
          authConfig: environment.authConfig,
          isActive: environment.isActive,
        },
        endpoints,
        parsedSpec,
        runSource: 'scheduler',
      })

      const executedAt = new Date().toISOString()
      const nextScheduledAt = computeNextScheduledAt(
        schedule.scheduledAt,
        schedule.recurrenceType,
        schedule.recurrenceEndsAt
      )

      if (nextScheduledAt) {
        scheduleRepo.rescheduleNextRun(schedule.id, nextScheduledAt)
        sendSchedulerUpdated(schedule.id, 'pending')
        return
      }

      scheduleRepo.updateStatus(schedule.id, 'completed', {
        executedAt,
        lastError: null,
      })
      sendSchedulerUpdated(schedule.id, 'completed')
    } catch (error) {
      const normalized = normalizeError(error)
      scheduleRepo.updateStatus(schedule.id, 'failed', {
        executedAt: new Date().toISOString(),
        lastError: normalized.message,
      })
      sendSchedulerUpdated(schedule.id, 'failed')
    }
  }
}

export const schedulerService = new SchedulerService()
