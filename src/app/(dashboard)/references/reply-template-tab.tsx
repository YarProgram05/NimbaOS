'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  createReplyTemplate,
  createReplyTemplateGroup,
  deleteReplyTemplate,
  deleteReplyTemplateGroup,
  updateReplyTemplate,
  updateReplyTemplateGroup,
} from '@/lib/actions/references'
import type { ReplyTemplateGroupRow, ReplyTemplateRow } from '@/types/references'

interface ReplyTemplateTabProps {
  groups: ReplyTemplateGroupRow[]
  wbAccountId: string
  onMutate: () => void
}

export function ReplyTemplateTab({ groups, wbAccountId, onMutate }: ReplyTemplateTabProps) {
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? '')
  const [groupDialog, setGroupDialog] = useState<{ mode: 'create' | 'edit'; group?: ReplyTemplateGroupRow } | null>(null)
  const [templateDialog, setTemplateDialog] = useState<{ mode: 'create' | 'edit'; template?: ReplyTemplateRow } | null>(null)
  const [deleteGroup, setDeleteGroup] = useState<ReplyTemplateGroupRow | null>(null)
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<ReplyTemplateRow | null>(null)

  const selectedGroup = useMemo(() => {
    return groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null
  }, [groups, selectedGroupId])

  function refreshSelection() {
    onMutate()
  }

  async function handleDeleteGroup() {
    if (!deleteGroup) return
    const result = await deleteReplyTemplateGroup(deleteGroup.id)
    if (result.success) {
      toast.success('Группа удалена')
      setDeleteGroup(null)
      setSelectedGroupId(groups.find((group) => group.id !== deleteGroup.id)?.id ?? '')
      refreshSelection()
    } else {
      toast.error(result.error)
    }
  }

  async function handleDeleteTemplate() {
    if (!deleteTemplateTarget) return
    const result = await deleteReplyTemplate(deleteTemplateTarget.id)
    if (result.success) {
      toast.success('Шаблон удален')
      setDeleteTemplateTarget(null)
      refreshSelection()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Группы</p>
          <Button size="icon" variant="ghost" className="h-11 w-11 md:h-8 md:w-8" onClick={() => setGroupDialog({ mode: 'create' })} aria-label="Добавить группу">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-64 overflow-auto p-2 lg:max-h-[560px]">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setSelectedGroupId(group.id)}
              className={`mb-1 flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                selectedGroup?.id === group.id ? 'bg-muted font-semibold' : ''
              }`}
            >
              <span className="min-w-0 truncate">{group.name}</span>
              <span className="ml-2 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">{group.templates.length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{selectedGroup?.name ?? 'Группа не выбрана'}</p>
            <p className="text-xs text-muted-foreground">Шаблоны подставляются в поле ответа на отзывах и вопросах.</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {selectedGroup && (
              <>
                <Button size="sm" variant="outline" className="min-h-11 flex-1 sm:min-h-0 sm:flex-none" onClick={() => setGroupDialog({ mode: 'edit', group: selectedGroup })}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Группа
                </Button>
                {!selectedGroup.isDefault && (
                  <Button size="sm" variant="outline" className="min-h-11 flex-1 text-destructive hover:text-destructive sm:min-h-0 sm:flex-none" onClick={() => setDeleteGroup(selectedGroup)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Группа
                  </Button>
                )}
                <Button size="sm" className="min-h-11 flex-1 sm:min-h-0 sm:flex-none" onClick={() => setTemplateDialog({ mode: 'create' })}>
                  <Plus className="mr-2 h-4 w-4" />
                  Шаблон
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="divide-y">
          {selectedGroup?.templates.map((template) => (
            <div key={template.id} className="grid gap-3 px-4 py-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-start">
              <div className="flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4 text-primary" />
                <span className="break-words">{template.title}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{template.text}</p>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-11 w-11 md:h-8 md:w-8" onClick={() => setTemplateDialog({ mode: 'edit', template })} aria-label={`Редактировать шаблон ${template.title}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-11 w-11 text-destructive hover:text-destructive md:h-8 md:w-8" onClick={() => setDeleteTemplateTarget(template)} aria-label={`Удалить шаблон ${template.title}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {selectedGroup && selectedGroup.templates.length === 0 && (
            <div className="flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
              <FileText className="mb-2 h-8 w-8" />
              В этой группе пока нет шаблонов
            </div>
          )}
        </div>
      </div>

      <GroupDialog
        open={groupDialog !== null}
        dialog={groupDialog}
        wbAccountId={wbAccountId}
        onClose={() => setGroupDialog(null)}
        onSuccess={refreshSelection}
      />
      <TemplateDialog
        open={templateDialog !== null}
        dialog={templateDialog}
        groupId={selectedGroup?.id ?? ''}
        onClose={() => setTemplateDialog(null)}
        onSuccess={refreshSelection}
      />
      <ConfirmDialog
        open={deleteGroup !== null}
        title="Удалить группу?"
        text="Шаблоны внутри группы тоже будут удалены."
        confirmLabel="Удалить"
        onClose={() => setDeleteGroup(null)}
        onConfirm={handleDeleteGroup}
      />
      <ConfirmDialog
        open={deleteTemplateTarget !== null}
        title="Удалить шаблон?"
        text="Это действие нельзя отменить."
        confirmLabel="Удалить"
        onClose={() => setDeleteTemplateTarget(null)}
        onConfirm={handleDeleteTemplate}
      />
    </div>
  )
}

function GroupDialog({
  open,
  dialog,
  wbAccountId,
  onClose,
  onSuccess,
}: {
  open: boolean
  dialog: { mode: 'create' | 'edit'; group?: ReplyTemplateGroupRow } | null
  wbAccountId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = dialog?.mode === 'edit'

  useEffect(() => {
    setName(dialog?.group?.name ?? '')
  }, [dialog])

  async function submit() {
    setSaving(true)
    const result = isEdit && dialog?.group
      ? await updateReplyTemplateGroup({ id: dialog.group.id, name })
      : await createReplyTemplateGroup({ wbAccountId, name })
    setSaving(false)
    if (result.success) {
      toast.success(isEdit ? 'Группа обновлена' : 'Группа создана')
      onClose()
      onSuccess()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать группу' : 'Новая группа'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reply-group-name">Название</Label>
          <Input id="reply-group-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TemplateDialog({
  open,
  dialog,
  groupId,
  onClose,
  onSuccess,
}: {
  open: boolean
  dialog: { mode: 'create' | 'edit'; template?: ReplyTemplateRow } | null
  groupId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = dialog?.mode === 'edit'

  useEffect(() => {
    setTitle(dialog?.template?.title ?? '')
    setText(dialog?.template?.text ?? '')
  }, [dialog])

  async function submit() {
    setSaving(true)
    const result = isEdit && dialog?.template
      ? await updateReplyTemplate({ id: dialog.template.id, title, text })
      : await createReplyTemplate({ groupId, title, text })
    setSaving(false)
    if (result.success) {
      toast.success(isEdit ? 'Шаблон обновлен' : 'Шаблон создан')
      onClose()
      onSuccess()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать шаблон' : 'Новый шаблон'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reply-template-title">Название</Label>
          <Input id="reply-template-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reply-template-text">Текст ответа</Label>
          <Textarea
            id="reply-template-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={8}
          />
          <p className="text-xs text-muted-foreground">{text.trim().length}/5000</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  text: string
  confirmLabel: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{text}</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
