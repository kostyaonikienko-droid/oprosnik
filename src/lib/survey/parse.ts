import { toString as nodeToString } from 'mdast-util-to-string'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { parse as parseYaml } from 'yaml'
import { formatSchemaIssues, surveySchema } from './schema'
import type { Question, Survey, SurveyStatus } from './types'
import { QUESTION_TYPES } from './types'

/** Ошибка разбора с указанием строки в исходном .md */
export interface ParseIssue {
  line: number | null
  message: string
}

export type ParseResult =
  | { ok: true; survey: Survey; issues: ParseIssue[] }
  | { ok: false; issues: ParseIssue[] }

type MdNode = {
  type: string
  position?: { start: { line: number } }
  children?: MdNode[]
  depth?: number
  ordered?: boolean
  value?: string
}

const NUMERIC_ATTRS = new Set(['min', 'max', 'step', 'rows', 'maxlength', 'scale'])
const BOOLEAN_ATTRS = new Set(['required', 'shuffle', 'slider'])

interface FrontmatterResult {
  data: Record<string, unknown>
  body: string
  /** Сколько строк занимает frontmatter — нужно для нумерации строк в теле */
  offset: number
  issues: ParseIssue[]
}

function splitFrontmatter(source: string): FrontmatterResult {
  const normalized = source.replace(/^\uFEFF/, '')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(normalized)
  if (!match) {
    return {
      data: {},
      body: normalized,
      offset: 0,
      issues: [
        {
          line: 1,
          message:
            'Не найден YAML-блок в начале файла. Ожидается --- … --- с полями id, title, status.',
        },
      ],
    }
  }

  const frontmatterLines = match[0].split(/\r?\n/).length - 1
  try {
    const data = parseYaml(match[1] ?? '')
    if (data === null || data === undefined) {
      return {
        data: {},
        body: normalized.slice(match[0].length),
        offset: frontmatterLines,
        issues: [{ line: 2, message: 'YAML-блок пустой' }],
      }
    }
    if (typeof data !== 'object' || Array.isArray(data)) {
      return {
        data: {},
        body: normalized.slice(match[0].length),
        offset: frontmatterLines,
        issues: [{ line: 2, message: 'В YAML-блоке ожидается набор полей key: value' }],
      }
    }
    return {
      data: data as Record<string, unknown>,
      body: normalized.slice(match[0].length),
      offset: frontmatterLines,
      issues: [],
    }
  } catch (error) {
    return {
      data: {},
      body: normalized.slice(match[0].length),
      offset: frontmatterLines,
      issues: [
        {
          line: 2,
          message: `Не удалось разобрать YAML: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

/** Разбирает блок атрибутов `{#q1 type=single required max=3}` */
export function parseAttributes(raw: string): Record<string, unknown> {
  const attrs: Record<string, unknown> = {}
  const re = /#([A-Za-z0-9_-]+)|([A-Za-z0-9_-]+)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s,{}]+))?/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    if (match[1]) {
      attrs.id = match[1]
      continue
    }
    const key = match[2]
    if (!key) continue
    let value: unknown = true
    if (match[3] !== undefined) {
      const rawValue = match[3].replace(/^["']|["']$/g, '')
      if (NUMERIC_ATTRS.has(key)) {
        const num = Number(rawValue)
        value = Number.isFinite(num) ? num : rawValue
      } else if (BOOLEAN_ATTRS.has(key)) {
        value = rawValue === 'true' || rawValue === '1' || rawValue === 'yes'
      } else {
        value = rawValue
      }
    }
    attrs[key] = value
  }
  return attrs
}

/** Отделяет блок атрибутов в конце заголовка от текста вопроса */
function splitHeading(text: string): { text: string; attrs: Record<string, unknown> } {
  const match = /\{([^{}]*)\}\s*$/.exec(text)
  if (!match) return { text: text.trim(), attrs: {} }
  return {
    text: text.slice(0, match.index).trim(),
    attrs: parseAttributes(match[1] ?? ''),
  }
}

/** Убирает `- [ ]` / `- [x]` из текста варианта ответа */
function cleanOption(text: string): string {
  return text
    .replace(/^\s*\[[ xX]\]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectListItems(node: MdNode, out: string[]): void {
  if (node.type === 'listItem') {
    const text = cleanOption(nodeToString(node as never))
    if (text) out.push(text)
    return
  }
  for (const child of node.children ?? []) collectListItems(child, out)
}

function nodeLine(node: MdNode, offset: number): number {
  return (node.position?.start.line ?? 1) + offset
}

interface RawQuestion {
  line: number
  attrs: Record<string, unknown>
  text: string
  options: string[]
  descriptionParts: string[]
}

function extractQuestions(root: MdNode, offset: number): {
  introLines: number
  questions: RawQuestion[]
  issues: ParseIssue[]
} {
  const children = root.children ?? []
  const issues: ParseIssue[] = []
  const questions: RawQuestion[] = []
  let introLines = 0
  let current: RawQuestion | null = null

  for (const node of children) {
    const isH2 = node.type === 'heading' && node.depth === 2
    if (isH2) {
      const { text, attrs } = splitHeading(nodeToString(node as never))
      current = { line: nodeLine(node, offset), attrs, text, options: [], descriptionParts: [] }
      questions.push(current)
      continue
    }

    if (!current) {
      // Сколько строк тела занимает приветственный текст до первого `##`
      introLines = Math.max(introLines, (node.position?.start.line ?? 1) - 1)
      continue
    }

    if (node.type === 'list') {
      collectListItems(node, current.options)
      continue
    }

    const text = nodeToString(node as never).trim()
    if (text) current.descriptionParts.push(text)
  }

  if (questions.length === 0) {
    issues.push({
      line: null,
      message:
        'В теле файла не найдено ни одного вопроса. Каждый вопрос — это заголовок второго уровня (##).',
    })
  }

  return { introLines: Math.max(introLines, 0), questions, issues }
}

function buildQuestion(raw: RawQuestion): { question: Record<string, unknown>; issues: ParseIssue[] } {
  const issues: ParseIssue[] = []
  const attrs = { ...raw.attrs }
  const type = String(attrs.type ?? '')

  if (!type) {
    issues.push({
      line: raw.line,
      message: `У вопроса «${raw.text || '(без текста)'}» не указан type. Добавьте {#id type=…}.`,
    })
  } else if (!QUESTION_TYPES.includes(type as (typeof QUESTION_TYPES)[number])) {
    issues.push({
      line: raw.line,
      message: `Неизвестный type="${type}". Доступны: ${QUESTION_TYPES.join(', ')}.`,
    })
  }

  if (!attrs.id) {
    issues.push({
      line: raw.line,
      message: `У вопроса «${raw.text || '(без текста)'}» не задан id. Добавьте {#q1}.`,
    })
  }

  const question: Record<string, unknown> = {
    id: attrs.id ?? '',
    type: type || 'text',
    text: raw.text,
    required: attrs.required === true,
    comment: attrs.comment ?? 'off',
  }

  if (raw.descriptionParts.length > 0) {
    question.description = raw.descriptionParts.join('\n\n')
  } else if (typeof attrs.description === 'string' && attrs.description.trim()) {
    question.description = attrs.description.trim()
  }

  if (type === 'single' || type === 'multi') {
    question.options = raw.options
    if (raw.options.length === 0) {
      issues.push({
        line: raw.line,
        message: `Для вопроса «${raw.text}» типа ${type} нужен список вариантов (- Вариант).`,
      })
    }
    if (attrs.shuffle !== undefined) question.shuffle = attrs.shuffle === true
    if (type === 'multi') {
      if (attrs.min !== undefined) question.min = attrs.min
      if (attrs.max !== undefined) question.max = attrs.max
    }
  }

  if (type === 'agree') {
    question.scale = attrs.scale ?? 5
  }

  if (type === 'number') {
    if (attrs.min !== undefined) question.min = attrs.min
    if (attrs.max !== undefined) question.max = attrs.max
    if (attrs.step !== undefined) question.step = attrs.step
    if (attrs.slider !== undefined) question.slider = attrs.slider === true
  }

  if (type === 'text') {
    if (attrs.rows !== undefined) question.rows = attrs.rows
    if (attrs.maxlength !== undefined) question.maxlength = attrs.maxlength
  }

  return { question, issues }
}

/**
 * Разбирает .md-файл опроса в типизированный объект Survey.
 *
 * Формат:
 * - YAML-блок в начале: id, title, status, starts_at, ends_at
 * - Текст до первого `##` — приветствие участнику
 * - Каждый `##` — вопрос, атрибуты в `{...}` в конце заголовка
 * - Маркированный список под вопросом — варианты ответа
 * - Абзац под вопросом — подсказка (description)
 */
export function parseSurveyMarkdown(source: string): ParseResult {
  const { data, body, offset, issues } = splitFrontmatter(source)
  const tree = unified().use(remarkParse).parse(body) as unknown as MdNode
  const extracted = extractQuestions(tree, offset)
  const allIssues: ParseIssue[] = [...issues, ...extracted.issues]

  const intro = body
    .split(/\r?\n/)
    .slice(0, extracted.introLines)
    .join('\n')
    .trim()

  const questions: Record<string, unknown>[] = []
  for (const raw of extracted.questions) {
    const { question, issues: questionIssues } = buildQuestion(raw)
    allIssues.push(...questionIssues)
    questions.push(question)
  }

  const candidate = {
    id: data.id,
    title: data.title,
    status: (data.status as SurveyStatus | undefined) ?? 'draft',
    intro: intro || undefined,
    startsAt: normalizeDate(data.starts_at),
    endsAt: normalizeDate(data.ends_at),
    questions,
    origin: 'seed',
    version: 1,
  }

  if (allIssues.length > 0 && questions.length === 0) {
    return { ok: false, issues: allIssues }
  }

  const parsed = surveySchema.safeParse(cleanUndefined(candidate))
  if (!parsed.success) {
    const lineByQuestion = new Map<number, number>()
    extracted.questions.forEach((raw, index) => lineByQuestion.set(index, raw.line))

    for (const issue of formatSchemaIssues(parsed.error)) {
      const questionIndex = /^questions\.(\d+)/.exec(issue.path)?.[1]
      allIssues.push({
        line: questionIndex === undefined ? null : (lineByQuestion.get(Number(questionIndex)) ?? null),
        message: issue.path.startsWith('questions.')
          ? `${issue.path.replace(/^questions\.\d+\.?/, '') || 'вопрос'}: ${issue.message}`
          : `${issue.path}: ${issue.message}`,
      })
    }
    return { ok: false, issues: allIssues }
  }

  return { ok: true, survey: parsed.data as Survey, issues: allIssues }
}

function normalizeDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

function cleanUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanUndefined) as unknown as T
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== undefined) result[key] = cleanUndefined(item)
    }
    return result as T
  }
  return value
}

export function surveyToMarkdown(survey: Survey): string {
  const frontmatter: Record<string, unknown> = {
    id: survey.id,
    title: survey.title,
    status: survey.status,
  }
  if (survey.startsAt) frontmatter.starts_at = survey.startsAt
  if (survey.endsAt) frontmatter.ends_at = survey.endsAt

  const lines: string[] = ['---']
  for (const [key, value] of Object.entries(frontmatter)) {
    lines.push(`${key}: ${typeof value === 'string' && /[:#\n]/.test(value) ? JSON.stringify(value) : value}`)
  }
  lines.push('---', '')

  if (survey.intro) lines.push(survey.intro, '')

  for (const question of survey.questions) {
    const attrs: string[] = [`#${question.id}`, `type=${question.type}`]
    if (question.required) attrs.push('required')
    if (question.comment !== 'off') attrs.push(`comment=${question.comment}`)
    if (question.description) attrs.push(`description="${question.description.replace(/\n/g, ' ')}"`)

    if (question.type === 'single' || question.type === 'multi') {
      if (question.shuffle) attrs.push('shuffle')
      if (question.type === 'multi') {
        if (question.min !== undefined) attrs.push(`min=${question.min}`)
        if (question.max !== undefined) attrs.push(`max=${question.max}`)
      }
    }
    if (question.type === 'agree' && question.scale !== 5) attrs.push(`scale=${question.scale}`)
    if (question.type === 'number') {
      if (question.min !== undefined) attrs.push(`min=${question.min}`)
      if (question.max !== undefined) attrs.push(`max=${question.max}`)
      if (question.step !== undefined) attrs.push(`step=${question.step}`)
      if (question.slider) attrs.push('slider')
    }
    if (question.type === 'text') {
      if (question.rows !== undefined) attrs.push(`rows=${question.rows}`)
      if (question.maxlength !== undefined) attrs.push(`maxlength=${question.maxlength}`)
    }

    lines.push(`## ${question.text} {${attrs.join(' ')}}`)

    if (question.type === 'single' || question.type === 'multi') {
      for (const option of question.options) lines.push(`- ${option}`)
    }

    lines.push('')
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
}

export type { Question }
