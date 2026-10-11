import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import type { AnswerValue, Survey } from '@/lib/survey'
import { emptyValue, isAnswered, toStoredAnswer, validateAnswer } from '@/lib/survey/answers'
import { AppError } from '@/lib/errors'
import { Alert, Progress } from '@/ui/feedback'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader } from '@/ui/card'
import { Loading } from '@/ui/status'
import { QuestionRenderer } from './QuestionRenderer'

const DRAFT_KEY = 'oprosnik:draft:'

export function SurveyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { backend, user } = useAuth()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, AnswerValue>>({})
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const draftKey = `${DRAFT_KEY}${id}`

  useEffect(() => {
    if (!backend || !id) return
    Promise.all([backend.getSurvey(id), backend.checkAvailability(id)])
      .then(([s, avail]) => {
        if (!s) { setError('Опрос не найден'); setLoading(false); return }
        if (!avail.available) { setError(avail.reason ?? 'Опрос недоступен'); setLoading(false); return }
        setSurvey(s)
        try {
          const saved = localStorage.getItem(draftKey)
          if (saved) setValues(JSON.parse(saved))
        } catch {}
        setLoading(false)
      })
      .catch((err) => { setError(err instanceof AppError ? err.message : 'Ошибка загрузки'); setLoading(false) })
  }, [backend, id, draftKey])

  useEffect(() => {
    if (!survey) return
    const timer = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(values)) } catch {}
    }, 300)
    return () => clearTimeout(timer)
  }, [values, survey, draftKey])

  const updateValue = (questionId: string, value: AnswerValue) => {
    setValues((prev) => ({ ...prev, [questionId]: value }))
    setErrors((prev) => { const next = { ...prev }; delete next[questionId]; return next })
  }

  const answeredCount = useMemo(() => {
    if (!survey) return 0
    return survey.questions.filter((q) => isAnswered(q, values[q.id])).length
  }, [survey, values])

  const progress = survey ? (answeredCount / survey.questions.length) * 100 : 0

  const submit = async () => {
    if (!survey || !backend || !user) return
    const newErrors: Record<string, string> = {}
    for (const q of survey.questions) {
      const err = validateAnswer(q, values[q.id])
      if (err) newErrors[q.id] = err
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setSubmitting(true)
    try {
      const answers = survey.questions.map((q) => toStoredAnswer(q, values[q.id]))
      await backend.submitResponse({ surveyId: survey.id, answers })
      try { localStorage.removeItem(draftKey) } catch {}
      navigate('/me')
    } catch (err) {
      setError(err instanceof AppError ? err.message : 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loading />
  if (error) return <Alert tone="danger" title="Ошибка">{error}</Alert>
  if (!survey) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader title={survey.title} description={survey.intro} />
        <CardContent>
          <Progress value={progress} label={`Вопросов отвечено: ${answeredCount} из ${survey.questions.length}`} />
        </CardContent>
      </Card>

      {survey.questions.map((q, index) => (
        <QuestionRenderer
          key={q.id}
          question={q}
          index={index + 1}
          value={values[q.id] ?? emptyValue()}
          onChange={(v) => updateValue(q.id, v)}
          error={errors[q.id]}
        />
      ))}

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="subtle" onClick={() => navigate('/me')}>Отмена</Button>
        <Button loading={submitting} onClick={submit}>Отправить ответы</Button>
      </div>
    </div>
  )
}
