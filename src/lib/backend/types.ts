import type { ResponseRecord, Respondent, Survey, SurveyStatus, StoredAnswer } from '@/lib/survey'

export type UserRole = 'participant' | 'moderator'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  department: string
  position: string
  role: UserRole
  createdAt: string
}

export interface SignUpInput {
  email: string
  password: string
  fullName: string
  department: string
  position: string
}

export interface ProfilePatch {
  fullName?: string
  department?: string
  position?: string
}

export interface SubmitInput {
  surveyId: string
  answers: StoredAnswer[]
}

export interface PublishResult {
  survey: Survey
  /** Предупреждения, которые не мешают публикации */
  warnings: string[]
}

/**
 * Единый контракт хранилища. MockBackend и SupabaseBackend реализуют его
 * идентично, поэтому переключение между ними — это одна переменная окружения.
 */
export interface Backend {
  readonly kind: 'mock' | 'supabase'
  readonly description: string

  /* --- Авторизация --- */
  signUp(input: SignUpInput): Promise<AuthUser>
  signIn(email: string, password: string): Promise<AuthUser>
  signOut(): Promise<void>
  restoreSession(): Promise<AuthUser | null>
  subscribeToAuth(listener: (user: AuthUser | null) => void): () => void
  updateProfile(patch: ProfilePatch): Promise<AuthUser>
  changePassword(current: string, next: string): Promise<void>

  /* --- Опросы --- */
  listSurveys(): Promise<Survey[]>
  getSurvey(id: string): Promise<Survey | null>
  /** Публикация опроса из markdown-текста (страница «Новый опрос») */
  publishSurvey(markdown: string): Promise<PublishResult>
  setSurveyStatus(id: string, status: SurveyStatus): Promise<Survey>

  /* --- Прохождение --- */
  /** Может ли текущий пользователь пройти опрос (не проходил ли уже, открыт ли опрос) */
  checkAvailability(surveyId: string): Promise<{ available: boolean; reason?: string }>
  submitResponse(input: SubmitInput): Promise<ResponseRecord>
  getMyResponses(): Promise<ResponseRecord[]>
  getMyResponse(surveyId: string): Promise<ResponseRecord | null>

  /* --- Модерация --- */
  getSurveyResponses(surveyId: string): Promise<ResponseRecord[]>
  listRespondents(): Promise<Respondent[]>
  /** Сводка по опросу: сколько собрано ответов и сколько зарегистрировано участников */
  getProgress(surveyId: string): Promise<{ responses: number; participants: number }>
  deleteResponse(responseId: string): Promise<void>
}
