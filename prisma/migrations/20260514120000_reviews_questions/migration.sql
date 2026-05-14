-- Phase 4: WB reviews and questions read-only feedback module.
ALTER TYPE "SyncJobKind" ADD VALUE IF NOT EXISTS 'REVIEWS_REFRESH';
ALTER TYPE "SyncJobKind" ADD VALUE IF NOT EXISTS 'QUESTIONS_REFRESH';

CREATE TABLE "product_reviews" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "nmId" INTEGER NOT NULL,
  "rating" INTEGER NOT NULL,
  "text" TEXT,
  "pros" TEXT,
  "cons" TEXT,
  "state" TEXT,
  "answerText" TEXT,
  "answerState" TEXT,
  "answerEditable" BOOLEAN,
  "isAnswered" BOOLEAN NOT NULL DEFAULT false,
  "hasMedia" BOOLEAN NOT NULL DEFAULT false,
  "photos" JSONB,
  "videos" JSONB,
  "productId" TEXT,
  "vendorCode" TEXT,
  "productName" TEXT,
  "brandName" TEXT,
  "supplierName" TEXT,
  "productSnapshot" JSONB,
  "createdDate" TIMESTAMP(3) NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_questions" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "nmId" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "state" TEXT,
  "wasViewed" BOOLEAN NOT NULL DEFAULT false,
  "isWarned" BOOLEAN NOT NULL DEFAULT false,
  "answerText" TEXT,
  "answerEditable" BOOLEAN,
  "answerCreatedDate" TIMESTAMP(3),
  "isAnswered" BOOLEAN NOT NULL DEFAULT false,
  "productId" TEXT,
  "vendorCode" TEXT,
  "productName" TEXT,
  "brandName" TEXT,
  "supplierName" TEXT,
  "productSnapshot" JSONB,
  "createdDate" TIMESTAMP(3) NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_reviews_wbAccountId_externalId_key" ON "product_reviews"("wbAccountId", "externalId");
CREATE INDEX "product_reviews_wbAccountId_createdDate_idx" ON "product_reviews"("wbAccountId", "createdDate");
CREATE INDEX "product_reviews_wbAccountId_nmId_idx" ON "product_reviews"("wbAccountId", "nmId");
CREATE INDEX "product_reviews_wbAccountId_isAnswered_idx" ON "product_reviews"("wbAccountId", "isAnswered");
CREATE INDEX "product_reviews_rating_idx" ON "product_reviews"("rating");

CREATE UNIQUE INDEX "product_questions_wbAccountId_externalId_key" ON "product_questions"("wbAccountId", "externalId");
CREATE INDEX "product_questions_wbAccountId_createdDate_idx" ON "product_questions"("wbAccountId", "createdDate");
CREATE INDEX "product_questions_wbAccountId_nmId_idx" ON "product_questions"("wbAccountId", "nmId");
CREATE INDEX "product_questions_wbAccountId_isAnswered_idx" ON "product_questions"("wbAccountId", "isAnswered");

ALTER TABLE "product_reviews"
  ADD CONSTRAINT "product_reviews_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_reviews"
  ADD CONSTRAINT "product_reviews_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_questions"
  ADD CONSTRAINT "product_questions_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_questions"
  ADD CONSTRAINT "product_questions_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
