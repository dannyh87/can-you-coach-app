-- CreateEnum
CREATE TYPE "EventDefinitionMatchDayGroup" AS ENUM ('GOALS_OUTCOMES', 'SHOOTING', 'PASSING', 'POSSESSION', 'DEFENDING', 'DISCIPLINE', 'GOALKEEPING', 'CUSTOM_OTHER');

-- AlterTable
ALTER TABLE "EventDefinition" ADD COLUMN     "matchDayGroup" "EventDefinitionMatchDayGroup";

-- CreateIndex
CREATE INDEX "EventDefinition_matchDayGroup_idx" ON "EventDefinition"("matchDayGroup");
