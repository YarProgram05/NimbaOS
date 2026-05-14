-- Phase 4.1: answer templates and explicit WB feedback/question write actions.
CREATE TYPE "FeedbackWriteActionKind" AS ENUM (
  'REVIEW_ANSWER_CREATE',
  'REVIEW_ANSWER_UPDATE',
  'QUESTION_ANSWER_UPSERT'
);

CREATE TYPE "FeedbackWriteActionStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TABLE "reply_template_groups" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reply_template_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reply_templates" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reply_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feedback_write_action_logs" (
  "id" TEXT NOT NULL,
  "wbAccountId" TEXT NOT NULL,
  "userId" TEXT,
  "kind" "FeedbackWriteActionKind" NOT NULL,
  "status" "FeedbackWriteActionStatus" NOT NULL DEFAULT 'QUEUED',
  "entityType" TEXT NOT NULL,
  "localEntityId" TEXT,
  "externalId" TEXT NOT NULL,
  "answerText" TEXT NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "feedback_write_action_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reply_template_groups_wbAccountId_name_key"
  ON "reply_template_groups"("wbAccountId", "name");
CREATE INDEX "reply_template_groups_wbAccountId_sortOrder_idx"
  ON "reply_template_groups"("wbAccountId", "sortOrder");
CREATE INDEX "reply_templates_groupId_sortOrder_idx"
  ON "reply_templates"("groupId", "sortOrder");
CREATE INDEX "feedback_write_action_logs_wbAccountId_createdAt_idx"
  ON "feedback_write_action_logs"("wbAccountId", "createdAt");
CREATE INDEX "feedback_write_action_logs_status_createdAt_idx"
  ON "feedback_write_action_logs"("status", "createdAt");
CREATE INDEX "feedback_write_action_logs_externalId_idx"
  ON "feedback_write_action_logs"("externalId");

ALTER TABLE "reply_template_groups"
  ADD CONSTRAINT "reply_template_groups_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reply_templates"
  ADD CONSTRAINT "reply_templates_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "reply_template_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedback_write_action_logs"
  ADD CONSTRAINT "feedback_write_action_logs_wbAccountId_fkey"
  FOREIGN KEY ("wbAccountId") REFERENCES "wb_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedback_write_action_logs"
  ADD CONSTRAINT "feedback_write_action_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
