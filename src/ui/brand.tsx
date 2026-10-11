import { cn } from '@/lib/utils'

/**
 * Фирменный знак ФБУ «Пермский ЦСМ» — `public/logo.svg`.
 * Внутри файла уже есть и эмблема, и название учреждения,
 * поэтому дополнительная текстовая подпись не нужна.
 */
const LOGO_URL = './logo.svg'

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt="ФБУ «Пермский ЦСМ» — Государственный региональный центр стандартизации, метрологии и испытаний"
      className={cn('h-8 w-auto md:h-10', className)}
    />
  )
}
