'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function AccountSelector() {
  return (
    <Select disabled>
      <SelectTrigger className="w-full bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground">
        <SelectValue placeholder="Нет кабинетов" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="placeholder">Кабинеты в фазе 2</SelectItem>
      </SelectContent>
    </Select>
  )
}
