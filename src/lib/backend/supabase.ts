import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import { prepareSurveyFromMarkdown } from '@/lib/survey'
import type {
  QuestionType,
  Respondent,
  ResponseRecord,
  StoredAnswer,
  Survey,
  SurveyStatus,
} from '@/lib/survey'
import type {
  AuthUser,
  Backend,
  ProfilePatch,
  PublishResult,
  SignUpInput,
  SubmitInput,
} from './types'

interface ProfileRow {
  id: string
  full_name: string
  department: string
  position: string
  email: string | null
}

interface SurveyRow {
  id: string
  title: string
  status: SurveyStatus
  starts_at: string | null
  ends_at: string | null
  definition: Pick<Survey, 'intro' | 'questions'> | null
  version: number
  updated_at: string | null
}

interface ResponseRow {
  id: string
  survey_id: string
  user_id: string
  submitted_at: string
}

interface AnswerRow {
  response_id: string
  question_id: string
  question_text: string
  question_type: QuestionType
  option_labels: string[] | null
  value_text: string | null
  value_num: number | null
  comment: string | null
}

interface ResponseWithJoins extends ResponseRow {
  profiles: ProfileRow | null
  answers: AnswerRow[] | null
}

export interface SupabaseConfig {
  url: string
  anonKey: string
}

function mapAuthError(error: { message: string; code?: string }, fallback: 'network' = 'network'): AppError {
  const message = error.message.toLowerCase()
  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return new AppError('invalid-credentials')
  }
  if (message.includes('already registered') || message.includes('already been registered')) {
    return new AppError('email-taken')
  }
  if (message.includes('row-level security') || message.includes('permission')) {
    return new AppError('forbidden', error.message)
  }
  if (message.includes('duplicate key') || message.includes('23505')) {
    return new AppError('already-responded')
  }
  if (message.includes('email') && message.includes('invalid')) {
    return new AppError('validation', error.message)
  }
  return new AppError(fallback, error.message)
}

function toAuthUser(user: User, profile: ProfileRow | null): AuthUser {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  return {
    id: user.id,
    email: user.email ?? profile?.email ?? '',
    fullName: profile?.full_name ?? String(metadata.full_name ?? ''),
    department: profile?.department ?? String(metadata.department ?? ''),
    position: profile?.position ?? String(metadata.position ?? ''),
    role:
      ((user.app_metadata as Record<string, unknown> | undefined)?.role === 'moderator'
        ? 'moderator'
        : 'participant'),
    createdAt: user.created_at,
  }
}

function rowToSurvey(row: SurveyRow): Survey {
  const definition = row.definition ?? { intro: '', questions: [] }
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    intro: definition.intro ?? '',
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    questions: definition.questions ?? [],
    origin: 'published',
    version: row.version ?? 1,
    updatedAt: row.updated_at ?? undefined,
  }
}

function surveyToRow(survey: Survey, createdBy: string | null): Record<string, unknown> {
  return {
    id: survey.id,
    title: survey.title,
    status: survey.status,
    starts_at: survey.startsAt ?? null,
    ends_at: survey.endsAt ?? null,
    definition: { intro: survey.intro ?? '', questions: survey.questions },
    version: survey.version,
    updated_at: survey.updatedAt ?? new Date().toISOString(),
    created_by: createdBy,
  }
}

/**
 * Реализация контракта Backend поверх Supabase.
 * Включается переменными окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.
 * Структура таблиц и RLS-политики — в `supabase/schema.sql`.
 */
export class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const
  readonly description = 'Supabase (PostgreSQL + Auth)'

  private client: SupabaseClient
  private profileCache = new Map<string, ProfileRow | null>()

  constructor(config: SupabaseConfig) {
    this.client = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  }

  /* ---------- авторизация ---------- */

  private async loadProfile(userId: string): Promise<ProfileRow | null> {
    const cached = this.profileCache.get(userId)
    if (cached !== undefined) return cached
    const { data, error } = await this.client
      .from('profiles')
      .select('id, full_name, department, position, email')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw mapAuthError(error)
    this.profileCache.set(userId, data)
    return data
  }

  private async toAuthUserOrNull(user: User | null): Promise<AuthUser | null> {
    if (!user) return null
    const profile = await this.loadProfile(user.id)
    return toAuthUser(user, profile)
  }

  async signUp(input: SignUpInput): Promise<AuthUser> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          department: input.department,
          position: input.position,
        },
      },
    })
    if (error) throw mapAuthError(error)
    if (!data.user) throw new AppError('network', 'Не удалось создать пользователя')

    const { error: profileError } = await this.client.from('profiles').insert({
      id: data.user.id,
      full_name: input.fullName.trim(),
      department: input.department.trim(),
      position: input.position.trim(),
      email: input.email.trim().toLowerCase(),
    })
    if (profileError) throw mapAuthError(profileError)

    if (!data.session) {
      throw new AppError(
        'validation',
        'Регистрация выполнена. Подтвердите адрес электронной почты по ссылке из письма и войдите снова.',
      )
    }

    const authUser = await this.toAuthUserOrNull(data.user)
    if (!authUser) throw new AppError('not-authenticated')
    return authUser
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw mapAuthError(error)
    const user = await this.toAuthUserOrNull(data.user)
    if (!user) throw new AppError('not-authenticated')
    return user
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut()
    this.profileCache.clear()
  }

  async restoreSession(): Promise<AuthUser | null> {
    const { data, error } = await this.client.auth.getSession()
    if (error) return null
    return this.toAuthUserOrNull(data.session?.user ?? null)
  }

  subscribeToAuth(listener: (user: AuthUser | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      void this.toAuthUserOrNull(session?.user ?? null).then(listener)
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }

  async updateProfile(patch: ProfilePatch): Promise<AuthUser> {
    const { data: sessionData } = await this.client.auth.getSession()
    const user = sessionData.session?.user
    if (!user) throw new AppError('not-authenticated')

    const { error } = await this.client
      .from('profiles')
      .update({
        full_name: patch.fullName?.trim(),
        department: patch.department?.trim(),
        position: patch.position?.trim(),
      })
      .eq('id', user.id)
    if (error) throw mapAuthError(error)

    this.profileCache.delete(user.id)
    const updated = await this.toAuthUserOrNull(user)
    if (!updated) throw new AppError('not-authenticated')
    return updated
  }

  async changePassword(current: string, next: string): Promise<void> {
    const { data: sessionData } = await this.client.auth.getSession()
    const user = sessionData.session?.user
    if (!user?.email) throw new AppError('not-authenticated')
    if (next.length < 6) {
      throw new AppError('validation', 'Пароль должен быть не короче 6 символов')
    }

    // Supabase не проверяет текущий пароль, поэтому подтверждаем его повторным входом
    const { error: verifyError } = await this.client.auth.signInWithPassword({
      email: user.email,
      password: current,
    })
    if (verifyError) throw new AppError('invalid-credentials')

    const { error } = await this.client.auth.updateUser({ password: next })
    if (error) throw mapAuthError(error)
  }

  /* ---------- опросы ---------- */

  private async fetchSurveys(): Promise<Survey[]> {
    const { data, error } = await this.client
      .from('surveys')
      .select('id, title, status, starts_at, ends_at, definition, version, updated_at')
      .order('starts_at', { ascending: false })
    if (error) throw mapAuthError(error)
    const order: Record<SurveyStatus, number> = { active: 0, draft: 1, closed: 2 }
    return (data ?? [])
      .map((row) => rowToSurvey(row as SurveyRow))
      .sort((a, b) => {
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
        return (b.startsAt ?? b.id).localeCompare(a.startsAt ?? a.id)
      })
  }

  async listSurveys(): Promise<Survey[]> {
    return this.fetchSurveys()
  }

  async getSurvey(id: string): Promise<Survey | null> {
    const { data, error } = await this.client
      .from('surveys')
      .select('id, title, status, starts_at, ends_at, definition, version, updated_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw mapAuthError(error)
    return data ? rowToSurvey(data as SurveyRow) : null
  }

  async publishSurvey(markdown: string): Promise<PublishResult> {
    const { data: sessionData } = await this.client.auth.getSession()
    const user = sessionData.session?.user
    if (!user) throw new AppError('not-authenticated')

    const { survey: prepared, warnings } = prepareSurveyFromMarkdown(markdown)
    const existing = await this.getSurvey(prepared.id)

    const survey: Survey = {
      ...prepared,
      origin: 'published',
      version: existing ? existing.version + 1 : 1,
      updatedAt: new Date().toISOString(),
    }

    if (survey.status === 'active') {
      const others = await this.fetchSurveys()
      for (const other of others) {
        if (other.id === survey.id || other.status !== 'active') continue
        await this.client
          .from('surveys')
          .update({ status: 'closed', updated_at: survey.updatedAt })
          .eq('id', other.id)
        warnings.push(`Предыдущий активный опрос «${other.title}» переведён в статус «закрыт»`)
      }
    }

    const { error } = await this.client
      .from('surveys')
      .upsert(surveyToRow(survey, user.id), { onConflict: 'id' })
    if (error) throw mapAuthError(error)

    return { survey, warnings }
  }

  async setSurveyStatus(id: string, status: SurveyStatus): Promise<Survey> {
    const target = await this.getSurvey(id)
    if (!target) throw new AppError('not-found', id)

    if (status === 'active') {
      const others = await this.fetchSurveys()
      for (const other of others) {
        if (other.id !== id && other.status === 'active') {
          await this.client
            .from('surveys')
            .update({ status: 'closed', updated_at: new Date().toISOString() })
            .eq('id', other.id)
        }
      }
    }

    const next: Survey = {
      ...target,
      status,
      version: target.version + 1,
      updatedAt: new Date().toISOString(),
    }
    const { data: sessionData } = await this.client.auth.getSession()
    const { error } = await this.client
      .from('surveys')
      .upsert(surveyToRow(next, sessionData.session?.user?.id ?? null), { onConflict: 'id' })
    if (error) throw mapAuthError(error)
    return next
  }

  /* ---------- прохождение ---------- */

  async checkAvailability(surveyId: string): Promise<{ available: boolean; reason?: string }> {
    const survey = await this.getSurvey(surveyId)
    if (!survey) return { available: false, reason: 'Опрос не найден' }
    if (survey.status === 'draft') return { available: false, reason: 'Опрос ещё не опубликован' }
    if (survey.status !== 'active') return { available: false, reason: 'Опрос закрыт' }

    const today = new Date().toISOString().slice(0, 10)
    if (survey.startsAt && today < survey.startsAt) {
      return { available: false, reason: 'Опрос ещё не начался' }
    }
    if (survey.endsAt && today > survey.endsAt) {
      return { available: false, reason: 'Срок прохождения истёк' }
    }

    const { data: sessionData } = await this.client.auth.getSession()
    const user = sessionData.session?.user
    if (!user) return { available: false, reason: 'Требуется вход в систему' }

    const { data: existing } = await this.client
      .from('responses')
      .select('id')
      .eq('survey_id', surveyId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) return { available: false, reason: 'Вы уже прошли этот опрос' }

    return { available: true }
  }

  async submitResponse(input: SubmitInput): Promise<ResponseRecord> {
    const { data: sessionData } = await this.client.auth.getSession()
    const user = sessionData.session?.user
    if (!user) throw new AppError('not-authenticated')

    const survey = await this.getSurvey(input.surveyId)
    if (!survey) throw new AppError('not-found', input.surveyId)
    if (survey.status !== 'active') throw new AppError('survey-unavailable', survey.title)

    const profile = await this.loadProfile(user.id)

    const { data: responseRow, error } = await this.client
      .from('responses')
      .insert({ survey_id: input.surveyId, user_id: user.id })
      .select('id, survey_id, user_id, submitted_at')
      .single()
    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        throw new AppError('already-responded', survey.title)
      }
      throw mapAuthError(error)
    }

    const answerRows = input.answers.map((answer: StoredAnswer) => ({
      response_id: (responseRow as ResponseRow).id,
      question_id: answer.questionId,
      question_text: answer.questionText,
      question_type: answer.questionType,
      option_labels: answer.optionLabels,
      value_text: answer.valueText,
      value_num: answer.valueNum,
      comment: answer.comment,
    }))

    const { error: answersError } = await this.client.from('answers').insert(answerRows)
    if (answersError) {
      // Откатываем ответ, чтобы не осталось «половины» данных
      await this.client.from('responses').delete().eq('id', (responseRow as ResponseRow).id)
      throw mapAuthError(answersError)
    }

    const row = responseRow as ResponseRow
    const answers: Record<string, StoredAnswer> = {}
    for (const answer of input.answers) answers[answer.questionId] = answer

    return {
      id: row.id,
      surveyId: row.survey_id,
      respondent: {
        id: row.user_id,
        fullName: profile?.full_name ?? '',
        department: profile?.department ?? '',
        position: profile?.position ?? '',
        email: profile?.email ?? undefined,
      },
      submittedAt: row.submitted_at,
      answers,
    }
  }

  async getMyResponses(): Promise<ResponseRecord[]> {
    const { data: sessionData } = await this.client.auth.getSession()
    const user = sessionData.session?.user
    if (!user) return []
    return this.fetchResponses({ userId: user.id })
  }

  async getMyResponse(surveyId: string): Promise<ResponseRecord | null> {
    const { data: sessionData } = await this.client.auth.getSession()
    const user = sessionData.session?.user
    if (!user) return null
    const records = await this.fetchResponses({ userId: user.id, surveyId })
    return records[0] ?? null
  }

  private async fetchResponses(filter: {
    userId?: string
    surveyId?: string
  }): Promise<ResponseRecord[]> {
    let query = this.client
      .from('responses')
      .select(
        'id, survey_id, user_id, submitted_at, profiles(id, full_name, department, position, email), answers(response_id, question_id, question_text, question_type, option_labels, value_text, value_num, comment)',
      )
      .order('submitted_at', { ascending: false })

    if (filter.userId) query = query.eq('user_id', filter.userId)
    if (filter.surveyId) query = query.eq('survey_id', filter.surveyId)

    const { data, error } = await query
    if (error) throw mapAuthError(error)
    return ((data ?? []) as unknown as ResponseWithJoins[]).map(mapResponseRow)
  }

  /* ---------- модерация ---------- */

  async getSurveyResponses(surveyId: string): Promise<ResponseRecord[]> {
    return this.fetchResponses({ surveyId })
  }

  async listRespondents(): Promise<Respondent[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, full_name, department, position, email')
      .order('full_name')
    if (error) throw mapAuthError(error)
    return (data ?? []).map((row) => ({
      id: (row as ProfileRow).id,
      fullName: (row as ProfileRow).full_name,
      department: (row as ProfileRow).department,
      position: (row as ProfileRow).position,
      email: (row as ProfileRow).email ?? undefined,
    }))
  }

  async getProgress(surveyId: string): Promise<{ responses: number; participants: number }> {
    const [{ count: responses }, { count: participants }] = await Promise.all([
      this.client
        .from('responses')
        .select('id', { count: 'exact', head: true })
        .eq('survey_id', surveyId),
      this.client.from('profiles').select('id', { count: 'exact', head: true }),
    ])
    return { responses: responses ?? 0, participants: participants ?? 0 }
  }

  async deleteResponse(responseId: string): Promise<void> {
    const { error } = await this.client.from('responses').delete().eq('id', responseId)
    if (error) throw mapAuthError(error)
  }
}

function mapResponseRow(row: ResponseWithJoins): ResponseRecord {
  const answers: Record<string, StoredAnswer> = {}
  for (const answer of row.answers ?? []) {
    answers[answer.question_id] = {
      questionId: answer.question_id,
      questionText: answer.question_text,
      questionType: answer.question_type,
      optionLabels: answer.option_labels ?? [],
      valueText: answer.value_text,
      valueNum: answer.value_num,
      comment: answer.comment,
    }
  }
  return {
    id: row.id,
    surveyId: row.survey_id,
    respondent: {
      id: row.profiles?.id ?? row.user_id,
      fullName: row.profiles?.full_name ?? '',
      department: row.profiles?.department ?? '',
      position: row.profiles?.position ?? '',
      email: row.profiles?.email ?? undefined,
    },
    submittedAt: row.submitted_at,
    answers,
  }
}
