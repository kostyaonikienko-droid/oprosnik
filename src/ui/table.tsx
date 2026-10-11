import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function TableWrap({
  className,
  children,
  maxHeight,
}: {
  className?: string
  children: React.ReactNode
  maxHeight?: number
}) {
  return (
    <div
      className={cn(
        'scrollbar-thin overflow-auto rounded-lg border border-line bg-raised shadow-sm',
        className,
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {children}
    </div>
  )
}

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn('w-full border-collapse text-sm text-fg', className)}
      {...rest}
    />
  )
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('sticky top-0 z-10 bg-sunken [&_th]:border-b', className)}
      {...rest}
    />
  )
}

export function TBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr]:border-b [&_tr:last-child]:border-0', className)} {...rest} />
}

export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-sunken/60', className)} {...rest} />
}

export function TH({
  className,
  align = 'left',
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-line px-3.5 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase',
        'whitespace-nowrap',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...rest}
    />
  )
}

export function TD({
  className,
  align = 'left',
  numeric = false,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & {
  align?: 'left' | 'right' | 'center'
  numeric?: boolean
}) {
  return (
    <td
      className={cn(
        'border-line px-3.5 py-2.5 align-middle text-fg',
        numeric && 'tnum tabular-nums',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      style={{ height: 'var(--table-row-height)' }}
      {...rest}
    />
  )
}

export function TFoot({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn('sticky bottom-0 bg-sunken font-semibold [&_td]:border-t', className)}
      {...rest}
    />
  )
}
