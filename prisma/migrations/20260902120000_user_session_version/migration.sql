-- Incremented whenever login credentials change so previously issued JWT sessions can be rejected.
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
