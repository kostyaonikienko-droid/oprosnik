import type { Question, ResponseRecord, Survey } from '@/lib/survey'
import { agreeLabels } from '@/lib/survey'
import { agreeThreshold, isNonEmptyAnswer, mean, median } from './aggregate'
import type { Dimension, Measure, PivotGroup, PivotRow, PivotTable, RowKind } from './types'

export interface PivotConfig {
  dimension: Dimension
  measure: Measure
}

const DEFAULT_CONFIG: PivotConfig = { dimension: 'department', measure: 'colPct' }

function columnKey(record: ResponseRecord, dimension: Dimension): string {
  switch (dimension) {
    case 'department':
      return record.respondent.department.trim() || 'Не указано'
    case 'position':
      return record.respondent.position.trim() || 'Не указано'
    case 'all':
      return 'Все респонденты'
  }
}

function buildColumns(records: ResponseRecord[], dimension: Dimension): string[] {
  if (dimension === 'all') return ['Все респонденты']
  const counts = new Map<string, number>()
  for (const record of records) {
    const key = columnKey(record, dimension)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  // Группы с большим числом респондентов идут первыми
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
    .map(([key]) => key)
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/**
 * Кросс-таблица «вопрос/вариант ответа × группа респондентов».
 *
 * База для процентов:
 * - `colPct`    — доля внутри столбца от числа ответивших на вопрос в этой группе;
 * - `rowPct`    — распределение строки между группами (сумма = 100%);
 * - `totalPct`  — доля от всех респондентов группы.
 *
 * Для меры `avg` таблица строится только по числовым вопросам и шкалам
 * согласия: по одной строке на вопрос со средним значением.
 */
export function pivot(
  survey: Survey,
  records: ResponseRecord[],
  config: PivotConfig = DEFAULT_CONFIG,
): PivotTable {
  const columns = buildColumns(records, config.dimension)
  const buckets = new Map<string, ResponseRecord[]>(columns.map((column) => [column, []]))
  for (const record of records) {
    const key = columnKey(record, config.dimension)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(record)
    else buckets.set(key, [record])
  }

  const columnRespondents = columns.map((column) => buckets.get(column)?.length ?? 0)
  const rows: PivotRow[] = []
  const groups: PivotGroup[] = []

  for (const question of survey.questions) {
    const start = rows.length
    const perColumn = columns.map((column) => buckets.get(column) ?? [])

    if (config.measure === 'avg') {
      const row = buildAvgRow(question, perColumn, records)
      if (row) rows.push(row)
    } else {
      rows.push(...buildCountRows(question, perColumn, records))
    }

    if (rows.length > start) {
      groups.push({
        questionId: question.id,
        questionText: question.text,
        questionType: question.type,
        rowIndexes: rows.slice(start).map((_, index) => start + index),
      })
    }
  }

  const table: PivotTable = {
    columns,
    rows: rows.map((row) => applyMeasure(row, config.measure, columnRespondents)),
    groups,
    columnRespondents,
    measure: config.measure,
    dimension: config.dimension,
    grandTotal: records.length,
  }

  return table
}

function answeredCounts(question: Question, perColumn: ResponseRecord[][]): number[] {
  return perColumn.map((records) =>
    records.filter((record) => isNonEmptyAnswer(record.answers[question.id])).length,
  )
}

function buildCountRows(
  question: Question,
  perColumn: ResponseRecord[][],
  allRecords: ResponseRecord[],
): PivotRow[] {
  const answeredByColumn = answeredCounts(question, perColumn)
  const totalAnswered = allRecords.filter((record) =>
    isNonEmptyAnswer(record.answers[question.id]),
  ).length

  const makeRow = (
    key: string,
    label: string,
    kind: RowKind,
    rawCounts: number[],
    rawTotal: number,
  ): PivotRow => ({
    key,
    questionId: question.id,
    questionText: question.text,
    label,
    kind,
    values: [],
    total: null,
    rawCounts,
    rawTotal,
    answeredByColumn,
  })

  const rows: PivotRow[] = []

  if (question.type === 'single' || question.type === 'multi') {
    question.options.forEach((option, index) => {
      const counts = perColumn.map(
        (records) =>
          records.filter((record) =>
            (record.answers[question.id]?.optionLabels ?? []).includes(option),
          ).length,
      )
      const total = allRecords.filter((record) =>
        (record.answers[question.id]?.optionLabels ?? []).includes(option),
      ).length
      rows.push(makeRow(`${question.id}#o${index}`, option, 'option', counts, total))
    })
    return rows
  }

  if (question.type === 'agree') {
    const labels = agreeLabels(question.scale)
    labels.forEach((label, index) => {
      const position = index + 1
      const counts = perColumn.map(
        (records) =>
          records.filter((record) => record.answers[question.id]?.valueNum === position).length,
      )
      const total = allRecords.filter(
        (record) => record.answers[question.id]?.valueNum === position,
      ).length
      rows.push(makeRow(`${question.id}#a${index}`, label, 'option', counts, total))
    })

    const threshold = agreeThreshold(question.scale)
    const agreeingCounts = perColumn.map(
      (records) =>
        records.filter((record) => {
          const value = record.answers[question.id]?.valueNum
          return value !== undefined && value !== null && value <= threshold
        }).length,
    )
    const agreeingTotal = allRecords.filter((record) => {
      const value = record.answers[question.id]?.valueNum
      return value !== undefined && value !== null && value <= threshold
    }).length
    rows.push(
      makeRow(`${question.id}#agree`, 'Доля согласных', 'agreement', agreeingCounts, agreeingTotal),
    )
    return rows
  }

  if (question.type === 'number') {
    const values = (records: ResponseRecord[]) =>
      records
        .map((record) => record.answers[question.id]?.valueNum)
        .filter((value): value is number => value !== undefined && value !== null)

    const columnValues = perColumn.map(values)
    const allValues = values(allRecords)

    rows.push(
      makeRow(
        `${question.id}#answered`,
        'Заполнено ответов',
        'answered',
        columnValues.map((items) => items.length),
        allValues.length,
      ),
    )

    const statRows: { key: string; label: string; kind: RowKind; fn: (v: number[]) => number | null }[] = [
      { key: `${question.id}#mean`, label: 'Среднее', kind: 'mean', fn: (v) => round(mean(v)) },
      { key: `${question.id}#median`, label: 'Медиана', kind: 'median', fn: (v) => median(v) },
      { key: `${question.id}#min`, label: 'Минимум', kind: 'min', fn: (v) => (v.length ? Math.min(...v) : null) },
      { key: `${question.id}#max`, label: 'Максимум', kind: 'max', fn: (v) => (v.length ? Math.max(...v) : null) },
    ]

    for (const stat of statRows) {
      const row = makeRow(stat.key, stat.label, stat.kind, [], 0)
      row.values = columnValues.map(stat.fn)
      row.total = stat.fn(allValues)
      rows.push(row)
    }
    return rows
  }

  // type === 'text'
  rows.push(
    makeRow(
      `${question.id}#answered`,
      'Заполнено ответов',
      'answered',
      answeredByColumn,
      totalAnswered,
    ),
  )
  return rows
}

function buildAvgRow(
  question: Question,
  perColumn: ResponseRecord[][],
  allRecords: ResponseRecord[],
): PivotRow | null {
  const numeric = (records: ResponseRecord[]): number[] =>
    records
      .map((record) => record.answers[question.id]?.valueNum)
      .filter((value): value is number => value !== undefined && value !== null)

  let label = 'Среднее значение'
  let transform: (value: number) => number = (value) => value

  if (question.type === 'agree') {
    label = `Средний балл согласия (1–${question.scale})`
    const scale = question.scale
    transform = (position) => scale + 1 - position
  } else if (question.type !== 'number') {
    return null
  }

  const answeredByColumn = answeredCounts(question, perColumn)
  const row: PivotRow = {
    key: `${question.id}#avg`,
    questionId: question.id,
    questionText: question.text,
    label,
    kind: 'mean',
    values: perColumn.map((records) => round(mean(numeric(records).map(transform)))),
    total: round(mean(numeric(allRecords).map(transform))),
    rawCounts: [],
    rawTotal: 0,
    answeredByColumn,
  }
  return row
}

const STAT_KINDS = new Set<RowKind>(['mean', 'median', 'min', 'max'])

/** Пересчитывает сырые количества в выбранную меру */
function applyMeasure(
  row: PivotRow,
  measure: Measure,
  columnRespondents: number[],
): PivotRow {
  // Среднее, медиана, минимум и максимум уже вычислены — мера их не меняет
  if (row.values.length > 0 && STAT_KINDS.has(row.kind)) return row
  if (measure === 'count') {
    return { ...row, values: row.rawCounts, total: row.rawTotal }
  }

  const percent = (part: number, base: number): number | null =>
    base > 0 ? round((part / base) * 100) : null

  switch (measure) {
    case 'colPct':
      return {
        ...row,
        values: row.rawCounts.map((count, index) =>
          percent(count, row.answeredByColumn[index] ?? 0),
        ),
        total: percent(row.rawTotal, row.answeredByColumn.reduce((sum, n) => sum + n, 0)),
      }
    case 'rowPct':
      return {
        ...row,
        values: row.rawCounts.map((count) => percent(count, row.rawTotal)),
        total: row.rawTotal > 0 ? 100 : null,
      }
    case 'totalPct':
      return {
        ...row,
        values: row.rawCounts.map((count, index) => percent(count, columnRespondents[index] ?? 0)),
        total: percent(row.rawTotal, columnRespondents.reduce((sum, n) => sum + n, 0)),
      }
    default:
      return { ...row, values: row.rawCounts, total: row.rawTotal }
  }
}

export function isPercentMeasure(measure: Measure): boolean {
  return measure === 'colPct' || measure === 'rowPct' || measure === 'totalPct'
}
