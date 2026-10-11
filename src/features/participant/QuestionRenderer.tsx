import type { AnswerValue, Question } from '@/lib/survey'
import { agreeLabels } from '@/lib/survey'
import { questionTypeHint } from '@/lib/survey/answers'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/ui/card'
import { Choice, Input, Textarea } from '@/ui/form'

interface Props {
  question: Question
  index: number
  value: AnswerValue
  onChange: (value: AnswerValue) => void
  error?: string
}

/** Рендер одного вопроса: тип вопроса определяет виджет ввода */
export function QuestionRenderer({ question, index, value, onChange, error }: Props) {
  const patch = (part: Partial<AnswerValue>) => onChange({ ...value, ...part })

  return (
    <Card className={cn(error && 'border-danger')}>
      <CardContent className="space-y-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="tnum text-sm font-semibold text-muted">{index}.</span>
            <h3 className="text-lg font-semibold text-fg">
              {question.text}
              {question.required ? <span className="ml-1 text-danger">*</span> : null}
            </h3>
          </div>
          <p className="mt-1 text-sm text-muted">
            {question.description ? `${question.description} · ` : ''}
            {questionTypeHint(question)}
          </p>
        </div>

        {question.type === 'single' ? (
          <div className="space-y-2">
            {question.options.map((option, optionIndex) => (
              <Choice
                key={option}
                type="radio"
                name={question.id}
                label={option}
                checked={value.optionIndexes?.[0] === optionIndex}
                onChange={(checked) => checked && patch({ optionIndexes: [optionIndex] })}
              />
            ))}
          </div>
        ) : null}

        {question.type === 'multi' ? (
          <div className="space-y-2">
            {question.options.map((option, optionIndex) => {
              const selected = value.optionIndexes ?? []
              const checked = selected.includes(optionIndex)
              const limitReached = question.max !== undefined && selected.length >= question.max
              return (
                <Choice
                  key={option}
                  type="checkbox"
                  label={option}
                  checked={checked}
                  disabled={!checked && limitReached}
                  onChange={(next) => {
                    const updated = next
                      ? [...selected, optionIndex].sort((a, b) => a - b)
                      : selected.filter((item) => item !== optionIndex)
                    patch({ optionIndexes: updated })
                  }}
                />
              )
            })}
          </div>
        ) : null}

        {question.type === 'agree' ? (
          <div className="space-y-2">
            {agreeLabels(question.scale).map((label, labelIndex) => (
              <Choice
                key={label}
                type="radio"
                name={question.id}
                label={label}
                checked={value.agreePosition === labelIndex + 1}
                onChange={(checked) => checked && patch({ agreePosition: labelIndex + 1 })}
              />
            ))}
          </div>
        ) : null}

        {question.type === 'number' ? (
          question.slider && question.min !== undefined && question.max !== undefined ? (
            <div className="space-y-2">
              <input
                type="range"
                min={question.min}
                max={question.max}
                step={question.step ?? 1}
                value={value.number ?? question.min}
                onChange={(event) => patch({ number: Number(event.target.value) })}
                className="w-full accent-[var(--accent-primary)]"
              />
              <div className="flex items-center justify-between text-sm text-muted">
                <span>{question.min}</span>
                <span className="tnum text-2xl font-bold text-fg">
                  {value.number ?? question.min}
                </span>
                <span>{question.max}</span>
              </div>
            </div>
          ) : (
            <Input
              type="number"
              min={question.min}
              max={question.max}
              step={question.step}
              value={value.number ?? ''}
              onChange={(event) =>
                patch({ number: event.target.value === '' ? undefined : Number(event.target.value) })
              }
              className="max-w-40"
            />
          )
        ) : null}

        {question.type === 'text' ? (
          <Textarea
            rows={question.rows ?? 4}
            maxLength={question.maxlength}
            value={value.text ?? ''}
            onChange={(event) => patch({ text: event.target.value })}
            placeholder="Введите ответ…"
          />
        ) : null}

        {question.comment !== 'off' ? (
          <Textarea
            label="Комментарий"
            required={question.comment === 'required'}
            rows={2}
            value={value.comment ?? ''}
            onChange={(event) => patch({ comment: event.target.value })}
            placeholder="Поясните свой ответ…"
          />
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
