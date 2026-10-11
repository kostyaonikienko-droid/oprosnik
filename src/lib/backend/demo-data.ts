import type { ResponseRecord, StoredAnswer, Survey } from '@/lib/survey'
import { toStoredAnswer } from '@/lib/survey/answers'
import { agreeLabels } from '@/lib/survey'
import type { AnswerValue } from '@/lib/survey'
import { addDays, isOpen, today, weakHash } from './internal'
import type { MockState, MockUser } from './internal'

export const DEMO_PASSWORD = 'demo1234'
export const DEMO_MODERATOR_EMAIL = 'moderator@csm.local'
export const DEMO_PARTICIPANT_EMAIL = 'ivanova@csm.local'

/** Детерминированный ГПСЧ, чтобы демо-данные были одинаковыми между перезагрузками */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEPARTMENTS = [
  'Отдел метрологии',
  'Испытательная лаборатория',
  'Отдел стандартизации',
  'Отдел информационного обеспечения',
  'Административно-управленческий персонал',
  'Отдел кадров',
] as const

const POSITIONS = [
  'Инженер 1 категории',
  'Ведущий инженер',
  'Инженер-метролог',
  'Начальник отдела',
  'Специалист',
  'Техник',
] as const

const PARTICIPANTS: { fullName: string; department: string; position: string }[] = [
  { fullName: 'Иванова Мария Сергеевна', department: DEPARTMENTS[0], position: POSITIONS[2] },
  { fullName: 'Петров Алексей Николаевич', department: DEPARTMENTS[0], position: POSITIONS[1] },
  { fullName: 'Сидорова Ольга Владимировна', department: DEPARTMENTS[1], position: POSITIONS[0] },
  { fullName: 'Кузнецов Дмитрий Андреевич', department: DEPARTMENTS[1], position: POSITIONS[3] },
  { fullName: 'Смирнова Екатерина Павловна', department: DEPARTMENTS[2], position: POSITIONS[4] },
  { fullName: 'Васильев Игорь Олегович', department: DEPARTMENTS[2], position: POSITIONS[1] },
  { fullName: 'Попова Наталья Ивановна', department: DEPARTMENTS[3], position: POSITIONS[0] },
  { fullName: 'Соколов Артём Викторович', department: DEPARTMENTS[3], position: POSITIONS[5] },
  { fullName: 'Михайлова Анна Юрьевна', department: DEPARTMENTS[4], position: POSITIONS[3] },
  { fullName: 'Фёдоров Сергей Александрович', department: DEPARTMENTS[4], position: POSITIONS[4] },
  { fullName: 'Николаева Елена Дмитриевна', department: DEPARTMENTS[5], position: POSITIONS[4] },
  { fullName: 'Морозов Павел Игоревич', department: DEPARTMENTS[0], position: POSITIONS[5] },
  { fullName: 'Волкова Светлана Андреевна', department: DEPARTMENTS[1], position: POSITIONS[2] },
  { fullName: 'Алексеев Роман Валерьевич', department: DEPARTMENTS[2], position: POSITIONS[0] },
]

const TEXT_ANSWERS = [
  'В целом всё устраивает, замечаний нет.',
  'Не хватает современного поверочного оборудования.',
  'Стоит обновить программное обеспечение для ведения реестров.',
  'Хотелось бы больше профильного обучения за счёт организации.',
  'Нагрузка распределена неравномерно между отделами.',
  'Нужна более прозрачная система премирования.',
  'Условия труда хорошие, радует коллектив.',
  'Не удобно расположены рабочие места в лаборатории.',
  'Требуется ремонт помещения отдела метрологии.',
  'Коммуникация между отделами могла бы быть лучше.',
  'Достаточно информационных материалов, всё понятно.',
  'Хотелось бы чаще получать обратную связь от руководства.',
]

function emailFrom(fullName: string, index: number): string {
  const [lastName, firstName] = fullName.split(' ')
  const translit: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  }
  const map = (value: string) =>
    value
      .toLowerCase()
      .split('')
      .map((char) => translit[char] ?? char)
      .join('')
  const login = `${map(firstName ?? 'user')[0] ?? 'u'}${map(lastName ?? `user${index}`)}`
  return `${login}@csm.local`.toLowerCase()
}

/**
 * Стартовое состояние демо-режима: модератор, участники, seed-опросы
 * и детерминированно сгенерированные ответы, чтобы статистика и сводные
 * таблицы были наполнены сразу после `npm run dev`.
 */
export function buildDemoState(seedSurveys: Survey[]): MockState {
  const random = mulberry32(20261010)
  const createdAt = new Date().toISOString()
  const hash = weakHash(DEMO_PASSWORD)

  const moderator: MockUser = {
    id: 'u-moderator',
    email: DEMO_MODERATOR_EMAIL,
    passwordHash: hash,
    fullName: 'Модератор опросов',
    department: 'Административно-управленческий персонал',
    position: 'Администратор системы',
    role: 'moderator',
    createdAt,
  }

  const users: MockUser[] = [
    moderator,
    ...PARTICIPANTS.map((person, index) => ({
      id: `u-p${String(index + 1).padStart(2, '0')}`,
      email: emailFrom(person.fullName, index),
      passwordHash: hash,
      fullName: person.fullName,
      department: person.department,
      position: person.position,
      role: 'participant' as const,
      createdAt,
    })),
  ]

  const surveys = seedSurveys.map((survey) => ({ ...survey }))
  const responses: ResponseRecord[] = []

  for (const survey of surveys) {
    if (!isOpen(survey)) continue
    const participants = users.filter((user) => user.role === 'participant')
    // Отвечают не все — реалистичный процент заполнения
    participants.forEach((user, userIndex) => {
      if (random() > 0.78 && userIndex > 3) return
      const submittedAt = `${addDays(-Math.floor(random() * 6))}T${String(9 + Math.floor(random() * 9)).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00.000Z`
      const answers: Record<string, StoredAnswer> = {}
      for (const question of survey.questions) {
        answers[question.id] = toStoredAnswer(question, generateValue(question, random))
      }
      responses.push({
        id: `r-${survey.id}-${user.id}`,
        surveyId: survey.id,
        respondent: {
          id: user.id,
          fullName: user.fullName,
          department: user.department,
          position: user.position,
          email: user.email,
        },
        submittedAt,
        answers,
      })
    })
  }

  return {
    version: 1,
    users,
    sessionUserId: null,
    surveys,
    responses,
    seededAt: today(),
  }
}

function generateValue(
  question: Survey['questions'][number],
  random: () => number,
): AnswerValue {
  switch (question.type) {
    case 'single': {
      // Небольшой перекос в сторону первых вариантов
      const weights = question.options.map((_, index) => 1 / (index + 1.4))
      const total = weights.reduce((sum, weight) => sum + weight, 0)
      let roll = random() * total
      let chosen = 0
      for (let index = 0; index < weights.length; index += 1) {
        roll -= weights[index] as number
        if (roll <= 0) {
          chosen = index
          break
        }
      }
      return { optionIndexes: [chosen], comment: maybeComment(random) }
    }
    case 'multi': {
      const max = Math.min(question.options.length, question.max ?? 3)
      const count = Math.max(question.min ?? 1, 1 + Math.floor(random() * max))
      const indexes = new Set<number>()
      while (indexes.size < count) indexes.add(Math.floor(random() * question.options.length))
      return { optionIndexes: [...indexes], comment: maybeComment(random) }
    }
    case 'agree': {
      const labels = agreeLabels(question.scale)
      // Перекос в сторону согласия
      const weights = labels.map((_, index) => 1 / (index * 0.8 + 1.1))
      const total = weights.reduce((sum, weight) => sum + weight, 0)
      let roll = random() * total
      let position = 1
      for (let index = 0; index < weights.length; index += 1) {
        roll -= weights[index] as number
        if (roll <= 0) {
          position = index + 1
          break
        }
      }
      return { agreePosition: position, comment: maybeComment(random) }
    }
    case 'number': {
      const min = question.min ?? 1
      const max = question.max ?? 10
      return {
        number: Math.round(min + random() * (max - min)),
        comment: maybeComment(random),
      }
    }
    case 'text': {
      return {
        text: TEXT_ANSWERS[Math.floor(random() * TEXT_ANSWERS.length)] as string,
        comment: maybeComment(random),
      }
    }
  }
}

function maybeComment(random: () => number): string | undefined {
  if (random() > 0.88) {
    return TEXT_ANSWERS[Math.floor(random() * TEXT_ANSWERS.length)]
  }
  return undefined
}
