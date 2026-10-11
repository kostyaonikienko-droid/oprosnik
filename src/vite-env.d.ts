/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `mock` | `supabase` | `auto` (по умолчанию) */
  readonly VITE_BACKEND?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Название организации в шапке */
  readonly VITE_APP_ORG?: string
  readonly VITE_APP_TITLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
