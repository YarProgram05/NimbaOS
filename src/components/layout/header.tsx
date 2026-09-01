'use client'

import { signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Menu, LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SessionUser } from '@/types'

interface HeaderProps {
  user: SessionUser
  onMobileMenuOpen: () => void
  onSidebarCollapse: () => void
}

export function Header({ user, onMobileMenuOpen, onSidebarCollapse }: HeaderProps) {
  const pathname = usePathname()
  const displayName = user.name.trim() || user.email || 'Пользователь'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="flex h-14 min-w-0 shrink-0 items-center justify-between gap-2 border-b bg-card/80 px-3 backdrop-blur sm:gap-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={onMobileMenuOpen}
          aria-label="Открыть меню"
          title="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden shrink-0 lg:inline-flex"
          onClick={onSidebarCollapse}
          aria-label="Свернуть или развернуть меню"
          title="Свернуть или развернуть меню"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 truncate font-medium text-foreground">Операционный кабинет</span>
          <span className="hidden shrink-0 lg:inline">· Wildberries аналитика и планирование</span>
          {pathname === '/reports' && (
            <span className="hidden min-w-0 truncate font-medium text-foreground xl:inline">
              · Финансы · Финансовые отчёты · Реализация по кабинету Wildberries
            </span>
          )}
        </div>
      </div>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex min-w-0 max-w-[45vw] shrink-0 items-center gap-2 px-2 hover:bg-secondary sm:max-w-[16rem]"
            aria-label="Открыть меню пользователя"
            title={`${displayName} — меню пользователя`}
          >
            <Avatar className="h-7 w-7 border border-border">
              <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 truncate text-sm font-medium sm:inline">{displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[min(12rem,calc(100vw-1rem))]">
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
