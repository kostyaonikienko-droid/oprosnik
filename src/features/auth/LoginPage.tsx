import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { AppError } from '@/lib/errors'
import { Alert } from '@/ui/feedback'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader } from '@/ui/card'
import { Field, Input } from '@/ui/form'
import { PageTitle } from '@/ui/card'

export function LoginPage() {
  const { signIn, demoHint, backendError } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/me')
    } catch (err) {
      setError(err instanceof AppError ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pt-12">
      <PageTitle title="Вход в систему" description="Введите email и пароль для доступа к опросам" />

      {backendError && (
        <Alert tone="danger" title="Хранилище не настроено">{backendError}</Alert>
      )}

      {demoHint && (
        <Alert tone="info" title="Демо-режим">
          <p>Модератор: {demoHint.moderator}</p>
          <p>Участник: {demoHint.participant}</p>
          <p>Пароль: {demoHint.password}</p>
        </Alert>
      )}

      <Card>
        <CardHeader title="Авторизация" />
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivan@csm.local" required />
            </Field>
            <Field label="Пароль" required>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </Field>
            <Button type="submit" loading={loading} className="w-full">Войти</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            Нет аккаунта?{' '}
            <Link to="/register" className="font-semibold text-brand hover:underline">Зарегистрироваться</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
