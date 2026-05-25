async function main() {
  const { applyAllAutomationSchedules } = await import('@/lib/automations/workflows')
  const result = await applyAllAutomationSchedules()
  console.log(`[automation-schedule] applied ${result.scheduled} schedulers for ${result.workflows} workflows`)
}

main()
  .catch((error) => {
    console.error('[automation-schedule] failed', error)
    process.exit(1)
  })
  .finally(async () => {
    const { prisma } = await import('@/lib/db')
    await prisma.$disconnect()
  })
