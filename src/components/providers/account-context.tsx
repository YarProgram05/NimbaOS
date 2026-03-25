'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getWbAccounts, type WbAccountSummary } from '@/lib/actions/accounts'

const STORAGE_KEY = 'wb_selected_account'

interface AccountContextValue {
  accounts: WbAccountSummary[] | null // null = loading
  selectedId: string | null
  selectedAccount: WbAccountSummary | null
  selectAccount: (id: string) => void
  refreshAccounts: () => Promise<void>
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<WbAccountSummary[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refreshAccounts = useCallback(async () => {
    try {
      const data = await getWbAccounts()
      setAccounts(data)
      // Auto-select first if current selection no longer exists
      setSelectedId((prev) => {
        const still = data.find((a) => a.id === prev)
        if (still) return prev
        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
        const fromStorage = stored ? data.find((a) => a.id === stored) : null
        return fromStorage?.id ?? data[0]?.id ?? null
      })
    } catch {
      setAccounts([])
    }
  }, [])

  useEffect(() => {
    refreshAccounts()
  }, [refreshAccounts])

  const selectAccount = useCallback((id: string) => {
    setSelectedId(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id)
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
