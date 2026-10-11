import ExcelJS from 'exceljs'
import type { ResponseRecord, Survey } from '@/lib/survey'
import { answerWithComment } from '@/lib/survey/answers'
import type { SurveyStats } from '@/lib/stats'
import { pivot } from '@/lib/stats'
import { formatDate, formatDateTime } from '@/lib/format'

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF006E4C' },
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
}

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE1E3E6' } },
  left: { style: 'thin', color: { argb: 'FFE1E3E6' } },
  bottom: { style: 'thin', color: { argb: 'FFE1E3E6' } },
  right: { style: 'thin', color: { argb: 'FFE1E3E6' } },
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.height = 24
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = BORDER
  })
}

function applyBorders(worksheet: ExcelJS.Worksheet, fromRow = 2): void {
  for (let index = fromRow; index <= worksheet.rowCount; index += 1) {
    worksheet.getRow(index).eachCell((cell) => {
      cell.border = BORDER
      cell.alignment = { ...(cell.alignment ?? {}), vertical: 'top', wrapText: true }
    })
  }
}

/** Лист «Сводная»: вариант ответа × подразделение/должность */
function buildPivotSheet(
  workbook: ExcelJS.Workbook,
  survey: Survey,
  records: ResponseRecord[],
  percent: boolean,
): void {
  const worksheet = workbook.addWorksheet(percent ? 'Сводная, %' : 'Сводная')
  const table = pivot(survey, records, {
    dimension: 'department',
    measure: percent ? 'colPct' : 'count',
  })

  worksheet.columns = [
    { header: 'Вопрос', key: 'question', width: 52 },
    { header: 'Вариант / показатель', key: 'label', width: 34 },
    ...table.columns.map((column, index) => ({
      header: column,
      key: `col${index}`,
      width: 18,
    })),
    { header: 'Итого', key: 'total', width: 14 },
  ]

  for (const row of table.rows) {
    const values = row.values.map((value) =>
      value === null ? '' : percent ? Number((value / 100).toFixed(4)) : value,
    )
    const added = worksheet.addRow({
      question: row.questionText,
      label: row.label,
      ...Object.fromEntries(values.map((value, index) => [`col${index}`, value])),
      total: row.total === null ? '' : percent ? Number((row.total / 100).toFixed(4)) : row.total,
    })
    if (percent) {
      added.eachCell((cell, colNumber) => {
        if (colNumber > 2) cell.numFmt = '0.0%'
      })
    }
  }

  styleHeaderRow(worksheet.getRow(1))
  worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
  applyBorders(worksheet)
}

/** Лист «Статистика»: частоты и доли по каждому вопросу */
function buildStatsSheet(workbook: ExcelJS.Workbook, stats: SurveyStats): void {
  const worksheet = workbook.addWorksheet('Статистика')
  worksheet.columns = [
    { header: '№', key: 'index', width: 5 },
    { header: 'Вопрос', key: 'question', width: 52 },
    { header: 'Тип', key: 'type', width: 12 },
    { header: 'Показатель', key: 'label', width: 34 },
    { header: 'Значение', key: 'value', width: 14 },
    { header: 'Доля', key: 'ratio', width: 12 },
  ]

  stats.questions.forEach((question, questionIndex) => {
    const common = {
      index: questionIndex + 1,
      question: question.questionText,
      type: question.questionType,
    }

    for (const option of question.options) {
      const row = worksheet.addRow({
        ...common,
        label: option.label,
        value: option.count,
        ratio: Number(option.ratio.toFixed(4)),
      })
      row.getCell('ratio').numFmt = '0.0%'
    }

    if (question.number) {
      worksheet.addRow({ ...common, label: 'Среднее', value: round(question.number.mean) })
      worksheet.addRow({ ...common, label: 'Медиана', value: round(question.number.median) })
      worksheet.addRow({ ...common, label: 'Минимум', value: question.number.min })
      worksheet.addRow({ ...common, label: 'Максимум', value: question.number.max })
    }

    if (question.agreementIndex !== null) {
      const row = worksheet.addRow({
        ...common,
        label: 'Индекс согласия',
        value: Number(question.agreementIndex.toFixed(4)),
      })
      row.getCell('value').numFmt = '0.0%'
    }
    if (question.agreementMean !== null) {
      worksheet.addRow({ ...common, label: 'Средний балл согласия', value: round(question.agreementMean) })
    }

    worksheet.addRow({ ...common, label: 'Ответило', value: question.answered })
    worksheet.addRow({ ...common, label: 'Пропустило', value: question.skipped })
    worksheet.addRow({})
  })

  styleHeaderRow(worksheet.getRow(1))
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  applyBorders(worksheet)
}

/** Лист «Ответы»: одна строка на респондента, по колонке на вопрос */
function buildResponsesSheet(
  workbook: ExcelJS.Workbook,
  survey: Survey,
  records: ResponseRecord[],
): void {
  const worksheet = workbook.addWorksheet('Ответы')
  worksheet.columns = [
    { header: 'ФИО', key: 'name', width: 34 },
    { header: 'Подразделение', key: 'department', width: 32 },
    { header: 'Должность', key: 'position', width: 26 },
    { header: 'Отправлено', key: 'submittedAt', width: 20 },
    ...survey.questions.map((question, index) => ({
      header: `${index + 1}. ${question.text}`,
      key: `q${question.id}`,
      width: 40,
    })),
  ]

  for (const record of records) {
    worksheet.addRow({
      name: record.respondent.fullName,
      department: record.respondent.department,
      position: record.respondent.position,
      submittedAt: formatDateTime(record.submittedAt),
      ...Object.fromEntries(
        survey.questions.map((question) => [
          `q${question.id}`,
          answerWithComment(record.answers[question.id]) || '—',
        ]),
      ),
    })
  }

  styleHeaderRow(worksheet.getRow(1))
  worksheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  applyBorders(worksheet)
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  }
}

/** Лист «Комментарии»: все свободные комментарии респондентов */
function buildCommentsSheet(workbook: ExcelJS.Workbook, stats: SurveyStats): void {
  const worksheet = workbook.addWorksheet('Комментарии')
  worksheet.columns = [
    { header: 'Вопрос', key: 'question', width: 52 },
    { header: 'ФИО', key: 'name', width: 32 },
    { header: 'Подразделение', key: 'department', width: 32 },
    { header: 'Комментарий', key: 'comment', width: 70 },
  ]

  for (const comment of stats.comments) {
    worksheet.addRow({
      question: comment.questionText,
      name: comment.respondent,
      department: comment.department,
      comment: comment.comment,
    })
  }

  styleHeaderRow(worksheet.getRow(1))
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  applyBorders(worksheet)
}

/** Лист «Обзор»: метрики опроса и распределение по группам */
function buildOverviewSheet(workbook: ExcelJS.Workbook, survey: Survey, stats: SurveyStats): void {
  const worksheet = workbook.addWorksheet('Обзор')
  worksheet.columns = [
    { header: 'Показатель', key: 'label', width: 40 },
    { header: 'Значение', key: 'value', width: 24 },
  ]

  worksheet.addRow({ label: 'Опрос', value: survey.title })
  worksheet.addRow({ label: 'Идентификатор', value: survey.id })
  worksheet.addRow({ label: 'Статус', value: survey.status })
  worksheet.addRow({ label: 'Период', value: `${formatDate(survey.startsAt)} — ${formatDate(survey.endsAt)}` })
  worksheet.addRow({ label: 'Собрано ответов', value: stats.respondents })
  worksheet.addRow({ label: 'Зарегистрировано участников', value: stats.registeredParticipants })
  worksheet.addRow({ label: 'Доля прошедших', value: Number(stats.completionRate.toFixed(4)) })
  worksheet.addRow({ label: 'Вопросов в опросе', value: survey.questions.length })
  worksheet.addRow({ label: 'Выгружено', value: formatDateTime(new Date().toISOString()) })
  worksheet.getRow(worksheet.rowCount).getCell('value').numFmt = 'dd.mm.yyyy hh:mm'
  worksheet.getRow(7).getCell('value').numFmt = '0.0%'

  worksheet.addRow({})
  worksheet.addRow({ label: 'По подразделениям', value: '' })
  for (const group of stats.byDepartment) {
    const row = worksheet.addRow({ label: group.key, value: group.respondents })
    row.getCell('value').numFmt = '0'
  }

  worksheet.addRow({})
  worksheet.addRow({ label: 'По должностям', value: '' })
  for (const group of stats.byPosition) {
    worksheet.addRow({ label: group.key, value: group.respondents })
  }

  styleHeaderRow(worksheet.getRow(1))
  applyBorders(worksheet)
}

function round(value: number | null): number | string {
  return value === null ? '' : Number(value.toFixed(2))
}

/**
 * Формирует и скачивает .xlsx с листами:
 * Обзор · Сводная · Сводная, % · Статистика · Ответы · Комментарии
 */
export async function exportSurveyXlsx(
  survey: Survey,
  stats: SurveyStats,
  records: ResponseRecord[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Опросник'
  workbook.created = new Date()

  buildOverviewSheet(workbook, survey, stats)
  buildPivotSheet(workbook, survey, records, false)
  buildPivotSheet(workbook, survey, records, true)
  buildStatsSheet(workbook, stats)
  buildResponsesSheet(workbook, survey, records)
  buildCommentsSheet(workbook, stats)

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${survey.id}-результаты-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
