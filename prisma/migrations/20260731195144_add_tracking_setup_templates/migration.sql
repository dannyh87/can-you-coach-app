-- CreateEnum
CREATE TYPE "TrackingTemplateVisibility" AS ENUM ('PERSONAL', 'TEAM', 'CLUB');

-- AlterTable
ALTER TABLE "MatchTrackingTask" ADD COLUMN     "sourceTemplateTaskId" TEXT,
ADD COLUMN     "templateApplicationId" TEXT;

-- CreateTable
CREATE TABLE "TrackingSetupTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "TrackingTemplateVisibility" NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingSetupTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingSetupTemplateTask" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "scopeType" "MatchTrackingScope" NOT NULL,
    "targetContext" "TrackingTargetContext",
    "unitKey" TEXT,
    "unitLabel" TEXT,
    "topicId" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingSetupTemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingSetupTemplateTaskEvent" (
    "id" TEXT NOT NULL,
    "templateTaskId" TEXT NOT NULL,
    "eventDefinitionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingSetupTemplateTaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingSetupTemplateTaskPattern" (
    "id" TEXT NOT NULL,
    "templateTaskId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingSetupTemplateTaskPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingSetupTemplateApplication" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateRevision" INTEGER NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "appliedByUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingSetupTemplateApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingSetupTemplate_clubId_idx" ON "TrackingSetupTemplate"("clubId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplate_teamId_idx" ON "TrackingSetupTemplate"("teamId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplate_ownerUserId_idx" ON "TrackingSetupTemplate"("ownerUserId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplate_visibility_idx" ON "TrackingSetupTemplate"("visibility");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplate_active_idx" ON "TrackingSetupTemplate"("active");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplate_archivedAt_idx" ON "TrackingSetupTemplate"("archivedAt");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTask_templateId_idx" ON "TrackingSetupTemplateTask"("templateId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTask_topicId_idx" ON "TrackingSetupTemplateTask"("topicId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTask_scopeType_targetContext_idx" ON "TrackingSetupTemplateTask"("scopeType", "targetContext");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTaskEvent_templateTaskId_idx" ON "TrackingSetupTemplateTaskEvent"("templateTaskId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTaskEvent_eventDefinitionId_idx" ON "TrackingSetupTemplateTaskEvent"("eventDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingSetupTemplateTaskEvent_templateTaskId_eventDefiniti_key" ON "TrackingSetupTemplateTaskEvent"("templateTaskId", "eventDefinitionId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTaskPattern_templateTaskId_idx" ON "TrackingSetupTemplateTaskPattern"("templateTaskId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTaskPattern_patternId_idx" ON "TrackingSetupTemplateTaskPattern"("patternId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingSetupTemplateTaskPattern_templateTaskId_patternId_key" ON "TrackingSetupTemplateTaskPattern"("templateTaskId", "patternId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingSetupTemplateApplication_idempotencyKey_key" ON "TrackingSetupTemplateApplication"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateApplication_templateId_idx" ON "TrackingSetupTemplateApplication"("templateId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateApplication_matchDayId_idx" ON "TrackingSetupTemplateApplication"("matchDayId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateApplication_appliedByUserId_idx" ON "TrackingSetupTemplateApplication"("appliedByUserId");

-- CreateIndex
CREATE INDEX "MatchTrackingTask_templateApplicationId_idx" ON "MatchTrackingTask"("templateApplicationId");

-- CreateIndex
CREATE INDEX "MatchTrackingTask_sourceTemplateTaskId_idx" ON "MatchTrackingTask"("sourceTemplateTaskId");

-- AddForeignKey
ALTER TABLE "MatchTrackingTask" ADD CONSTRAINT "MatchTrackingTask_templateApplicationId_fkey" FOREIGN KEY ("templateApplicationId") REFERENCES "TrackingSetupTemplateApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingTask" ADD CONSTRAINT "MatchTrackingTask_sourceTemplateTaskId_fkey" FOREIGN KEY ("sourceTemplateTaskId") REFERENCES "TrackingSetupTemplateTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplate" ADD CONSTRAINT "TrackingSetupTemplate_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplate" ADD CONSTRAINT "TrackingSetupTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplate" ADD CONSTRAINT "TrackingSetupTemplate_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplate" ADD CONSTRAINT "TrackingSetupTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplate" ADD CONSTRAINT "TrackingSetupTemplate_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateTask" ADD CONSTRAINT "TrackingSetupTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TrackingSetupTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateTask" ADD CONSTRAINT "TrackingSetupTemplateTask_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "EventTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateTaskEvent" ADD CONSTRAINT "TrackingSetupTemplateTaskEvent_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "TrackingSetupTemplateTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateTaskEvent" ADD CONSTRAINT "TrackingSetupTemplateTaskEvent_eventDefinitionId_fkey" FOREIGN KEY ("eventDefinitionId") REFERENCES "EventDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateTaskPattern" ADD CONSTRAINT "TrackingSetupTemplateTaskPattern_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "TrackingSetupTemplateTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateTaskPattern" ADD CONSTRAINT "TrackingSetupTemplateTaskPattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "TrackingPatternDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateApplication" ADD CONSTRAINT "TrackingSetupTemplateApplication_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TrackingSetupTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateApplication" ADD CONSTRAINT "TrackingSetupTemplateApplication_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateApplication" ADD CONSTRAINT "TrackingSetupTemplateApplication_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
