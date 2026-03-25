'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAccount } from '@/components/providers/account-context'

export function AccountSelector() {
  const { accounts, selectedId, selectAccount } = useAccount()
  const router = useRouter()
  const pathname = usePathname()

  function handleSelect(id: string) {
    selectAccount(id)
    // Propagate the account change to Server Component pages via URL param
    const params = new URLSearchParams(window.location.search)
    params.set('account', id)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  if (accounts === null) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground">
          <SelectValue placeholder="Загрузка..." />
        </SelectTrigger>
        <SelectContent />
      </Select>
    )
  }

  if (accounts.length === 0) {
    return (
      <Link
        href="/settings"
        className="flex items-center justify-center rounded-md px-3 py-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors border border-dashed border-sidebar-border"
      >
        + Добавить кабинет
      </Link>
    )
  }

  return (
    <Select value={selectedId ?? ''} onValueChange={handleSelect}>
      <SelectTrigger className="w-full bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground">
        <SelectValue placeholder="Выберите кабинет" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <span className="font-medium">{account.name}</span>
            {account.sellerName && (
              <span className="ml-1 text-muted-foreground text-xs">· {account.sellerName}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
