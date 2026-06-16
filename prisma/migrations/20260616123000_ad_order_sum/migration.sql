ALTER TABLE "ad_campaign_stats"
  ADD COLUMN "orderSum" DECIMAL(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE "ad_campaign_nm_stats"
  ADD COLUMN "orderSum" DECIMAL(12, 2) NOT NULL DEFAULT 0;
