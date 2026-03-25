'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatRub } from '@/lib/utils/format'
import { updateProductPriceAction } from '@/lib/actions/products'
import type { ProductRow } from '@/types/products'

const WB_WALLET_DISCOUNT = 2  // WB wallet gives an additional 2% off

interface PriceCellProps {
  row: ProductRow
  wbAccountId: string
  lastSyncAt: string | null
}

export function PriceCell({ row, wbAccountId, lastSyncAt }: PriceCellProps) {
  const [open, setOpen] = useState(false)
  const [basePriceInput, setBasePriceInput] = useState(
    row.basePrice ? Math.round(parseFloat(row.basePrice)).toString() : '',
  )
  const [discountInput, setDiscountInput] = useState(
    row.discount !== null ? row.discount.toString() : '0',
  )
  const [saving, startSave] = useTransition()

  // ── Derived prices ───────────────────────────────────────────────────────────
  const baseNum      = parseFloat(basePriceInput) || 0
  const discountNum  = Math.min(95, Math.max(0, parseFloat(discountInput) || 0))
  const sellerPrice  = baseNum * (1 - discountNum / 100)

  // From DB (what was synced): used only for tooltip display
  const syncedSellerPrice = row.price     !== null ? parseFloat(row.price)    : null
  const syncedSppPrice    = row.sppPrice  !== null ? parseFloat(row.sppPrice) : null

  // SPP % (back-calculated if we have both seller price and SPP price)
  const sppPercent =
    syncedSppPrice !== null && syncedSellerPrice !== null && syncedSellerPrice > 0
      ? Math.round((1 - syncedSppPrice / syncedSellerPrice) * 100)
      : null

  // WB wallet price: apply WB_WALLET_DISCOUNT on top of SPP price (or seller price if no SPP)
  const wbBase = syncedSppPrice ?? syncedSellerPrice
  const wbWalletPrice = wbBase !== null ? wbBase * (1 - WB_WALLET_DISCOUNT / 100) : null

  // "Актуально на HH:MM по МСК"
  const syncTime = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow',
      })
    : null

  // ── Save handler ─────────────────────────────────────────────────────────────
  function handleSave() {
    if (!basePriceInput || baseNum <= 0) {
      toast.error('Введите корректную базовую цену')
      return
    }
    startSave(async () => {
      const result = await updateProductPriceAction(
        wbAccountId,
        row.nmId,
        baseNum,
        discountNum,
      )
      if (result.success) {
        toast.success('Цена обновлена')
        setOpen(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  // ── Display price (synced seller price, or calculated if not yet synced) ─────
  const displayPrice = syncedSellerPrice ?? sellerPrice

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        {/* Tooltip wraps the Popover trigger so hover shows quick info */}
        <Popover open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button className="text-right w-full hover:opacity-70 transition-opacity cursor-pointer">
                <div className="text-sm font-medium">{formatRub(displayPrice)}</div>
                {(row.discount ?? 0) > 0 && (
                  <div className="text-xs text-muted-foreground">−{row.discount}%</div>
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>

          {/* ── Hover tooltip ──────────────────────────────────────────────── */}
          <TooltipContent side="left" className="space-y-0.5 text-xs">
            {sppPercent !== null && syncedSppPrice !== null && (
              <div>Цена с СПП ({sppPercent}%): {formatRub(syncedSppPrice)}</div>
            )}
            {wbWalletPrice !== null && (
              <div>Цена с WB картой ({WB_WALLET_DISCOUNT}%): {formatRub(wbWalletPrice)}</div>
            )}
            {syncTime && (
              <div className="text-muted-foreground pt-0.5">Актуально на {syncTime} по МСК</div>
            )}
          </TooltipContent>

          {/* ── Click popover: edit panel ───────────────────────────────────── */}
          <PopoverContent side="left" className="w-64 p-4 space-y-3">
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                Базовая цена
                <RefreshCw className="h-3 w-3" />
              </Label>
              <Input
                type="number"
                min={1}
                value={basePriceInput}
                onChange={(e) => setBasePriceInput(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Скидка (%)</Label>
              <Input
                type="number"
                min={0}
                max={95}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="text-sm text-muted-foreground">
              Цена со скидкой:{' '}
              <span className="font-medium text-foreground">{formatRub(sellerPrice)}</span>
            </div>

            {(sppPercent !== null || wbWalletPrice !== null) && (
              <>
                <Separator />
                <div className="space-y-1 text-xs text-muted-foreground">
                  {sppPercent !== null && syncedSppPrice !== null && (
                    <div>с СПП ({sppPercent}%): {formatRub(syncedSppPrice)}</div>
                  )}
                  {wbWalletPrice !== null && (
                    <div>с WB Кошельком ({WB_WALLET_DISCOUNT}%): {formatRub(wbWalletPrice)}</div>
                  )}
                </div>
              </>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-8 text-sm"
            >
              {saving ? 'Сохранение...' : 'Изменить'}
            </Button>
          </PopoverContent>
        </Popover>
      </Tooltip>
    </TooltipProvider>
  )
}
