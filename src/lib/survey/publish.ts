import { AppError } from '@/lib/errors'
import { parseSurveyMarkdown, validateSurvey } from '@/lib/survey'
import type { Survey } from '@/lib/survey'

export interface PreparedSurvey {
  survey: Survey
  warnings: string[]
}

/**
 * Разбор и проверка markdown перед публикацией. Используется и мок-бэкендом,
 * и Supabase, чтобы правила валидации не разъезжались между режимами.
 *
 * Бросает AppError('validation') с перечнем критичных проблем.
 */
export function prepareSurveyFromMarkdown(markdown: string): PreparedSurvey {
  const parsed = parseSurveyMarkdown(markdown)
  if (!parsed.ok) {
    throw new AppError(
      'validation',
      parsed.issues
        .map((issue) => (issue.line ? `строка ${issue.line}: ${issue.message}` : issue.message))
        .join('\n'),
    )
  }

  const warnings = parsed.issues.map((issue) =>
    issue.line ? `строка ${issue.line}: ${issue.message}` : issue.message,
  )

  const structural = validateSurvey(parsed.survey)
  const errors = structural.filter((issue) => issue.level === 'error')
  if (errors.length > 0) {
    throw new AppError('validation', errors.map((issue) => issue.message).join('\n'))
  }
  warnings.push(...structural.filter((issue) => issue.level === 'warning').map((i) => i.message))

  return { survey: parsed.survey, warnings }
}
