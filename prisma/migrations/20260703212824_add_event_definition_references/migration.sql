-- AlterTable
ALTER TABLE "EventDefinition" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "requiresLocation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MatchDayEventType" ADD COLUMN     "eventDefinitionId" TEXT;

-- AlterTable
ALTER TABLE "MatchEvent" ADD COLUMN     "eventDefinitionId" TEXT;

-- Backfill EventDefinition metadata for existing enum-backed events.
UPDATE "EventDefinition"
SET "requiresLocation" = true
WHERE "legacyEventType" = 'TOUCH';

-- Backfill selected match event definitions where a legacy enum mapping exists.
UPDATE "MatchDayEventType"
SET "eventDefinitionId" = "EventDefinition"."id"
FROM "EventDefinition"
WHERE "MatchDayEventType"."eventType" = "EventDefinition"."legacyEventType";

-- Backfill recorded match event definitions where a legacy enum mapping exists.
UPDATE "MatchEvent"
SET "eventDefinitionId" = "EventDefinition"."id"
FROM "EventDefinition"
WHERE "MatchEvent"."eventType" = "EventDefinition"."legacyEventType";

-- CreateIndex
CREATE INDEX "EventDefinition_scope_idx" ON "EventDefinition"("scope");

-- CreateIndex
CREATE INDEX "EventDefinition_clubId_idx" ON "EventDefinition"("clubId");

-- CreateIndex
CREATE INDEX "EventDefinition_isActive_idx" ON "EventDefinition"("isActive");

-- CreateIndex
CREATE INDEX "EventDefinition_createdByUserId_idx" ON "EventDefinition"("createdByUserId");

-- CreateIndex
CREATE INDEX "MatchDayEventType_eventDefinitionId_idx" ON "MatchDayEventType"("eventDefinitionId");

-- CreateIndex
CREATE INDEX "MatchEvent_eventDefinitionId_idx" ON "MatchEvent"("eventDefinitionId");

-- AddForeignKey
ALTER TABLE "MatchDayEventType" ADD CONSTRAINT "MatchDayEventType_eventDefinitionId_fkey" FOREIGN KEY ("eventDefinitionId") REFERENCES "EventDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_eventDefinitionId_fkey" FOREIGN KEY ("eventDefinitionId") REFERENCES "EventDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
