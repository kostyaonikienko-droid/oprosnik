/**
 * Доменные типы опросника.
 *
 * Важное соглашение: `StoredAnswer` — это «плоская» запись ответа, которая
 * один в один соответствует строке таблицы `answers` в Supabase и строке
 * в Excel-выгрузке. В ней всегда хранится слепок текста вопроса, поэтому
 * последующие правки определения опроса не ломают историю.
 */

export const QUESTION_TYPES = ['single', 'multi', 'agree', 'number', 'text'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const SURVEY_STATUSES = ['draft', 'active', 'closed'] as const
export type SurveyStatus = (typeof SURVEY_STATUSES)[number]

export const COMMENT_MODES = ['off', 'optional', 'required'] as const
export type CommentMode = (typeof COMMENT_MODES)[number]

export type AgreeScale = 5 | 7

/** Шкалы согласия. Индекс 0 = максимальное согласие. */
export const AGREE_LABELS: Record<AgreeScale, readonly string[]> = {
  5: ['Согласен', 'Скорее согласен', 'Нейтрально', 'Скорее не согласен', 'Не согласен'],
  7: [
    'Полностью согласен',
    'Согласен',
    'Скорее согласен',
    'Нейтрально',
    'Скорее не согласен',
    'Не согласен',
    'Полностью не согласен',
  ],
}

export interface QuestionBase {
  /** Уникальный в пределах опроса идентификатор, например `q1` */
  id: string
  /** Текст вопроса */
  text: string
  /** Необязательная подсказка под вопросом */
  description?: string
  required: boolean
  /** Нужен ли к вопросу дополнительный комментарий */
  comment: CommentMode
}

export interface SingleQuestion extends QuestionBase {
  type: 'single'
  options: string[]
  shuffle?: boolean
}

export interface MultiQuestion extends QuestionBase {
  type: 'multi'
  options: string[]
  /** Минимум и максимум выбираемых вариантов */
  min?: number
  max?: number
  shuffle?: boolean
}

export interface AgreeQuestion extends QuestionBase {
  type: 'agree'
  scale: AgreeScale
}

export interface NumberQuestion extends QuestionBase {
  type: 'number'
  min?: number
  max?: number
  step?: number
  /** Показывать слайдер вместо поля ввода */
  slider?: boolean
}

export interface TextQuestion extends QuestionBase {
  type: 'text'
  rows?: number
  maxlength?: number
}

export type Question =
  | SingleQuestion
  | MultiQuestion
  | AgreeQuestion
  | NumberQuestion
  | TextQuestion

export interface Survey {
  id: string
  title: string
  status: SurveyStatus
  /** Приветственный текст в markdown, показывается до первого вопроса */
  intro: string
  /** ISO-дата `YYYY-MM-DD` */
  startsAt?: string
  endsAt?: string
  questions: Question[]
  /** Откуда взято определение: seed-файл из репозитория или публикация из приложения */
  origin: 'seed' | 'published'
  version: number
  updatedAt?: string
}

/** Значение ответа в форме (до сохранения) */
export interface AnswerValue {
  /** Индексы выбранных вариантов для single/multi */
  optionIndexes?: number[]
  /** Для agree — позиция в шкале, 1-based (1 = «Согласен») */
  agreePosition?: number
  number?: number
  text?: string
  comment?: string
}

/** Сохранённый ответ — строка таблицы `answers` */
export interface StoredAnswer {
  questionId: string
  questionText: string
  questionType: QuestionType
  /** Выбранные варианты (для single — ровно один, иначе пустой массив) */
  optionLabels: string[]
  /** Текстовый ответ */
  valueText: string | null
  /**
   * Числовой ответ.
   * Для `agree` — позиция в шкале, 1-based (1 = «Согласен», чем меньше, тем выше согласие).
   * Для `number` — введённое число.
   */
  valueNum: number | null
  comment: string | null
}

export interface Respondent {
  id: string
  fullName: string
  department: string
  position: string
  email?: string
}

export interface ResponseRecord {
  id: string
  surveyId: string
  respondent: Respondent
  submittedAt: string
  /** Ключ — id вопроса */
  answers: Record<string, StoredAnswer>
}

/** Черновик заполнения, который живёт в localStorage участника */
export interface DraftState {
  surveyId: string
  values: Record<string, AnswerValue>
  savedAt: string
}

export function isChoiceQuestion(q: Question): q is SingleQuestion | MultiQuestion {
  return q.type === 'single' || q.type === 'multi'
}

export function questionSupportsStats(q: Question): boolean {
  return q.type !== 'text'
}

/** Подписи шкалы согласия для конкретной длины */
export function agreeLabels(scale: AgreeScale): readonly string[] {
  return AGREE_LABELS[scale]
}

/**
 * Нормированный балл согласия 0..1, где 1 = «Согласен».
 * position — 1-based позиция в шкале.
 */
export function agreementScore(position: number, scale: AgreeScale): number {
  if (scale <= 1) return 1
  return (scale - position) / (scale - 1)
}
