-- Phase 3: WB warehouse inventory snapshots.
ALTER TYPE "SyncJobKind" ADD VALUE IF NOT EXISTS 'STOCKS_CURRENT';

ALTER TABLE "product_sizes"
  ADD COLUMN "chrtId" INTEGER;

CREATE INDEX "product_sizes_chrtId_idx" ON "product_sizes"("chrtId");

CREATE TABLE "warehouses" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "regionName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_snapshots" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'wb_warehouses',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_items" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "nmId" INTEGER NOT NULL,
  "chrtId" INTEGER,
  "warehouseId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "inWayToClient" INTEGER NOT NULL DEFAULT 0,
  "inWayFromClient" INTEGER NOT NULL DEFAULT 0,
  "productId" TEXT,
  "productSizeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouses_wbAccountId_warehouseId_key" ON "warehouses"("wbAccountId", "warehouseId");
CREATE INDEX "warehouses_wbAccountId_idx" ON "warehouses"("wbAccountId");
CREATE INDEX "warehouses_warehouseId_idx" ON "warehouses"("warehouseId");

CREATE INDEX "stock_snapshots_wbAccountId_syncedAt_idx" ON "stock_snapshots"("wbAccountId", "syncedAt");

CREATE UNIQUE INDEX "stock_items_snapshotId_nmId_chrtId_warehouseId_key" ON "stock_items"("snapshotId", "nmId", "chrtId", "warehouseId");
CREATE INDEX "stock_items_snapshotId_idx" ON "stock_items"("snapshotId");
CREATE INDEX "stock_items_wbAccountId_nmId_idx" ON "stock_items"("wbAccountId", "nmId");
CREATE INDEX "stock_items_warehouseId_idx" ON "stock_items"("warehouseId");
CREATE INDEX "stock_items_chrtId_idx" ON "stock_items"("chrtId");

ALTER TABLE "warehouses"
  ADD CONSTRAINT "warehouses_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_snapshots"
  ADD CONSTRAINT "stock_snapshots_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_items"
  ADD CONSTRAINT "stock_items_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "stock_snapshots"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_items"
  ADD CONSTRAINT "stock_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_items"
  ADD CONSTRAINT "stock_items_productSizeId_fkey"
  FOREIGN KEY ("productSizeId") REFERENCES "product_sizes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_items"
  ADD CONSTRAINT "stock_items_wbAccountId_warehouseId_fkey"
  FOREIGN KEY ("wbAccountId", "warehouseId") REFERENCES "warehouses"("wbAccountId", "warehouseId")
  ON DELETE CASCADE ON UPDATE CASCADE;
