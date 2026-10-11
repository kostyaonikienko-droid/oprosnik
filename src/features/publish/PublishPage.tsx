import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { parseSurveyMarkdown, validateSurvey, hasErrors } from '@/lib/survey'
import type { Survey } from '@/lib/survey'
import { AppError } from '@/lib/errors'
import { Alert } from '@/ui/feedback'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, Section, PageTitle } from '@/ui/card'
import { Field, Textarea } from '@/ui/form'
import { Badge } from '@/ui/badge'

export function PublishPage() {
  const { backend } = useAuth()
  const [markdown, setMarkdown] = useState('')
  const [preview, setPreview] = useState<Survey | null>(null)
  const [issues, setIssues] = useState<{ line: number | null; message: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const parse = () => {
    setIssues([])
    setPreview(null)
    setError(null)
    setSuccess(false)
    if (!markdown.trim()) return
    const result = parseSurveyMarkdown(markdown)
    if (result.ok) {
      const structural = validateSurvey(result.survey)
      if (hasErrors(structural)) {
        setIssues(structural.filter((i) => i.level === 'error').map((i) => ({ line: null, message: i.message })))
        return
      }
      setPreview(result.survey)
      setIssues(result.issues)
    } else {
      setIssues(result.issues)
    }
  }

  const publish = async (status: 'draft' | 'active') => {
    if (!backend || !markdown.trim()) return
    setError(null)
    setPublishing(true)
    try {
      const md = status === 'draft' ? markdown : markdown.replace(/^status:\s*\w+/m, `status: ${status}`)
      await backend.publishSurvey(md)
      setSuccess(true)
      setMarkdown('')
      setPreview(null)
    } catch (err) {
      setError(err instanceof AppError ? err.message : 'Ошибка публикации')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Публикация опроса" description="Вставьте содержимое .md файла, проверьте предпросмотр и опубликуйте" />

      {success && <Alert tone="success" title="Опубликовано">Опрос успешно сохранён</Alert>}
      {error && <Alert tone="danger" title="Ошибка">{error}</Alert>}

      <Card>
        <CardHeader title="Исходный Markdown" actions={<Button variant="subtle" size="sm" onClick={parse}>Проверить</Button>} />
        <CardContent>
          <Field hint="Вставьте содержимое .md файла с вопросами">
            <Textarea rows={16} value={markdown} onChange={(e) => setMarkdown(e.target.value)} placeholder={`---\nid: my-survey\ntitle: Мой опрос\nstatus: draft\n---\n\n# Приветствие\n\n## Вопрос? {#q1 type=single required}\n- Вариант 1\n- Вариант 2`} className="font-mono text-sm" />
          </Field>
        </CardContent>
      </Card>

      {issues.length > 0 && (
        <Card>
          <CardHeader title="Замечания" />
          <CardContent>
            <ul className="space-y-1">
              {issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge tone="warning">строка {issue.line ?? '?'}</Badge>
                  <span className="text-fg">{issue.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Section title="Предпросмотр" actions={
          <div className="flex gap-2">
            <Button variant="subtle" loading={publishing} onClick={() => publish('draft')}>Сохранить черновик</Button>
            <Button loading={publishing} onClick={() => publish('active')}>Опубликовать</Button>
          </div>
        }>
          <Card>
            <CardHeader title={preview.title} description={`${preview.questions.length} вопросов · ${preview.status}`} />
            <CardContent>
              {preview.intro && <p className="mb-4 text-sm text-muted whitespace-pre-wrap">{preview.intro}</p>}
              <ol className="space-y-3">
                {preview.questions.map((q, i) => (
                  <li key={q.id} className="rounded-md border border-line bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-muted">{i + 1}.</span>
                      <span className="text-sm font-semibold text-fg">{q.text}</span>
                      <Badge tone="neutral">{q.type}</Badge>
                      {q.required && <Badge tone="danger">обязательный</Badge>}
                    </div>
                    {(q.type === 'single' || q.type === 'multi') && (
                      <ul className="mt-2 ml-6 list-disc space-y-1 text-sm text-muted">
                        {q.options.map((opt, j) => <li key={j}>{opt}</li>)}
                      </ul>
                    )}
                    {q.type === 'agree' && <p className="mt-1 ml-6 text-xs text-muted">Шкала согласия ({q.scale ?? 5} пунктов)</p>}
                    {q.type === 'number' && <p className="mt-1 ml-6 text-xs text-muted">{q.min}–{q.max}{q.slider ? ' (слайдер)' : ''}</p>}
                    {q.type === 'text' && <p className="mt-1 ml-6 text-xs text-muted">Текст, {q.rows ?? 4} строк</p>}
                    {q.comment !== 'off' && <p className="mt-1 ml-6 text-xs text-accent">+ комментарий ({q.comment})</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </Section>
      )}
    </div>
  )
}
