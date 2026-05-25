-- CreateEnum
CREATE TYPE "AutomationWorkflowKind" AS ENUM ('MORNING_WB_REPORT');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "automation_workflow_settings" (
    "id" TEXT NOT NULL,
    "kind" "AutomationWorkflowKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "timeOfDay" TEXT NOT NULL DEFAULT '10:00',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "config" JSONB NOT NULL,
    "lastAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_workflow_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_workflow_accounts" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "wbAccountId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sheetName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_workflow_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT,
    "kind" "AutomationWorkflowKind" NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "bullJobId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_workflow_settings_kind_key" ON "automation_workflow_settings"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "automation_workflow_accounts_workflowId_wbAccountId_key" ON "automation_workflow_accounts"("workflowId", "wbAccountId");

-- CreateIndex
CREATE INDEX "automation_workflow_accounts_workflowId_idx" ON "automation_workflow_accounts"("workflowId");

-- CreateIndex
CREATE INDEX "automation_workflow_accounts_wbAccountId_idx" ON "automation_workflow_accounts"("wbAccountId");

-- CreateIndex
CREATE INDEX "automation_runs_kind_createdAt_idx" ON "automation_runs"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "automation_runs_status_createdAt_idx" ON "automation_runs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "automation_runs_workflowId_createdAt_idx" ON "automation_runs"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX "automation_runs_bullJobId_idx" ON "automation_runs"("bullJobId");

-- AddForeignKey
ALTER TABLE "automation_workflow_accounts" ADD CONSTRAINT "automation_workflow_accounts_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "automation_workflow_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_workflow_accounts" ADD CONSTRAINT "automation_workflow_accounts_wbAccountId_fkey" FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "automation_workflow_settings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
