import type { Survey, SurveyStatus } from '@/lib/survey/types'
import { Badge } from '@/ui/badge'
import { Card, CardContent, CardHeader } from '@/ui/card'
import { BareSelect, Field, Input, Textarea } from '@/ui/form'
import { STATUS_OPTIONS } from './questionTemplates'

interface Props {
  survey: Survey
  onChange: (patch: Partial<Survey>) => void
  /** Такой id уже есть в базе — публикация перезапишет существующий опрос */
  idConflict: boolean
}

export function SurveyMetaForm({ survey, onChange, idConflict }: Props) {
  return (
    <Card>
      <CardHeader
        title="Параметры опроса"
        description="Идентификатор, название, период проведения и приветственный текст"
        actions={
          idConflict ? (
            <Badge tone="warning">id уже существует — будет перезаписан</Badge>
          ) : undefined
        }
      />
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Название"
            required
            hint="Видно участникам в списке опросов"
          >
            <Input
              value={survey.title}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="Опрос удовлетворённости условиями труда"
            />
          </Field>
          <Field
            label="Идентификатор"
            required
            hint="Латиница, цифры, дефис. Не меняется после публикации"
          >
            <Input
              value={survey.id}
              onChange={(event) => onChange({ id: event.target.value })}
              placeholder="opros-2026-10"
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Статус">
            <BareSelect
              value={survey.status}
              onChange={(event) => onChange({ status: event.target.value as SurveyStatus })}
              className="h-[46px] w-full px-4 text-base"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </BareSelect>
          </Field>
          <Field label="Начало" hint="Необязательно">
            <Input
              type="date"
              value={survey.startsAt ?? ''}
              onChange={(event) => onChange({ startsAt: event.target.value || undefined })}
            />
          </Field>
          <Field label="Окончание" hint="Необязательно">
            <Input
              type="date"
              value={survey.endsAt ?? ''}
              onChange={(event) => onChange({ endsAt: event.target.value || undefined })}
            />
          </Field>
        </div>

        <Field
          label="Приветственный текст"
          hint="Показывается участнику перед первым вопросом"
        >
          <Textarea
            rows={4}
            value={survey.intro}
            onChange={(event) => onChange({ intro: event.target.value })}
            placeholder={'Уважаемые коллеги!\n\nПросим вас принять участие в опросе…'}
          />
        </Field>
      </CardContent>
    </Card>
  )
}
