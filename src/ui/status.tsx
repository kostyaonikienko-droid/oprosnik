import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-5 animate-spin rounded-full border-2 border-brand border-t-transparent',
        className,
      )}
    />
  )
}

export function Loading({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong',
        'bg-surface px-6 py-14 text-center',
        className,
      )}
    >
      <div className="text-lg font-semibold text-fg">{title}</div>
      {description ? <div className="mt-2 max-w-xl text-sm text-muted">{description}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-alt', className)} />
}

export function Metric({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
}) {
  const valueTone =
    tone === 'brand'
      ? 'text-brand'
      : tone === 'success'
        ? 'text-success'
        : tone === 'warning'
          ? 'text-warning'
          : tone === 'danger'
            ? 'text-danger'
            : 'text-fg'
  return (
    <div className="rounded-lg border border-line bg-raised px-5 py-4 shadow-sm">
      <div className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className={cn('tnum mt-1.5 text-2xl font-bold', valueTone)}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  )
}
