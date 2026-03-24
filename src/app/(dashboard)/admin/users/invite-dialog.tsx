'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createInvitation } from '@/lib/actions/users'
import type { UserRole } from '@/types'

export function InviteDialog() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<UserRole>('VIEWER')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    const result = await createInvitation(role)
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setInviteUrl(result.data.inviteUrl)
  }

  function handleCopy() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    toast.success('Ссылка скопирована')
  }

  function handleClose() {
    setOpen(false)
    setInviteUrl(null)
    setRole('VIEWER')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
        else setOpen(true)
      }}
    >
      <DialogTrigger asChild>
        <Button>Пригласить</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Пригласить пользователя</DialogTitle>
          <DialogDescription>
            Сгенерируйте ссылку для регистрации. Ссылка действует 7 дней и является одноразовой.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Роль</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANAGER">Менеджер</SelectItem>
                <SelectItem value="VIEWER">Наблюдатель</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {inviteUrl && (
            <div className="space-y-1.5">
              <Label>Ссылка для регистрации</Label>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="text-xs" />
                <Button type="button" variant="outline" onClick={handleCopy}>
                  Копировать
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Передайте эту ссылку пользователю. После регистрации ссылка станет недействительной.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Закрыть
          </Button>
          {!inviteUrl && (
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? 'Генерация...' : 'Сгенерировать ссылку'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
