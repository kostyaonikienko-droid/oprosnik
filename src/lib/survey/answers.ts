import type { AnswerValue, Question, StoredAnswer } from './types'
import { agreeLabels } from './types'

export function emptyValue(): AnswerValue {
  return {}
}

/** Превращает значение из формы в «плоскую» сохраняемую запись ответа */
export function toStoredAnswer(question: Question, value: AnswerValue | undefined): StoredAnswer {
  const base: StoredAnswer = {
    questionId: question.id,
    questionText: question.text,
    questionType: question.type,
    optionLabels: [],
    valueText: null,
    valueNum: null,
    comment: value?.comment?.trim() ? value.comment.trim() : null,
  }

  if (!value) return base

  switch (question.type) {
    case 'single':
    case 'multi': {
      const indexes = (value.optionIndexes ?? []).filter(
        (index) => index >= 0 && index < question.options.length,
      )
      base.optionLabels = indexes
        .slice()
        .sort((a, b) => a - b)
        .map((index) => question.options[index] as string)
      if (question.type === 'single') {
        const first = indexes[0]
        base.valueNum = indexes.length === 1 && first !== undefined ? first : null
      } else {
        base.valueNum = indexes.length
      }
      break
    }
    case 'agree': {
      if (value.agreePosition !== undefined) {
        base.valueNum = value.agreePosition
        const label = agreeLabels(question.scale)[value.agreePosition - 1]
        base.optionLabels = label ? [label] : []
      }
      break
    }
    case 'number': {
      if (value.number !== undefined && Number.isFinite(value.number)) {
        base.valueNum = value.number
        base.valueText = String(value.number)
      }
      break
    }
    case 'text': {
      const text = value.text?.trim()
      if (text) {
        base.valueText = text
        base.optionLabels = []
      }
      break
    }
  }

  return base
}

export function isAnswered(question: Question, value: AnswerValue | undefined): boolean {
  if (!value) return false
  switch (question.type) {
    case 'single':
      return (value.optionIndexes ?? []).length === 1
    case 'multi':
      return (value.optionIndexes ?? []).length > 0
    case 'agree':
      return value.agreePosition !== undefined
    case 'number':
      return value.number !== undefined && Number.isFinite(value.number)
    case 'text':
      return Boolean(value.text?.trim())
  }
}

/** Текст ошибки для вопроса или null, если ответ корректен */
export function validateAnswer(question: Question, value: AnswerValue | undefined): string | null {
  const answered = isAnswered(question, value)

  if (question.required && !answered) {
    return question.type === 'text'
      ? 'Введите ответ'
      : question.type === 'number'
        ? 'Укажите значение'
        : 'Выберите вариант ответа'
  }

  if (question.type === 'multi') {
    const count = (value?.optionIndexes ?? []).length
    if (question.min !== undefined && count > 0 && count < question.min) {
      return `Выберите минимум ${question.min} вариант(ов)`
    }
    if (question.max !== undefined && count > question.max) {
      return `Можно выбрать не более ${question.max} вариант(ов)`
    }
  }

  if (question.type === 'number' && value?.number !== undefined) {
    if (question.min !== undefined && value.number < question.min) {
      return `Значение должно быть не меньше ${question.min}`
    }
    if (question.max !== undefined && value.number > question.max) {
      return `Значение должно быть не больше ${question.max}`
    }
  }

  if (question.type === 'text' && question.maxlength && (value?.text?.length ?? 0) > question.maxlength) {
    return `Не более ${question.maxlength} символов`
  }

  if (question.comment === 'required' && !value?.comment?.trim()) {
    return 'Добавьте комментарий к ответу'
  }

  return null
}

/** Человекочитаемое представление ответа — для таблиц, карточек и Excel */
export function answerToText(answer: StoredAnswer | undefined): string {
  if (!answer) return ''
  if (answer.optionLabels.length > 0) return answer.optionLabels.join('; ')
  if (answer.valueText) return answer.valueText
  if (answer.valueNum !== null) return String(answer.valueNum)
  return ''
}

/** Ответ вместе с комментарием — для выгрузки и просмотра */
export function answerWithComment(answer: StoredAnswer | undefined): string {
  if (!answer) return ''
  const main = answerToText(answer)
  if (!answer.comment) return main
  return main ? `${main} | Комментарий: ${answer.comment}` : `Комментарий: ${answer.comment}`
}

/** Краткая подпись типа вопроса для интерфейса */
export function questionTypeHint(question: Question): string {
  switch (question.type) {
    case 'single':
      return 'Выберите один вариант'
    case 'multi': {
      const parts = ['Выберите несколько вариантов']
      if (question.max !== undefined) parts.push(`не более ${question.max}`)
      if (question.min !== undefined) parts.push(`не менее ${question.min}`)
      return parts.join(', ')
    }
    case 'agree':
      return 'Отметьте степень согласия'
    case 'number': {
      if (question.min !== undefined && question.max !== undefined) {
        return `Число от ${question.min} до ${question.max}`
      }
      return 'Введите число'
    }
    case 'text':
      return 'Свободный ответ'
  }
}
