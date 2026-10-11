import { parseSurveyMarkdown } from './parse'
import type { ParseIssue } from './parse'
import type { Survey } from './types'

/**
 * Seed-опросы подхватываются из каталога `surveys/` на этапе сборки.
 * Это резервный источник определений: после появления страницы публикации
 * источник истины — бэкенд, а seed используется для первичного наполнения.
 */
const seedModules = import.meta.glob('/surveys/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface SeedFile {
  fileName: string
  raw: string
}

export function loadSeedFiles(): SeedFile[] {
  return Object.entries(seedModules)
    .map(([path, raw]) => ({
      fileName: path.replace(/^\/surveys\//, ''),
      raw,
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
}

export interface SeedLoadResult {
  surveys: Survey[]
  errors: { fileName: string; issues: ParseIssue[] }[]
}

export function loadSeedSurveys(): SeedLoadResult {
  const surveys: Survey[] = []
  const errors: SeedLoadResult['errors'] = []

  for (const file of loadSeedFiles()) {
    const result = parseSurveyMarkdown(file.raw)
    if (result.ok) {
      surveys.push({ ...result.survey, origin: 'seed' })
    } else {
      errors.push({ fileName: file.fileName, issues: result.issues })
    }
  }

  return { surveys, errors }
}
