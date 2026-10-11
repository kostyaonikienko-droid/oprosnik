import { useState } from 'react'
import { loadSeedFiles, parseSurveyMarkdown } from '@/lib/survey'
import type { Backend } from '@/lib/backend'
import { errorMessage } from '@/lib/errors'
import { Alert } from '@/ui/feedback'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Choice } from '@/ui/form'
import { Dialog } from '@/ui/dialog'
import { EmptyState } from '@/ui/status'

interface Props {
  open: boolean
  onClose: () => void
  backend: Backend | null
  /** Сообщить странице, что список опросов изменился */
  onImported: () => void
}

interface SeedItem {
  fileName: string
  raw: string
  id: string | null
  title: string | null
  valid: boolean
}

function loadItems(): SeedItem[] {
  return loadSeedFiles().map((file) => {
    const result = parseSurveyMarkdown(file.raw)
    return result.ok
      ? {
          fileName: file.fileName,
          raw: file.raw,
          id: result.survey.id,
          title: result.survey.title,
          valid: true,
        }
      : { fileName: file.fileName, raw: file.raw, id: null, title: null, valid: false }
  })
}

/**
 * Импорт seed-опросов из каталога `surveys/` в хранилище.
 * В Supabase-режиме список опросов читается только из базы, поэтому
 * примеры из репозитория нужно опубликовать хотя бы один раз.
 */
export function SeedImportDialog({ open, onClose, backend, onImported }: Props) {
  const [items] = useState<SeedItem[]>(() => loadItems())
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(loadItems().filter((item) => item.valid).map((item) => item.fileName)),
  )
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<string[] | null>(null)

  const toggle = (fileName: string, checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (checked) next.add(fileName)
      else next.delete(fileName)
      return next
    })
  }

  const runImport = async () => {
    if (!backend) return
    setBusy(true)
    const log: string[] = []
    for (const item of items) {
      if (!selected.has(item.fileName)) continue
      try {
        const result = await backend.publishSurvey(item.raw)
        log.push(`✓ ${result.survey.id} — опубликован (версия ${result.survey.version})`)
        for (const warning of result.warnings) log.push(`    ⚠ ${warning}`)
      } catch (error) {
        log.push(`✗ ${item.fileName} — ${errorMessage(error)}`)
      }
    }
    setReport(log)
    setBusy(false)
    onImported()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Загрузка опросов из репозитория"
      description="Файлы из каталога surveys/ будут опубликованы в хранилище"
      width="md"
      footer={
        <>
          <Button
            onClick={runImport}
            loading={busy}
            disabled={!backend || selected.size === 0}
          >
            Импортировать ({selected.size})
          </Button>
          <Button variant="subtle" onClick={onClose}>
            Закрыть
          </Button>
        </>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          title="Файлы не найдены"
          description="В каталоге surveys/ нет ни одного .md-файла."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.fileName} className="rounded-md border border-line p-3">
              <Choice
                type="checkbox"
                checked={selected.has(item.fileName)}
                disabled={!item.valid}
                onChange={(checked) => toggle(item.fileName, checked)}
                label={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted">{item.fileName}</span>
                    {item.valid ? (
                      <Badge tone="neutral">{item.id}</Badge>
                    ) : (
                      <Badge tone="danger">файл не разбирается</Badge>
                    )}
                  </span>
                }
                description={item.title ?? undefined}
              />
            </div>
          ))}

          {report ? (
            <Alert tone="info" title="Результат импорта">
              <pre className="mt-1 overflow-auto font-mono text-xs whitespace-pre-wrap">
                {report.join('\n')}
              </pre>
            </Alert>
          ) : null}
        </div>
      )}
    </Dialog>
  )
}
