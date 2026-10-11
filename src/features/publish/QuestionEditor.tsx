import type { AgreeScale, CommentMode, Question, QuestionType } from '@/lib/survey/types'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Card, CardContent } from '@/ui/card'
import { BareSelect, Choice, Field, Input, Textarea } from '@/ui/form'
import { changeQuestionType, COMMENT_MODE_OPTIONS, QUESTION_TYPE_OPTIONS } from './questionTemplates'

interface Props {
  question: Question
  index: number
  total: number
  onChange: (next: Question) => void
  onDelete: () => void
  onDuplicate: () => void
  onMove: (direction: -1 | 1) => void
}

export function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
}: Props) {
  const patch = <K extends keyof Question>(key: K, value: Question[K]) =>
    onChange({ ...question, [key]: value } as Question)

  const typeMeta = QUESTION_TYPE_OPTIONS.find((item) => item.value === question.type)

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-line bg-sunken px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="tnum shrink-0 text-sm font-bold text-brand">{index + 1}.</span>
          <span className="truncate text-sm font-semibold text-fg">
            {question.text || 'Без текста вопроса'}
          </span>
          <Badge tone="brand">{typeMeta?.label ?? question.type}</Badge>
          {question.required ? <Badge tone="danger">обязательный</Badge> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onMove(-1)} disabled={index === 0} title="Выше">
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Ниже"
          >
            ↓
          </Button>
          <Button variant="ghost" size="sm" onClick={onDuplicate} title="Дублировать">
            ⧉
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} title="Удалить" className="text-danger">
            ✕
          </Button>
        </div>
      </div>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <Field label="Текст вопроса" required>
            <Textarea
              rows={2}
              value={question.text}
              onChange={(event) => patch('text', event.target.value)}
              placeholder="Например: Как вы оцениваете условия труда?"
            />
          </Field>
          <Field label="Тип вопроса">
            <BareSelect
              value={question.type}
              onChange={(event) =>
                onChange(changeQuestionType(question, event.target.value as QuestionType))
              }
              className="h-[46px] w-full px-4 text-base"
            >
              {QUESTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </BareSelect>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Идентификатор" hint="Латиница, уникален в опросе">
            <Input
              value={question.id}
              onChange={(event) => patch('id', event.target.value)}
              placeholder="q1"
            />
          </Field>
          <Field label="Подсказка" hint="Показывается под вопросом">
            <Input
              value={question.description ?? ''}
              onChange={(event) =>
                onChange({ ...question, description: event.target.value || undefined } as Question)
              }
              placeholder="Необязательно"
            />
          </Field>
          <Field label="Комментарий участника">
            <BareSelect
              value={question.comment}
              onChange={(event) => patch('comment', event.target.value as CommentMode)}
              className="h-[46px] w-full px-4 text-base"
            >
              {COMMENT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </BareSelect>
          </Field>
        </div>

        <Choice
          type="checkbox"
          checked={question.required}
          onChange={(checked) => patch('required', checked)}
          label="Обязательный вопрос"
          description="Без ответа опрос нельзя отправить"
        />

        {(question.type === 'single' || question.type === 'multi') && (
          <OptionsBlock
            options={question.options}
            shuffle={question.shuffle}
            multi={question.type === 'multi'}
            min={question.type === 'multi' ? question.min : undefined}
            max={question.type === 'multi' ? question.max : undefined}
            onOptions={(options) => onChange({ ...question, options } as Question)}
            onShuffle={(shuffle) => onChange({ ...question, shuffle } as Question)}
            onLimits={(min, max) => onChange({ ...question, min, max } as Question)}
          />
        )}

        {question.type === 'agree' && (
          <Field label="Длина шкалы">
            <BareSelect
              value={String(question.scale)}
              onChange={(event) =>
                onChange({ ...question, scale: Number(event.target.value) as AgreeScale } as Question)
              }
              className="h-[46px] w-full max-w-56 px-4 text-base"
            >
              <option value="5">5 пунктов</option>
              <option value="7">7 пунктов</option>
            </BareSelect>
          </Field>
        )}

        {question.type === 'number' && (
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Минимум">
              <Input
                type="number"
                value={question.min ?? ''}
                onChange={(event) =>
                  onChange({
                    ...question,
                    min: event.target.value === '' ? undefined : Number(event.target.value),
                  } as Question)
                }
              />
            </Field>
            <Field label="Максимум">
              <Input
                type="number"
                value={question.max ?? ''}
                onChange={(event) =>
                  onChange({
                    ...question,
                    max: event.target.value === '' ? undefined : Number(event.target.value),
                  } as Question)
                }
              />
            </Field>
            <Field label="Шаг">
              <Input
                type="number"
                value={question.step ?? ''}
                onChange={(event) =>
                  onChange({
                    ...question,
                    step: event.target.value === '' ? undefined : Number(event.target.value),
                  } as Question)
                }
              />
            </Field>
            <div className="flex items-end pb-2">
              <Choice
                type="checkbox"
                checked={question.slider === true}
                onChange={(checked) => onChange({ ...question, slider: checked } as Question)}
                label="Слайдер"
              />
            </div>
          </div>
        )}

        {question.type === 'text' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Высота поля, строк">
              <Input
                type="number"
                min={1}
                value={question.rows ?? ''}
                onChange={(event) =>
                  onChange({
                    ...question,
                    rows: event.target.value === '' ? undefined : Number(event.target.value),
                  } as Question)
                }
              />
            </Field>
            <Field label="Максимум символов">
              <Input
                type="number"
                min={1}
                value={question.maxlength ?? ''}
                onChange={(event) =>
                  onChange({
                    ...question,
                    maxlength: event.target.value === '' ? undefined : Number(event.target.value),
                  } as Question)
                }
              />
            </Field>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OptionsBlock({
  options,
  shuffle,
  multi,
  min,
  max,
  onOptions,
  onShuffle,
  onLimits,
}: {
  options: string[]
  shuffle?: boolean
  multi: boolean
  min?: number
  max?: number
  onOptions: (options: string[]) => void
  onShuffle: (shuffle: boolean) => void
  onLimits: (min: number | undefined, max: number | undefined) => void
}) {
  const update = (index: number, value: string) => {
    const next = [...options]
    next[index] = value
    onOptions(next)
  }

  const remove = (index: number) => onOptions(options.filter((_, itemIndex) => itemIndex !== index))

  return (
    <div className="space-y-3 rounded-md border border-line bg-sunken p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-fg">Варианты ответа</span>
        <Button variant="subtle" size="sm" onClick={() => onOptions([...options, ''])}>
          + Добавить вариант
        </Button>
      </div>

      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="tnum w-5 shrink-0 text-right text-xs text-muted">{index + 1}</span>
            <Input
              value={option}
              onChange={(event) => update(index, event.target.value)}
              placeholder={`Вариант ${index + 1}`}
              className="py-2"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              disabled={options.length <= 2}
              className="shrink-0 text-danger"
              title="Удалить вариант"
            >
              ✕
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-4 border-t border-line pt-3">
        <Choice
          type="checkbox"
          checked={shuffle === true}
          onChange={onShuffle}
          label="Перемешивать варианты"
        />
        {multi ? (
          <>
            <Field label="Минимум выборов" className="w-40">
              <Input
                type="number"
                min={0}
                value={min ?? ''}
                onChange={(event) =>
                  onLimits(event.target.value === '' ? undefined : Number(event.target.value), max)
                }
              />
            </Field>
            <Field label="Максимум выборов" className="w-40">
              <Input
                type="number"
                min={1}
                value={max ?? ''}
                onChange={(event) =>
                  onLimits(min, event.target.value === '' ? undefined : Number(event.target.value))
                }
              />
            </Field>
          </>
        ) : null}
      </div>
    </div>
  )
}
