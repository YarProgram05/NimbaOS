'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { CalendarDays, Package, Plus, Percent, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deletePlanAction, getPlansAction } from '@/lib/actions/sales-plan'
import type { SalesPlanRow } from '@/types/sales-plan'
import { CreatePlanDialog } from './create-plan-dialog'

interface SalesPlanClientProps {
  initialPlans: SalesPlanRow[]
  wbAccountId: string
}

function formatDate(iso: string): string {
  return format(new Date(iso), 'd MMM yyyy', { locale: ru })
}

export function SalesPlanClient({ initialPlans, wbAccountId }: SalesPlanClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [plans, setPlans] = useState(initialPlans)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SalesPlanRow | null>(null)
  const [isDeleting, startDelete] = useTransition()

  const accountParam = searchParams.get('account') || wbAccountId

  function handleCardClick(planId: string) {
    router.push(`/sales-plan/${planId}?account=${accountParam}`)
  }

  function handleDeleteClick(e: React.MouseEvent, plan: SalesPlanRow) {
    e.stopPropagation()
    setDeleteTarget(plan)
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return
    startDelete(async () => {
      const result = await deletePlanAction(deleteTarget.id)
      if (result.success) {
        toast.success('План удалён')
        setDeleteTarget(null)
        const refreshed = await getPlansAction(wbAccountId)
        if (refreshed.success) setPlans(refreshed.data)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Создать план
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">Нет планов</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Создайте первый план продаж для отслеживания целей.
          </p>
          <Button onClick={() => setDialogOpen(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Создать план
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="group cursor-pointer transition-colors hover:bg-accent/50 relative"
              onClick={() => handleCardClick(plan.id)}
            >
              <button
                onClick={(e) => handleDeleteClick(e, plan)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                title="Удалить план"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold leading-tight pr-8">
                  {plan.name}
                </CardTitle>
                {plan.description && (
                  <CardDescription className="line-clamp-2">
                    {plan.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>
                    {formatDate(plan.dateFrom)} — {formatDate(plan.dateTo)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Percent className="h-4 w-4 shrink-0" />
                    <span>ДРР {plan.drrPercent}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Package className="h-4 w-4 shrink-0" />
                    <span>
                      {plan.itemCount}{' '}
                      {plan.itemCount === 1
                        ? 'артикул'
                        : plan.itemCount >= 2 && plan.itemCount <= 4
                          ? 'артикула'
                          : 'артикулов'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        wbAccountId={wbAccountId}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Удалить план?</DialogTitle>
            <DialogDescription>
              План «{deleteTarget?.name}» и все его артикулы будут удалены. Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
