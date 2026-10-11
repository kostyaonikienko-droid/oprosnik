import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionEditor } from './QuestionEditor'
import { SurveyMetaForm } from './SurveyMetaForm'
import type { Question, Survey } from '@/lib/survey/types'

const single: Question = {
  id: 'q1',
  type: 'single',
  text: 'Как вы оцениваете условия труда?',
  required: true,
  comment: 'optional',
  options: ['Отлично', 'Хорошо', 'Плохо'],
}

function renderEditor(overrides: { question?: Question; index?: number; total?: number } = {}) {
  const props = {
    question: single,
    index: 0,
    total: 3,
    onChange: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
    ...overrides,
  }
  render(<QuestionEditor {...props} />)
  return props
}

describe('QuestionEditor', () => {
  it('показывает текст вопроса и его тип', () => {
    renderEditor()
    expect(screen.getByDisplayValue('Как вы оцениваете условия труда?')).toBeInTheDocument()
    // Тип виден и в выпадающем списке, и в бейдже заголовка
    expect(screen.getByDisplayValue('Одиночный выбор')).toBeInTheDocument()
    expect(screen.getAllByText('Одиночный выбор').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('обязательный')).toBeInTheDocument()
  })

  it('ренерирует все варианты ответа', () => {
    renderEditor()
    expect(screen.getByDisplayValue('Отлично')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Хорошо')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Плохо')).toBeInTheDocument()
  })

  it('запрещает удалить вариант, когда их осталось два', async () => {
    renderEditor({ question: { ...single, options: ['Да', 'Нет'] } })
    const removeButtons = screen.getAllByTitle('Удалить вариант')
    expect(removeButtons).toHaveLength(2)
    expect(removeButtons[0]).toBeDisabled()
  })

  it('добавляет пустой вариант по кнопке', async () => {
    const user = userEvent.setup()
    const props = renderEditor()
    await user.click(screen.getByText('+ Добавить вариант'))
    expect(props.onChange).toHaveBeenCalledTimes(1)
    const next = props.onChange.mock.calls[0]?.[0] as Question
    if (next.type !== 'single') throw new Error('ожидался single')
    expect(next.options).toEqual(['Отлично', 'Хорошо', 'Плохо', ''])
  })

  it('переключает тип вопроса, сохраняя текст', async () => {
    const user = userEvent.setup()
    const props = renderEditor()
    await user.selectOptions(screen.getByDisplayValue('Одиночный выбор'), 'text')
    const next = props.onChange.mock.calls.at(-1)?.[0] as Question
    expect(next.type).toBe('text')
    expect(next.text).toBe('Как вы оцениваете условия труда?')
    expect(next.required).toBe(true)
  })

  it('вызывает обработчики перемещения, дублирования и удаления', async () => {
    const user = userEvent.setup()
    const props = renderEditor()
    await user.click(screen.getByTitle('Ниже'))
    await user.click(screen.getByTitle('Дублировать'))
    await user.click(screen.getByTitle('Удалить'))
    expect(props.onMove).toHaveBeenCalledWith(1)
    expect(props.onDuplicate).toHaveBeenCalledTimes(1)
    expect(props.onDelete).toHaveBeenCalledTimes(1)
  })

  it('блокирует перемещение вверх для первого вопроса', () => {
    renderEditor({ index: 0 })
    expect(screen.getByTitle('Выше')).toBeDisabled()
  })

  it('блокирует перемещение вниз для последнего вопроса', () => {
    renderEditor({ index: 2, total: 3 })
    expect(screen.getByTitle('Ниже')).toBeDisabled()
  })

  it('показывает границы только для множественного выбора', async () => {
    const { rerender } = render(<QuestionEditor
      question={single}
      index={0}
      total={1}
      onChange={vi.fn()}
      onDelete={vi.fn()}
      onDuplicate={vi.fn()}
      onMove={vi.fn()}
    />)
    expect(screen.queryByText('Максимум выборов')).not.toBeInTheDocument()

    rerender(<QuestionEditor
      question={{ ...single, type: 'multi' }}
      index={0}
      total={1}
      onChange={vi.fn()}
      onDelete={vi.fn()}
      onDuplicate={vi.fn()}
      onMove={vi.fn()}
    />)
    expect(screen.getByText('Максимум выборов')).toBeInTheDocument()
  })
})

describe('SurveyMetaForm', () => {
  const survey: Survey = {
    id: 'opros-2026-11',
    title: 'Осенний опрос',
    status: 'draft',
    intro: 'Приветствие',
    questions: [],
    origin: 'published',
    version: 1,
  }

  it('показывает текущие значения', () => {
    render(<SurveyMetaForm survey={survey} idConflict={false} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('Осенний опрос')).toBeInTheDocument()
    expect(screen.getByDisplayValue('opros-2026-11')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Приветствие')).toBeInTheDocument()
  })

  it('отправляет изменение названия в onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SurveyMetaForm survey={survey} idConflict={false} onChange={onChange} />)
    await user.type(screen.getByDisplayValue('Осенний опрос'), '!')
    expect(onChange).toHaveBeenCalledWith({ title: 'Осенний опрос!' })
  })

  it('предупреждает о конфликте идентификатора', () => {
    render(<SurveyMetaForm survey={survey} idConflict onChange={vi.fn()} />)
    expect(screen.getByText('id уже существует — будет перезаписан')).toBeInTheDocument()
  })
})
