'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { AccountProvider } from '@/components/providers/account-context'
import type { SessionUser, UserRole } from '@/types'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (media.matches) setIsMobileOpen(false)
    }
    closeOnDesktop()
    media.addEventListener('change', closeOnDesktop)
    return () => media.removeEventListener('change', closeOnDesktop)
  }, [])

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
  const isReportsPage = pathname === '/reports'
  const isFixedHeightPage = isReportsPage || pathname === '/stocks'

  return (
    <AccountProvider>
      <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
        <Sidebar
          isCollapsed={isCollapsed}
          onCollapse={() => setIsCollapsed((v) => !v)}
          userRole={user.role}
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header
            user={user}
            onMobileMenuOpen={() => setIsMobileOpen(true)}
            onSidebarCollapse={() => setIsCollapsed((v) => !v)}
          />
          <main
            className={
              isFixedHeightPage
                ? 'min-h-0 flex-1 overflow-auto overscroll-contain p-2 sm:p-3 lg:overflow-hidden'
                : 'min-h-0 flex-1 overflow-auto overscroll-contain p-3 sm:p-5 lg:p-6'
            }
          >
            {children}
          </main>
        </div>
      </div>
    </AccountProvider>
  )
}
