-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "SyncJobKind" AS ENUM ('PRODUCTS_REFRESH', 'REPORTS_PERIOD', 'SALES_PLAN_PERIOD', 'ADVERTISING_CAMPAIGNS', 'ADVERTISING_STATS', 'ADVERTISING_CLUSTERS');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdById" TEXT NOT NULL,
    "usedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wb_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sellerName" TEXT,
    "sellerId" TEXT,
    "tradeMark" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wb_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_job_runs" (
    "id" TEXT NOT NULL,
    "kind" "SyncJobKind" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "wbAccountId" TEXT,
    "payload" JSONB NOT NULL,
    "bullJobId" TEXT,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_schedule_settings" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "kind" "SyncJobKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timeOfDay" TEXT NOT NULL,
    "rollingDays" INTEGER NOT NULL DEFAULT 7,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "lastAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_schedule_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_data_coverages" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "kind" "SyncJobKind" NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_data_coverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "nmId" INTEGER NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "vendorCodeLocal" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "subjectId" INTEGER,
    "title" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sizes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "techSize" TEXT NOT NULL,
    "wbSize" TEXT,
    "barcode" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "discount" INTEGER,
    "spp" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_materials" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "composition" TEXT NOT NULL,
    "compositionLocal" TEXT,

    CONSTRAINT "product_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_prices" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_purchases" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "cashback" DECIMAL(10,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_ads" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "vendorCode" TEXT,
    "date" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "source" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_overrides" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "localName" TEXT,
    "localColor" TEXT,
    "localSize" TEXT,
    "localComposition" TEXT,

    CONSTRAINT "article_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realization_reports" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "rrdId" BIGINT NOT NULL,
    "realizationReportId" INTEGER NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "nmId" INTEGER NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "barcode" TEXT,
    "docTypeName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "retailPrice" DECIMAL(10,2) NOT NULL,
    "retailPriceWithDisc" DECIMAL(10,2) NOT NULL,
    "ppvzForPay" DECIMAL(10,2) NOT NULL,
    "ppvzSppPrc" DECIMAL(5,2) NOT NULL,
    "deliveryRub" DECIMAL(10,2) NOT NULL,
    "penalty" DECIMAL(10,2) NOT NULL,
    "additionalPayment" DECIMAL(10,2) NOT NULL,
    "storageFee" DECIMAL(10,2) NOT NULL,
    "deduction" DECIMAL(10,2) NOT NULL,
    "acceptance" DECIMAL(10,2) NOT NULL,
    "acquiringFee" DECIMAL(10,2) NOT NULL,
    "commissionPercent" DECIMAL(5,2) NOT NULL,
    "ppvzSalesCommission" DECIMAL(10,2) NOT NULL,
    "salePercent" DECIMAL(5,2) NOT NULL,
    "bonusTypeName" TEXT,
    "srid" TEXT,
    "subjectName" TEXT,
    "brandName" TEXT,
    "officeName" TEXT,
    "supplierOperName" TEXT,
    "orderDt" TIMESTAMP(3),
    "saleDt" TIMESTAMP(3),
    "rrDt" DATE,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realization_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paid_storage" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "nmId" INTEGER NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "barcode" TEXT,
    "brand" TEXT,
    "subject" TEXT,
    "category" TEXT,
    "warehouseName" TEXT,
    "chrtId" INTEGER NOT NULL,
    "size" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(10,2) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paid_storage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "advertId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "bidType" TEXT,
    "paymentType" TEXT,
    "placementSearch" BOOLEAN NOT NULL DEFAULT false,
    "placementReco" BOOLEAN NOT NULL DEFAULT false,
    "budget" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaign_stats" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "cpc" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "cartAdds" INTEGER NOT NULL DEFAULT 0,
    "bid" DECIMAL(10,2),

    CONSTRAINT "ad_campaign_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaign_nm_stats" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "nmId" INTEGER NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "cpc" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "cartAdds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ad_campaign_nm_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaign_clusters" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "cluster" TEXT NOT NULL,
    "ctr" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "position" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "cartAdds" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "cpm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,

    CONSTRAINT "ad_campaign_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_action_logs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "valueBefore" DECIMAL(10,2),
    "valueAfter" DECIMAL(10,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_plans" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "drrPercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_plan_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "nmId" INTEGER NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "plannedQty" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "buyoutPercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "sales_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wb_orders" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "srid" TEXT NOT NULL,
    "nmId" INTEGER NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "lastChangeDate" TIMESTAMP(3) NOT NULL,
    "finishedPrice" DECIMAL(10,2) NOT NULL,
    "isCancel" BOOLEAN NOT NULL DEFAULT false,
    "regionName" TEXT,
    "warehouseName" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wb_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wb_sales" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "srid" TEXT NOT NULL,
    "nmId" INTEGER NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "lastChangeDate" TIMESTAMP(3) NOT NULL,
    "finishedPrice" DECIMAL(10,2),
    "priceWithDisc" DECIMAL(10,2) NOT NULL,
    "forPay" DECIMAL(10,2) NOT NULL,
    "isReturn" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wb_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wb_funnel_stats" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "nmId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "addToCartCount" INTEGER NOT NULL DEFAULT 0,
    "addToCartConversion" DECIMAL(6,4) NOT NULL,
    "cartCount" INTEGER NOT NULL DEFAULT 0,
    "cartToOrderConversion" DECIMAL(6,4) NOT NULL,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "ordersSumRub" DECIMAL(12,2) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wb_funnel_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "sync_job_runs_status_createdAt_idx" ON "sync_job_runs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "sync_job_runs_kind_createdAt_idx" ON "sync_job_runs"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "sync_job_runs_wbAccountId_createdAt_idx" ON "sync_job_runs"("wbAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "sync_job_runs_bullJobId_idx" ON "sync_job_runs"("bullJobId");

-- CreateIndex
CREATE INDEX "sync_schedule_settings_wbAccountId_idx" ON "sync_schedule_settings"("wbAccountId");

-- CreateIndex
CREATE INDEX "sync_schedule_settings_kind_idx" ON "sync_schedule_settings"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "sync_schedule_settings_wbAccountId_kind_key" ON "sync_schedule_settings"("wbAccountId", "kind");

-- CreateIndex
CREATE INDEX "sync_data_coverages_wbAccountId_kind_dateFrom_dateTo_idx" ON "sync_data_coverages"("wbAccountId", "kind", "dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "products_nmId_idx" ON "products"("nmId");

-- CreateIndex
CREATE INDEX "products_vendorCode_idx" ON "products"("vendorCode");

-- CreateIndex
CREATE INDEX "products_wbAccountId_idx" ON "products"("wbAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "products_wbAccountId_nmId_key" ON "products"("wbAccountId", "nmId");

-- CreateIndex
CREATE INDEX "product_sizes_productId_idx" ON "product_sizes"("productId");

-- CreateIndex
CREATE INDEX "product_sizes_barcode_idx" ON "product_sizes"("barcode");

-- CreateIndex
CREATE INDEX "cost_prices_wbAccountId_idx" ON "cost_prices"("wbAccountId");

-- CreateIndex
CREATE INDEX "cost_prices_vendorCode_idx" ON "cost_prices"("vendorCode");

-- CreateIndex
CREATE UNIQUE INDEX "cost_prices_wbAccountId_vendorCode_key" ON "cost_prices"("wbAccountId", "vendorCode");

-- CreateIndex
CREATE INDEX "self_purchases_wbAccountId_idx" ON "self_purchases"("wbAccountId");

-- CreateIndex
CREATE INDEX "self_purchases_vendorCode_idx" ON "self_purchases"("vendorCode");

-- CreateIndex
CREATE INDEX "self_purchases_date_idx" ON "self_purchases"("date");

-- CreateIndex
CREATE INDEX "external_ads_wbAccountId_idx" ON "external_ads"("wbAccountId");

-- CreateIndex
CREATE INDEX "external_ads_date_idx" ON "external_ads"("date");

-- CreateIndex
CREATE INDEX "article_overrides_wbAccountId_idx" ON "article_overrides"("wbAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "article_overrides_wbAccountId_vendorCode_key" ON "article_overrides"("wbAccountId", "vendorCode");

-- CreateIndex
CREATE UNIQUE INDEX "realization_reports_rrdId_key" ON "realization_reports"("rrdId");

-- CreateIndex
CREATE INDEX "realization_reports_wbAccountId_idx" ON "realization_reports"("wbAccountId");

-- CreateIndex
CREATE INDEX "realization_reports_nmId_idx" ON "realization_reports"("nmId");

-- CreateIndex
CREATE INDEX "realization_reports_vendorCode_idx" ON "realization_reports"("vendorCode");

-- CreateIndex
CREATE INDEX "realization_reports_dateFrom_dateTo_idx" ON "realization_reports"("dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "realization_reports_wbAccountId_nmId_dateFrom_idx" ON "realization_reports"("wbAccountId", "nmId", "dateFrom");

-- CreateIndex
CREATE INDEX "paid_storage_wbAccountId_idx" ON "paid_storage"("wbAccountId");

-- CreateIndex
CREATE INDEX "paid_storage_wbAccountId_date_idx" ON "paid_storage"("wbAccountId", "date");

-- CreateIndex
CREATE INDEX "paid_storage_wbAccountId_nmId_idx" ON "paid_storage"("wbAccountId", "nmId");

-- CreateIndex
CREATE UNIQUE INDEX "paid_storage_wbAccountId_date_nmId_chrtId_key" ON "paid_storage"("wbAccountId", "date", "nmId", "chrtId");

-- CreateIndex
CREATE INDEX "ad_campaigns_wbAccountId_idx" ON "ad_campaigns"("wbAccountId");

-- CreateIndex
CREATE INDEX "ad_campaigns_status_idx" ON "ad_campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ad_campaigns_wbAccountId_advertId_key" ON "ad_campaigns"("wbAccountId", "advertId");

-- CreateIndex
CREATE INDEX "ad_campaign_stats_campaignId_idx" ON "ad_campaign_stats"("campaignId");

-- CreateIndex
CREATE INDEX "ad_campaign_stats_date_idx" ON "ad_campaign_stats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ad_campaign_stats_campaignId_date_source_key" ON "ad_campaign_stats"("campaignId", "date", "source");

-- CreateIndex
CREATE INDEX "ad_campaign_nm_stats_campaignId_idx" ON "ad_campaign_nm_stats"("campaignId");

-- CreateIndex
CREATE INDEX "ad_campaign_nm_stats_nmId_idx" ON "ad_campaign_nm_stats"("nmId");

-- CreateIndex
CREATE INDEX "ad_campaign_nm_stats_date_idx" ON "ad_campaign_nm_stats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ad_campaign_nm_stats_campaignId_date_source_nmId_key" ON "ad_campaign_nm_stats"("campaignId", "date", "source", "nmId");

-- CreateIndex
CREATE INDEX "ad_campaign_clusters_campaignId_idx" ON "ad_campaign_clusters"("campaignId");

-- CreateIndex
CREATE INDEX "ad_campaign_clusters_dateFrom_dateTo_idx" ON "ad_campaign_clusters"("dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "ad_action_logs_campaignId_idx" ON "ad_action_logs"("campaignId");

-- CreateIndex
CREATE INDEX "ad_action_logs_createdAt_idx" ON "ad_action_logs"("createdAt");

-- CreateIndex
CREATE INDEX "sales_plans_wbAccountId_idx" ON "sales_plans"("wbAccountId");

-- CreateIndex
CREATE INDEX "sales_plan_items_planId_idx" ON "sales_plan_items"("planId");

-- CreateIndex
CREATE INDEX "sales_plan_items_nmId_idx" ON "sales_plan_items"("nmId");

-- CreateIndex
CREATE INDEX "wb_orders_wbAccountId_nmId_date_idx" ON "wb_orders"("wbAccountId", "nmId", "date");

-- CreateIndex
CREATE INDEX "wb_orders_wbAccountId_date_idx" ON "wb_orders"("wbAccountId", "date");

-- CreateIndex
CREATE INDEX "wb_orders_wbAccountId_lastChangeDate_idx" ON "wb_orders"("wbAccountId", "lastChangeDate");

-- CreateIndex
CREATE UNIQUE INDEX "wb_orders_wbAccountId_srid_key" ON "wb_orders"("wbAccountId", "srid");

-- CreateIndex
CREATE INDEX "wb_sales_wbAccountId_nmId_date_idx" ON "wb_sales"("wbAccountId", "nmId", "date");

-- CreateIndex
CREATE INDEX "wb_sales_wbAccountId_date_idx" ON "wb_sales"("wbAccountId", "date");

-- CreateIndex
CREATE INDEX "wb_sales_wbAccountId_lastChangeDate_idx" ON "wb_sales"("wbAccountId", "lastChangeDate");

-- CreateIndex
CREATE UNIQUE INDEX "wb_sales_wbAccountId_srid_key" ON "wb_sales"("wbAccountId", "srid");

-- CreateIndex
CREATE INDEX "wb_funnel_stats_wbAccountId_date_idx" ON "wb_funnel_stats"("wbAccountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "wb_funnel_stats_wbAccountId_nmId_date_key" ON "wb_funnel_stats"("wbAccountId", "nmId", "date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_job_runs" ADD CONSTRAINT "sync_job_runs_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_schedule_settings" ADD CONSTRAINT "sync_schedule_settings_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_data_coverages" ADD CONSTRAINT "sync_data_coverages_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_prices" ADD CONSTRAINT "cost_prices_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_purchases" ADD CONSTRAINT "self_purchases_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_ads" ADD CONSTRAINT "external_ads_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_overrides" ADD CONSTRAINT "article_overrides_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realization_reports" ADD CONSTRAINT "realization_reports_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_storage" ADD CONSTRAINT "paid_storage_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaign_stats" ADD CONSTRAINT "ad_campaign_stats_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaign_nm_stats" ADD CONSTRAINT "ad_campaign_nm_stats_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaign_clusters" ADD CONSTRAINT "ad_campaign_clusters_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_action_logs" ADD CONSTRAINT "ad_action_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_plans" ADD CONSTRAINT "sales_plans_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_plan_items" ADD CONSTRAINT "sales_plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "sales_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wb_orders" ADD CONSTRAINT "wb_orders_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wb_sales" ADD CONSTRAINT "wb_sales_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wb_funnel_stats" ADD CONSTRAINT "wb_funnel_stats_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
