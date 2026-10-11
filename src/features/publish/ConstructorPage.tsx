import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { QuestionRenderer } from '@/features/participant/QuestionRenderer'
import type { AnswerValue, Question, QuestionType, Survey, SurveyStatus } from '@/lib/survey/types'
import { parseSurveyMarkdown, surveyToMarkdown, errorIssues, validateSurvey } from '@/lib/survey'
import type { ParseIssue, ValidationIssue } from '@/lib/survey'
import { errorMessage } from '@/lib/errors'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, PageTitle } from '@/ui/card'
import { Alert } from '@/ui/feedback'
import { BareSelect, Field } from '@/ui/form'
import { EmptyState } from '@/ui/status'
import { Tabs } from '@/ui/tabs'
import { HelpDialog } from './HelpDialog'
import { QuestionEditor } from './QuestionEditor'
import { SeedImportDialog } from './SeedImportDialog'
import { SurveyMetaForm } from './SurveyMetaForm'
import { createEmptySurvey, createQuestion, nextQuestionId, QUESTION_TYPE_OPTIONS } from './questionTemplates'

type EditorTab = 'visual' | 'markdown'

interface Notice {
  tone: 'success' | 'danger' | 'warning'
  text: string
}

export function ConstructorPage() {
  const { backend } = useAuth()
  const [tab, setTab] = useState<EditorTab>('visual')
  const [survey, setSurvey] = useState<Survey>(() => createEmptySurvey())
  const [markdown, setMarkdown] = useState('')
  const [markdownIssues, setMarkdownIssues] = useState<ParseIssue[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)
  const [existing, setExisting] = useState<Survey[]>([])
  const [publishing, setPublishing] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [seedOpen, setSeedOpen] = useState(false)
  const [newType, setNewType] = useState<QuestionType>('single')
  const [previewValues, setPreviewValues] = useState<Record<string, AnswerValue>>({})

  const refreshSurveys = useCallback(async () => {
    if (!backend) return
    try {
      setExisting(await backend.listSurveys())
    } catch (error) {
      setNotice({ tone: 'danger', text: errorMessage(error) })
    }
  }, [backend])

  useEffect(() => {
    void refreshSurveys()
  }, [refreshSurveys])

  const validation = useMemo(() => validateSurvey(survey), [survey])
  const errors = validation.filter((issue) => issue.level === 'error')
  const warnings = validation.filter((issue) => issue.level === 'warning')
  const idConflict = existing.some((item) => item.id === survey.id)
  const canPublish = errors.length === 0 && survey.title.trim().length > 0 && survey.questions.length > 0

  /* ---------- операции с вопросами ---------- */

  const updateQuestion = (index: number, next: Question) =>
    setSurvey((previous) => ({
      ...previous,
      questions: previous.questions.map((item, itemIndex) => (itemIndex === index ? next : item)),
    }))

  const deleteQuestion = (index: number) =>
    setSurvey((previous) => ({
      ...previous,
      questions: previous.questions.filter((_, itemIndex) => itemIndex !== index),
    }))

  const duplicateQuestion = (index: number) =>
    setSurvey((previous) => {
      const source = previous.questions[index]
      if (!source) return previous
      const copy = {
        ...source,
        id: nextQuestionId(previous.questions),
        // Варианты копируем отдельным массивом, чтобы правки не затрагивали оригинал
        options:
          source.type === 'single' || source.type === 'multi' ? [...source.options] : undefined,
      } as Question
      const questions = [...previous.questions]
      questions.splice(index + 1, 0, copy)
      return { ...previous, questions }
    })

  const moveQuestion = (index: number, direction: -1 | 1) =>
    setSurvey((previous) => {
      const target = index + direction
      if (target < 0 || target >= previous.questions.length) return previous
      const questions = [...previous.questions]
      const moved = questions[index]
      const other = questions[target]
      if (!moved || !other) return previous
      questions[index] = other
      questions[target] = moved
      return { ...previous, questions }
    })

  const addQuestion = () =>
    setSurvey((previous) => ({
      ...previous,
      questions: [...previous.questions, createQuestion(newType, nextQuestionId(previous.questions))],
    }))

  /* ---------- переключение вкладок ---------- */

  const switchTab = (next: EditorTab) => {
    if (next === tab) return
    setNotice(null)

    if (next === 'markdown') {
      setMarkdown(surveyToMarkdown(survey))
      setMarkdownIssues([])
      setTab('markdown')
      return
    }

    if (!markdown.trim()) {
      setTab('visual')
      return
    }

    const result = parseSurveyMarkdown(markdown)
    if (!result.ok) {
      setMarkdownIssues(errorIssues(result.issues))
      setNotice({
        tone: 'danger',
        text: 'В markdown есть ошибки — исправьте их, чтобы вернуться в конструктор.',
      })
      return
    }
    setSurvey(result.survey)
    setMarkdownIssues(result.issues)
    setTab('visual')
  }

  /* ---------- публикация ---------- */

  const publish = async (status: SurveyStatus) => {
    if (!backend) return
    setNotice(null)

    const next: Survey = { ...survey, status }
    const blocking = validateSurvey(next).filter((issue) => issue.level === 'error')
    if (blocking.length > 0) {
      setNotice({ tone: 'danger', text: blocking.map((issue) => issue.message).join('\n') })
      return
    }

    const md = surveyToMarkdown(next)
    const check = parseSurveyMarkdown(md)
    if (!check.ok) {
      setNotice({
        tone: 'danger',
        text: errorIssues(check.issues)
          .map((issue) => (issue.line ? `строка ${issue.line}: ${issue.message}` : issue.message))
          .join('\n'),
      })
      return
    }

    setPublishing(true)
    try {
      const result = await backend.publishSurvey(md)
      setSurvey(result.survey)
      const parts = [`Опрос «${result.survey.title}» сохранён, версия ${result.survey.version}.`]
      parts.push(...result.warnings.map((warning) => `⚠ ${warning}`))
      setNotice({ tone: 'success', text: parts.join('\n') })
      await refreshSurveys()
    } catch (error) {
      setNotice({ tone: 'danger', text: errorMessage(error) })
    } finally {
      setPublishing(false)
    }
  }

  const downloadMarkdown = () => {
    const md = tab === 'markdown' ? markdown : surveyToMarkdown(survey)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${survey.id || 'opros'}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const loadExisting = (id: string) => {
    const target = existing.find((item) => item.id === id)
    if (!target) return
    setSurvey(target)
    setPreviewValues({})
    setNotice({ tone: 'warning', text: `Загружен опрос «${target.title}» (версия ${target.version}).` })
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Опросы"
        description="Создание и редактирование опросов: конструктор или разметка .md"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)}>
              Справка
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSeedOpen(true)}>
              Из репозитория
            </Button>
            <Button variant="subtle" size="sm" onClick={downloadMarkdown}>
              Скачать .md
            </Button>
            <Button variant="secondary" size="sm" loading={publishing} disabled={!canPublish} onClick={() => publish('draft')}>
              Сохранить черновик
            </Button>
            <Button size="sm" loading={publishing} disabled={!canPublish} onClick={() => publish(survey.status === 'closed' ? 'closed' : 'active')}>
              {survey.status === 'closed' ? 'Сохранить закрытым' : 'Опубликовать'}
            </Button>
          </div>
        }
      />

      {notice ? (
        <Alert tone={notice.tone} title={notice.tone === 'success' ? 'Готово' : undefined}>
          <span className="whitespace-pre-wrap">{notice.text}</span>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {existing.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-muted">
            Открыть существующий:
            <BareSelect value="" onChange={(event) => loadExisting(event.target.value)} className="min-w-72">
              <option value="">— выбрать —</option>
              {existing.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {item.status} · v{item.version}
                </option>
              ))}
            </BareSelect>
          </label>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSurvey(createEmptySurvey())
            setPreviewValues({})
            setMarkdown('')
            setNotice(null)
          }}
        >
          Новый опрос
        </Button>
      </div>

      <Tabs<EditorTab>
        items={[
          { value: 'visual', label: 'Конструктор' },
          { value: 'markdown', label: 'Markdown' },
        ]}
        value={tab}
        onChange={switchTab}
      />

      {errors.length > 0 ? (
        <Alert tone="danger" title="Исправьте ошибки перед публикацией">
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {errors.map((issue, index) => (
              <li key={index}>{issueText(issue, survey)}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {warnings.length > 0 ? (
        <Alert tone="warning" title="Предупреждения">
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {warnings.map((issue, index) => (
              <li key={index}>{issueText(issue, survey)}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {tab === 'markdown' ? (
        <MarkdownTab
          markdown={markdown}
          onChange={(value) => {
            setMarkdown(value)
            setNotice(null)
          }}
          issues={markdownIssues}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4">
            <SurveyMetaForm
              survey={survey}
              idConflict={idConflict}
              onChange={(patch) => setSurvey((previous) => ({ ...previous, ...patch }))}
            />

            <div className="space-y-4">
              {survey.questions.length === 0 ? (
                <EmptyState
                  title="Вопросов пока нет"
                  description="Добавьте первый вопрос — выберите тип и нажмите «Добавить»."
                />
              ) : (
                survey.questions.map((question, index) => (
                  <QuestionEditor
                    key={`${question.id}-${index}`}
                    question={question}
                    index={index}
                    total={survey.questions.length}
                    onChange={(next) => updateQuestion(index, next)}
                    onDelete={() => deleteQuestion(index)}
                    onDuplicate={() => duplicateQuestion(index)}
                    onMove={(direction) => moveQuestion(index, direction)}
                  />
                ))
              )}
            </div>

            <Card>
              <CardContent className="flex flex-wrap items-end gap-3">
                <Field label="Тип нового вопроса" className="min-w-64 flex-1">
                  <BareSelect
                    value={newType}
                    onChange={(event) => setNewType(event.target.value as QuestionType)}
                    className="h-11 w-full px-4 text-base"
                  >
                    {QUESTION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} — {option.hint}
                      </option>
                    ))}
                  </BareSelect>
                </Field>
                <Button onClick={addQuestion}>+ Добавить вопрос</Button>
              </CardContent>
            </Card>
          </div>

          <PreviewPanel
            survey={survey}
            values={previewValues}
            onChange={setPreviewValues}
          />
        </div>
      )}

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onInsertTemplate={(value) => {
          setMarkdown(value)
          setTab('markdown')
          setNotice({ tone: 'warning', text: 'Шаблон вставлен во вкладку Markdown.' })
        }}
      />

      <SeedImportDialog
        open={seedOpen}
        onClose={() => setSeedOpen(false)}
        backend={backend}
        onImported={() => void refreshSurveys()}
      />
    </div>
  )
}

function issueText(issue: ValidationIssue, survey: Survey): string {
  if (issue.questionIndex === null) return issue.message
  const question = survey.questions[issue.questionIndex]
  return question ? `Вопрос ${issue.questionIndex + 1} (${question.id}): ${issue.message}` : issue.message
}

function MarkdownTab({
  markdown,
  onChange,
  issues,
}: {
  markdown: string
  onChange: (value: string) => void
  issues: ParseIssue[]
}) {
  const result = useMemo(
    () => (markdown.trim() ? parseSurveyMarkdown(markdown) : null),
    [markdown],
  )

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <textarea
          value={markdown}
          onChange={(event) => onChange(event.target.value)}
          rows={28}
          spellCheck={false}
          className="w-full rounded-md border border-line bg-surface p-4 font-mono text-sm leading-relaxed text-fg focus:border-brand focus:outline-none"
          placeholder="Вставьте содержимое .md файла…"
        />

        {issues.length > 0 ? (
          <Alert tone="danger" title="Ошибки разбора">
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {issues.map((issue, index) => (
                <li key={index}>
                  {issue.line ? `строка ${issue.line}: ` : ''}
                  {issue.message}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </div>

      <Card className="self-start">
        <CardHeader title="Проверка" description="Обновляется при вводе" />
        <CardContent className="space-y-2 text-sm">
          {!result ? (
            <p className="text-muted">
              Начните вводить разметку — проверка запустится автоматически. Переключение на вкладку
              «Конструктор» перенесёт разобранный опрос в визуальный редактор.
            </p>
          ) : result.ok ? (
            <>
              <p className="flex items-center gap-2 font-semibold text-success">
                <Badge tone="success">разобрано</Badge>
                {result.survey.questions.length} вопросов
              </p>
              <p className="text-fg">{result.survey.title || 'Без названия'}</p>
              <p className="text-muted">
                id: <span className="font-mono text-fg">{result.survey.id}</span>
              </p>
              <p className="text-muted">
                статус: <span className="font-mono text-fg">{result.survey.status}</span>
              </p>
              {result.issues.length > 0 ? (
                <ul className="mt-2 space-y-1 border-t border-line pt-2">
                  {result.issues.map((issue, index) => (
                    <li key={index} className="text-warning">
                      ⚠ {issue.line ? `строка ${issue.line}: ` : ''}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 font-semibold text-danger">
                <Badge tone="danger">есть ошибки</Badge>
                {errorIssues(result.issues).length}
              </p>
              <ul className="mt-2 space-y-1">
                {errorIssues(result.issues).map((issue, index) => (
                  <li key={index} className="text-danger">
                    ✗ {issue.line ? `строка ${issue.line}: ` : ''}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PreviewPanel({
  survey,
  values,
  onChange,
}: {
  survey: Survey
  values: Record<string, AnswerValue>
  onChange: (values: Record<string, AnswerValue>) => void
}) {
  return (
    <div className="scrollbar-thin space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-auto xl:pr-1">
      <div className="rounded-lg border border-line bg-raised p-5 shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide text-muted uppercase">
              Предпросмотр
            </div>
            <h3 className="mt-1 text-xl font-semibold break-words text-fg">
              {survey.title || 'Без названия'}
            </h3>
          </div>
          <Badge tone="neutral">{survey.status}</Badge>
        </div>
        {survey.intro.trim() ? (
          <p className="mt-3 text-sm whitespace-pre-wrap text-muted">{survey.intro}</p>
        ) : null}
      </div>

      {survey.questions.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Вопросов пока нет.</p>
          </CardContent>
        </Card>
      ) : (
        survey.questions.map((question, index) => (
          <QuestionRenderer
            key={`${question.id}-${index}`}
            question={question}
            index={index + 1}
            value={values[question.id] ?? {}}
            onChange={(value) => onChange({ ...values, [question.id]: value })}
          />
        ))
      )}
    </div>
  )
}
