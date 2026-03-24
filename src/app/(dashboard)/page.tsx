import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const name = session?.user?.name ?? 'Пользователь'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Добро пожаловать, {name}!</h1>
        <p className="text-muted-foreground mt-1">
          Выберите раздел в меню слева для начала работы.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Карточки товаров</CardTitle>
            <CardDescription>Управление товарами на Wildberries</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Синхронизация и просмотр карточек товаров из ваших кабинетов WB.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Финансовые отчёты</CardTitle>
            <CardDescription>Анализ реализации и прибыльности</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Загрузка и анализ отчётов реализации с расчётом всех показателей.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>План продаж</CardTitle>
            <CardDescription>Планирование и контроль продаж</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Создание планов продаж по артикулам и отслеживание выполнения.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
