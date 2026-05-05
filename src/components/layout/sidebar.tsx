'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  FileText,
  TrendingUp,
  BookOpen,
  Megaphone,
  RefreshCw,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { AccountSelector } from './account-selector'
import { useAccount } from '@/components/providers/account-context'
import type { UserRole } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { href: '/cards', label: 'Карточки', icon: LayoutGrid },
  { href: '/reports', label: 'Отчёты', icon: FileText },
  { href: '/sales-plan', label: 'План продаж', icon: TrendingUp },
  { href: '/references', label: 'Справочники', icon: BookOpen },
  { href: '/advertising', label: 'Реклама', icon: Megaphone },
  { href: '/sync', label: 'Синхронизация', icon: RefreshCw },
  { href: '/settings', label: 'Настройки', icon: Settings },
]

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/admin/users', label: 'Пользователи', icon: Users },
]

interface SidebarProps {
  isCollapsed: boolean
  onCollapse: () => void
  userRole: UserRole
  isMobileOpen: boolean
  onMobileClose: () => void
}

function NavLink({
  item,
  isActive,
  isCollapsed,
  accountId,
}: {
  item: NavItem
  isActive: boolean
  isCollapsed: boolean
  accountId?: string | null
}) {
  const Icon = item.icon
  const href = accountId ? `${item.href}?account=${accountId}` : item.href
  return (
    <Link
      href={href}
      title={isCollapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        isCollapsed && 'justify-center px-2'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!isCollapsed && <span>{item.label}</span>}
    </Link>
  )
}

function NavContent({
  userRole,
  isCollapsed = false,
}: {
  userRole: UserRole
  isCollapsed?: boolean
}) {
  const pathname = usePathname()
  const { selectedId } = useAccount()
  const allItems =
    userRole === 'ADMIN' ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS

  return (
    <nav className="flex flex-col gap-1 px-2">
      {allItems.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          isActive={pathname.startsWith(item.href)}
          isCollapsed={isCollapsed}
          accountId={selectedId}
        />
      ))}
    </nav>
  )
}

export function Sidebar({
  isCollapsed,
  onCollapse,
  userRole,
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out shrink-0',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-14 items-center border-b border-sidebar-border px-3',
            isCollapsed ? 'justify-center' : 'gap-2 px-4'
          )}
        >
          {!isCollapsed && (
            <span className="text-sm font-semibold text-sidebar-foreground truncate">
              NimbaOS
            </span>
          )}
        </div>

        {/* Account Selector */}
        {!isCollapsed && (
          <div className="px-3 py-3">
            <AccountSelector />
          </div>
        )}

        {!isCollapsed && <Separator className="bg-sidebar-border" />}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-3">
          <NavContent userRole={userRole} isCollapsed={isCollapsed} />
        </div>

        {/* Collapse Toggle */}
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapse}
            className={cn(
              'w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isCollapsed ? 'justify-center' : 'justify-end'
            )}
            title={isCollapsed ? 'Развернуть' : 'Свернуть'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* Mobile Sheet */}
      <Sheet open={isMobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
          <SheetTitle className="sr-only">Навигация</SheetTitle>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <span className="text-sm font-semibold text-sidebar-foreground">
              NimbaOS
            </span>
          </div>
          <div className="px-3 py-3">
            <AccountSelector />
          </div>
          <Separator className="bg-sidebar-border" />
          <div className="py-3">
            <NavContent userRole={userRole} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
