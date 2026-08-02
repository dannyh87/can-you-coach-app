-- CreateTable
CREATE TABLE "MatchTrackingTaskClubDefinition" (
    "id" TEXT NOT NULL,
    "trackingTaskId" TEXT NOT NULL,
    "clubTrackingDefinitionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "selectedKind" "ClubTrackingDefinitionKind" NOT NULL,
    "mappingRevisionAtSelection" INTEGER,
    "mappingStatusAtSelection" "ClubTrackingMappingStatus",
    "standardEventDefinitionIdAtSelection" TEXT,
    "standardPatternDefinitionIdAtSelection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchTrackingTaskClubDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingSetupTemplateTaskClubDefinition" (
    "id" TEXT NOT NULL,
    "templateTaskId" TEXT NOT NULL,
    "clubTrackingDefinitionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "selectedKind" "ClubTrackingDefinitionKind" NOT NULL,
    "mappingRevisionAtSelection" INTEGER,
    "mappingStatusAtSelection" "ClubTrackingMappingStatus",
    "standardEventDefinitionIdAtSelection" TEXT,
    "standardPatternDefinitionIdAtSelection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingSetupTemplateTaskClubDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubTrackingDefinitionTopic" (
    "id" TEXT NOT NULL,
    "clubTrackingDefinitionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "observerLoadWeight" INTEGER NOT NULL DEFAULT 1,
    "guidance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubTrackingDefinitionTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchTrackingTaskClubDefinition_trackingTaskId_idx" ON "MatchTrackingTaskClubDefinition"("trackingTaskId");

-- CreateIndex
CREATE INDEX "MatchTrackingTaskClubDefinition_clubTrackingDefinitionId_idx" ON "MatchTrackingTaskClubDefinition"("clubTrackingDefinitionId");

-- CreateIndex
CREATE INDEX "MatchTrackingTaskClubDefinition_standardEventDefinitionIdAt_idx" ON "MatchTrackingTaskClubDefinition"("standardEventDefinitionIdAtSelection");

-- CreateIndex
CREATE INDEX "MatchTrackingTaskClubDefinition_standardPatternDefinitionId_idx" ON "MatchTrackingTaskClubDefinition"("standardPatternDefinitionIdAtSelection");

-- CreateIndex
CREATE INDEX "MatchTrackingTaskClubDefinition_mappingStatusAtSelection_idx" ON "MatchTrackingTaskClubDefinition"("mappingStatusAtSelection");

-- CreateIndex
CREATE UNIQUE INDEX "MatchTrackingTaskClubDefinition_trackingTaskId_clubTracking_key" ON "MatchTrackingTaskClubDefinition"("trackingTaskId", "clubTrackingDefinitionId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTaskClubDefinition_templateTaskId_idx" ON "TrackingSetupTemplateTaskClubDefinition"("templateTaskId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTaskClubDefinition_clubTrackingDefinit_idx" ON "TrackingSetupTemplateTaskClubDefinition"("clubTrackingDefinitionId");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTaskClubDefinition_standardEventDefini_idx" ON "TrackingSetupTemplateTaskClubDefinition"("standardEventDefinitionIdAtSelection");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTaskClubDefinition_standardPatternDefi_idx" ON "TrackingSetupTemplateTaskClubDefinition"("standardPatternDefinitionIdAtSelection");

-- CreateIndex
CREATE INDEX "TrackingSetupTemplateTaskClubDefinition_mappingStatusAtSele_idx" ON "TrackingSetupTemplateTaskClubDefinition"("mappingStatusAtSelection");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingSetupTemplateTaskClubDefinition_templateTaskId_club_key" ON "TrackingSetupTemplateTaskClubDefinition"("templateTaskId", "clubTrackingDefinitionId");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinitionTopic_topicId_idx" ON "ClubTrackingDefinitionTopic"("topicId");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinitionTopic_recommended_idx" ON "ClubTrackingDefinitionTopic"("recommended");

-- CreateIndex
CREATE UNIQUE INDEX "ClubTrackingDefinitionTopic_clubTrackingDefinitionId_topicI_key" ON "ClubTrackingDefinitionTopic"("clubTrackingDefinitionId", "topicId");

-- AddForeignKey
ALTER TABLE "MatchTrackingTaskClubDefinition" ADD CONSTRAINT "MatchTrackingTaskClubDefinition_trackingTaskId_fkey" FOREIGN KEY ("trackingTaskId") REFERENCES "MatchTrackingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingTaskClubDefinition" ADD CONSTRAINT "MatchTrackingTaskClubDefinition_clubTrackingDefinitionId_fkey" FOREIGN KEY ("clubTrackingDefinitionId") REFERENCES "ClubTrackingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingTaskClubDefinition" ADD CONSTRAINT "MatchTrackingTaskClubDefinition_standardEventDefinitionIdA_fkey" FOREIGN KEY ("standardEventDefinitionIdAtSelection") REFERENCES "EventDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingTaskClubDefinition" ADD CONSTRAINT "MatchTrackingTaskClubDefinition_standardPatternDefinitionI_fkey" FOREIGN KEY ("standardPatternDefinitionIdAtSelection") REFERENCES "TrackingPatternDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateTaskClubDefinition" ADD CONSTRAINT "TrackingSetupTemplateTaskClubDefinition_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "TrackingSetupTemplateTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateTaskClubDefinition" ADD CONSTRAINT "TrackingSetupTemplateTaskClubDefinition_clubTrackingDefini_fkey" FOREIGN KEY ("clubTrackingDefinitionId") REFERENCES "ClubTrackingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateTaskClubDefinition" ADD CONSTRAINT "TrackingSetupTemplateTaskClubDefinition_standardEventDefin_fkey" FOREIGN KEY ("standardEventDefinitionIdAtSelection") REFERENCES "EventDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSetupTemplateTaskClubDefinition" ADD CONSTRAINT "TrackingSetupTemplateTaskClubDefinition_standardPatternDef_fkey" FOREIGN KEY ("standardPatternDefinitionIdAtSelection") REFERENCES "TrackingPatternDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTrackingDefinitionTopic" ADD CONSTRAINT "ClubTrackingDefinitionTopic_clubTrackingDefinitionId_fkey" FOREIGN KEY ("clubTrackingDefinitionId") REFERENCES "ClubTrackingDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTrackingDefinitionTopic" ADD CONSTRAINT "ClubTrackingDefinitionTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "EventTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
