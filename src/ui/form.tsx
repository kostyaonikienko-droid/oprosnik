import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

const CONTROL =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-base text-fg ' +
  'placeholder:text-faint transition-colors ' +
  'hover:border-line-strong focus:border-brand focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-alt disabled:text-muted'

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-fg">
          {label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="text-sm text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

export function Input({ label, hint, error, className, id, required, ...rest }: InputProps) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId}>
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, error && 'border-danger', className)}
        {...rest}
      />
    </Field>
  )
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

export function Textarea({ label, hint, error, className, id, required, ...rest }: TextareaProps) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId}>
      <textarea
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, 'resize-y leading-normal', error && 'border-danger', className)}
        {...rest}
      />
    </Field>
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  options: readonly { value: string; label: string }[]
  placeholder?: string
}

export function Select({
  label,
  hint,
  error,
  options,
  placeholder,
  className,
  id,
  required,
  ...rest
}: SelectProps) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId}>
      <select
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, 'cursor-pointer pr-10', error && 'border-danger', className)}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** Отдельный вариант без обёртки Field — для компактных фильтров */
export function BareSelect({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(CONTROL, 'h-10 cursor-pointer px-3 py-0 text-sm', className)}
      {...rest}
    />
  )
}

export interface ChoiceProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  name?: string
  invalid?: boolean
}

/**
 * Универсальный пункт выбора. Размер маркера 20×20 и акцентный цвет
 * соответствуют стилю проекта; нативные input сохраняют доступность.
 */
export function Choice({
  checked,
  onChange,
  label,
  description,
  disabled,
  name,
  invalid,
  type = 'radio',
}: ChoiceProps & { type?: 'radio' | 'checkbox' }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border border-line bg-surface px-4 py-3',
        'transition-colors hover:border-line-strong hover:bg-sunken',
        checked && 'border-brand bg-brand-subtle hover:bg-brand-subtle',
        disabled && 'cursor-not-allowed opacity-60 hover:bg-surface',
        invalid && 'border-danger',
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--accent-primary)] disabled:cursor-not-allowed"
      />
      <span className="min-w-0">
        <span className="block text-base leading-snug text-fg">{label}</span>
        {description ? <span className="mt-0.5 block text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  )
}
