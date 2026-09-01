'use client'

import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface MobileSortOption {
  value: string
  label: string
}

interface MobileSortControlsProps {
  value: string
  direction: 'asc' | 'desc'
  options: readonly MobileSortOption[]
  onFieldChange: (value: string) => void
  onDirectionToggle: () => void
  directionDisabled?: boolean
  className?: string
}

export function MobileSortControls({
  value,
  direction,
  options,
  onFieldChange,
  onDirectionToggle,
  directionDisabled = false,
  className,
}: MobileSortControlsProps) {
  return (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-2', className)}>
      <Select value={value} onValueChange={onFieldChange}>
        <SelectTrigger className="min-w-0" aria-label="Поле сортировки">
          <SelectValue placeholder="Сортировать" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        onClick={onDirectionToggle}
        disabled={directionDisabled}
        aria-label={direction === 'asc' ? 'Сортировать по убыванию' : 'Сортировать по возрастанию'}
      >
        <ArrowUpDown className="h-4 w-4" />
        {direction === 'asc' ? 'Возр.' : 'Убыв.'}
      </Button>
    </div>
  )
}
