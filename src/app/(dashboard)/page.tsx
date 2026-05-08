import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  FileText,
  LayoutGrid,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface DashboardPageProps {
  searchParams: Promise<{
    account?: string
  }>
}

async function getDashboardStats(wbAccountId?: string | null) {
  try {
    const selectedAccount = wbAccountId
      ? await prisma.wbAccount.findFirst({
          where: { id: wbAccountId, isActive: true },
          select: { id: true, name: true, sellerName: true, lastSyncAt: true },
        })
      : null

    const account = selectedAccount ?? await prisma.wbAccount.findFirst({
      where: { isActive: true },
      select: { id: true, name: true, sellerName: true, lastSyncAt: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!account) return null

    const [products, reportRows, plans, activeJobs] = await Promise.all([
      prisma.product.count({ where: { wbAccountId: account.id } }),
      prisma.realizationReport.count({ where: { wbAccountId: account.id } }),
      prisma.salesPlan.count({ where: { wbAccountId: account.id } }),
      prisma.syncJobRun.count({
        where: {
          wbAccountId: account.id,
          status: { in: ['QUEUED', 'RUNNING'] },
        },
      }),
    ])

    return { account, products, reportRows, plans, activeJobs }
  } catch {
    return null
  }
}

function formatNumber(value: number) {
  return value.toLocaleString('ru-RU')
}

function formatSyncDate(value?: Date | null) {
  if (!value) return 'Нет данных'
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getServerSession(authOptions)
  const params = await searchParams
  const name = session?.user?.name ?? 'Пользователь'
  const stats = await getDashboardStats(params.account)

  const modules = [
    {
      href: '/reports',
      title: 'Финансовые отчёты',
      label: 'P&L и реализация',
      icon: FileText,
      value: stats ? formatNumber(stats.reportRows) : '—',
      caption: 'строк реализации',
    },
    {
      href: '/cards',
      title: 'Карточки товаров',
      label: 'Каталог WB',
      icon: LayoutGrid,
      value: stats ? formatNumber(stats.products) : '—',
      caption: 'артикулов',
    },
    {
      href: '/sales-plan',
      title: 'План продаж',
      label: 'Цели и контроль',
      icon: TrendingUp,
      value: stats ? formatNumber(stats.plans) : '—',
      caption: 'активных планов',
    },
  ]

  return (
    <div className="dashboard-page">
      <section className="old-money-panel rounded-md p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <BriefcaseBusiness className="h-4 w-4 text-primary" />
              NimbaOS кабинет
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Добро пожаловать, {name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Единая панель для каталога, финансовых отчётов и планов продаж Wildberries.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-md border bg-secondary/60 p-3">
              <p className="metric-label">Кабинет</p>
              <p className="mt-1 truncate text-sm font-semibold">
                {stats?.account.name ?? 'Не подключён'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {stats?.account.sellerName ?? 'Wildberries'}
              </p>
            </div>
            <div className="rounded-md border bg-card p-3">
              <p className="metric-label">Синхронизация</p>
              <p className="mt-1 text-sm font-semibold">{formatSyncDate(stats?.account.lastSyncAt)}</p>
            </div>
            <div className="rounded-md border bg-card p-3">
              <p className="metric-label">В очереди</p>
              <p className="mt-1 text-sm font-semibold">{stats?.activeJobs ?? 0} задач</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid shrink-0 gap-3 md:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon
          return (
            <Link
              key={module.href}
              href={stats?.account.id ? `${module.href}?account=${stats.account.id}` : module.href}
              className="old-money-panel group rounded-md p-4 transition-colors hover:bg-secondary/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
              <p className="mt-4 text-xs font-medium text-muted-foreground">{module.label}</p>
              <h2 className="mt-1 text-base font-semibold">{module.title}</h2>
              <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3">
                <span className="text-2xl font-semibold tracking-tight">{module.value}</span>
                <span className="pb-1 text-xs text-muted-foreground">{module.caption}</span>
              </div>
            </Link>
          )
        })}
      </section>

      <section className="dashboard-scroll grid gap-3 xl:grid-cols-[1fr_0.78fr]">
        <div className="old-money-panel rounded-md p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="metric-label">Фокус дня</p>
              <h2 className="mt-1 text-base font-semibold">Коммерческий контур</h2>
            </div>
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">Сначала</p>
              <p className="mt-1 text-sm font-medium">обновить каталог</p>
            </div>
            <div className="rounded-md border bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">Затем</p>
              <p className="mt-1 text-sm font-medium">сверить реализацию</p>
            </div>
            <div className="rounded-md border bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">После</p>
              <p className="mt-1 text-sm font-medium">обновить план</p>
            </div>
          </div>
        </div>

        <Link
          href={stats?.account.id ? `/sync?account=${stats.account.id}` : '/sync'}
          className="old-money-panel group flex rounded-md p-4 transition-colors hover:bg-secondary/60"
        >
          <div className="flex flex-1 items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border bg-secondary text-primary">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="metric-label">Синхронизация</p>
              <h2 className="mt-1 text-base font-semibold">Фоновые загрузки WB</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Очередь, расписание и история задач в одном разделе.
              </p>
            </div>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>
      </section>
    </div>
  )
}
