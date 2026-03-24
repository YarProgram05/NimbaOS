'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, UserX, UserCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { updateUserRole, toggleUserActive, deleteUser } from '@/lib/actions/users'
import type { UserRole } from '@/types'

interface Props {
  userId: string
  currentRole: UserRole
  isActive: boolean
  isSelf: boolean
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Администратор' },
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'VIEWER', label: 'Наблюдатель' },
]

export function UserRowActions({ userId, currentRole, isActive, isSelf }: Props) {
  const [loading, setLoading] = useState(false)

  if (isSelf) return null

  async function handleRoleChange(role: UserRole) {
    if (role === currentRole) return
    setLoading(true)
    const result = await updateUserRole(userId, role)
    setLoading(false)
    if (!result.success) toast.error(result.error)
    else toast.success('Роль изменена')
  }

  async function handleToggleActive() {
    setLoading(true)
    const result = await toggleUserActive(userId)
    setLoading(false)
    if (!result.success) toast.error(result.error)
    else toast.success(isActive ? 'Пользователь деактивирован' : 'Пользователь активирован')
  }

  async function handleDelete() {
    if (!confirm('Удалить пользователя? Это действие необратимо.')) return
    setLoading(true)
    const result = await deleteUser(userId)
    setLoading(false)
    if (!result.success) toast.error(result.error)
    else toast.success('Пользователь удалён')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={loading}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Действия</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Действия</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Pencil className="mr-2 h-4 w-4" />
            Изменить роль
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {ROLES.map((r) => (
              <DropdownMenuItem
                key={r.value}
                onClick={() => handleRoleChange(r.value)}
                className={r.value === currentRole ? 'font-semibold' : ''}
              >
                {r.label}
                {r.value === currentRole && ' ✓'}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onClick={handleToggleActive}>
          {isActive ? (
            <>
              <UserX className="mr-2 h-4 w-4" />
              Деактивировать
            </>
          ) : (
            <>
              <UserCheck className="mr-2 h-4 w-4" />
              Активировать
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
