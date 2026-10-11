import { describe, expect, it } from 'vitest'
import {
  changeQuestionType,
  createEmptySurvey,
  createQuestion,
  nextQuestionId,
} from './questionTemplates'
import type { Question } from '@/lib/survey/types'

describe('nextQuestionId', () => {
  it('возвращает q1 для пустого списка', () => {
    expect(nextQuestionId([])).toBe('q1')
  })

  it('продолжает нумерацию по максимальному числовому суффиксу', () => {
    const questions = [
      { id: 'q1' },
      { id: 'q5' },
      { id: 'q3' },
    ] as unknown as Question[]
    expect(nextQuestionId(questions)).toBe('q6')
  })

  it('не конфликтует с id без числового суффикса', () => {
    const questions = [{ id: 'about-job' }, { id: 'x' }] as unknown as Question[]
    expect(nextQuestionId(questions)).toBe('q3')
  })
})

describe('createQuestion', () => {
  it('создает single с двумя вариантами', () => {
    const question = createQuestion('single', 'q1')
    expect(question.type).toBe('single')
    expect(question.required).toBe(false)
    expect(question.comment).toBe('off')
    if (question.type === 'single') expect(question.options).toHaveLength(2)
  })

  it('создает agree со шкалой 5', () => {
    const question = createQuestion('agree', 'q2')
    expect(question.type === 'agree' && question.scale).toBe(5)
  })

  it('создает number с границами 1–10', () => {
    const question = createQuestion('number', 'q3')
    if (question.type !== 'number') throw new Error('ожидался number')
    expect(question.min).toBe(1)
    expect(question.max).toBe(10)
  })

  it('создает text с rows=4', () => {
    const question = createQuestion('text', 'q4')
    expect(question.type === 'text' && question.rows).toBe(4)
  })
})

describe('changeQuestionType', () => {
  const single: Question = {
    id: 'q1',
    type: 'single',
    text: 'Вопрос',
    description: 'Подсказка',
    required: true,
    comment: 'optional',
    options: ['Да', 'Нет'],
  }

  it('сохраняет текст, обязательность и комментарий', () => {
    const next = changeQuestionType(single, 'text')
    expect(next.text).toBe('Вопрос')
    expect(next.description).toBe('Подсказка')
    expect(next.required).toBe(true)
    expect(next.comment).toBe('optional')
    expect(next.type).toBe('text')
  })

  it('переносит варианты между single и multi', () => {
    const next = changeQuestionType(single, 'multi')
    if (next.type !== 'multi') throw new Error('ожидался multi')
    expect(next.options).toEqual(['Да', 'Нет'])
  })

  it('не оставляет чужих полей при переходе в agree', () => {
    const next = changeQuestionType(single, 'agree')
    expect(next.type).toBe('agree')
    expect('options' in next).toBe(false)
    expect(next.type === 'agree' && next.scale).toBe(5)
  })

  it('сохраняет границы числа при смене типа number → number', () => {
    const numeric: Question = {
      id: 'q9',
      type: 'number',
      text: 'Число',
      required: false,
      comment: 'off',
      min: 0,
      max: 100,
      step: 5,
      slider: true,
    }
    const next = changeQuestionType(numeric, 'number')
    if (next.type !== 'number') throw new Error('ожидался number')
    expect(next.min).toBe(0)
    expect(next.max).toBe(100)
    expect(next.step).toBe(5)
    expect(next.slider).toBe(true)
  })
})

describe('createEmptySurvey', () => {
  it('создает черновик с осмысленным id', () => {
    const survey = createEmptySurvey()
    expect(survey.status).toBe('draft')
    expect(survey.questions).toEqual([])
    expect(survey.id).toMatch(/^opros-\d{4}-\d{2}$/)
    expect(survey.origin).toBe('published')
  })
})
