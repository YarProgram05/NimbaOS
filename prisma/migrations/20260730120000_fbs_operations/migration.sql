-- FBS operational accounting, seller-owned inventory and serialized KIZ lifecycle.
-- All WB mutations remain explicit and warehouse-gated; background syncs are read-only.

ALTER TYPE "SyncJobKind" ADD VALUE 'FBS_OPERATIONAL';
ALTER TYPE "SyncJobKind" ADD VALUE 'FBS_STOCKS_CURRENT';
ALTER TYPE "SyncJobKind" ADD VALUE 'FBS_MARKING_REPORT';

CREATE TYPE "FbsInventoryMovementType" AS ENUM (
  'OPENING',
  'RECEIPT',
  'ADJUSTMENT',
  'RESERVE',
  'RELEASE',
  'SHIPMENT',
  'RETURN_RECEIVED',
  'QUARANTINE',
  'WRITE_OFF'
);

CREATE TYPE "KizPhysicalState" AS ENUM (
  'IN_STOCK',
  'RESERVED',
  'HANDED_OVER',
  'RETURN_EXPECTED',
  'QUARANTINE',
  'LOST',
  'WRITTEN_OFF'
);

CREATE TYPE "KizCirculationState" AS ENUM (
  'UNKNOWN',
  'COMMISSIONING_REQUIRED',
  'IN_CIRCULATION',
  'WITHDRAWAL_REQUIRED',
  'WITHDRAWN',
  'RETURN_TO_CIRCULATION_REQUIRED'
);

CREATE TYPE "KizEventType" AS ENUM (
  'IMPORTED',
  'SCANNED',
  'ASSIGNED',
  'UNASSIGNED',
  'ATTACHED_TO_WB',
  'HANDED_OVER',
  'SALE_DETECTED',
  'RETURN_EXPECTED',
  'RETURN_RECEIVED',
  'QUARANTINED',
  'COMPLIANCE_EXPORTED',
  'COMPLIANCE_CONFIRMED'
);

CREATE TYPE "KizComplianceTaskType" AS ENUM (
  'COMMISSIONING',
  'WITHDRAWAL_REMOTE_SALE',
  'WITHDRAWAL_B2B',
  'RETURN_TO_CIRCULATION',
  'RELABEL'
);

CREATE TYPE "KizComplianceTaskStatus" AS ENUM (
  'OPEN',
  'EXPORTED',
  'CONFIRMED',
  'CANCELED'
);

CREATE TYPE "FbsActionKind" AS ENUM (
  'ATTACH_KIZ',
  'SET_ORDER_STATUS',
  'MOVE_TO_SUPPLY',
  'CLOSE_SUPPLY',
  'PUBLISH_STOCKS'
);

CREATE TYPE "FbsActionStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED'
);

ALTER TABLE "sync_schedule_settings"
  ADD COLUMN "intervalMinutes" INTEGER;

ALTER TABLE "realization_reports"
  ADD COLUMN "orderId" BIGINT,
  ADD COLUMN "orderUid" TEXT,
  ADD COLUMN "trbxId" TEXT,
  ADD COLUMN "deliveryMethod" TEXT,
  ADD COLUMN "isB2b" BOOLEAN,
  ADD COLUMN "kizHash" TEXT,
  ADD COLUMN "kizMasked" TEXT,
  ADD COLUMN "kizEncrypted" TEXT;

CREATE INDEX "realization_reports_wbAccountId_deliveryMethod_dateFrom_idx"
  ON "realization_reports"("wbAccountId", "deliveryMethod", "dateFrom");
CREATE INDEX "realization_reports_wbAccountId_orderId_idx"
  ON "realization_reports"("wbAccountId", "orderId");
CREATE INDEX "realization_reports_wbAccountId_kizHash_idx"
  ON "realization_reports"("wbAccountId", "kizHash");

CREATE TABLE "fbs_seller_warehouses" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "externalId" BIGINT NOT NULL,
  "name" TEXT NOT NULL,
  "officeId" BIGINT,
  "deliveryType" TEXT,
  "cargoType" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "writeEnabled" BOOLEAN NOT NULL DEFAULT false,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fbs_seller_warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fbs_assortment_items" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT,
  "productSizeId" TEXT,
  "nmId" INTEGER NOT NULL,
  "chrtId" INTEGER NOT NULL,
  "barcode" TEXT NOT NULL,
  "vendorCode" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "requiresKiz" BOOLEAN NOT NULL DEFAULT false,
  "markingGtin" TEXT,
  "onHand" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "wbStock" INTEGER NOT NULL DEFAULT 0,
  "wbStockSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fbs_assortment_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "fbs_assortment_items"
  ADD CONSTRAINT "fbs_assortment_items_balance_check"
  CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand");

CREATE TABLE "fbs_supplies" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "warehouseId" TEXT,
  "externalId" TEXT NOT NULL,
  "name" TEXT,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "isB2b" BOOLEAN NOT NULL DEFAULT false,
  "cargoType" TEXT,
  "crossBorderType" TEXT,
  "createdAtWb" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fbs_supplies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fbs_orders" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "externalOrderId" BIGINT NOT NULL,
  "rid" TEXT,
  "orderUid" TEXT,
  "warehouseId" TEXT,
  "assortmentItemId" TEXT,
  "supplyId" TEXT,
  "nmId" INTEGER NOT NULL,
  "chrtId" INTEGER NOT NULL,
  "barcode" TEXT NOT NULL,
  "vendorCode" TEXT,
  "createdAtWb" TIMESTAMP(3) NOT NULL,
  "deliveryDate" TIMESTAMP(3),
  "priceRaw" INTEGER,
  "convertedPriceRaw" INTEGER,
  "currencyCode" INTEGER,
  "isB2b" BOOLEAN NOT NULL DEFAULT false,
  "requiredMeta" JSONB,
  "optionalMeta" JSONB,
  "metadataStatus" JSONB,
  "supplierStatus" TEXT NOT NULL,
  "wbStatus" TEXT NOT NULL,
  "reservationApplied" BOOLEAN NOT NULL DEFAULT false,
  "shipmentApplied" BOOLEAN NOT NULL DEFAULT false,
  "shippedAt" TIMESTAMP(3),
  "soldAt" TIMESTAMP(3),
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fbs_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fbs_order_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "supplierStatus" TEXT,
  "wbStatus" TEXT,
  "supplyExternalId" TEXT,
  "metadataStatus" JSONB,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fbs_order_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kiz_units" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "warehouseId" TEXT,
  "assortmentItemId" TEXT,
  "productSizeId" TEXT,
  "currentOrderId" TEXT,
  "encryptedCode" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "maskedCode" TEXT NOT NULL,
  "gtin" TEXT,
  "serialMasked" TEXT,
  "physicalState" "KizPhysicalState" NOT NULL DEFAULT 'IN_STOCK',
  "circulationState" "KizCirculationState" NOT NULL DEFAULT 'UNKNOWN',
  "wbValidationStatus" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastScannedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "kiz_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fbs_inventory_movements" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "orderId" TEXT,
  "kizUnitId" TEXT,
  "userId" TEXT,
  "type" "FbsInventoryMovementType" NOT NULL,
  "onHandDelta" INTEGER NOT NULL DEFAULT 0,
  "reservedDelta" INTEGER NOT NULL DEFAULT 0,
  "balanceAfterOnHand" INTEGER NOT NULL,
  "balanceAfterReserved" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "note" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fbs_inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kiz_events" (
  "id" TEXT NOT NULL,
  "kizUnitId" TEXT NOT NULL,
  "orderId" TEXT,
  "userId" TEXT,
  "type" "KizEventType" NOT NULL,
  "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kiz_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kiz_operation_batches" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "createdById" TEXT,
  "filename" TEXT NOT NULL,
  "taskCount" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kiz_operation_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kiz_compliance_tasks" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "kizUnitId" TEXT NOT NULL,
  "orderId" TEXT,
  "batchId" TEXT,
  "type" "KizComplianceTaskType" NOT NULL,
  "status" "KizComplianceTaskStatus" NOT NULL DEFAULT 'OPEN',
  "idempotencyKey" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "documentNumber" TEXT,
  "documentDate" DATE,
  "exportedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "confirmedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "kiz_compliance_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fbs_action_logs" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "userId" TEXT,
  "warehouseId" TEXT,
  "assortmentItemId" TEXT,
  "orderId" TEXT,
  "supplyId" TEXT,
  "kind" "FbsActionKind" NOT NULL,
  "status" "FbsActionStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "requestSummary" JSONB,
  "result" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fbs_action_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fbs_seller_warehouses_wbAccountId_externalId_key"
  ON "fbs_seller_warehouses"("wbAccountId", "externalId");
CREATE INDEX "fbs_seller_warehouses_wbAccountId_isEnabled_idx"
  ON "fbs_seller_warehouses"("wbAccountId", "isEnabled");

CREATE UNIQUE INDEX "fbs_assortment_items_warehouseId_chrtId_key"
  ON "fbs_assortment_items"("warehouseId", "chrtId");
CREATE INDEX "fbs_assortment_items_wbAccountId_nmId_idx"
  ON "fbs_assortment_items"("wbAccountId", "nmId");
CREATE INDEX "fbs_assortment_items_warehouseId_isEnabled_idx"
  ON "fbs_assortment_items"("warehouseId", "isEnabled");
CREATE INDEX "fbs_assortment_items_barcode_idx"
  ON "fbs_assortment_items"("barcode");

CREATE UNIQUE INDEX "fbs_supplies_wbAccountId_externalId_key"
  ON "fbs_supplies"("wbAccountId", "externalId");
CREATE INDEX "fbs_supplies_wbAccountId_done_idx"
  ON "fbs_supplies"("wbAccountId", "done");
CREATE INDEX "fbs_supplies_warehouseId_idx"
  ON "fbs_supplies"("warehouseId");

CREATE UNIQUE INDEX "fbs_orders_wbAccountId_externalOrderId_key"
  ON "fbs_orders"("wbAccountId", "externalOrderId");
CREATE INDEX "fbs_orders_wbAccountId_createdAtWb_idx"
  ON "fbs_orders"("wbAccountId", "createdAtWb");
CREATE INDEX "fbs_orders_wbAccountId_supplierStatus_wbStatus_idx"
  ON "fbs_orders"("wbAccountId", "supplierStatus", "wbStatus");
CREATE INDEX "fbs_orders_warehouseId_createdAtWb_idx"
  ON "fbs_orders"("warehouseId", "createdAtWb");
CREATE INDEX "fbs_orders_supplyId_idx"
  ON "fbs_orders"("supplyId");

CREATE UNIQUE INDEX "fbs_order_events_orderId_eventKey_key"
  ON "fbs_order_events"("orderId", "eventKey");
CREATE INDEX "fbs_order_events_orderId_observedAt_idx"
  ON "fbs_order_events"("orderId", "observedAt");

CREATE UNIQUE INDEX "kiz_units_wbAccountId_codeHash_key"
  ON "kiz_units"("wbAccountId", "codeHash");
CREATE INDEX "kiz_units_wbAccountId_physicalState_circulationState_idx"
  ON "kiz_units"("wbAccountId", "physicalState", "circulationState");
CREATE INDEX "kiz_units_currentOrderId_idx"
  ON "kiz_units"("currentOrderId");
CREATE INDEX "kiz_units_gtin_idx"
  ON "kiz_units"("gtin");

CREATE UNIQUE INDEX "fbs_inventory_movements_itemId_idempotencyKey_key"
  ON "fbs_inventory_movements"("itemId", "idempotencyKey");
CREATE INDEX "fbs_inventory_movements_itemId_occurredAt_idx"
  ON "fbs_inventory_movements"("itemId", "occurredAt");
CREATE INDEX "fbs_inventory_movements_orderId_idx"
  ON "fbs_inventory_movements"("orderId");
CREATE INDEX "fbs_inventory_movements_kizUnitId_idx"
  ON "fbs_inventory_movements"("kizUnitId");

CREATE INDEX "kiz_events_kizUnitId_occurredAt_idx"
  ON "kiz_events"("kizUnitId", "occurredAt");
CREATE INDEX "kiz_events_orderId_idx"
  ON "kiz_events"("orderId");

CREATE INDEX "kiz_operation_batches_wbAccountId_createdAt_idx"
  ON "kiz_operation_batches"("wbAccountId", "createdAt");

CREATE UNIQUE INDEX "kiz_compliance_tasks_idempotencyKey_key"
  ON "kiz_compliance_tasks"("idempotencyKey");
CREATE INDEX "kiz_compliance_tasks_wbAccountId_status_dueAt_idx"
  ON "kiz_compliance_tasks"("wbAccountId", "status", "dueAt");
CREATE INDEX "kiz_compliance_tasks_kizUnitId_idx"
  ON "kiz_compliance_tasks"("kizUnitId");
CREATE INDEX "kiz_compliance_tasks_orderId_idx"
  ON "kiz_compliance_tasks"("orderId");
CREATE INDEX "kiz_compliance_tasks_batchId_idx"
  ON "kiz_compliance_tasks"("batchId");

CREATE UNIQUE INDEX "fbs_action_logs_wbAccountId_kind_idempotencyKey_key"
  ON "fbs_action_logs"("wbAccountId", "kind", "idempotencyKey");
CREATE INDEX "fbs_action_logs_wbAccountId_createdAt_idx"
  ON "fbs_action_logs"("wbAccountId", "createdAt");
CREATE INDEX "fbs_action_logs_status_createdAt_idx"
  ON "fbs_action_logs"("status", "createdAt");

ALTER TABLE "fbs_seller_warehouses"
  ADD CONSTRAINT "fbs_seller_warehouses_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fbs_assortment_items"
  ADD CONSTRAINT "fbs_assortment_items_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fbs_assortment_items"
  ADD CONSTRAINT "fbs_assortment_items_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "fbs_seller_warehouses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fbs_assortment_items"
  ADD CONSTRAINT "fbs_assortment_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fbs_assortment_items"
  ADD CONSTRAINT "fbs_assortment_items_productSizeId_fkey"
  FOREIGN KEY ("productSizeId") REFERENCES "product_sizes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fbs_supplies"
  ADD CONSTRAINT "fbs_supplies_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fbs_supplies"
  ADD CONSTRAINT "fbs_supplies_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "fbs_seller_warehouses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fbs_orders"
  ADD CONSTRAINT "fbs_orders_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fbs_orders"
  ADD CONSTRAINT "fbs_orders_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "fbs_seller_warehouses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fbs_orders"
  ADD CONSTRAINT "fbs_orders_assortmentItemId_fkey"
  FOREIGN KEY ("assortmentItemId") REFERENCES "fbs_assortment_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fbs_orders"
  ADD CONSTRAINT "fbs_orders_supplyId_fkey"
  FOREIGN KEY ("supplyId") REFERENCES "fbs_supplies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fbs_order_events"
  ADD CONSTRAINT "fbs_order_events_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "fbs_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kiz_units"
  ADD CONSTRAINT "kiz_units_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kiz_units"
  ADD CONSTRAINT "kiz_units_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "fbs_seller_warehouses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kiz_units"
  ADD CONSTRAINT "kiz_units_assortmentItemId_fkey"
  FOREIGN KEY ("assortmentItemId") REFERENCES "fbs_assortment_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kiz_units"
  ADD CONSTRAINT "kiz_units_productSizeId_fkey"
  FOREIGN KEY ("productSizeId") REFERENCES "product_sizes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kiz_units"
  ADD CONSTRAINT "kiz_units_currentOrderId_fkey"
  FOREIGN KEY ("currentOrderId") REFERENCES "fbs_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fbs_inventory_movements"
  ADD CONSTRAINT "fbs_inventory_movements_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "fbs_assortment_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fbs_inventory_movements"
  ADD CONSTRAINT "fbs_inventory_movements_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "fbs_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fbs_inventory_movements"
  ADD CONSTRAINT "fbs_inventory_movements_kizUnitId_fkey"
  FOREIGN KEY ("kizUnitId") REFERENCES "kiz_units"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fbs_inventory_movements"
  ADD CONSTRAINT "fbs_inventory_movements_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kiz_events"
  ADD CONSTRAINT "kiz_events_kizUnitId_fkey"
  FOREIGN KEY ("kizUnitId") REFERENCES "kiz_units"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kiz_events"
  ADD CONSTRAINT "kiz_events_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "fbs_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kiz_events"
  ADD CONSTRAINT "kiz_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kiz_operation_batches"
  ADD CONSTRAINT "kiz_operation_batches_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kiz_operation_batches"
  ADD CONSTRAINT "kiz_operation_batches_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kiz_compliance_tasks"
  ADD CONSTRAINT "kiz_compliance_tasks_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kiz_compliance_tasks"
  ADD CONSTRAINT "kiz_compliance_tasks_kizUnitId_fkey"
  FOREIGN KEY ("kizUnitId") REFERENCES "kiz_units"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kiz_compliance_tasks"
  ADD CONSTRAINT "kiz_compliance_tasks_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "fbs_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kiz_compliance_tasks"
  ADD CONSTRAINT "kiz_compliance_tasks_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "kiz_operation_batches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kiz_compliance_tasks"
  ADD CONSTRAINT "kiz_compliance_tasks_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fbs_action_logs"
  ADD CONSTRAINT "fbs_action_logs_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fbs_action_logs"
  ADD CONSTRAINT "fbs_action_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fbs_action_logs"
  ADD CONSTRAINT "fbs_action_logs_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "fbs_seller_warehouses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fbs_action_logs"
  ADD CONSTRAINT "fbs_action_logs_assortmentItemId_fkey"
  FOREIGN KEY ("assortmentItemId") REFERENCES "fbs_assortment_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fbs_action_logs"
  ADD CONSTRAINT "fbs_action_logs_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "fbs_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fbs_action_logs"
  ADD CONSTRAINT "fbs_action_logs_supplyId_fkey"
  FOREIGN KEY ("supplyId") REFERENCES "fbs_supplies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
