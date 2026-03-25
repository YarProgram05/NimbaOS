import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from './profile-form'
import { AccountsSection } from './accounts-section'
import type { WbAccountSummary } from '@/lib/actions/accounts'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  const userRole = session?.user?.role ?? 'VIEWER'

  const rawAccounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sellerName: true,
      sellerId: true,
      tradeMark: true,
      taxRate: true,
      isActive: true,
      lastSyncAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const accounts: WbAccountSummary[] = rawAccounts.map((a) => ({
    ...a,
    taxRate: a.taxRate.toString(),
  }))

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-muted-foreground mt-1">Управление профилем и WB кабинетами</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Профиль</TabsTrigger>
          <TabsTrigger value="accounts">Кабинеты WB</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Профиль</CardTitle>
              <CardDescription>Ваше имя отображается в интерфейсе приложения</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                defaultName={session?.user?.name ?? ''}
                email={session?.user?.email ?? ''}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <AccountsSection accounts={accounts} isReadOnly={userRole === 'VIEWER'} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
