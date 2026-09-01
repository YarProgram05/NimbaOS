export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col overflow-y-auto bg-muted/40 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-4">
      <div className="my-auto flex w-full justify-center py-2 sm:py-4">
        {children}
      </div>
    </div>
  )
}
