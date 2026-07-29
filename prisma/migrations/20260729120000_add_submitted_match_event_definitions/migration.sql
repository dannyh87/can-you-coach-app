-- AlterTable
ALTER TABLE "SubmittedMatchEvent" ADD COLUMN "eventDefinitionId" TEXT;

-- Allow definition-backed parent submissions that do not have a legacy enum mapping.
ALTER TABLE "SubmittedMatchEvent" ALTER COLUMN "eventType" DROP NOT NULL;

-- Backfill submitted match event definitions where a legacy enum mapping exists.
UPDATE "SubmittedMatchEvent"
SET "eventDefinitionId" = "EventDefinition"."id"
FROM "EventDefinition"
WHERE "SubmittedMatchEvent"."eventType" = "EventDefinition"."legacyEventType"
  AND "SubmittedMatchEvent"."eventDefinitionId" IS NULL;

-- CreateIndex
CREATE INDEX "SubmittedMatchEvent_eventDefinitionId_idx" ON "SubmittedMatchEvent"("eventDefinitionId");

-- AddForeignKey
ALTER TABLE "SubmittedMatchEvent" ADD CONSTRAINT "SubmittedMatchEvent_eventDefinitionId_fkey" FOREIGN KEY ("eventDefinitionId") REFERENCES "EventDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
