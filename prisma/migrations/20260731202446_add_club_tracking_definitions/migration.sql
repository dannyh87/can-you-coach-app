-- CreateEnum
CREATE TYPE "ClubTrackingDefinitionKind" AS ENUM ('EVENT_ALIAS', 'EVENT_MAPPED', 'EVENT_CUSTOM', 'PATTERN_ALIAS', 'PATTERN_MAPPED');

-- CreateEnum
CREATE TYPE "ClubTrackingDefinitionStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ClubTrackingMappingStatus" AS ENUM ('NONE', 'PROPOSED', 'CLUB_APPROVED', 'STANDARD_APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "MatchEvent" ADD COLUMN     "clubMappingRevisionAtRecording" INTEGER,
ADD COLUMN     "clubMappingStatusAtRecording" "ClubTrackingMappingStatus",
ADD COLUMN     "clubTrackingDefinitionId" TEXT,
ADD COLUMN     "standardEventDefinitionIdAtRecording" TEXT;

-- AlterTable
ALTER TABLE "MatchTrackingPatternObservation" ADD COLUMN     "clubMappingRevisionAtRecording" INTEGER,
ADD COLUMN     "clubMappingStatusAtRecording" "ClubTrackingMappingStatus",
ADD COLUMN     "clubTrackingDefinitionId" TEXT,
ADD COLUMN     "standardPatternDefinitionIdAtRecording" TEXT;

-- AlterTable
ALTER TABLE "SubmittedMatchEvent" ADD COLUMN     "clubMappingRevisionAtRecording" INTEGER,
ADD COLUMN     "clubMappingStatusAtRecording" "ClubTrackingMappingStatus",
ADD COLUMN     "clubTrackingDefinitionId" TEXT,
ADD COLUMN     "standardEventDefinitionIdAtRecording" TEXT;

-- AlterTable
ALTER TABLE "SubmittedTrackingPatternObservation" ADD COLUMN     "clubMappingRevisionAtRecording" INTEGER,
ADD COLUMN     "clubMappingStatusAtRecording" "ClubTrackingMappingStatus",
ADD COLUMN     "clubTrackingDefinitionId" TEXT,
ADD COLUMN     "standardPatternDefinitionIdAtRecording" TEXT;

-- CreateTable
CREATE TABLE "ClubTrackingDefinition" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "kind" "ClubTrackingDefinitionKind" NOT NULL,
    "status" "ClubTrackingDefinitionStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "guidance" TEXT,
    "scopeType" "MatchTrackingScope",
    "targetContext" "TrackingTargetContext",
    "phase" "TrackingTopicPhase",
    "focusArea" "TrackingFocusArea",
    "agePhases" "EventDefinitionAgePhase"[],
    "requiresLocation" BOOLEAN NOT NULL DEFAULT false,
    "mappedEventDefinitionId" TEXT,
    "mappedPatternDefinitionId" TEXT,
    "mappingStatus" "ClubTrackingMappingStatus" NOT NULL DEFAULT 'NONE',
    "mappingRevision" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "retiredAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubTrackingDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_clubId_idx" ON "ClubTrackingDefinition"("clubId");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_kind_idx" ON "ClubTrackingDefinition"("kind");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_status_idx" ON "ClubTrackingDefinition"("status");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_active_idx" ON "ClubTrackingDefinition"("active");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_mappingStatus_idx" ON "ClubTrackingDefinition"("mappingStatus");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_mappedEventDefinitionId_idx" ON "ClubTrackingDefinition"("mappedEventDefinitionId");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_mappedPatternDefinitionId_idx" ON "ClubTrackingDefinition"("mappedPatternDefinitionId");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_createdByUserId_idx" ON "ClubTrackingDefinition"("createdByUserId");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_approvedByUserId_idx" ON "ClubTrackingDefinition"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubTrackingDefinition_clubId_kind_normalizedName_key" ON "ClubTrackingDefinition"("clubId", "kind", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "ClubTrackingDefinition_clubId_slug_key" ON "ClubTrackingDefinition"("clubId", "slug");

-- CreateIndex
CREATE INDEX "MatchEvent_clubTrackingDefinitionId_idx" ON "MatchEvent"("clubTrackingDefinitionId");

-- CreateIndex
CREATE INDEX "MatchEvent_standardEventDefinitionIdAtRecording_idx" ON "MatchEvent"("standardEventDefinitionIdAtRecording");

-- CreateIndex
CREATE INDEX "MatchTrackingPatternObservation_clubTrackingDefinitionId_idx" ON "MatchTrackingPatternObservation"("clubTrackingDefinitionId");

-- CreateIndex
CREATE INDEX "MatchTrackingPatternObservation_standardPatternDefinitionId_idx" ON "MatchTrackingPatternObservation"("standardPatternDefinitionIdAtRecording");

-- CreateIndex
CREATE INDEX "SubmittedMatchEvent_clubTrackingDefinitionId_idx" ON "SubmittedMatchEvent"("clubTrackingDefinitionId");

-- CreateIndex
CREATE INDEX "SubmittedMatchEvent_standardEventDefinitionIdAtRecording_idx" ON "SubmittedMatchEvent"("standardEventDefinitionIdAtRecording");

-- CreateIndex
CREATE INDEX "SubmittedTrackingPatternObservation_clubTrackingDefinitionI_idx" ON "SubmittedTrackingPatternObservation"("clubTrackingDefinitionId");

-- CreateIndex
CREATE INDEX "SubmittedTrackingPatternObservation_standardPatternDefiniti_idx" ON "SubmittedTrackingPatternObservation"("standardPatternDefinitionIdAtRecording");

-- AddForeignKey
ALTER TABLE "ClubTrackingDefinition" ADD CONSTRAINT "ClubTrackingDefinition_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTrackingDefinition" ADD CONSTRAINT "ClubTrackingDefinition_mappedEventDefinitionId_fkey" FOREIGN KEY ("mappedEventDefinitionId") REFERENCES "EventDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTrackingDefinition" ADD CONSTRAINT "ClubTrackingDefinition_mappedPatternDefinitionId_fkey" FOREIGN KEY ("mappedPatternDefinitionId") REFERENCES "TrackingPatternDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTrackingDefinition" ADD CONSTRAINT "ClubTrackingDefinition_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTrackingDefinition" ADD CONSTRAINT "ClubTrackingDefinition_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTrackingDefinition" ADD CONSTRAINT "ClubTrackingDefinition_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_clubTrackingDefinitionId_fkey" FOREIGN KEY ("clubTrackingDefinitionId") REFERENCES "ClubTrackingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_standardEventDefinitionIdAtRecording_fkey" FOREIGN KEY ("standardEventDefinitionIdAtRecording") REFERENCES "EventDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedMatchEvent" ADD CONSTRAINT "SubmittedMatchEvent_clubTrackingDefinitionId_fkey" FOREIGN KEY ("clubTrackingDefinitionId") REFERENCES "ClubTrackingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedMatchEvent" ADD CONSTRAINT "SubmittedMatchEvent_standardEventDefinitionIdAtRecording_fkey" FOREIGN KEY ("standardEventDefinitionIdAtRecording") REFERENCES "EventDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTrackingPatternObservation" ADD CONSTRAINT "SubmittedTrackingPatternObservation_clubTrackingDefinition_fkey" FOREIGN KEY ("clubTrackingDefinitionId") REFERENCES "ClubTrackingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTrackingPatternObservation" ADD CONSTRAINT "SubmittedTrackingPatternObservation_standardPatternDefinit_fkey" FOREIGN KEY ("standardPatternDefinitionIdAtRecording") REFERENCES "TrackingPatternDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingPatternObservation" ADD CONSTRAINT "MatchTrackingPatternObservation_clubTrackingDefinitionId_fkey" FOREIGN KEY ("clubTrackingDefinitionId") REFERENCES "ClubTrackingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingPatternObservation" ADD CONSTRAINT "MatchTrackingPatternObservation_standardPatternDefinitionI_fkey" FOREIGN KEY ("standardPatternDefinitionIdAtRecording") REFERENCES "TrackingPatternDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
