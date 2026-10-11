import type {
  AnswerValue,
  Question,
  ResponseRecord,
  StoredAnswer,
  Survey,
} from '@/lib/survey'
import { agreeLabels } from '@/lib/survey'
import { safeRatio } from '@/lib/format'
import type {
  CommentItem,
  GroupStat,
  NumberStat,
  OptionStat,
  QuestionStat,
  SurveyStats,
  TextAnswer,
} from './types'

/** Ответ считается заполненным, если есть хотя бы одно значение */
export function isNonEmptyAnswer(answer: StoredAnswer | undefined): boolean {
  if (!answer) return false
  return (
    answer.optionLabels.length > 0 || answer.valueText !== null || answer.valueNum !== null
  )
}

/** Порог «согласия»: какие позиции шкалы считаем положительным ответом */
export function agreeThreshold(scale: 5 | 7): number {
  return scale === 5 ? 2 : 3
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? null
  const low = sorted[middle - 1] ?? 0
  const high = sorted[middle] ?? 0
  return (low + high) / 2
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function countGroup(records: ResponseRecord[], pick: (r: ResponseRecord) => string): GroupStat[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    const key = pick(record).trim() || 'Не указано'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = records.length
  return [...counts.entries()]
    .map(([key, count]) => ({ key, respondents: count, ratio: safeRatio(count, total) }))
    .sort((a, b) => b.respondents - a.respondents || a.key.localeCompare(b.key, 'ru'))
}

function buildTimeline(records: ResponseRecord[]): { date: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    const date = record.submittedAt.slice(0, 10)
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))
}

/**
 * Полная статистика по опросу. Функция чистая: не знает ни о бэкенде,
 * ни о React, поэтому легко покрывается тестами и переиспользуется
 * в дашборде, сводной таблице и Excel-экспорте.
 */
export function aggregate(
  survey: Survey,
  records: ResponseRecord[],
  registeredParticipants = records.length,
): SurveyStats {
  const total = records.length
  const questions = survey.questions.map((question) =>
    questionStat(question, records, total),
  )
  const comments = questions.flatMap((stat) => stat.comments)

  return {
    surveyId: survey.id,
    surveyTitle: survey.title,
    respondents: total,
    registeredParticipants,
    completionRate: safeRatio(total, registeredParticipants),
    questions,
    byDepartment: countGroup(records, (record) => record.respondent.department),
    byPosition: countGroup(records, (record) => record.respondent.position),
    timeline: buildTimeline(records),
    comments,
  }
}

function questionStat(
  question: Question,
  records: ResponseRecord[],
  total: number,
): QuestionStat {
  const options: OptionStat[] = []
  const texts: TextAnswer[] = []
  const comments: CommentItem[] = []
  const numbers: number[] = []
  const agreePositions: number[] = []
  let answered = 0

  const scale = question.type === 'agree' ? question.scale : null
  const labels = scale ? agreeLabels(scale) : []

  // Для вариантов ответа и шкалы согласия заранее заводим счётчики,
  // чтобы в таблице были и нулевые значения
  const optionCounts = new Map<string, number>()
  if (question.type === 'single' || question.type === 'multi') {
    for (const option of question.options) optionCounts.set(option, 0)
  } else if (scale) {
    for (const label of labels) optionCounts.set(label, 0)
  }

  for (const record of records) {
    const answer = record.answers[question.id]
    if (answer?.comment) {
      comments.push({
        responseId: record.id,
        respondent: record.respondent.fullName,
        department: record.respondent.department,
        questionText: question.text,
        comment: answer.comment,
      })
    }
    if (!isNonEmptyAnswer(answer)) continue
    answered += 1

    if (answer) {
      if (question.type === 'single' || question.type === 'multi') {
        for (const label of answer.optionLabels) {
          optionCounts.set(label, (optionCounts.get(label) ?? 0) + 1)
        }
      } else if (scale && answer.valueNum !== null) {
        agreePositions.push(answer.valueNum)
        const label = labels[answer.valueNum - 1]
        if (label) optionCounts.set(label, (optionCounts.get(label) ?? 0) + 1)
      } else if (question.type === 'number' && answer.valueNum !== null) {
        numbers.push(answer.valueNum)
      } else if (question.type === 'text' && answer.valueText) {
        texts.push({
          responseId: record.id,
          respondent: record.respondent.fullName,
          department: record.respondent.department,
          position: record.respondent.position,
          text: answer.valueText,
          comment: answer.comment,
          submittedAt: record.submittedAt,
        })
      }
    }
  }

  for (const [label, count] of optionCounts) {
    options.push({
      label,
      count,
      ratio: safeRatio(count, answered),
      ratioOfTotal: safeRatio(count, total),
    })
  }

  const threshold = scale ? agreeThreshold(scale) : 0
  const agreementIndex =
    scale && answered > 0
      ? safeRatio(
          agreePositions.filter((position) => position <= threshold).length,
          answered,
        )
      : null
  // Переводим позицию в балл согласия: чем выше, тем больше согласие
  const agreementMean =
    scale && agreePositions.length > 0
      ? (mean(agreePositions.map((position) => scale + 1 - position)) ?? null)
      : null

  return {
    questionId: question.id,
    questionText: question.text,
    questionType: question.type,
    description: question.description,
    total,
    answered,
    skipped: Math.max(total - answered, 0),
    responseRate: safeRatio(answered, total),
    options,
    number: numberStat(numbers),
    agreementIndex,
    agreementMean,
    agreeScale: scale,
    texts,
    comments,
  }
}

function numberStat(values: number[]): NumberStat | null {
  if (values.length === 0) return null
  const counts = new Map<number, number>()
  for (const value of values) {
    const rounded = Math.round(value)
    counts.set(rounded, (counts.get(rounded) ?? 0) + 1)
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const histogram: { value: number; count: number }[] = []
  for (let value = Math.floor(min); value <= Math.ceil(max); value += 1) {
    histogram.push({ value, count: counts.get(value) ?? 0 })
  }
  return {
    mean: mean(values),
    median: median(values),
    min,
    max,
    count: values.length,
    histogram,
  }
}

export type { AnswerValue }
