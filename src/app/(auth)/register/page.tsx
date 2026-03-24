import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { RegisterForm } from './register-form'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  VIEWER: 'Наблюдатель',
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) redirect('/login')

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      role: true,
      usedById: true,
      expiresAt: true,
    },
  })

  if (!invitation || invitation.usedById || invitation.expiresAt < new Date()) {
    redirect('/login')
  }

  return (
    <RegisterForm
      token={invitation.token}
      roleLabel={ROLE_LABELS[invitation.role] ?? invitation.role}
    />
  )
}
