/**
 * Debug script: verify ppvzForPay calculation for WB Galioni (WB 2)
 * Period: 2026-02-16 .. 2026-02-22
 *
 * Expected values (from official WB weekly reports 634782052 + 635428294):
 *   naive_sum (all ppvzForPay, both docTypes) = 100 486.70
 *   sales     (ppvzForPay where docTypeName = 'Продажа')   = 92 239.31
 *   returns   (ppvzForPay where docTypeName = 'Возврат')   =  8 247.39
 *   net       (sales − returns)                            = 83 991.92
 *
 * Run: DATABASE_URL=<url> npx tsx scripts/debug-report.ts
 */

import pg from 'pg'

const DATE_FROM = '2026-02-16'
const DATE_TO   = '2026-02-22'

// ── Expected reference values (from official WB xlsx reports) ─────────────────
const EXPECTED = {
  naiveSum: 100_486.70,
  sales:     92_239.31,
  returns:    8_247.39,
  net:       83_991.92,
}

function assertClose(label: string, actual: number, expected: number, eps = 0.02) {
  const ok = Math.abs(actual - expected) <= eps
  const status = ok ? '✓' : '✗'
  console.log(`  ${status} ${label}: ${actual.toFixed(2)} (expected ${expected.toFixed(2)})`)
  if (!ok) process.exitCode = 1
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

  try {
    // ppvzForPay breakdown by docTypeName
    const { rows: ppvzRows } = await pool.query<{
      naive_sum: string
      sales_ppvz: string
      returns_ppvz: string
      net: string
    }>(`
      SELECT
        ROUND(SUM("ppvzForPay"), 2)::text                                             AS naive_sum,
        ROUND(SUM(CASE WHEN "docTypeName" = 'Продажа' THEN "ppvzForPay" ELSE 0 END), 2)::text AS sales_ppvz,
        ROUND(SUM(CASE WHEN "docTypeName" = 'Возврат' THEN "ppvzForPay" ELSE 0 END), 2)::text AS returns_ppvz,
        ROUND(
          SUM(CASE WHEN "docTypeName" = 'Продажа' THEN "ppvzForPay" ELSE 0 END) -
          SUM(CASE WHEN "docTypeName" = 'Возврат' THEN "ppvzForPay" ELSE 0 END),
          2
        )::text AS net
      FROM realization_reports
      WHERE "dateFrom" >= $1 AND "dateTo" <= $2
    `, [DATE_FROM, DATE_TO])

    const { naive_sum, sales_ppvz, returns_ppvz, net } = ppvzRows[0]

    console.log(`\n=== ppvzForPay debug: ${DATE_FROM} .. ${DATE_TO} ===`)
    assertClose('naive sum (all rows)', parseFloat(naive_sum), EXPECTED.naiveSum)
    assertClose('sales ppvz',           parseFloat(sales_ppvz), EXPECTED.sales)
    assertClose('returns ppvz',         parseFloat(returns_ppvz), EXPECTED.returns)
    assertClose('net (sales − returns)', parseFloat(net), EXPECTED.net)

    // vendorCode coverage
    const { rows: vcRows } = await pool.query<{
      total_rows: string
      empty_vc_rows: string
    }>(`
      SELECT
        COUNT(*)::text                                        AS total_rows,
        COUNT(*) FILTER (WHERE "vendorCode" = '')::text      AS empty_vc_rows
      FROM realization_reports
      WHERE "dateFrom" >= $1 AND "dateTo" <= $2
    `, [DATE_FROM, DATE_TO])

    const { total_rows, empty_vc_rows } = vcRows[0]
    console.log(`\n  Empty vendorCode rows: ${empty_vc_rows} / ${total_rows}`)
    if (parseInt(empty_vc_rows) > 0) {
      console.log('  ⚠ WB API omits vendor_code — using Products table fallback in calculator.')
    }

    // Products coverage for report nmIds
    const { rows: coverageRows } = await pool.query<{
      distinct_nm_ids: string
      covered: string
    }>(`
      SELECT
        COUNT(DISTINCT rr."nmId")::text                                       AS distinct_nm_ids,
        COUNT(DISTINCT p."nmId")::text                                        AS covered
      FROM realization_reports rr
      LEFT JOIN products p ON p."nmId" = rr."nmId" AND p."vendorCode" != ''
      WHERE rr."dateFrom" >= $1 AND rr."dateTo" <= $2 AND rr."nmId" > 0
    `, [DATE_FROM, DATE_TO])

    const { distinct_nm_ids, covered } = coverageRows[0]
    console.log(`  Products coverage: ${covered} / ${distinct_nm_ids} nmIds have vendorCode in Products table`)

    if (process.exitCode === 1) {
      console.log('\n  ✗ Some assertions failed — check calculator formulas')
    } else {
      console.log('\n  All assertions passed ✓')
    }
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
