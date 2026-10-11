import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Герб организации. Положите настоящий файл в `public/emblem.svg`
 * (или .png) — он подхватится автоматически. Пока файла нет,
 * рисуется нейтральная заглушка в фирменном цвете.
 */
const EMBLEM_URL = './emblem.svg'

export function Emblem({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false)

  if (!failed) {
    return (
      <img
        src={EMBLEM_URL}
        alt="Герб Росстандарта"
        className={cn('size-11 shrink-0 object-contain', className)}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 44 44"
      role="img"
      aria-label="Эмблема"
      className={cn('size-11 shrink-0', className)}
    >
      <path
        d="M22 2 40 8v13c0 10.5-7.4 18.6-18 21C11.4 39.6 4 31.5 4 21V8L22 2Z"
        fill="var(--accent-primary)"
      />
      <path
        d="M22 5.4 36.6 10v11c0 8.7-6 15.4-14.6 17.6C13.4 36.4 7.4 29.7 7.4 21V10L22 5.4Z"
        fill="none"
        stroke="var(--accent-primary-text)"
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />
      <text
        x="22"
        y="27"
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fontSize="13"
        fontWeight="700"
        fill="var(--accent-primary-text)"
      >
        РСТ
      </text>
    </svg>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Emblem />
      {!compact && (
        <div className="leading-tight">
          <div className="text-xl font-bold tracking-tight text-fg">РСТ</div>
          <div className="text-xs font-semibold text-muted whitespace-nowrap">
            ФБУ «Пермский ЦСМ»
          </div>
        </div>
      )}
    </div>
  )
}
