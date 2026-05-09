'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getWbAccounts, type WbAccountSummary } from '@/lib/actions/accounts'

const STORAGE_KEY = 'wb_selected_account'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

interface AccountContextValue {
  accounts: WbAccountSummary[] | null // null = loading
  selectedId: string | null
  selectedAccount: WbAccountSummary | null
  selectAccount: (id: string) => void
  refreshAccounts: () => Promise<void>
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<WbAccountSummary[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refreshAccounts = useCallback(async () => {
    try {
      const data = await getWbAccounts()
      setAccounts(data)
    } catch {
      setAccounts([])
    }
  }, [])

  useEffect(() => {
    refreshAccounts()
  }, [refreshAccounts])

  useEffect(() => {
    if (accounts === null) return

    const params = new URLSearchParams(searchParams.toString())
    const urlId = params.get('account')
    const urlAccount = urlId ? accounts.find((account) => account.id === urlId) : null
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    const storedAccount = stored ? accounts.find((account) => account.id === stored) : null
    const nextId = urlAccount?.id ?? storedAccount?.id ?? accounts[0]?.id ?? null

    setSelectedId((prev) => (prev === nextId ? prev : nextId))

    if (nextId && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, nextId)
      document.cookie = `${STORAGE_KEY}=${encodeURIComponent(nextId)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
    }

    if (!urlAccount && nextId) {
      params.set('account', nextId)
      params.delete('page')
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }, [accounts, pathname, router, searchParams])

  const selectAccount = useCallback((id: string) => {
    setSelectedId(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id)
      document.cookie = `${STORAGE_KEY}=${encodeURIComponent(id)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
    }
  }, [])

  const selectedAccount = accounts?.find((a) => a.id === selectedId) ?? null

  return (
    <AccountContext.Provider
      value={{ accounts, selectedId, selectedAccount, selectAccount, refreshAccounts }}
    >
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within AccountProvider')
  return ctx
}
