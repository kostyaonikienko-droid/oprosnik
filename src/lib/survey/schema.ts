import { z } from 'zod'
import { COMMENT_MODES, QUESTION_TYPES, SURVEY_STATUSES } from './types'

const commentMode = z.enum(COMMENT_MODES)
const agreeScale = z.union([z.literal(5), z.literal(7)], {
  error: 'scale может быть только 5 или 7',
})

const baseQuestion = {
  id: z.string().min(1, 'не задан id вопроса'),
  text: z.string().min(1, 'пустой текст вопроса'),
  description: z.string().optional(),
  required: z.boolean(),
  comment: commentMode,
}

export const singleQuestionSchema = z
  .object({
    ...baseQuestion,
    type: z.literal('single'),
    options: z.array(z.string().min(1)).min(2, 'нужно минимум 2 варианта ответа'),
    shuffle: z.boolean().optional(),
  })
  .strict()

export const multiQuestionSchema = z
  .object({
    ...baseQuestion,
    type: z.literal('multi'),
    options: z.array(z.string().min(1)).min(2, 'нужно минимум 2 варианта ответа'),
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().positive().optional(),
    shuffle: z.boolean().optional(),
  })
  .strict()

export const agreeQuestionSchema = z
  .object({
    ...baseQuestion,
    type: z.literal('agree'),
    scale: agreeScale,
  })
  .strict()

export const numberQuestionSchema = z
  .object({
    ...baseQuestion,
    type: z.literal('number'),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    slider: z.boolean().optional(),
  })
  .strict()

export const textQuestionSchema = z
  .object({
    ...baseQuestion,
    type: z.literal('text'),
    rows: z.number().int().positive().optional(),
    maxlength: z.number().int().positive().optional(),
  })
  .strict()

export const questionSchema = z.discriminatedUnion('type', [
  singleQuestionSchema,
  multiQuestionSchema,
  agreeQuestionSchema,
  numberQuestionSchema,
  textQuestionSchema,
])

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ожидается дата в формате ГГГГ-ММ-ДД')

export const surveySchema = z
  .object({
    id: z
      .string()
      .min(1, 'не задан id опроса')
      .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'id может содержать только латиницу, цифры, - и _'),
    title: z.string().min(1, 'не задан заголовок опроса'),
    status: z.enum(SURVEY_STATUSES),
    intro: z.string().optional(),
    startsAt: isoDate.optional(),
    endsAt: isoDate.optional(),
    questions: z.array(questionSchema).min(1, 'в опросе должен быть хотя бы один вопрос'),
    origin: z.enum(['seed', 'published']).optional(),
    version: z.number().int().positive().optional(),
    updatedAt: z.string().optional(),
  })
  .strict()

export type SurveyInput = z.input<typeof surveySchema>

export const QUESTION_TYPE_LABELS: Record<(typeof QUESTION_TYPES)[number], string> = {
  single: 'Одиночный выбор',
  multi: 'Множественный выбор',
  agree: 'Согласие с утверждением',
  number: 'Числовая оценка',
  text: 'Свободный ответ',
}

export interface SchemaIssue {
  path: string
  message: string
}

export function formatSchemaIssues(error: z.ZodError): SchemaIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(корень)',
    message: issue.message,
  }))
}
