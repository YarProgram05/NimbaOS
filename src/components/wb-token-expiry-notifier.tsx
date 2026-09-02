'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAccount } from '@/components/providers/account-context'
import {
  daysUntilWbTokenExpiration,
  getMoscowDateKey,
  shouldWarnAboutWbToken,
} from '@/lib/wb-api/token-expiration'
import type { UserRole } from '@/types'

const WARNING_DAYS = 10
const STORAGE_PREFIX = 'nimba_wb_token_expiry_notice'

interface WbTokenExpiryNotifierProps {
  userId: string
  userRole: UserRole
}

function countdownText(days: number): string {
  if (days < 0) return `срок истёк ${Math.abs(days)} дн. назад`
  if (days === 0) return 'истекает сегодня'
  return `осталось ${days} дн.`
}

export function WbTokenExpiryNotifier({ userId, userRole }: WbTokenExpiryNotifierProps) {
  const { accounts } = useAccount()
  const router = useRouter()

  useEffect(() => {
    if (userRole !== 'ADMIN' || accounts === null) return

    const now = new Date()
    const expiring = accounts
      .filter((account) => account.apiKeyExpiresAt)
      .map((account) => ({
        ...account,
        daysRemaining: daysUntilWbTokenExpiration(account.apiKeyExpiresAt!, now),
      }))
      .filter((account) => shouldWarnAboutWbToken(
        account.apiKeyExpiresAt!,
        now,
        WARNING_DAYS
      ))
      .sort((a, b) => a.daysRemaining - b.daysRemaining)

    if (expiring.length === 0) return

    const today = getMoscowDateKey()
    const storageKey = `${STORAGE_PREFIX}:${userId}`
    if (localStorage.getItem(storageKey) === today) return

    // Store before opening the toast so React Strict Mode or another render cannot duplicate it.
    localStorage.setItem(storageKey, today)

    toast.warning(
      expiring.length === 1
        ? 'Заканчивается срок WB API-токена'
        : `Заканчиваются WB API-токены: ${expiring.length}`,
      {
        description: (
          <div className="space-y-1">
            {expiring.map((account) => (
              <div key={account.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{account.name}</span>
                <span className="shrink-0 font-medium">
                  {countdownText(account.daysRemaining)}
                </span>
              </div>
            ))}
          </div>
        ),
        duration: 20_000,
        action: {
          label: 'Открыть',
          onClick: () => router.push('/settings?tab=accounts'),
        },
      }
    )
  }, [accounts, router, userId, userRole])

  return null
}
