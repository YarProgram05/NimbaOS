'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Check, X, KeyRound, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AddAccountDialog } from './add-account-dialog'
import { updateTaxRate, toggleAccountActive, updateWbAccountApiKey } from '@/lib/actions/accounts'
import type { WbAccountSummary } from '@/lib/actions/accounts'

interface TaxRateCellProps {
  account: WbAccountSummary
  isReadOnly?: boolean
}

function TaxRateCell({ account, isReadOnly }: TaxRateCellProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(account.taxRate)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function save() {
    const parsed = parseFloat(value)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      toast.error('Ставка от 0 до 100')
      setValue(account.taxRate)
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const result = await updateTaxRate(account.id, parsed)
      if (result.success) {
        toast.success('Ставка обновлена')
        setValue(String(parsed))
      } else {
        toast.error(result.error)
        setValue(account.taxRate)
      }
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  function cancel() {
    setValue(account.taxRate)
    setEditing(false)
  }

  if (isReadOnly) {
    return <span className="text-sm">{value}%</span>
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') cancel()
          }}
          className="h-7 w-20 text-sm px-2"
          disabled={saving}
        />
        <span className="text-sm">%</span>
        <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-700">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={cancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={startEdit}
      className="flex items-center gap-1 group text-sm hover:text-foreground"
    >
      <span>{value}%</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  )
}

interface AccountRowProps {
  account: WbAccountSummary
  onDeactivated: () => void
  isReadOnly?: boolean
  canEditApiKey?: boolean
}

function AccountRow({ account, onDeactivated, isReadOnly, canEditApiKey }: AccountRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  async function handleDeactivate() {
    setDeactivating(true)
    try {
      const result = await toggleAccountActive(account.id)
      if (result.success) {
        toast.success('Кабинет деактивирован')
        setConfirmOpen(false)
        onDeactivated()
      } else {
        toast.error(result.error)
      }
    } finally {
      setDeactivating(false)
    }
  }

  function handleKeyOpenChange(open: boolean) {
    setKeyOpen(open)
    if (!open) {
      setApiKey('')
      setApiError(null)
      setShowKey(false)
    }
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) {
      setApiError('API-ключ обязателен')
      return
    }

    setSavingKey(true)
    setApiError(null)
    try {
      const result = await updateWbAccountApiKey(account.id, apiKey)
      if (result.success) {
        toast.success('API-ключ обновлен')
        handleKeyOpenChange(false)
        onDeactivated()
      } else {
        setApiError(result.error)
      }
    } finally {
      setSavingKey(false)
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{account.name}</TableCell>
        <TableCell>
          {account.sellerName ? (
            <div className="flex flex-col">
              <span className="text-sm">{account.sellerName}</span>
              {account.sellerId && (
                <span className="text-xs text-muted-foreground">{account.sellerId}</span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant="secondary">Активен</Badge>
        </TableCell>
        <TableCell>
          <TaxRateCell account={account} isReadOnly={isReadOnly} />
        </TableCell>
        <TableCell>
          {canEditApiKey ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setKeyOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
              API
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">вЂ”</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {!isReadOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
              title="Деактивировать"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </TableCell>
      </TableRow>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Деактивировать кабинет?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Кабинет «{account.name}» будет скрыт. Все связанные данные (карточки, отчёты)
            сохранятся.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? 'Деактивация...' : 'Деактивировать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={keyOpen} onOpenChange={handleKeyOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Обновить API-ключ</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-muted-foreground">{account.name}</p>
              <div className="relative">
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type={showKey ? 'text' : 'password'}
                  placeholder="eyJ..."
                  className="pr-10"
                  disabled={savingKey}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {apiError && <p className="text-sm text-destructive">{apiError}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => handleKeyOpenChange(false)} disabled={savingKey}>
                Отмена
              </Button>
              <Button onClick={handleSaveApiKey} disabled={savingKey}>
                {savingKey ? 'Проверка...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface AccountsSectionProps {
  accounts: WbAccountSummary[]
  isReadOnly?: boolean
  canEditApiKey?: boolean
}

export function AccountsSection({ accounts, isReadOnly, canEditApiKey }: AccountsSectionProps) {
  const router = useRouter()

  function refresh() {
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Кабинеты WB</CardTitle>
            <CardDescription className="mt-1">
              Добавьте API-ключи ваших кабинетов Wildberries
            </CardDescription>
          </div>
          {!isReadOnly && <AddAccountDialog onSuccess={refresh} />}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
            <p className="text-muted-foreground text-sm">Кабинеты не добавлены</p>
            <p className="text-muted-foreground text-xs mt-1">
              Нажмите «Добавить кабинет» и введите API-ключ из личного кабинета WB
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Продавец</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Налоговая ставка</TableHead>
                <TableHead>API</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onDeactivated={refresh}
                  isReadOnly={isReadOnly}
                  canEditApiKey={canEditApiKey}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
