import { RefreshCw } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="dashboard-page">
      <section className="old-money-panel rounded-md p-4">
        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>Обновляем данные...</span>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="old-money-panel h-24 animate-pulse rounded-md bg-secondary/35" />
        ))}
      </section>
      <section className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="old-money-panel h-80 animate-pulse rounded-md bg-secondary/35" />
        <div className="old-money-panel h-80 animate-pulse rounded-md bg-secondary/35" />
      </section>
    </div>
  )
}
