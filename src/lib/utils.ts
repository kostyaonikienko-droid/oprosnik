export type ClassValue = string | number | bigint | boolean | null | undefined

/** Минималистичный аналог clsx — без зависимостей */
export function cn(...parts: ClassValue[]): string {
  return parts
    .filter((part): part is string | number => typeof part === 'string' || typeof part === 'number')
    .join(' ')
}
