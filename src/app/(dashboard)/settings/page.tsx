import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from './profile-form'
import { SecurityForms } from './security-forms'
import { AccountsSection } from './accounts-section'
import { getWbAccounts } from '@/lib/actions/accounts'

interface SettingsPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await getServerSession(authOptions)
  const params = await searchParams
  const userRole = session?.user?.role ?? 'VIEWER'

  const accounts = await getWbAccounts()

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-muted-foreground mt-1">Управление профилем и WB кабинетами</p>
      </div>

      <Tabs defaultValue={params.tab === 'accounts' ? 'accounts' : 'profile'}>
        <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-grid sm:w-auto">
          <TabsTrigger className="min-h-11 sm:min-h-0" value="profile">Профиль</TabsTrigger>
          <TabsTrigger className="min-h-11 sm:min-h-0" value="accounts">Кабинеты WB</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <div className="space-y-4">
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

            <Card>
              <CardHeader>
                <CardTitle>Безопасность и вход</CardTitle>
                <CardDescription>
                  После изменения все ваши сеансы завершатся, потребуется войти заново
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SecurityForms currentEmail={session?.user?.email ?? ''} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <AccountsSection
            accounts={accounts}
            isReadOnly={userRole === 'VIEWER'}
            canEditApiKey={userRole === 'ADMIN'}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
