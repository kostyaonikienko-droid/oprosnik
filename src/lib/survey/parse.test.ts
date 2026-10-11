import { describe, expect, it } from 'vitest'
import { parseSurveyMarkdown, surveyToMarkdown } from '@/lib/survey/parse'
import { validateSurvey, validateSurveySet, hasErrors } from '@/lib/survey/validate'
import type { Survey } from '@/lib/survey/types'

function unwrap(source: string): Survey {
  const result = parseSurveyMarkdown(source)
  if (!result.ok) {
    throw new Error(`Ожидался успешный разбор: ${result.issues.map((i) => i.message).join('; ')}`)
  }
  return result.survey
}

const MINIMAL = `---
id: test
title: Тестовый опрос
status: draft
---

## Вопрос? {#q1 type=text}
`

describe('parseSurveyMarkdown: frontmatter', () => {
  it('разбирает обязательные поля', () => {
    const survey = unwrap(MINIMAL)
    expect(survey.id).toBe('test')
    expect(survey.title).toBe('Тестовый опрос')
    expect(survey.status).toBe('draft')
  })

  it('без YAML-блока возвращает ошибку с указанием строки', () => {
    const result = parseSurveyMarkdown('## Вопрос? {#q1 type=text}\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.line).toBe(1)
    expect(result.issues[0]?.message).toContain('Не найден YAML-блок')
  })

  it('при отсутствии status подставляет draft', () => {
    const survey = unwrap(`---
id: test
title: Без статуса
---

## Вопрос? {#q1 type=text}
`)
    expect(survey.status).toBe('draft')
  })

  it('приводит даты к ГГГГ-ММ-ДД', () => {
    const survey = unwrap(`---
id: test
title: Даты
status: active
starts_at: 2026-10-01
ends_at: 2026-10-31
---

## Вопрос? {#q1 type=text}
`)
    expect(survey.startsAt).toBe('2026-10-01')
    expect(survey.endsAt).toBe('2026-10-31')
  })

  it('принимает title с кавычками и двоеточием', () => {
    const survey = unwrap(`---
id: test
title: 'Опрос: итоги "2026" #1'
status: draft
---

## Вопрос? {#q1 type=text}
`)
    expect(survey.title).toBe('Опрос: итоги "2026" #1')
  })
})

describe('parseSurveyMarkdown: приветствие', () => {
  it('сохраняет все абзацы до первого вопроса, включая последний', () => {
    const survey = unwrap(`---
id: test
title: Приветствие
status: draft
---

# Заголовок опроса

Уважаемые коллеги!

ФБУ «Пермский ЦСМ» проводит плановый опрос.
Заполнение займёт не более 7 минут.

Обязательные вопросы отмечены звёздочкой.

## Вопрос? {#q1 type=text}
`)
    expect(survey.intro).toContain('# Заголовок опроса')
    expect(survey.intro).toContain('Уважаемые коллеги!')
    expect(survey.intro).toContain('Заполнение займёт не более 7 минут.')
    expect(survey.intro).toContain('Обязательные вопросы отмечены звёздочкой.')
  })

  it('не включает текст первого вопроса в приветствие', () => {
    const survey = unwrap(`---
id: test
title: Границы
status: draft
---

Введение.

## Первый вопрос {#q1 type=text}

## Второй вопрос {#q2 type=text}
`)
    expect(survey.intro).toBe('Введение.')
    expect(survey.questions).toHaveLength(2)
  })
})

describe('parseSurveyMarkdown: типы вопросов', () => {
  it('single — варианты из маркированного списка', () => {
    const survey = unwrap(`---
id: test
title: Single
status: draft
---

## Как вы оцениваете условия? {#q1 type=single required}
- Отлично
- Хорошо
- Плохо
`)
    const question = survey.questions[0]
    expect(question?.type).toBe('single')
    expect(question?.required).toBe(true)
    if (question?.type === 'single') {
      expect(question.options).toEqual(['Отлично', 'Хорошо', 'Плохо'])
    }
  })

  it('multi — min/max и чекбоксы в списках', () => {
    const survey = unwrap(`---
id: test
title: Multi
status: draft
---

## Чего не хватает? {#q1 type=multi min=1 max=2 comment=optional}
- [ ] Оборудование
- [x] ПО
- Техника
`)
    const question = survey.questions[0]
    if (question?.type !== 'multi') throw new Error('ожидался multi')
    expect(question.min).toBe(1)
    expect(question.max).toBe(2)
    expect(question.comment).toBe('optional')
    expect(question.options).toEqual(['Оборудование', 'ПО', 'Техника'])
  })

  it('agree — шкала по умолчанию 5 и явная 7', () => {
    const survey = unwrap(`---
id: test
title: Agree
status: draft
---

## Утверждение A {#q1 type=agree required}

## Утверждение B {#q2 type=agree scale=7}
`)
    const first = survey.questions[0]
    const second = survey.questions[1]
    expect(first?.type === 'agree' && first.scale).toBe(5)
    expect(second?.type === 'agree' && second.scale).toBe(7)
  })

  it('number — границы, шаг и слайдер', () => {
    const survey = unwrap(`---
id: test
title: Number
status: draft
---

## Загрузка {#q1 type=number min=1 max=10 slider required}
Где 1 — минимум, 10 — максимум.
`)
    const question = survey.questions[0]
    if (question?.type !== 'number') throw new Error('ожидался number')
    expect(question.min).toBe(1)
    expect(question.max).toBe(10)
    expect(question.slider).toBe(true)
    expect(question.description).toBe('Где 1 — минимум, 10 — максимум.')
  })

  it('text — rows и maxlength', () => {
    const survey = unwrap(`---
id: test
title: Text
status: draft
---

## Что улучшить? {#q1 type=text rows=6 maxlength=500}
`)
    const question = survey.questions[0]
    if (question?.type !== 'text') throw new Error('ожидался text')
    expect(question.rows).toBe(6)
    expect(question.maxlength).toBe(500)
  })

  it('абзац под вопросом становится подсказкой', () => {
    const survey = unwrap(`---
id: test
title: Подсказка
status: draft
---

## Вопрос? {#q1 type=single}
Выберите один вариант.

- Да
- Нет
`)
    expect(survey.questions[0]?.description).toBe('Выберите один вариант.')
  })

  it('required=false снимает обязательность', () => {
    const survey = unwrap(`---
id: test
title: Необязательный
status: draft
---

## Вопрос? {#q1 type=text required=false}
`)
    expect(survey.questions[0]?.required).toBe(false)
  })
})

describe('parseSurveyMarkdown: ошибки и предупреждения', () => {
  it('сообщает номер строки при отсутствии type', () => {
    const result = parseSurveyMarkdown(`---
id: test
title: Без типа
status: draft
---

Введение.

## Вопрос без типа {#q1}
`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((item) => item.message.includes('не указан type'))
    expect(issue?.line).toBe(9)
  })

  it('предлагает исправление при опечатке в атрибуте', () => {
    const result = parseSurveyMarkdown(`---
id: test
title: Опечатка
status: draft
---

## Вопрос? {#q1 type=text requred}
`)
    if (!result.ok) throw new Error('ожидался успешный разбор с предупреждением')
    const issue = result.issues.find((item) => item.message.includes('requred'))
    expect(issue?.message).toContain('возможно, имелся в виду "required"')
    expect(result.survey.questions[0]?.required).toBe(false)
  })

  it('предупреждает об атрибуте, неприменимом к типу', () => {
    const result = parseSurveyMarkdown(`---
id: test
title: Лишний атрибут
status: draft
---

## Вопрос? {#q1 type=single max=3}
- Да
- Нет
`)
    if (!result.ok) throw new Error('ожидался успешный разбор с предупреждением')
    const issue = result.issues.find((item) => item.message.includes('не применяется к типу'))
    expect(issue?.message).toContain('"max"')
  })

  it('требует минимум два варианта для single', () => {
    const result = parseSurveyMarkdown(`---
id: test
title: Мало вариантов
status: draft
---

## Вопрос? {#q1 type=single}
- Только один
`)
    expect(result.ok).toBe(false)
  })

  it('без вопросов возвращает ошибку', () => {
    const result = parseSurveyMarkdown(`---
id: test
title: Пустой
status: draft
---

Только введение.
`)
    expect(result.ok).toBe(false)
  })
})

describe('surveyToMarkdown: round-trip', () => {
  it('сохраняет опрос без потерь', () => {
    const original = unwrap(`---
id: round-trip
title: Полный опрос
status: active
starts_at: 2026-10-01
ends_at: 2026-10-31
---

# Приветствие

Текст введения в несколько абзацев.

## Одиночный выбор {#q1 type=single required}
Подсказка к вопросу.

- Первый
- Второй

## Множественный выбор {#q2 type=multi max=2 comment=required}
- А
- Б
- В

## Согласие {#q3 type=agree scale=7 required}

## Число {#q4 type=number min=0 max=10 step=2 slider}

## Текст {#q5 type=text rows=8 maxlength=1000 comment=optional}
`)
    const restored = unwrap(surveyToMarkdown(original))
    expect(restored).toEqual({ ...original, origin: 'seed', version: 1 })
  })

  it('переживает кавычки и двоеточия в названии', () => {
    const survey: Survey = {
      id: 'quotes',
      title: 'Опрос: итоги "года" #1',
      status: 'draft',
      intro: '',
      questions: [
        { id: 'q1', type: 'text', text: 'Вопрос?', required: false, comment: 'off' },
      ],
      origin: 'published',
      version: 1,
    }
    const restored = unwrap(surveyToMarkdown(survey))
    expect(restored.title).toBe('Опрос: итоги "года" #1')
  })

  it('переживает многострочную подсказку', () => {
    const survey: Survey = {
      id: 'multiline',
      title: 'Многострочная подсказка',
      status: 'draft',
      intro: '',
      questions: [
        {
          id: 'q1',
          type: 'text',
          text: 'Вопрос?',
          required: false,
          comment: 'off',
          description: 'Первая строка подсказки.\nВторая строка подсказки.',
        },
      ],
      origin: 'published',
      version: 1,
    }
    const restored = unwrap(surveyToMarkdown(survey))
    expect(restored.questions[0]?.description).toBe(
      'Первая строка подсказки.\nВторая строка подсказки.',
    )
  })

  it('не путает вариант ответа, начинающийся с дефиса, со списком', () => {
    const survey: Survey = {
      id: 'dash',
      title: 'Дефис в вариантах',
      status: 'draft',
      intro: '',
      questions: [
        {
          id: 'q1',
          type: 'single',
          text: 'Вопрос?',
          required: false,
          comment: 'off',
          options: ['- странный вариант', 'обычный вариант'],
        },
      ],
      origin: 'published',
      version: 1,
    }
    const restored = unwrap(surveyToMarkdown(survey))
    const question = restored.questions[0]
    if (question?.type !== 'single') throw new Error('ожидался single')
    expect(question.options).toEqual(['- странный вариант', 'обычный вариант'])
  })
})

describe('validateSurvey', () => {
  it('ловит повторяющиеся id вопросов', () => {
    const survey = unwrap(`---
id: dup
title: Дубликаты
status: draft
---

## Первый {#q1 type=text}

## Второй {#q1 type=text}
`)
    const issues = validateSurvey(survey)
    expect(hasErrors(issues)).toBe(true)
    expect(issues.some((issue) => issue.message.includes('повторяется'))).toBe(true)
  })

  it('ловит max больше числа вариантов', () => {
    const survey = unwrap(`---
id: badmax
title: Плохой max
status: draft
---

## Вопрос {#q1 type=multi max=9}
- А
- Б
`)
    const issues = validateSurvey(survey)
    expect(hasErrors(issues)).toBe(true)
  })

  it('ловит ends_at раньше starts_at', () => {
    const survey = unwrap(`---
id: dates
title: Даты
status: draft
starts_at: 2026-10-31
ends_at: 2026-10-01
---

## Вопрос {#q1 type=text}
`)
    const issues = validateSurvey(survey)
    expect(issues.some((issue) => issue.message.includes('раньше starts_at'))).toBe(true)
  })

  it('ловит несколько активных опросов в наборе', () => {
    const first = unwrap(`---
id: a
title: A
status: active
---

## Вопрос {#q1 type=text}
`)
    const second = unwrap(`---
id: b
title: B
status: active
---

## Вопрос {#q1 type=text}
`)
    const issues = validateSurveySet([first, second])
    expect(hasErrors(issues)).toBe(true)
    expect(issues[0]?.message).toContain('Активным может быть только один')
  })
})
