-- Article model/version history for reports.
-- Lets one WB nmId be split into business versions with separate display names
-- and optional historical cost prices.

CREATE TABLE "article_versions" (
    "id" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "nmId" INTEGER NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE,
    "vendorCode" TEXT NOT NULL,
    "costPrice" DECIMAL(10,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "article_versions_wbAccountId_nmId_dateFrom_key"
    ON "article_versions"("wbAccountId", "nmId", "dateFrom");

CREATE INDEX "article_versions_wbAccountId_idx"
    ON "article_versions"("wbAccountId");

CREATE INDEX "article_versions_wbAccountId_nmId_dateFrom_dateTo_idx"
    ON "article_versions"("wbAccountId", "nmId", "dateFrom", "dateTo");

ALTER TABLE "article_versions"
    ADD CONSTRAINT "article_versions_wbAccountId_fkey"
    FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
