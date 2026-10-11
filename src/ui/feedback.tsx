import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<AlertTone, string> = {
  info: 'bg-info-bg text-info border-info/30',
  success: 'bg-success-bg text-success border-success/30',
  warning: 'bg-warning-bg text-warning border-warning/30',
  danger: 'bg-danger-bg text-danger border-danger/30',
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-md border px-4 py-3 text-sm', TONES[tone], className)}
    >
      {title ? <div className="font-semibold">{title}</div> : null}
      {children ? <div className={cn(title && 'mt-1', 'opacity-90')}>{children}</div> : null}
    </div>
  )
}

/** Прогресс-бар по спецификации: фон #F0F0F0, высота 8px, заполнение изумрудом */
export function Progress({
  value,
  label,
  className,
}: {
  value: number
  label?: ReactNode
  className?: string
}) {
  const percent = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>{label}</span>
          <span className="tnum font-semibold text-fg">{Math.round(percent)}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-sm bg-alt"
      >
        <div
          className="h-full rounded-sm bg-brand transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
