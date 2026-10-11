import type { Question, QuestionType } from '@/lib/survey/types'

export const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string; hint: string }[] = [
  { value: 'single', label: 'Одиночный выбор', hint: 'один вариант из списка' },
  { value: 'multi', label: 'Множественный выбор', hint: 'несколько галочек' },
  { value: 'agree', label: 'Согласие с утверждением', hint: 'шкала от «согласен» до «не согласен»' },
  { value: 'number', label: 'Числовая оценка', hint: 'число или слайдер' },
  { value: 'text', label: 'Свободный ответ', hint: 'текстовое поле' },
]

export const COMMENT_MODE_OPTIONS = [
  { value: 'off', label: 'Без комментария' },
  { value: 'optional', label: 'Комментарий (необязательно)' },
  { value: 'required', label: 'Комментарий (обязательно)' },
] as const

export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик — не виден участникам' },
  { value: 'active', label: 'Активен — принимает ответы' },
  { value: 'closed', label: 'Закрыт — только просмотр результатов' },
] as const

/** Следующий свободный id вида q1, q2, q3 … */
export function nextQuestionId(questions: Question[]): string {
  let max = 0
  for (const question of questions) {
    const match = /^q(\d+)$/i.exec(question.id)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `q${Math.max(max, questions.length) + 1}`
}

/** Заготовка нового вопроса выбранного типа */
export function createQuestion(type: QuestionType, id: string): Question {
  const base = { id, text: '', required: false, comment: 'off' as const }

  switch (type) {
    case 'single':
      return { ...base, type: 'single', options: ['Вариант 1', 'Вариант 2'] }
    case 'multi':
      return { ...base, type: 'multi', options: ['Вариант 1', 'Вариант 2', 'Вариант 3'] }
    case 'agree':
      return { ...base, type: 'agree', scale: 5 }
    case 'number':
      return { ...base, type: 'number', min: 1, max: 10 }
    case 'text':
      return { ...base, type: 'text', rows: 4 }
  }
}

/** Меняет тип вопроса, сохраняя текст, обязательность и комментарий */
export function changeQuestionType(question: Question, type: QuestionType): Question {
  const preserved = {
    id: question.id,
    text: question.text,
    description: question.description,
    required: question.required,
    comment: question.comment,
  }

  switch (type) {
    case 'single':
      return {
        ...preserved,
        type: 'single',
        options: question.type === 'single' || question.type === 'multi' ? question.options : ['Вариант 1', 'Вариант 2'],
      }
    case 'multi':
      return {
        ...preserved,
        type: 'multi',
        options: question.type === 'single' || question.type === 'multi' ? question.options : ['Вариант 1', 'Вариант 2'],
      }
    case 'agree':
      return { ...preserved, type: 'agree', scale: question.type === 'agree' ? question.scale : 5 }
    case 'number':
      return {
        ...preserved,
        type: 'number',
        min: question.type === 'number' ? question.min : 1,
        max: question.type === 'number' ? question.max : 10,
        step: question.type === 'number' ? question.step : undefined,
        slider: question.type === 'number' ? question.slider : undefined,
      }
    case 'text':
      return {
        ...preserved,
        type: 'text',
        rows: question.type === 'text' ? question.rows : 4,
        maxlength: question.type === 'text' ? question.maxlength : undefined,
      }
  }
}

/** Пустой опрос с осмысленным id по умолчанию */
export function createEmptySurvey(): import('@/lib/survey/types').Survey {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return {
    id: `opros-${year}-${month}`,
    title: '',
    status: 'draft',
    intro: '',
    questions: [],
    origin: 'published',
    version: 1,
  }
}
