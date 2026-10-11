import { AppError } from '@/lib/errors'
import {
  hasErrors,
  loadSeedSurveys,
  prepareSurveyFromMarkdown,
  validateSurvey,
  validateSurveySet,
} from '@/lib/survey'
import type { ResponseRecord, Respondent, StoredAnswer, Survey, SurveyStatus } from '@/lib/survey'
import { toStoredAnswer } from '@/lib/survey/answers'
import { buildDemoState, DEMO_MODERATOR_EMAIL, DEMO_PASSWORD } from './demo-data'
import { delay, isOpen, today, weakHash } from './internal'
import type { MockState, MockUser } from './internal'
import type {
  AuthUser,
  Backend,
  ProfilePatch,
  PublishResult,
  SignUpInput,
  SubmitInput,
} from './types'

const STORAGE_KEY = 'oprosnik:mock:v1'

function toAuthUser(user: MockUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    department: user.department,
    position: user.position,
    role: user.role,
    createdAt: user.createdAt,
  }
}

function toRespondent(user: MockUser): Respondent {
  return {
    id: user.id,
    fullName: user.fullName,
    department: user.department,
    position: user.position,
    email: user.email,
  }
}

/**
 * Демо-хранилище на localStorage. Реализует тот же контракт `Backend`,
 * что и SupabaseBackend, поэтому вся логика приложения и статистика
 * работают одинаково в обоих режимах.
 */
export class MockBackend implements Backend {
  readonly kind = 'mock' as const
  readonly description = 'Локальное хранилище браузера (демо-режим)'
  readonly demoCredentials = {
    moderator: DEMO_MODERATOR_EMAIL,
    participant: 'ivanova@csm.local',
    password: DEMO_PASSWORD,
  }

  private state: MockState
  private listeners = new Set<(user: AuthUser | null) => void>()

  constructor() {
    this.state = this.load()
  }

  /* ---------- сохранение ---------- */

  private load(): MockState {
    const fresh = () => buildDemoState(loadSeedSurveys().surveys)
    if (typeof localStorage === 'undefined') return fresh()
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return this.persist(fresh())
      const parsed = JSON.parse(raw) as MockState
      if (parsed.version !== 1 || !Array.isArray(parsed.users) || !Array.isArray(parsed.responses)) {
        return this.persist(fresh())
      }
      return parsed
    } catch {
      return this.persist(fresh())
    }
  }

  private persist(state: MockState): MockState {
    this.state = state
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Приватный режим или переполнение — продолжаем работать в памяти
    }
    return state
  }

  private save(): void {
    this.persist(this.state)
  }

  /** Полный сброс демо-данных */
  reset(): void {
    this.persist(buildDemoState(loadSeedSurveys().surveys))
    this.emit()
  }

  /* ---------- авторизация ---------- */

  private emit(): void {
    const user = this.currentUserSync()
    for (const listener of [...this.listeners]) listener(user)
  }

  private currentUserSync(): AuthUser | null {
    const user = this.state.users.find((item) => item.id === this.state.sessionUserId)
    return user ? toAuthUser(user) : null
  }

  private requireUser(): MockUser {
    const user = this.state.users.find((item) => item.id === this.state.sessionUserId)
    if (!user) throw new AppError('not-authenticated')
    return user
  }

  private requireModerator(): MockUser {
    const user = this.requireUser()
    if (user.role !== 'moderator') throw new AppError('forbidden')
    return user
  }

  async signUp(input: SignUpInput): Promise<AuthUser> {
    await delay()
    const email = input.email.trim().toLowerCase()
    if (!email.includes('@')) throw new AppError('validation', 'Некорректный email')
    if (input.password.length < 6) {
      throw new AppError('validation', 'Пароль должен быть не короче 6 символов')
    }
    if (this.state.users.some((user) => user.email === email)) {
      throw new AppError('email-taken', email)
    }
    const user: MockUser = {
      id: `u-${Date.now().toString(36)}`,
      email,
      passwordHash: weakHash(input.password),
      fullName: input.fullName.trim(),
      department: input.department.trim(),
      position: input.position.trim(),
      role: 'participant',
      createdAt: new Date().toISOString(),
    }
    this.state.users.push(user)
    this.state.sessionUserId = user.id
    this.save()
    this.emit()
    return toAuthUser(user)
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    await delay()
    const normalized = email.trim().toLowerCase()
    const user = this.state.users.find((item) => item.email === normalized)
    if (!user || user.passwordHash !== weakHash(password)) {
      throw new AppError('invalid-credentials')
    }
    this.state.sessionUserId = user.id
    this.save()
    this.emit()
    return toAuthUser(user)
  }

  async signOut(): Promise<void> {
    await delay(30)
    this.state.sessionUserId = null
    this.save()
    this.emit()
  }

  async restoreSession(): Promise<AuthUser | null> {
    return this.currentUserSync()
  }

  subscribeToAuth(listener: (user: AuthUser | null) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async updateProfile(patch: ProfilePatch): Promise<AuthUser> {
    await delay()
    const user = this.requireUser()
    if (patch.fullName !== undefined) user.fullName = patch.fullName.trim()
    if (patch.department !== undefined) user.department = patch.department.trim()
    if (patch.position !== undefined) user.position = patch.position.trim()
    this.save()
    this.emit()
    return toAuthUser(user)
  }

  async changePassword(current: string, next: string): Promise<void> {
    await delay()
    const user = this.requireUser()
    if (user.passwordHash !== weakHash(current)) throw new AppError('invalid-credentials')
    if (next.length < 6) throw new AppError('validation', 'Пароль должен быть не короче 6 символов')
    user.passwordHash = weakHash(next)
    this.save()
  }

  /* ---------- опросы ---------- */

  /** Опубликованные в приложении опросы + seed-файлы из репозитория */
  private mergedSurveys(): Survey[] {
    const byId = new Map(this.state.surveys.map((survey) => [survey.id, survey]))
    for (const seed of loadSeedSurveys().surveys) {
      if (!byId.has(seed.id)) byId.set(seed.id, { ...seed, origin: 'seed' })
    }
    const order: Record<SurveyStatus, number> = { active: 0, draft: 1, closed: 2 }
    return [...byId.values()].sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      return (b.startsAt ?? b.id).localeCompare(a.startsAt ?? a.id)
    })
  }

  async listSurveys(): Promise<Survey[]> {
    await delay(40)
    return this.mergedSurveys()
  }

  async getSurvey(id: string): Promise<Survey | null> {
    await delay(20)
    return this.mergedSurveys().find((survey) => survey.id === id) ?? null
  }

  async publishSurvey(markdown: string): Promise<PublishResult> {
    await delay(160)
    this.requireModerator()

    const { survey: prepared, warnings } = prepareSurveyFromMarkdown(markdown)

    const survey: Survey = { ...prepared, origin: 'published' }
    const existingIndex = this.state.surveys.findIndex((item) => item.id === survey.id)
    const previous = existingIndex >= 0 ? this.state.surveys[existingIndex] : undefined
    survey.version = previous ? previous.version + 1 : 1
    survey.updatedAt = new Date().toISOString()

    if (survey.status === 'active') {
      for (const item of this.mergedSurveys()) {
        if (item.id === survey.id || item.status !== 'active') continue
        this.upsert({ ...item, status: 'closed', updatedAt: survey.updatedAt })
        warnings.push(`Предыдущий активный опрос «${item.title}» переведён в статус «закрыт»`)
      }
    }

    this.upsert(survey)
    return { survey, warnings }
  }

  async setSurveyStatus(id: string, status: SurveyStatus): Promise<Survey> {
    await delay(80)
    this.requireModerator()

    const target = this.mergedSurveys().find((survey) => survey.id === id)
    if (!target) throw new AppError('not-found', id)

    if (status === 'active') {
      for (const item of this.mergedSurveys()) {
        if (item.id !== id && item.status === 'active') {
          this.upsert({ ...item, status: 'closed', updatedAt: new Date().toISOString() })
        }
      }
    }

    const next: Survey = {
      ...target,
      status,
      version: target.version + 1,
      updatedAt: new Date().toISOString(),
    }
    this.upsert(next)
    return next
  }

  private upsert(survey: Survey): void {
    const index = this.state.surveys.findIndex((item) => item.id === survey.id)
    if (index >= 0) this.state.surveys[index] = survey
    else this.state.surveys.push(survey)
    this.save()
  }

  /* ---------- прохождение ---------- */

  async checkAvailability(surveyId: string): Promise<{ available: boolean; reason?: string }> {
    const survey = this.mergedSurveys().find((item) => item.id === surveyId)
    if (!survey) return { available: false, reason: 'Опрос не найден' }
    if (survey.status === 'draft') return { available: false, reason: 'Опрос ещё не опубликован' }
    if (!isOpen(survey)) return { available: false, reason: 'Опрос закрыт или недоступен в текущие даты' }
    const user = this.currentUserSync()
    if (!user) return { available: false, reason: 'Требуется вход в систему' }
    const existing = this.state.responses.some(
      (response) => response.surveyId === surveyId && response.respondent.id === user.id,
    )
    if (existing) return { available: false, reason: 'Вы уже прошли этот опрос' }
    return { available: true }
  }

  async submitResponse(input: SubmitInput): Promise<ResponseRecord> {
    await delay(200)
    const user = this.requireUser()
    const survey = this.mergedSurveys().find((item) => item.id === input.surveyId)
    if (!survey) throw new AppError('not-found', input.surveyId)
    if (!isOpen(survey)) throw new AppError('survey-unavailable', survey.title)
    if (
      this.state.responses.some(
        (response) => response.surveyId === survey.id && response.respondent.id === user.id,
      )
    ) {
      throw new AppError('already-responded', survey.title)
    }

    const byQuestion = new Map<string, StoredAnswer>(input.answers.map((a) => [a.questionId, a]))
    for (const question of survey.questions) {
      if (!question.required) continue
      const answer = byQuestion.get(question.id)
      const filled =
        answer !== undefined &&
        (answer.optionLabels.length > 0 ||
          answer.valueText !== null ||
          answer.valueNum !== null)
      if (!filled) {
        throw new AppError('validation', `Не заполнен обязательный вопрос: ${question.text}`)
      }
    }

    const answers: Record<string, StoredAnswer> = {}
    for (const question of survey.questions) {
      answers[question.id] = byQuestion.get(question.id) ?? toStoredAnswer(question, undefined)
    }

    const record: ResponseRecord = {
      id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      surveyId: survey.id,
      respondent: toRespondent(user),
      submittedAt: new Date().toISOString(),
      answers,
    }
    this.state.responses.push(record)
    this.save()
    return record
  }

  async getMyResponses(): Promise<ResponseRecord[]> {
    await delay(40)
    const user = this.currentUserSync()
    if (!user) return []
    return this.state.responses
      .filter((response) => response.respondent.id === user.id)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  }

  async getMyResponse(surveyId: string): Promise<ResponseRecord | null> {
    const user = this.currentUserSync()
    if (!user) return null
    return (
      this.state.responses.find(
        (response) => response.surveyId === surveyId && response.respondent.id === user.id,
      ) ?? null
    )
  }

  /* ---------- модерация ---------- */

  async getSurveyResponses(surveyId: string): Promise<ResponseRecord[]> {
    await delay(110)
    this.requireModerator()
    return this.state.responses
      .filter((response) => response.surveyId === surveyId)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  }

  async listRespondents(): Promise<Respondent[]> {
    await delay(40)
    this.requireModerator()
    return this.state.users
      .filter((user) => user.role === 'participant')
      .map(toRespondent)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'))
  }

  async getProgress(surveyId: string): Promise<{ responses: number; participants: number }> {
    this.requireModerator()
    return {
      responses: this.state.responses.filter((item) => item.surveyId === surveyId).length,
      participants: this.state.users.filter((user) => user.role === 'participant').length,
    }
  }

  async deleteResponse(responseId: string): Promise<void> {
    await delay(80)
    this.requireModerator()
    this.state.responses = this.state.responses.filter((item) => item.id !== responseId)
    this.save()
  }

  /* ---------- служебное ---------- */

  validateAll(surveys: Survey[]): string[] {
    const issues = [
      ...surveys.flatMap((survey) => validateSurvey(survey)),
      ...validateSurveySet(surveys),
    ]
    return hasErrors(issues)
      ? issues.filter((issue) => issue.level === 'error').map((issue) => issue.message)
      : []
  }
}

export { today }
