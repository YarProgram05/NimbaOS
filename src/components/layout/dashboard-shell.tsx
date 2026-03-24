'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import type { SessionUser, UserRole } from '@/types'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </div>
    )
  }

  if (!session?.user) return null

  const user: SessionUser = {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
    role: session.user.role as UserRole,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isCollapsed={isCollapsed}
        onCollapse={() => setIsCollapsed((v) => !v)}
        userRole={user.role}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header user={user} onMobileMenuOpen={() => setIsMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
