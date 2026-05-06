-- rrdId is unique only within a WB account. The same WB report row id can
-- appear in another account after account/key replacement, so a global unique
-- index makes re-sync silently skip valid rows.
DROP INDEX IF EXISTS "realization_reports_rrdId_key";

CREATE UNIQUE INDEX "realization_reports_wbAccountId_rrdId_key"
ON "realization_reports"("wbAccountId", "rrdId");
