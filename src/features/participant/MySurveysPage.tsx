import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import type { Survey } from '@/lib/survey'
import { formatDate } from '@/lib/format'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, Section } from '@/ui/card'
import { EmptyState, Loading } from '@/ui/status'
import type { BadgeTone } from '@/ui/badge'

const STATUS_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  active: { tone: 'success', label: 'Доступен' },
  closed: { tone: 'neutral', label: 'Завершён' },
  draft: { tone: 'warning', label: 'Черновик' },
}

export function MySurveysPage() {
  const { user, backend } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!backend || !user) return
    Promise.all([backend.listSurveys(), backend.getMyResponses()]).then(([all, my]) => {
      setSurveys(all.filter((s) => s.status !== 'draft' || user.role === 'moderator'))
      setCompletedIds(new Set(my.map((r) => r.surveyId)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [backend, user])

  if (loading) return <Loading />

  const available = surveys.filter((s) => s.status === 'active' && !completedIds.has(s.id))
  const completed = surveys.filter((s) => completedIds.has(s.id))
  const closed = surveys.filter((s) => s.status === 'closed' && !completedIds.has(s.id))

  return (
    <div className="space-y-10">
      <Section title="Доступные опросы" description="Опросы, которые вы ещё не проходили">
        {available.length === 0 ? (
          <EmptyState title="Нет доступных опросов" description="Сейчас нет активных опросов, которые вы могли бы пройти." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {available.map((s) => (
              <SurveyCard key={s.id} survey={s} action={<Link to={`/survey/${s.id}`}><Button size="sm">Пройти</Button></Link>} />
            ))}
          </div>
        )}
      </Section>

      {completed.length > 0 && (
        <Section title="Пройденные опросы" description="Вы уже ответили на эти вопросы">
          <div className="grid gap-4 md:grid-cols-2">
            {completed.map((s) => (
              <SurveyCard key={s.id} survey={s} action={<Badge tone="success">Пройден</Badge>} />
            ))}
          </div>
        </Section>
      )}

      {closed.length > 0 && (
        <Section title="Завершённые опросы" description="Эти опросы больше не принимают ответы">
          <div className="grid gap-4 md:grid-cols-2">
            {closed.map((s) => (
              <SurveyCard key={s.id} survey={s} action={<Badge tone="neutral">Закрыт</Badge>} />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function SurveyCard({ survey, action }: { survey: Survey; action: React.ReactNode }) {
  const badge = STATUS_BADGE[survey.status]
  if (!badge) return null
  return (
    <Card hover>
      <CardHeader
        title={survey.title}
        description={`ID: ${survey.id}`}
        actions={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />
      <CardContent className="flex items-end justify-between gap-4">
        <div className="text-sm text-muted">
          {survey.startsAt && <span>{formatDate(survey.startsAt)}</span>}
          {survey.endsAt && <span> — {formatDate(survey.endsAt)}</span>}
          <div className="mt-1">{survey.questions.length} вопросов</div>
        </div>
        {action}
      </CardContent>
    </Card>
  )
}
