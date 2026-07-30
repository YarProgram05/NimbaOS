\set ON_ERROR_STOP on

COPY (
WITH
params AS (
  SELECT
    DATE '2026-06-15' AS period_from,
    DATE '2026-07-19' AS period_to,
    DATE '2026-06-30' AS early_to,
    DATE '2026-07-01' AS late_from
),
accounts AS (
  SELECT id, name, "lastSyncAt"
  FROM wb_accounts
  WHERE "isActive" = TRUE
    AND (name ILIKE '%Nimba%' OR name ILIKE '%Galioni%')
),
latest_snapshots AS (
  SELECT DISTINCT ON ("wbAccountId")
    id,
    "wbAccountId",
    "syncedAt",
    source
  FROM stock_snapshots
  WHERE "wbAccountId" IN (SELECT id FROM accounts)
  ORDER BY "wbAccountId", "syncedAt" DESC
),
size_counts AS (
  SELECT
    p."wbAccountId",
    p."nmId",
    COUNT(DISTINCT COALESCE(NULLIF(BTRIM(ps."techSize"), ''), NULLIF(BTRIM(ps."wbSize"), ''), 'без размера')) AS size_count
  FROM products p
  LEFT JOIN product_sizes ps ON ps."productId" = p.id
  WHERE p."wbAccountId" IN (SELECT id FROM accounts)
  GROUP BY p."wbAccountId", p."nmId"
),
product_base AS (
  SELECT
    p.id AS product_id,
    p."wbAccountId" AS account_id,
    a.name AS account_name,
    p."nmId" AS nm_id,
    p."vendorCode" AS article,
    COALESCE(p.category, '') AS category,
    COALESCE(p.title, '') AS title,
    (
      a.name ILIKE '%Nimba%'
      AND COALESCE(sc.size_count, 0) > 1
      AND (
        p."vendorCode" ILIKE '%детск%'
        OR COALESCE(p.title, '') ILIKE '%детск%'
        OR COALESCE(p.title, '') ILIKE '%для девочк%'
      )
    ) AS split_by_size
  FROM products p
  JOIN accounts a ON a.id = p."wbAccountId"
  LEFT JOIN size_counts sc
    ON sc."wbAccountId" = p."wbAccountId"
   AND sc."nmId" = p."nmId"
),
product_entities AS (
  SELECT DISTINCT
    pb.account_id,
    pb.account_name,
    pb.nm_id,
    pb.article,
    pb.category,
    pb.title,
    pb.split_by_size,
    CASE
      WHEN pb.split_by_size THEN COALESCE(NULLIF(BTRIM(ps."techSize"), ''), NULLIF(BTRIM(ps."wbSize"), ''), 'без размера')
      ELSE ''
    END AS size_label
  FROM product_base pb
  LEFT JOIN product_sizes ps ON ps."productId" = pb.product_id
  WHERE NOT pb.split_by_size OR ps.id IS NOT NULL
),
financial_rows AS (
  SELECT
    rr."wbAccountId" AS account_id,
    rr."nmId" AS nm_id,
    CASE
      WHEN pb.split_by_size THEN COALESCE(NULLIF(BTRIM(ps."techSize"), ''), NULLIF(BTRIM(ps."wbSize"), ''), 'без размера')
      ELSE ''
    END AS size_label,
    COALESCE(rr."rrDt", rr."dateFrom") AS metric_date,
    rr."docTypeName" AS doc_type,
    rr.quantity,
    rr."supplierOperName" AS supplier_oper_name,
    rr."bonusTypeName" AS bonus_type_name
  FROM realization_reports rr
  JOIN product_base pb
    ON pb.account_id = rr."wbAccountId"
   AND pb.nm_id = rr."nmId"
  LEFT JOIN product_sizes ps
    ON ps."productId" = pb.product_id
   AND ps.barcode = rr.barcode
  CROSS JOIN params p
  WHERE rr."wbAccountId" IN (SELECT id FROM accounts)
    AND (
      rr."rrDt" BETWEEN p.period_from AND p.period_to
      OR (
        rr."rrDt" IS NULL
        AND rr."dateFrom" <= p.period_to
        AND rr."dateTo" >= p.period_from
      )
    )
),
financial_metrics AS (
  SELECT
    fr.account_id,
    fr.nm_id,
    fr.size_label,
    SUM(CASE WHEN fr.doc_type = 'Продажа' THEN fr.quantity ELSE 0 END)
      + COUNT(*) FILTER (
        WHERE fr.supplier_oper_name = 'Логистика'
          AND fr.bonus_type_name = 'К клиенту при отмене'
      ) AS trace_orders,
    COUNT(*) FILTER (
      WHERE fr.supplier_oper_name = 'Логистика'
        AND fr.bonus_type_name = 'К клиенту при отмене'
    ) AS trace_cancellations,
    SUM(CASE
      WHEN fr.doc_type = 'Продажа' THEN fr.quantity
      WHEN fr.doc_type = 'Возврат' THEN -fr.quantity
      ELSE 0
    END) AS net_sales,
    SUM(CASE
      WHEN fr.metric_date <= (SELECT early_to FROM params) AND fr.doc_type = 'Продажа' THEN fr.quantity
      WHEN fr.metric_date <= (SELECT early_to FROM params) AND fr.doc_type = 'Возврат' THEN -fr.quantity
      ELSE 0
    END) AS early_net_sales,
    SUM(CASE
      WHEN fr.metric_date >= (SELECT late_from FROM params) AND fr.doc_type = 'Продажа' THEN fr.quantity
      WHEN fr.metric_date >= (SELECT late_from FROM params) AND fr.doc_type = 'Возврат' THEN -fr.quantity
      ELSE 0
    END) AS late_net_sales
  FROM financial_rows fr
  GROUP BY fr.account_id, fr.nm_id, fr.size_label
),
order_metrics AS (
  SELECT
    o."wbAccountId" AS account_id,
    o."nmId" AS nm_id,
    COUNT(*) AS orders,
    COUNT(*) FILTER (WHERE o."isCancel") AS cancellations
  FROM wb_orders o
  CROSS JOIN params p
  WHERE o."wbAccountId" IN (SELECT id FROM accounts)
    AND o.date BETWEEN p.period_from AND p.period_to
  GROUP BY o."wbAccountId", o."nmId"
),
stock_rows AS (
  SELECT
    si."wbAccountId" AS account_id,
    si."nmId" AS nm_id,
    CASE
      WHEN pb.split_by_size THEN COALESCE(NULLIF(BTRIM(ps."techSize"), ''), NULLIF(BTRIM(ps."wbSize"), ''), 'без размера')
      ELSE ''
    END AS size_label,
    si.quantity,
    w.name AS warehouse_name,
    (
      LOWER(REPLACE(w.name, 'ё', 'е')) LIKE '%электростал%'
      OR LOWER(REPLACE(w.name, 'ё', 'е')) LIKE '%краснодар%'
      OR LOWER(REPLACE(w.name, 'ё', 'е')) LIKE '%невинномыс%'
      OR LOWER(REPLACE(w.name, 'ё', 'е')) LIKE '%шушар%'
      OR LOWER(REPLACE(w.name, 'ё', 'е')) LIKE '%котовск%'
    ) AS excluded
  FROM latest_snapshots ls
  JOIN stock_items si ON si."snapshotId" = ls.id
  JOIN product_base pb
    ON pb.account_id = si."wbAccountId"
   AND pb.nm_id = si."nmId"
  LEFT JOIN product_sizes ps ON ps.id = si."productSizeId"
  JOIN warehouses w
    ON w."wbAccountId" = si."wbAccountId"
   AND w."warehouseId" = si."warehouseId"
),
stock_metrics AS (
  SELECT
    sr.account_id,
    sr.nm_id,
    sr.size_label,
    COALESCE(SUM(sr.quantity) FILTER (WHERE NOT sr.excluded), 0) AS stock_included,
    COALESCE(SUM(sr.quantity) FILTER (WHERE sr.excluded), 0) AS stock_excluded,
    COALESCE(SUM(sr.quantity), 0) AS stock_total
  FROM stock_rows sr
  GROUP BY sr.account_id, sr.nm_id, sr.size_label
),
all_keys AS (
  SELECT account_id, nm_id, size_label FROM product_entities
  UNION
  SELECT account_id, nm_id, size_label FROM financial_metrics
  UNION
  SELECT account_id, nm_id, size_label FROM stock_metrics
),
coverage AS (
  SELECT
    a.id AS account_id,
    EXISTS (
      SELECT 1
      FROM sync_data_coverages c
      CROSS JOIN params p
      WHERE c."wbAccountId" = a.id
        AND c.kind = 'REPORTS_PERIOD'
        AND c."dateFrom" <= p.period_from
        AND c."dateTo" >= p.period_to
    ) AS report_covered
  FROM accounts a
),
order_bounds AS (
  SELECT
    o."wbAccountId" AS account_id,
    MIN(o.date) AS min_order_date,
    MAX(o.date) AS max_order_date,
    MAX(o."fetchedAt") AS max_order_fetched_at
  FROM wb_orders o
  CROSS JOIN params p
  WHERE o."wbAccountId" IN (SELECT id FROM accounts)
    AND o.date BETWEEN p.period_from AND p.period_to
  GROUP BY o."wbAccountId"
),
report_bounds AS (
  SELECT
    rr."wbAccountId" AS account_id,
    MIN(COALESCE(rr."rrDt", rr."dateFrom")) AS min_report_date,
    MAX(COALESCE(rr."rrDt", rr."dateFrom")) AS max_report_date,
    MAX(rr."fetchedAt") AS max_report_fetched_at
  FROM realization_reports rr
  CROSS JOIN params p
  WHERE rr."wbAccountId" IN (SELECT id FROM accounts)
    AND (
      rr."rrDt" BETWEEN p.period_from AND p.period_to
      OR (
        rr."rrDt" IS NULL
        AND rr."dateFrom" <= p.period_to
        AND rr."dateTo" >= p.period_from
      )
    )
  GROUP BY rr."wbAccountId"
)
SELECT
  a.id AS account_id,
  a.name AS account_name,
  a."lastSyncAt" AS account_last_sync_at,
  COALESCE(c.report_covered, FALSE) AS report_covered,
  ls."syncedAt" AS stock_snapshot_at,
  ob.min_order_date,
  ob.max_order_date,
  ob.max_order_fetched_at,
  rb.min_report_date,
  rb.max_report_date,
  rb.max_report_fetched_at,
  ak.nm_id,
  COALESCE(pe.article, pb.article, ak.nm_id::text) AS article,
  ak.size_label AS size,
  CASE
    WHEN ak.size_label = '' THEN COALESCE(pe.article, pb.article, ak.nm_id::text)
    ELSE CONCAT(COALESCE(pe.article, pb.article, ak.nm_id::text), ' ', ak.size_label)
  END AS sku,
  COALESCE(pe.category, pb.category, '') AS category,
  COALESCE(pe.title, pb.title, '') AS title,
  COALESCE(pe.split_by_size, pb.split_by_size, FALSE) AS split_by_size,
  CASE
    WHEN COALESCE(pe.split_by_size, pb.split_by_size, FALSE) THEN 'Финансовый отчет: размерный след'
    ELSE 'wb_orders'
  END AS order_source,
  CASE
    WHEN COALESCE(pe.split_by_size, pb.split_by_size, FALSE) THEN COALESCE(fm.trace_orders, 0)
    ELSE COALESCE(om.orders, 0)
  END AS orders,
  CASE
    WHEN COALESCE(pe.split_by_size, pb.split_by_size, FALSE) THEN COALESCE(fm.trace_cancellations, 0)
    ELSE COALESCE(om.cancellations, 0)
  END AS cancellations,
  COALESCE(om.orders, 0) AS parent_orders,
  COALESCE(om.cancellations, 0) AS parent_cancellations,
  COALESCE(fm.net_sales, 0) AS net_sales,
  COALESCE(fm.early_net_sales, 0) AS early_net_sales,
  COALESCE(fm.late_net_sales, 0) AS late_net_sales,
  COALESCE(sm.stock_included, 0) AS stock_included,
  COALESCE(sm.stock_excluded, 0) AS stock_excluded,
  COALESCE(sm.stock_total, 0) AS stock_total
FROM all_keys ak
JOIN accounts a ON a.id = ak.account_id
LEFT JOIN latest_snapshots ls ON ls."wbAccountId" = ak.account_id
LEFT JOIN coverage c ON c.account_id = ak.account_id
LEFT JOIN order_bounds ob ON ob.account_id = ak.account_id
LEFT JOIN report_bounds rb ON rb.account_id = ak.account_id
LEFT JOIN product_entities pe
  ON pe.account_id = ak.account_id
 AND pe.nm_id = ak.nm_id
 AND pe.size_label = ak.size_label
LEFT JOIN product_base pb
  ON pb.account_id = ak.account_id
 AND pb.nm_id = ak.nm_id
LEFT JOIN financial_metrics fm
  ON fm.account_id = ak.account_id
 AND fm.nm_id = ak.nm_id
 AND fm.size_label = ak.size_label
LEFT JOIN order_metrics om
  ON om.account_id = ak.account_id
 AND om.nm_id = ak.nm_id
LEFT JOIN stock_metrics sm
  ON sm.account_id = ak.account_id
 AND sm.nm_id = ak.nm_id
 AND sm.size_label = ak.size_label
ORDER BY a.name, COALESCE(pe.article, pb.article, ak.nm_id::text), ak.size_label
) TO '/tmp/stock_supply_rows.csv' WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

COPY (
WITH
accounts AS (
  SELECT id, name
  FROM wb_accounts
  WHERE "isActive" = TRUE
    AND (name ILIKE '%Nimba%' OR name ILIKE '%Galioni%')
),
latest_snapshots AS (
  SELECT DISTINCT ON ("wbAccountId")
    id,
    "wbAccountId",
    "syncedAt"
  FROM stock_snapshots
  WHERE "wbAccountId" IN (SELECT id FROM accounts)
  ORDER BY "wbAccountId", "syncedAt" DESC
)
SELECT
  a.name AS account_name,
  ls."syncedAt" AS stock_snapshot_at,
  w.name AS warehouse_name,
  COALESCE(w."regionName", '') AS region_name,
  SUM(si.quantity) AS quantity,
  (
    LOWER(REPLACE(w.name, 'ё', 'е')) LIKE '%электростал%'
    OR LOWER(REPLACE(w.name, 'ё', 'е')) LIKE '%краснодар%'
    OR LOWER(REPLACE(w.name, 'ё', 'е')) LIKE '%невинномыс%'
    OR LOWER(REPLACE(w.name, 'ё', 'е')) LIKE '%шушар%'
    OR LOWER(REPLACE(w.name, 'ё', 'е')) LIKE '%котовск%'
  ) AS excluded
FROM latest_snapshots ls
JOIN accounts a ON a.id = ls."wbAccountId"
JOIN stock_items si ON si."snapshotId" = ls.id
JOIN warehouses w
  ON w."wbAccountId" = si."wbAccountId"
 AND w."warehouseId" = si."warehouseId"
GROUP BY a.name, ls."syncedAt", w.name, w."regionName"
ORDER BY a.name, excluded DESC, quantity DESC
) TO '/tmp/stock_supply_warehouses.csv' WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');
