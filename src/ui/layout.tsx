import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Logo } from '@/ui/brand'
import { Button } from '@/ui/button'
import { useAuth } from '@/features/auth/AuthContext'

const NAV_ITEMS = [
  { to: '/me', label: 'Мои опросы' },
  { to: '/moderator', label: 'Модерация', role: 'moderator' as const },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-surface shadow-sm">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.filter((item) => !item.role || user.role === item.role).map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                    pathname.startsWith(item.to)
                      ? 'bg-brand-subtle text-brand'
                      : 'text-muted hover:bg-alt hover:text-fg',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden text-sm text-muted sm:block">{user.fullName}</span>
                <Button variant="ghost" size="sm" onClick={() => signOut()}>
                  Выйти
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="secondary" size="sm">Войти</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container-page py-8">{children}</div>
      </main>

      <footer className="border-t border-line bg-sunken py-6 text-center text-xs text-muted">
        ФБУ «Пермский ЦСМ» · Система опросов · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
