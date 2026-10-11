export type ErrorCode =
  | 'invalid-credentials'
  | 'email-taken'
  | 'not-authenticated'
  | 'forbidden'
  | 'not-found'
  | 'already-responded'
  | 'survey-unavailable'
  | 'validation'
  | 'network'
  | 'not-configured'

const MESSAGES: Record<ErrorCode, string> = {
  'invalid-credentials': 'Неверный email или пароль',
  'email-taken': 'Пользователь с таким email уже зарегистрирован',
  'not-authenticated': 'Требуется вход в систему',
  forbidden: 'Недостаточно прав',
  'not-found': 'Ничего не найдено',
  'already-responded': 'Вы уже прошли этот опрос',
  'survey-unavailable': 'Опрос недоступен для прохождения',
  validation: 'Проверьте заполнение полей',
  network: 'Ошибка соединения. Повторите попытку.',
  'not-configured': 'Хранилище не настроено',
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly details?: string

  constructor(code: ErrorCode, details?: string) {
    super(details ? `${MESSAGES[code]}: ${details}` : MESSAGES[code])
    this.name = 'AppError'
    this.code = code
    this.details = details
  }

  static is(error: unknown): error is AppError {
    return error instanceof AppError
  }
}

export function errorMessage(error: unknown): string {
  if (AppError.is(error)) return error.message
  if (error instanceof Error) return error.message
  return 'Неизвестная ошибка'
}

export function userMessage(error: unknown): string {
  if (AppError.is(error)) {
    return error.code === 'network' ? MESSAGES.network : error.message
  }
  if (error instanceof Error) return error.message
  return 'Неизвестная ошибка'
}
