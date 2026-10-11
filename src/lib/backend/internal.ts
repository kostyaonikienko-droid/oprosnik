import type { Survey } from '@/lib/survey'

/** Внутренние типы мок-хранилища (не часть публичного контракта Backend) */
export interface MockUser {
  id: string
  email: string
  /** НЕ криптостойко — только для локального демо-режима */
  passwordHash: string
  fullName: string
  department: string
  position: string
  role: 'participant' | 'moderator'
  createdAt: string
}

export interface MockState {
  version: 1
  users: MockUser[]
  sessionUserId: string | null
  surveys: Survey[]
  responses: import('@/lib/survey').ResponseRecord[]
  seededAt: string
}

/** FNV-1a. Заглушка вместо настоящего хеширования, используется только в моке. */
export function weakHash(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(days: number, from = new Date()): string {
  const date = new Date(from)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function delay(ms = 90): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isWithinWindow(survey: Survey, current = today()): boolean {
  if (survey.startsAt && current < survey.startsAt) return false
  if (survey.endsAt && current > survey.endsAt) return false
  return true
}

export function isOpen(survey: Survey, current = today()): boolean {
  return survey.status === 'active' && isWithinWindow(survey, current)
}
