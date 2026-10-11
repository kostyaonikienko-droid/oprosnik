import { cn } from '@/lib/utils'

export interface TabItem<T extends string> {
  value: T
  label: string
  count?: number
  disabled?: boolean
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('flex flex-wrap gap-1 border-b border-line', className)}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold',
              'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              active
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:border-line-strong hover:text-fg',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="tnum rounded-sm bg-alt px-1.5 py-0.5 text-xs text-muted">
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
