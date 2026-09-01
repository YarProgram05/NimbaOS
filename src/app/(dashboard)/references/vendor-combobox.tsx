'use client'

import { useRef, useState } from 'react'
import { ChevronsUpDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { VendorCodeOption } from '@/types/references'

interface VendorComboboxProps {
  value: string
  onChange: (value: string) => void
  vendorCodes: VendorCodeOption[]
  placeholder?: string
  disabled?: boolean
}

export function VendorCombobox({
  value,
  onChange,
  vendorCodes,
  placeholder = 'Выберите артикул...',
  disabled = false,
}: VendorComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filtered = vendorCodes.filter(
    (v) =>
      v.vendorCode.toLowerCase().includes(search.toLowerCase()) ||
      (v.title ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={`min-w-0 truncate ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="flex w-[--radix-popover-trigger-width] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0"
        align="start"
        collisionPadding={8}
        style={{
          maxHeight:
            'min(calc(100dvh - 1rem), var(--radix-popover-content-available-height))',
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }))
          }
        }}
      >
        <div className="shrink-0 border-b p-2">
          <Input
            ref={searchInputRef}
            placeholder="Поиск артикула..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 text-base lg:h-8 lg:text-sm"
          />
        </div>
        <div
          className="max-h-60 min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground text-center">Не найдено</p>
          ) : (
            filtered.map((v) => (
              <button
                key={v.vendorCode}
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange(v.vendorCode)
                  setSearch('')
                  setOpen(false)
                }}
              >
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${value === v.vendorCode ? 'opacity-100' : 'opacity-0'}`}
                />
                <span className="font-medium">{v.vendorCode}</span>
                {v.title && (
                  <span className="text-muted-foreground text-xs truncate">{v.title}</span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
