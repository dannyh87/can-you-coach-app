-- AlterTable
ALTER TABLE "EventDefinition" ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "subcategory" TEXT;

-- AlterTable
ALTER TABLE "MatchDayEventType" ALTER COLUMN "eventType" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MatchEvent" ALTER COLUMN "eventType" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MatchDayEventType_matchDayId_eventDefinitionId_key" ON "MatchDayEventType"("matchDayId", "eventDefinitionId");

-- CreateIndex
CREATE INDEX "EventDefinition_category_idx" ON "EventDefinition"("category");

-- CreateIndex
CREATE INDEX "EventDefinition_subcategory_idx" ON "EventDefinition"("subcategory");

-- CreateIndex
CREATE INDEX "EventDefinition_requiresLocation_idx" ON "EventDefinition"("requiresLocation");
