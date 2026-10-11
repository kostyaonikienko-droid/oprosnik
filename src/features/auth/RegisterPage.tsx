import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { AppError } from '@/lib/errors'
import { Alert } from '@/ui/feedback'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader } from '@/ui/card'
import { Field, Input } from '@/ui/form'
import { PageTitle } from '@/ui/card'

export function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', fullName: '', department: '', position: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signUp(form)
      navigate('/me')
    } catch (err) {
      setError(err instanceof AppError ? err.message : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pt-12">
      <PageTitle title="Регистрация" description="Создайте аккаунт для прохождения опросов" />

      <Card>
        <CardHeader title="Новый аккаунт" />
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="ФИО" required>
              <Input value={form.fullName} onChange={set('fullName')} placeholder="Иванова Мария Петровна" required />
            </Field>
            <Field label="Подразделение" required>
              <Input value={form.department} onChange={set('department')} placeholder="Отдел метрологии" required />
            </Field>
            <Field label="Должность" required>
              <Input value={form.position} onChange={set('position')} placeholder="Инженер" required />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="ivanova@csm.local" required />
            </Field>
            <Field label="Пароль" hint="Минимум 6 символов" required>
              <Input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required minLength={6} />
            </Field>
            <Button type="submit" loading={loading} className="w-full">Зарегистрироваться</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="font-semibold text-brand hover:underline">Войти</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
