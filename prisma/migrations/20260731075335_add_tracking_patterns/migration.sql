-- CreateTable
CREATE TABLE "EventTopicPattern" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT true,
    "guidance" TEXT,
    "observerLoadWeight" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventTopicPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchTrackingTaskPattern" (
    "id" TEXT NOT NULL,
    "trackingTaskId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchTrackingTaskPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingPatternDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "ownerScope" "EventTopicOwnerScope" NOT NULL DEFAULT 'GLOBAL',
    "clubId" TEXT,
    "phase" "TrackingTopicPhase" NOT NULL,
    "focusArea" "TrackingFocusArea" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requiresLocation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingPatternDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingPatternContext" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "scopeType" "MatchTrackingScope" NOT NULL,
    "targetContext" "TrackingTargetContext",
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingPatternContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingPatternStep" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "eventDefinitionId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingPatternStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingPatternOutcome" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "positive" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingPatternOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingPatternAlias" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingPatternAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmittedTrackingPatternObservation" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "trackingTaskId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "playerId" TEXT,
    "patternId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "half" "MatchHalf" NOT NULL,
    "matchSecond" INTEGER NOT NULL,
    "ownScoreAtTime" INTEGER NOT NULL,
    "oppositionScoreAtTime" INTEGER NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "note" TEXT,
    "status" "SubmittedMatchEventStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmittedTrackingPatternObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchTrackingPatternObservation" (
    "id" TEXT NOT NULL,
    "submittedObservationId" TEXT,
    "matchDayId" TEXT NOT NULL,
    "trackingTaskId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "submittedByUserId" TEXT,
    "playerId" TEXT,
    "patternId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "half" "MatchHalf" NOT NULL,
    "matchSecond" INTEGER NOT NULL,
    "ownScoreAtTime" INTEGER NOT NULL,
    "oppositionScoreAtTime" INTEGER NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchTrackingPatternObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventTopicPattern_topicId_idx" ON "EventTopicPattern"("topicId");

-- CreateIndex
CREATE INDEX "EventTopicPattern_patternId_idx" ON "EventTopicPattern"("patternId");

-- CreateIndex
CREATE INDEX "EventTopicPattern_recommended_idx" ON "EventTopicPattern"("recommended");

-- CreateIndex
CREATE UNIQUE INDEX "EventTopicPattern_topicId_patternId_key" ON "EventTopicPattern"("topicId", "patternId");

-- CreateIndex
CREATE INDEX "MatchTrackingTaskPattern_trackingTaskId_idx" ON "MatchTrackingTaskPattern"("trackingTaskId");

-- CreateIndex
CREATE INDEX "MatchTrackingTaskPattern_patternId_idx" ON "MatchTrackingTaskPattern"("patternId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchTrackingTaskPattern_trackingTaskId_patternId_key" ON "MatchTrackingTaskPattern"("trackingTaskId", "patternId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingPatternDefinition_slug_key" ON "TrackingPatternDefinition"("slug");

-- CreateIndex
CREATE INDEX "TrackingPatternDefinition_ownerScope_idx" ON "TrackingPatternDefinition"("ownerScope");

-- CreateIndex
CREATE INDEX "TrackingPatternDefinition_clubId_idx" ON "TrackingPatternDefinition"("clubId");

-- CreateIndex
CREATE INDEX "TrackingPatternDefinition_phase_idx" ON "TrackingPatternDefinition"("phase");

-- CreateIndex
CREATE INDEX "TrackingPatternDefinition_focusArea_idx" ON "TrackingPatternDefinition"("focusArea");

-- CreateIndex
CREATE INDEX "TrackingPatternDefinition_active_idx" ON "TrackingPatternDefinition"("active");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingPatternDefinition_ownerScope_clubId_normalizedName_key" ON "TrackingPatternDefinition"("ownerScope", "clubId", "normalizedName");

-- CreateIndex
CREATE INDEX "TrackingPatternContext_scopeType_targetContext_idx" ON "TrackingPatternContext"("scopeType", "targetContext");

-- CreateIndex
CREATE INDEX "TrackingPatternContext_recommended_idx" ON "TrackingPatternContext"("recommended");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingPatternContext_patternId_scopeType_targetContext_key" ON "TrackingPatternContext"("patternId", "scopeType", "targetContext");

-- CreateIndex
CREATE INDEX "TrackingPatternStep_patternId_idx" ON "TrackingPatternStep"("patternId");

-- CreateIndex
CREATE INDEX "TrackingPatternStep_eventDefinitionId_idx" ON "TrackingPatternStep"("eventDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingPatternStep_patternId_stepOrder_key" ON "TrackingPatternStep"("patternId", "stepOrder");

-- CreateIndex
CREATE INDEX "TrackingPatternOutcome_patternId_idx" ON "TrackingPatternOutcome"("patternId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingPatternOutcome_patternId_code_key" ON "TrackingPatternOutcome"("patternId", "code");

-- CreateIndex
CREATE INDEX "TrackingPatternAlias_normalizedAlias_idx" ON "TrackingPatternAlias"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingPatternAlias_patternId_normalizedAlias_key" ON "TrackingPatternAlias"("patternId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "SubmittedTrackingPatternObservation_matchDayId_idx" ON "SubmittedTrackingPatternObservation"("matchDayId");

-- CreateIndex
CREATE INDEX "SubmittedTrackingPatternObservation_trackingTaskId_idx" ON "SubmittedTrackingPatternObservation"("trackingTaskId");

-- CreateIndex
CREATE INDEX "SubmittedTrackingPatternObservation_assignmentId_idx" ON "SubmittedTrackingPatternObservation"("assignmentId");

-- CreateIndex
CREATE INDEX "SubmittedTrackingPatternObservation_submittedByUserId_idx" ON "SubmittedTrackingPatternObservation"("submittedByUserId");

-- CreateIndex
CREATE INDEX "SubmittedTrackingPatternObservation_playerId_idx" ON "SubmittedTrackingPatternObservation"("playerId");

-- CreateIndex
CREATE INDEX "SubmittedTrackingPatternObservation_patternId_idx" ON "SubmittedTrackingPatternObservation"("patternId");

-- CreateIndex
CREATE INDEX "SubmittedTrackingPatternObservation_outcomeId_idx" ON "SubmittedTrackingPatternObservation"("outcomeId");

-- CreateIndex
CREATE INDEX "SubmittedTrackingPatternObservation_status_idx" ON "SubmittedTrackingPatternObservation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MatchTrackingPatternObservation_submittedObservationId_key" ON "MatchTrackingPatternObservation"("submittedObservationId");

-- CreateIndex
CREATE INDEX "MatchTrackingPatternObservation_matchDayId_idx" ON "MatchTrackingPatternObservation"("matchDayId");

-- CreateIndex
CREATE INDEX "MatchTrackingPatternObservation_trackingTaskId_idx" ON "MatchTrackingPatternObservation"("trackingTaskId");

-- CreateIndex
CREATE INDEX "MatchTrackingPatternObservation_assignmentId_idx" ON "MatchTrackingPatternObservation"("assignmentId");

-- CreateIndex
CREATE INDEX "MatchTrackingPatternObservation_submittedByUserId_idx" ON "MatchTrackingPatternObservation"("submittedByUserId");

-- CreateIndex
CREATE INDEX "MatchTrackingPatternObservation_playerId_idx" ON "MatchTrackingPatternObservation"("playerId");

-- CreateIndex
CREATE INDEX "MatchTrackingPatternObservation_patternId_idx" ON "MatchTrackingPatternObservation"("patternId");

-- CreateIndex
CREATE INDEX "MatchTrackingPatternObservation_outcomeId_idx" ON "MatchTrackingPatternObservation"("outcomeId");

-- AddForeignKey
ALTER TABLE "EventTopicPattern" ADD CONSTRAINT "EventTopicPattern_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "EventTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTopicPattern" ADD CONSTRAINT "EventTopicPattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "TrackingPatternDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingTaskPattern" ADD CONSTRAINT "MatchTrackingTaskPattern_trackingTaskId_fkey" FOREIGN KEY ("trackingTaskId") REFERENCES "MatchTrackingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingTaskPattern" ADD CONSTRAINT "MatchTrackingTaskPattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "TrackingPatternDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingPatternContext" ADD CONSTRAINT "TrackingPatternContext_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "TrackingPatternDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingPatternStep" ADD CONSTRAINT "TrackingPatternStep_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "TrackingPatternDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingPatternStep" ADD CONSTRAINT "TrackingPatternStep_eventDefinitionId_fkey" FOREIGN KEY ("eventDefinitionId") REFERENCES "EventDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingPatternOutcome" ADD CONSTRAINT "TrackingPatternOutcome_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "TrackingPatternDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingPatternAlias" ADD CONSTRAINT "TrackingPatternAlias_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "TrackingPatternDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTrackingPatternObservation" ADD CONSTRAINT "SubmittedTrackingPatternObservation_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTrackingPatternObservation" ADD CONSTRAINT "SubmittedTrackingPatternObservation_trackingTaskId_fkey" FOREIGN KEY ("trackingTaskId") REFERENCES "MatchTrackingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTrackingPatternObservation" ADD CONSTRAINT "SubmittedTrackingPatternObservation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "MatchContributorAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTrackingPatternObservation" ADD CONSTRAINT "SubmittedTrackingPatternObservation_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTrackingPatternObservation" ADD CONSTRAINT "SubmittedTrackingPatternObservation_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTrackingPatternObservation" ADD CONSTRAINT "SubmittedTrackingPatternObservation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTrackingPatternObservation" ADD CONSTRAINT "SubmittedTrackingPatternObservation_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "TrackingPatternDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTrackingPatternObservation" ADD CONSTRAINT "SubmittedTrackingPatternObservation_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "TrackingPatternOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingPatternObservation" ADD CONSTRAINT "MatchTrackingPatternObservation_submittedObservationId_fkey" FOREIGN KEY ("submittedObservationId") REFERENCES "SubmittedTrackingPatternObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingPatternObservation" ADD CONSTRAINT "MatchTrackingPatternObservation_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingPatternObservation" ADD CONSTRAINT "MatchTrackingPatternObservation_trackingTaskId_fkey" FOREIGN KEY ("trackingTaskId") REFERENCES "MatchTrackingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingPatternObservation" ADD CONSTRAINT "MatchTrackingPatternObservation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "MatchContributorAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingPatternObservation" ADD CONSTRAINT "MatchTrackingPatternObservation_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingPatternObservation" ADD CONSTRAINT "MatchTrackingPatternObservation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingPatternObservation" ADD CONSTRAINT "MatchTrackingPatternObservation_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "TrackingPatternDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTrackingPatternObservation" ADD CONSTRAINT "MatchTrackingPatternObservation_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "TrackingPatternOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
