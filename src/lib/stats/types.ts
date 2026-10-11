import type { QuestionType } from '@/lib/survey'

export type Measure = 'count' | 'colPct' | 'rowPct' | 'totalPct' | 'avg'

export type Dimension = 'all' | 'department' | 'position'

export const MEASURE_LABELS: Record<Measure, string> = {
  count: 'Количество',
  colPct: '% внутри столбца',
  rowPct: '% внутри строки',
  totalPct: '% от общего числа',
  avg: 'Среднее значение',
}

export const DIMENSION_LABELS: Record<Dimension, string> = {
  all: 'Все респонденты',
  department: 'Подразделение',
  position: 'Должность',
}

export type RowKind = 'option' | 'mean' | 'median' | 'min' | 'max' | 'answered' | 'agreement'

export const ROW_KIND_LABELS: Record<RowKind, string> = {
  option: 'Вариант ответа',
  mean: 'Среднее',
  median: 'Медиана',
  min: 'Минимум',
  max: 'Максимум',
  answered: 'Заполнено ответов',
  agreement: 'Индекс согласия',
}

export interface PivotRow {
  key: string
  questionId: string
  questionText: string
  label: string
  kind: RowKind
  /** Значения меры по столбцам; null — метрика неприменима к этой группе */
  values: (number | null)[]
  /** Значение меры по всем респондентам */
  total: number | null
  /** Исходное количество ответов по столбцам (до применения меры) */
  rawCounts: number[]
  rawTotal: number
  /** Число ответивших на вопрос в каждом столбце — база для процентов */
  answeredByColumn: number[]
}

export interface PivotGroup {
  questionId: string
  questionText: string
  questionType: QuestionType
  /** Индексы строк, относящихся к вопросу */
  rowIndexes: number[]
}

export interface PivotTable {
  columns: string[]
  rows: PivotRow[]
  groups: PivotGroup[]
  /** Число респондентов в каждом столбце */
  columnRespondents: number[]
  /** Число ответивших на вопрос в каждом столбце — используется как база процентов */
  measure: Measure
  dimension: Dimension
  grandTotal: number
}

export interface OptionStat {
  label: string
  count: number
  /** Доля от числа ответивших на вопрос */
  ratio: number
  /** Доля от общего числа респондентов */
  ratioOfTotal: number
}

export interface TextAnswer {
  responseId: string
  respondent: string
  department: string
  position: string
  text: string
  comment: string | null
  submittedAt: string
}

export interface CommentItem {
  responseId: string
  respondent: string
  department: string
  questionText: string
  comment: string
}

export interface NumberStat {
  mean: number | null
  median: number | null
  min: number | null
  max: number | null
  count: number
  /** Распределение по целым значениям — для гистограммы */
  histogram: { value: number; count: number }[]
}

export interface QuestionStat {
  questionId: string
  questionText: string
  questionType: QuestionType
  description?: string
  /** Общее число респондентов в выборке */
  total: number
  /** Сколько из них ответили на вопрос */
  answered: number
  skipped: number
  responseRate: number
  options: OptionStat[]
  number: NumberStat | null
  /** Только для `agree`: доля ответивших «согласен» и «скорее согласен» */
  agreementIndex: number | null
  /** Только для `agree`: средний балл согласия 1..scale, чем выше, тем больше согласие */
  agreementMean: number | null
  agreeScale: number | null
  texts: TextAnswer[]
  comments: CommentItem[]
}

export interface GroupStat {
  key: string
  respondents: number
  ratio: number
}

export interface SurveyStats {
  surveyId: string
  surveyTitle: string
  respondents: number
  registeredParticipants: number
  completionRate: number
  questions: QuestionStat[]
  byDepartment: GroupStat[]
  byPosition: GroupStat[]
  /** Хронология сдачи ответов — для графика активности */
  timeline: { date: string; count: number }[]
  comments: CommentItem[]
}
