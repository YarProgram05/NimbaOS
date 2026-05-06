'use client'

import { signOut } from 'next-auth/react'
import { Menu, LogOut } from 'lucide-react'
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
}

export function Header({ user, onMobileMenuOpen }: HeaderProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-3 sm:px-4">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMobileMenuOpen}
        aria-label="Открыть меню"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Spacer for desktop (hamburger absent) */}
      <div className="hidden md:block" />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex min-w-0 items-center gap-2 px-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-sm font-medium">{user.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
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
