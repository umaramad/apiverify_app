export type ValidationScheduleStatus = 'pending' | 'running' | 'completed' | 'failed'

export type ScheduleRecurrenceType = 'once' | 'daily' | 'weekly'

export interface ValidationSchedule {
  id: string
  userId?: string | null
  projectId: string
  environmentId: string
  specId: string
  name: string
  endpointIds: string[]
  scheduledAt: string
  recurrenceType: ScheduleRecurrenceType
  recurrenceEndsAt?: string | null
  status: ValidationScheduleStatus
  lastError?: string | null
  executedAt?: string | null
  createdAt?: string
}

export interface SaveValidationScheduleInput {
  id: string
  userId?: string | null
  projectId: string
  environmentId: string
  specId: string
  name: string
  endpointIds: string[]
  scheduledAt: string
  recurrenceType?: ScheduleRecurrenceType
}

export interface SchedulerUpdatedEvent {
  scheduleId: string
  status: ValidationScheduleStatus
}
