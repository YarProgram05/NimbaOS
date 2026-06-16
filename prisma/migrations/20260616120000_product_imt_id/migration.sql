ALTER TABLE "products"
  ADD COLUMN "imtId" INTEGER;

CREATE INDEX "products_imtId_idx" ON "products"("imtId");
