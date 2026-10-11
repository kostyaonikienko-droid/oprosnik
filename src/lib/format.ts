const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const DATETIME_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const MONTH_FMT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })

/** `2026-10-10` → `10.10.2026` */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? parseIso(value) : value
  return date ? DATE_FMT.format(date) : '—'
}

/** ISO-строка → `10.10.2026 14:35` */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? parseIso(value) : value
  return date ? DATETIME_FMT.format(date) : '—'
}

/** `2026-10-05` → `5 октября` */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = parseIso(value)
  return date ? MONTH_FMT.format(date) : '—'
}

function parseIso(value: string): Date | null {
  // Дата без времени трактуется как локальная, чтобы не «уезжать» на день назад
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return null
    const date = new Date(year, month - 1, day)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Число с неразрывным разделителем тысяч и запятой как десятичным знаком */
export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** `0.423` → `42,3%` */
export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '—'
  return `${formatNumber(ratio * 100, digits)}%`
}

/** Доля, округлённая до безопасного для отображения значения */
export function safeRatio(part: number, total: number): number {
  if (!total) return 0
  return part / total
}

export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

export function respondentsLabel(count: number): string {
  return `${formatNumber(count)} ${plural(count, 'респондент', 'респондента', 'респондентов')}`
}

export function answersLabel(count: number): string {
  return `${formatNumber(count)} ${plural(count, 'ответ', 'ответа', 'ответов')}`
}

/** Обрезка длинного текста для таблиц с многоточием */
export function truncate(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}
