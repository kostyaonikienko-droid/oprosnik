import { AppError } from '@/lib/errors'
import { errorIssues, parseSurveyMarkdown, warningIssues } from './parse'
import type { Survey } from './types'
import { validateSurvey } from './validate'

export interface PreparedSurvey {
  survey: Survey
  warnings: string[]
}

function withLine(line: number | null, message: string): string {
  return line === null ? message : `строка ${line}: ${message}`
}

/**
 * Разбор и проверка markdown перед публикацией. Используется и мок-бэкендом,
 * и Supabase, чтобы правила валидации не разъезжались между режимами.
 *
 * Бросает AppError('validation') с перечнем блокирующих проблем.
 */
export function prepareSurveyFromMarkdown(markdown: string): PreparedSurvey {
  const parsed = parseSurveyMarkdown(markdown)

  if (!parsed.ok) {
    const blocking = errorIssues(parsed.issues)
    const problems = (blocking.length > 0 ? blocking : parsed.issues).map((issue) =>
      withLine(issue.line, issue.message),
    )
    throw new AppError('validation', problems.join('\n'))
  }

  const warnings = warningIssues(parsed.issues).map((issue) => withLine(issue.line, issue.message))

  for (const issue of validateSurvey(parsed.survey)) {
    if (issue.level === 'error') {
      throw new AppError('validation', issue.message)
    }
    warnings.push(issue.message)
  }

  return { survey: parsed.survey, warnings }
}
