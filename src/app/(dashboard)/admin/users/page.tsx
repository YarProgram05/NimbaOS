import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkRole } from '@/lib/auth/check-role'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { InviteDialog } from './invite-dialog'
import { UserRowActions } from './user-row-actions'
import type { UserRole } from '@/types'

const ROLE_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> =
  {
    ADMIN: { label: 'Администратор', variant: 'default' },
    MANAGER: { label: 'Менеджер', variant: 'secondary' },
    VIEWER: { label: 'Наблюдатель', variant: 'outline' },
  }

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions)
  if (!checkRole(session, 'ADMIN')) redirect('/')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Пользователи</h1>
          <p className="mt-1 text-muted-foreground">
            Управление пользователями платформы. Всего: {users.length}
          </p>
        </div>
        <InviteDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Создан</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const roleConf = ROLE_CONFIG[user.role] ?? { label: user.role, variant: 'outline' as const }
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleConf.variant}>{roleConf.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Активен' : 'Неактивен'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dateFormatter.format(user.createdAt)}
                  </TableCell>
                  <TableCell>
                    <UserRowActions
                      userId={user.id}
                      currentRole={user.role as UserRole}
                      isActive={user.isActive}
                      isSelf={user.id === session!.user.id}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
