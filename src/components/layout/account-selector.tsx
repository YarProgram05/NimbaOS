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
      <div className="flex h-10 w-full items-center rounded-md border border-sidebar-border bg-sidebar-accent/70 px-3 text-sm text-sidebar-foreground/70 shadow-sm">
        Загрузка...
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <Link
        href="/settings"
        className="flex items-center justify-center rounded-md border border-dashed border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        + Добавить кабинет
      </Link>
    )
  }

  const effectiveSelectedId = selectedId ?? accounts[0]?.id

  return (
    <Select value={effectiveSelectedId} onValueChange={handleSelect}>
      <SelectTrigger className="w-full border-sidebar-border bg-sidebar-accent/70 text-sidebar-foreground shadow-sm">
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
