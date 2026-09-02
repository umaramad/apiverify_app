import type { ScheduleRecurrenceType } from '../models/scheduler'

/** Maximum days ahead a schedule can be created or recur within. */
export const SCHEDULE_MAX_DAYS_AHEAD = 7

export function getScheduleMaxDate(from = new Date()): Date {
  const max = new Date(from)
  max.setDate(max.getDate() + SCHEDULE_MAX_DAYS_AHEAD)
  return max
}

export function isScheduleDateAllowed(date: Date, now = new Date()): boolean {
  if (date.getTime() <= now.getTime()) return false
  return date.getTime() <= getScheduleMaxDate(now).getTime()
}

export function computeRecurrenceEndsAt(scheduledAt: Date): string {
  return getScheduleMaxDate(scheduledAt).toISOString()
}

export function computeNextScheduledAt(
  currentScheduledAt: string,
  recurrenceType: ScheduleRecurrenceType,
  recurrenceEndsAt: string | null | undefined
): string | null {
  if (recurrenceType === 'once') return null

  const current = new Date(currentScheduledAt)
  if (Number.isNaN(current.getTime())) return null

  const next = new Date(current)
  if (recurrenceType === 'daily') {
    next.setDate(next.getDate() + 1)
  } else if (recurrenceType === 'weekly') {
    next.setDate(next.getDate() + 7)
  } else {
    return null
  }

  const endMs = recurrenceEndsAt ? Date.parse(recurrenceEndsAt) : NaN
  if (!Number.isNaN(endMs) && next.getTime() > endMs) {
    return null
  }

  return next.toISOString()
}

export function formatRecurrenceLabel(recurrenceType: ScheduleRecurrenceType): string {
  switch (recurrenceType) {
    case 'once':
      return 'Once'
    case 'daily':
      return 'Daily (1 week)'
    case 'weekly':
      return 'Weekly (1 week)'
  }
}
