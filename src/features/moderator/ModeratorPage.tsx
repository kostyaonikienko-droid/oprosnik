import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import type { ResponseRecord, Survey } from '@/lib/survey'
import { answerToText } from '@/lib/survey/answers'
import { aggregate, pivot, isPercentMeasure } from '@/lib/stats'
import type { Dimension, Measure, PivotConfig, QuestionStat, SurveyStats } from '@/lib/stats'
import { DIMENSION_LABELS, MEASURE_LABELS } from '@/lib/stats'
import { exportSurveyXlsx } from '@/lib/excel/export'
import { answersLabel, formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format'
import { Badge } from '@/ui/badge'
import { Button, buttonClasses } from '@/ui/button'
import { Card, CardContent, CardHeader, PageTitle } from '@/ui/card'
import { Alert } from '@/ui/feedback'
import { BareSelect } from '@/ui/form'
import { Metric, Loading, EmptyState } from '@/ui/status'
import { Table, TBody, TD, TFoot, THead, TH, TR, TableWrap } from '@/ui/table'
import { Tabs } from '@/ui/tabs'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ModeratorTab = 'overview' | 'questions' | 'pivot' | 'responses'

const STATUS_TONE: Record<Survey['status'], 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  draft: 'warning',
  closed: 'neutral',
}

const STATUS_LABEL: Record<Survey['status'], string> = {
  active: 'Активен',
  draft: 'Черновик',
  closed: 'Закрыт',
}

export function ModeratorPage() {
  const { backend } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [records, setRecords] = useState<ResponseRecord[]>([])
  const [participants, setParticipants] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ModeratorTab>('overview')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!backend) return
    let cancelled = false
    backend
      .listSurveys()
      .then((all) => {
        if (cancelled) return
        setSurveys(all)
        const preferred = all.find((s) => s.status === 'active') ?? all[0]
        if (preferred) setSelectedId(preferred.id)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Не удалось загрузить список опросов')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [backend])

  useEffect(() => {
    if (!backend || !selectedId) return
    let cancelled = false
    setLoading(true)
    Promise.all([backend.getSurveyResponses(selectedId), backend.getProgress(selectedId)])
      .then(([rows, progress]) => {
        if (cancelled) return
        setRecords(rows)
        setParticipants(progress.participants)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Не удалось загрузить ответы')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [backend, selectedId])

  const survey = useMemo(
    () => surveys.find((item) => item.id === selectedId) ?? null,
    [surveys, selectedId],
  )

  const stats = useMemo<SurveyStats | null>(
    () => (survey ? aggregate(survey, records, participants) : null),
    [survey, records, participants],
  )

  const exportXlsx = useCallback(async () => {
    if (!survey || !stats) return
    setExporting(true)
    try {
      await exportSurveyXlsx(survey, stats, records)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сформировать файл')
    } finally {
      setExporting(false)
    }
  }, [survey, stats, records])

  if (loading && surveys.length === 0) return <Loading label="Загрузка опросов…" />

  return (
    <div className="space-y-8">
      <PageTitle
        title="Модерация"
        description="Просмотр ответов, статистика и сводные таблицы по опросам"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <BareSelect
              aria-label="Выбор опроса"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="min-w-72"
            >
              {surveys.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} — {STATUS_LABEL[item.status]}
                </option>
              ))}
            </BareSelect>
            <Link to="/publish" className={buttonClasses('secondary', 'sm')}>
              Новый опрос
            </Link>
            <Button variant="primary" size="sm" loading={exporting} onClick={exportXlsx} disabled={!stats}>
              Экспорт .xlsx
            </Button>
          </div>
        }
      />

      {error ? (
        <Alert tone="danger" title="Ошибка">
          {error}
        </Alert>
      ) : null}

      {!survey || !stats ? (
        <EmptyState
          title="Опросы не найдены"
          description="Опубликуйте первый опрос, чтобы начать сбор ответов."
          action={
            <Link to="/publish" className={buttonClasses('primary', 'md')}>
              Опубликовать опрос
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Собрано ответов" value={formatNumber(stats.respondents)} tone="brand" />
            <Metric
              label="Доля прошедших"
              value={formatPercent(stats.completionRate, 0)}
              hint={`${formatNumber(stats.registeredParticipants)} зарегистрировано`}
            />
            <Metric label="Вопросов" value={formatNumber(survey.questions.length)} />
            <Metric
              label="Статус"
              value={<Badge tone={STATUS_TONE[survey.status]}>{STATUS_LABEL[survey.status]}</Badge>}
              hint={`${formatDate(survey.startsAt)} — ${formatDate(survey.endsAt)}`}
            />
          </div>

          <Tabs<ModeratorTab>
            items={[
              { value: 'overview', label: 'Обзор' },
              { value: 'questions', label: 'По вопросам', count: survey.questions.length },
              { value: 'pivot', label: 'Сводная таблица' },
              { value: 'responses', label: 'Ответы', count: records.length },
            ]}
            value={tab}
            onChange={setTab}
          />

          {loading ? (
            <Loading label="Загрузка ответов…" />
          ) : (
            <>
              {tab === 'overview' && <OverviewTab stats={stats} />}
              {tab === 'questions' && <QuestionsTab stats={stats} />}
              {tab === 'pivot' && <PivotTab survey={survey} records={records} />}
              {tab === 'responses' && <ResponsesTab survey={survey} records={records} />}
            </>
          )}
        </>
      )}
    </div>
  )
}

function OverviewTab({ stats }: { stats: SurveyStats }) {
  const deptData = stats.byDepartment.map((group) => ({
    name: group.key,
    count: group.respondents,
  }))
  const timeline = stats.timeline.map((point) => ({
    name: formatDate(point.date),
    count: point.count,
  }))

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ответы по подразделениям" />
          <CardContent>
            {deptData.length === 0 ? (
              <p className="text-sm text-muted">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, deptData.length * 34)}>
                <BarChart data={deptData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line-border)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Ответов" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Динамика поступления ответов" />
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Ответов" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Распределение по должностям" />
          <CardContent>
            <TableWrap maxHeight={360}>
              <Table>
                <THead>
                  <TR>
                    <TH>Должность</TH>
                    <TH align="right">Ответов</TH>
                    <TH align="right">Доля</TH>
                  </TR>
                </THead>
                <TBody>
                  {stats.byPosition.map((group) => (
                    <TR key={group.key}>
                      <TD>{group.key}</TD>
                      <TD numeric align="right">{formatNumber(group.respondents)}</TD>
                      <TD numeric align="right">{formatPercent(group.ratio)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Комментарии участников"
            description={`${formatNumber(stats.comments.length)} записей`}
          />
          <CardContent>
            {stats.comments.length === 0 ? (
              <p className="text-sm text-muted">Комментариев нет</p>
            ) : (
              <ul className="scrollbar-thin max-h-80 space-y-3 overflow-auto pr-1">
                {stats.comments.slice(0, 50).map((comment, index) => (
                  <li key={index} className="rounded-md border border-line bg-sunken p-3 text-sm">
                    <div className="text-xs text-muted">
                      {comment.respondent} · {comment.department}
                    </div>
                    <div className="mt-1 text-fg">{comment.comment}</div>
                    <div className="mt-1 text-xs text-faint">{comment.questionText}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuestionsTab({ stats }: { stats: SurveyStats }) {
  return (
    <div className="space-y-6">
      {stats.questions.map((question, index) => (
        <QuestionCard key={question.questionId} stat={question} index={index + 1} />
      ))}
    </div>
  )
}

function QuestionCard({ stat, index }: { stat: QuestionStat; index: number }) {
  const chartData = stat.options.map((option) => ({
    name: option.label.length > 26 ? `${option.label.slice(0, 25)}…` : option.label,
    count: option.count,
  }))

  return (
    <Card>
      <CardHeader
        title={`${index}. ${stat.questionText}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{stat.questionType}</Badge>
            <span>{answersLabel(stat.answered)}</span>
            {stat.skipped > 0 ? <span className="text-faint">пропустили: {stat.skipped}</span> : null}
            {stat.agreementIndex !== null ? (
              <Badge tone={stat.agreementIndex >= 0.6 ? 'success' : 'warning'}>
                индекс согласия {formatPercent(stat.agreementIndex, 0)}
              </Badge>
            ) : null}
          </span>
        }
      />
      <CardContent className="space-y-4">
        {stat.options.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Вариант</TH>
                    <TH align="right">Кол-во</TH>
                    <TH align="right">Доля</TH>
                  </TR>
                </THead>
                <TBody>
                  {stat.options.map((option) => (
                    <TR key={option.label}>
                      <TD>{option.label}</TD>
                      <TD numeric align="right">{formatNumber(option.count)}</TD>
                      <TD numeric align="right">{formatPercent(option.ratio)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 34)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line-border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Ответов" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {stat.number ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Среднее" value={formatNumber(stat.number.mean ?? 0, 2)} tone="brand" />
            <Metric label="Медиана" value={formatNumber(stat.number.median ?? 0, 1)} />
            <Metric label="Минимум" value={formatNumber(stat.number.min ?? 0)} />
            <Metric label="Максимум" value={formatNumber(stat.number.max ?? 0)} />
            {stat.number.histogram.length > 0 ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stat.number.histogram}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line-border)" />
                    <XAxis dataKey="value" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Ответов" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>
        ) : null}

        {stat.texts.length > 0 ? (
          <div className="scrollbar-thin max-h-72 space-y-2 overflow-auto pr-1">
            {stat.texts.map((item) => (
              <div key={item.responseId} className="rounded-md border border-line bg-sunken p-3 text-sm">
                <div className="text-xs text-muted">
                  {item.respondent} · {item.department} · {formatDateTime(item.submittedAt)}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-fg">{item.text}</div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function PivotTab({ survey, records }: { survey: Survey; records: ResponseRecord[] }) {
  const [config, setConfig] = useState<PivotConfig>({ dimension: 'department', measure: 'colPct' })
  const table = useMemo(() => pivot(survey, records, config), [survey, records, config])
  const percent = isPercentMeasure(config.measure)

  if (records.length === 0) {
    return <EmptyState title="Нет ответов" description="Сводная таблица появится после первых ответов." />
  }

  const format = (value: number | null): string => {
    if (value === null) return '—'
    return percent ? `${formatNumber(value, 1)}%` : formatNumber(value, config.measure === 'avg' ? 2 : 0)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1.5">
          <span className="block text-sm font-semibold text-fg">Столбцы</span>
          <BareSelect
            value={config.dimension}
            onChange={(event) => setConfig((prev) => ({ ...prev, dimension: event.target.value as Dimension }))}
            className="min-w-56"
          >
            {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </BareSelect>
        </label>

        <label className="space-y-1.5">
          <span className="block text-sm font-semibold text-fg">Значение</span>
          <BareSelect
            value={config.measure}
            onChange={(event) => setConfig((prev) => ({ ...prev, measure: event.target.value as Measure }))}
            className="min-w-56"
          >
            {Object.entries(MEASURE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </BareSelect>
        </label>

        <span className="pb-2 text-sm text-muted">
          Респондентов: {formatNumber(table.grandTotal)}
        </span>
      </div>

      <TableWrap maxHeight={680}>
        <Table>
          <THead>
            <TR>
              <TH className="min-w-72">Вопрос / вариант</TH>
              {table.columns.map((column, index) => (
                <TH key={column} align="right">
                  {column}
                  <span className="ml-1 font-normal normal-case text-faint">
                    ({table.columnRespondents[index]})
                  </span>
                </TH>
              ))}
              <TH align="right">Итого</TH>
            </TR>
          </THead>
          <TBody>
            {table.rows.map((row) => (
              <TR key={row.key}>
                <TD>
                  <div className="text-xs text-muted">{row.questionText}</div>
                  <div className={row.kind === 'option' ? 'font-medium text-fg' : 'text-muted italic'}>
                    {row.label}
                  </div>
                </TD>
                {row.values.map((value, index) => (
                  <TD key={index} numeric align="right">{format(value)}</TD>
                ))}
                <TD numeric align="right" className="font-semibold">{format(row.total)}</TD>
              </TR>
            ))}
          </TBody>
          <TFoot>
            <TR>
              <TD>Респондентов в группе</TD>
              {table.columnRespondents.map((count, index) => (
                <TD key={index} numeric align="right">{formatNumber(count)}</TD>
              ))}
              <TD numeric align="right">{formatNumber(table.grandTotal)}</TD>
            </TR>
          </TFoot>
        </Table>
      </TableWrap>

      <p className="text-xs text-muted">
        Процент считается от числа ответивших на вопрос в соответствующей группе.
        Для множественного выбора сумма по строке может превышать 100%.
      </p>
    </div>
  )
}

function ResponsesTab({ survey, records }: { survey: Survey; records: ResponseRecord[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return records
    return records.filter((record) => {
      const { fullName, department, position } = record.respondent
      return (
        fullName.toLowerCase().includes(query) ||
        department.toLowerCase().includes(query) ||
        position.toLowerCase().includes(query)
      )
    })
  }, [records, search])

  if (records.length === 0) {
    return <EmptyState title="Ответов пока нет" description="Как только участники пройдут опрос, ответы появятся здесь." />
  }

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Поиск по ФИО, подразделению или должности…"
        className="w-full max-w-md rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none"
      />

      <TableWrap maxHeight={680}>
        <Table>
          <THead>
            <TR>
              <TH className="min-w-52">ФИО</TH>
              <TH className="min-w-40">Подразделение</TH>
              <TH className="min-w-36">Должность</TH>
              <TH className="min-w-32">Отправлено</TH>
              {survey.questions.map((question, index) => (
                <TH key={question.id} className="min-w-48">
                  {index + 1}. {question.text}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {filtered.map((record) => (
              <TR key={record.id}>
                <TD className="font-semibold whitespace-nowrap">{record.respondent.fullName}</TD>
                <TD>{record.respondent.department || '—'}</TD>
                <TD>{record.respondent.position || '—'}</TD>
                <TD className="whitespace-nowrap">{formatDateTime(record.submittedAt)}</TD>
                {survey.questions.map((question) => {
                  const answer = record.answers[question.id]
                  const text = answerToText(answer)
                  return (
                    <TD key={question.id} className="max-w-80 align-top">
                      <div className="truncate" title={text || undefined}>{text || '—'}</div>
                      {answer?.comment ? (
                        <div className="mt-1 text-xs text-muted italic" title={answer.comment}>
                          💬 {answer.comment}
                        </div>
                      ) : null}
                    </TD>
                  )
                })}
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>

      <p className="text-sm text-muted">
        Показано {formatNumber(filtered.length)} из {formatNumber(records.length)} записей
      </p>
    </div>
  )
}
