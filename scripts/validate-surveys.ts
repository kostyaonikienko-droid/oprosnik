/**
 * Проверка seed-опросов в каталоге `surveys/`.
 *
 * Запуск: `npm run surveys:validate`
 * В CI используется как гейт перед сборкой: при наличии ошибок
 * скрипт завершается с кодом 1.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSurveyMarkdown } from '@/lib/survey/parse'
import type { ParseIssue } from '@/lib/survey/parse'
import { validateSurvey, validateSurveySet } from '@/lib/survey/validate'
import type { Survey } from '@/lib/survey/types'

const SURVEYS_DIR = join(process.cwd(), 'surveys')

function listSurveyFiles(): string[] {
  try {
    return readdirSync(SURVEYS_DIR)
      .filter((name) => name.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

function formatIssue(prefix: string, line: number | null, message: string): string {
  return `    ${prefix} ${line === null ? '' : `строка ${line}: `}${message}`
}

let errorCount = 0
let warningCount = 0
const surveys: Survey[] = []
const files = listSurveyFiles()

if (files.length === 0) {
  console.log(`Каталог surveys/ пуст или не найден (${SURVEYS_DIR})`)
  process.exit(0)
}

for (const fileName of files) {
  const source = readFileSync(join(SURVEYS_DIR, fileName), 'utf8')
  const result = parseSurveyMarkdown(source)
  const lines: string[] = [fileName]

  if (!result.ok) {
    errorCount += result.issues.length
    lines.push('  ✗ не удалось разобрать файл')
    for (const issue of result.issues) {
      lines.push(formatIssue('✗', issue.line, issue.message))
    }
    console.log(lines.join('\n'))
    continue
  }

  const survey = result.survey
  surveys.push(survey)

  const structural = validateSurvey(survey)
  const parseWarnings: ParseIssue[] = result.issues

  lines.push(
    `  ✓ ${survey.id} — ${survey.title}`,
    `    статус: ${survey.status}, вопросов: ${survey.questions.length}` +
      (survey.startsAt || survey.endsAt
        ? `, период: ${survey.startsAt ?? '—'} … ${survey.endsAt ?? '—'}`
        : ''),
  )

  for (const issue of parseWarnings) {
    warningCount += 1
    lines.push(formatIssue('⚠', issue.line, issue.message))
  }

  for (const issue of structural) {
    if (issue.level === 'error') {
      errorCount += 1
      lines.push(formatIssue('✗', null, issue.message))
    } else {
      warningCount += 1
      lines.push(formatIssue('⚠', null, issue.message))
    }
  }

  console.log(lines.join('\n'))
}

const crossIssues = validateSurveySet(surveys)
if (crossIssues.length > 0) {
  console.log('\nПроверка набора опросов:')
  for (const issue of crossIssues) {
    if (issue.level === 'error') errorCount += 1
    else warningCount += 1
    const prefix = issue.level === 'error' ? '✗' : '⚠'
    console.log(formatIssue(prefix, null, issue.message))
  }
}

const active = surveys.filter((survey) => survey.status === 'active')
console.log(
  `\nИтого: файлов ${files.length}, опросов ${surveys.length}, активных ${active.length}, ` +
    `ошибок ${errorCount}, предупреждений ${warningCount}`,
)

if (errorCount > 0) {
  process.exit(1)
}
