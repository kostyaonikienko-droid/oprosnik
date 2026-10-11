import { AppError } from '@/lib/errors'
import { MockBackend } from './mock'
import type { Backend } from './types'

export type BackendKind = 'mock' | 'supabase'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

let instance: Backend | null = null

function readSupabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return { url, anonKey }
}

/**
 * Выбор хранилища:
 * - `VITE_BACKEND=mock`      — всегда локальное демо-хранилище;
 * - `VITE_BACKEND=supabase`  — всегда Supabase (ошибка, если ключи не заданы);
 * - не задано                — Supabase, если ключи есть, иначе демо-режим.
 *
 * SupabaseBackend подключается динамически, чтобы в демо-сборку не попадал SDK.
 */
export async function createBackend(): Promise<Backend> {
  const requested = (import.meta.env.VITE_BACKEND ?? 'auto').toLowerCase()
  const config = readSupabaseConfig()

  if (requested === 'mock') return new MockBackend()

  if (requested === 'supabase') {
    if (!config) {
      throw new AppError(
        'not-configured',
        'Задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env.local',
      )
    }
    const { SupabaseBackend } = await import('./supabase')
    return new SupabaseBackend(config)
  }

  if (config) {
    const { SupabaseBackend } = await import('./supabase')
    return new SupabaseBackend(config)
  }

  return new MockBackend()
}

export function initBackend(backend: Backend): void {
  instance = backend
}

export function getBackend(): Backend {
  if (!instance) throw new AppError('not-configured', 'Хранилище не инициализировано')
  return instance
}

/** Демо-режим позволяет показать подсказку с тестовыми учётными данными */
export function asMock(backend: Backend): MockBackend | null {
  return backend.kind === 'mock' ? (backend as MockBackend) : null
}

export type { Backend }
export * from './types'
