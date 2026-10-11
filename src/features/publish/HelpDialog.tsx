import { Button } from '@/ui/button'
import { Dialog } from '@/ui/dialog'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/ui/table'
import { CHEATSHEET, MARKDOWN_TEMPLATE } from './cheatsheet'

interface Props {
  open: boolean
  onClose: () => void
  /** Вставить готовый шаблон в редактор Markdown */
  onInsertTemplate: (markdown: string) => void
}

export function HelpDialog({ open, onClose, onInsertTemplate }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Формат .md-файла опроса"
      description="Синтаксис, типы вопросов и все доступные атрибуты"
      width="lg"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onInsertTemplate(MARKDOWN_TEMPLATE)
              onClose()
            }}
          >
            Вставить шаблон в редактор
          </Button>
          <Button variant="subtle" onClick={onClose}>
            Закрыть
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        {CHEATSHEET.map((section) => (
          <section key={section.title} className="space-y-3">
            <h4 className="text-lg font-semibold text-fg">{section.title}</h4>

            {section.text ? <p className="text-sm text-muted">{section.text}</p> : null}

            {section.list ? (
              <ul className="space-y-1.5 text-sm text-fg">
                {section.list.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-brand">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {section.table ? (
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      {section.table.head.map((cell) => (
                        <TH key={cell}>{cell}</TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {section.table.rows.map((row) => (
                      <TR key={row.join('|')}>
                        {row.map((cell, index) => (
                          <TD key={index} className={index === 0 ? 'font-mono text-xs' : undefined}>
                            {cell}
                          </TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            ) : null}

            {section.code ? (
              <pre className="scrollbar-thin overflow-auto rounded-md border border-line bg-sunken p-4 font-mono text-xs leading-relaxed text-fg">
                {section.code}
              </pre>
            ) : null}
          </section>
        ))}
      </div>
    </Dialog>
  )
}
