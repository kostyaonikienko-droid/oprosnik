import type { Survey } from './types'

export type IssueLevel = 'error' | 'warning'

export interface ValidationIssue {
  level: IssueLevel
  /** Номер вопроса (0-based) внутри опроса, если проблема относится к вопросу */
  questionIndex: number | null
  message: string
}

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Проверки одного опроса: то, что не ловит zod-схема */
export function validateSurvey(survey: Survey): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!ID_PATTERN.test(survey.id)) {
    issues.push({
      level: 'error',
      questionIndex: null,
      message: `id опроса «${survey.id}» должен содержать только латиницу, цифры, - и _`,
    })
  }

  if (survey.startsAt && !isValidDate(survey.startsAt)) {
    issues.push({
      level: 'error',
      questionIndex: null,
      message: `starts_at «${survey.startsAt}» не является корректной датой ГГГГ-ММ-ДД`,
    })
  }
  if (survey.endsAt && !isValidDate(survey.endsAt)) {
    issues.push({
      level: 'error',
      questionIndex: null,
      message: `ends_at «${survey.endsAt}» не является корректной датой ГГГГ-ММ-ДД`,
    })
  }
  if (
    survey.startsAt &&
    survey.endsAt &&
    isValidDate(survey.startsAt) &&
    isValidDate(survey.endsAt) &&
    survey.endsAt < survey.startsAt
  ) {
    issues.push({
      level: 'error',
      questionIndex: null,
      message: `ends_at (${survey.endsAt}) раньше starts_at (${survey.startsAt})`,
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  if (survey.status === 'active' && survey.endsAt && survey.endsAt < today) {
    issues.push({
      level: 'warning',
      questionIndex: null,
      message: `Опрос помечен как active, но ends_at (${survey.endsAt}) уже прошёл`,
    })
  }

  if (survey.questions.length === 0) {
    issues.push({ level: 'error', questionIndex: null, message: 'В опросе нет ни одного вопроса' })
  }

  const seenIds = new Map<string, number>()
  survey.questions.forEach((question, index) => {
    if (!ID_PATTERN.test(question.id)) {
      issues.push({
        level: 'warning',
        questionIndex: index,
        message: `id вопроса «${question.id}» лучше задать латиницей (например q1)`,
      })
    }

    const previous = seenIds.get(question.id)
    if (previous !== undefined) {
      issues.push({
        level: 'error',
        questionIndex: index,
        message: `id вопроса «${question.id}» повторяется (уже использован в вопросе №${previous + 1})`,
      })
    } else {
      seenIds.set(question.id, index)
    }

    if (!question.text.trim()) {
      issues.push({ level: 'error', questionIndex: index, message: 'Пустой текст вопроса' })
    }

    if (question.type === 'single' || question.type === 'multi') {
      const labels = question.options.map((option) => option.trim().toLowerCase())
      const unique = new Set(labels)
      if (unique.size !== labels.length) {
        issues.push({
          level: 'error',
          questionIndex: index,
          message: `Вопрос «${question.text}»: есть повторяющиеся варианты ответа`,
        })
      }
      if (question.options.some((option) => !option.trim())) {
        issues.push({
          level: 'error',
          questionIndex: index,
          message: `Вопрос «${question.text}»: есть пустой вариант ответа`,
        })
      }
    }

    if (question.type === 'multi') {
      const total = question.options.length
      if (question.max !== undefined && question.max > total) {
        issues.push({
          level: 'error',
          questionIndex: index,
          message: `Вопрос «${question.text}»: max=${question.max} больше числа вариантов (${total})`,
        })
      }
      if (
        question.min !== undefined &&
        question.max !== undefined &&
        question.min > question.max
      ) {
        issues.push({
          level: 'error',
          questionIndex: index,
          message: `Вопрос «${question.text}»: min=${question.min} больше max=${question.max}`,
        })
      }
      if (question.min !== undefined && question.min > total) {
        issues.push({
          level: 'error',
          questionIndex: index,
          message: `Вопрос «${question.text}»: min=${question.min} больше числа вариантов (${total})`,
        })
      }
    }

    if (question.type === 'number') {
      if (
        question.min !== undefined &&
        question.max !== undefined &&
        question.min >= question.max
      ) {
        issues.push({
          level: 'error',
          questionIndex: index,
          message: `Вопрос «${question.text}»: min должен быть меньше max`,
        })
      }
      if (question.slider && (question.min === undefined || question.max === undefined)) {
        issues.push({
          level: 'warning',
          questionIndex: index,
          message: `Вопрос «${question.text}»: для slider желательно задать min и max`,
        })
      }
    }

    if (question.type === 'text' && question.maxlength !== undefined && question.maxlength < 10) {
      issues.push({
        level: 'warning',
        questionIndex: index,
        message: `Вопрос «${question.text}»: maxlength=${question.maxlength} слишком мал для развёрнутого ответа`,
      })
    }
  })

  return issues
}

/** Проверки набора опросов: уникальность id и единственная активная сессия */
export function validateSurveySet(surveys: Survey[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const byId = new Map<string, number>()

  surveys.forEach((survey, index) => {
    const previous = byId.get(survey.id)
    if (previous !== undefined) {
      issues.push({
        level: 'error',
        questionIndex: null,
        message: `id опроса «${survey.id}» встречается дважды (файлы №${previous + 1} и №${index + 1})`,
      })
    } else {
      byId.set(survey.id, index)
    }
  })

  const active = surveys.filter((survey) => survey.status === 'active')
  if (active.length > 1) {
    issues.push({
      level: 'error',
      questionIndex: null,
      message: `Активным может быть только один опрос, сейчас их ${active.length}: ${active
        .map((survey) => survey.id)
        .join(', ')}`,
    })
  }

  return issues
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.level === 'error')
}
