CREATE TYPE "EventTopicOwnerScope" AS ENUM ('GLOBAL', 'CLUB');

CREATE TYPE "TrackingTargetContext" AS ENUM ('GOALKEEPER', 'CENTRE_BACK', 'FULL_BACK', 'WING_BACK', 'DEFENSIVE_MIDFIELDER', 'CENTRAL_MIDFIELDER', 'ATTACKING_MIDFIELDER', 'WIDE_PLAYER', 'CENTRE_FORWARD', 'GENERAL_OUTFIELD_PLAYER', 'GOALKEEPER_UNIT', 'DEFENSIVE_UNIT', 'MIDFIELD_UNIT', 'ATTACKING_UNIT', 'LEFT_SIDE_UNIT', 'RIGHT_SIDE_UNIT', 'BUILD_UP_UNIT', 'PRESSING_UNIT', 'CUSTOM_UNIT', 'WHOLE_TEAM');

CREATE TYPE "TrackingTopicPhase" AS ENUM ('IN_POSSESSION', 'OUT_OF_POSSESSION', 'ATTACKING_TRANSITION', 'DEFENSIVE_TRANSITION', 'ATTACKING_SET_PIECES', 'DEFENSIVE_SET_PIECES', 'GOALKEEPING');

CREATE TYPE "TrackingFocusArea" AS ENUM ('RECEIVING', 'PASSING', 'CARRYING', 'LINK_PLAY', 'MOVEMENT', 'CREATING_CHANCES', 'FINISHING', 'PRESSING', 'DEFENDING', 'AERIAL_PLAY', 'BALL_RETENTION', 'SHAPE_AND_COMPACTNESS', 'COVER_AND_BALANCE', 'PLAYING_OUT', 'PROGRESSION', 'PROTECTING_SPACE_BEHIND', 'DEFENDING_WIDE_AREAS', 'DEFENDING_CROSSES', 'COMBINATION_PLAY', 'SUPPORTING_THE_BALL', 'BUILD_UP', 'POSSESSION', 'TERRITORY', 'ATTACKING_TRANSITION', 'DEFENSIVE_TRANSITION', 'SET_PIECES', 'REST_DEFENCE', 'GOALKEEPER_DISTRIBUTION');

ALTER TABLE "MatchTrackingTask" ADD COLUMN "topicId" TEXT;

CREATE TABLE "EventTopic" (
    "id" TEXT NOT NULL,
    "ownerScope" "EventTopicOwnerScope" NOT NULL DEFAULT 'GLOBAL',
    "clubId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "phase" "TrackingTopicPhase" NOT NULL,
    "focusArea" "TrackingFocusArea" NOT NULL,
    "agePhases" "EventDefinitionAgePhase"[],
    "suggestedMaxEvents" INTEGER NOT NULL DEFAULT 6,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventTopicContext" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "scopeType" "MatchTrackingScope" NOT NULL,
    "targetContext" "TrackingTargetContext",
    "recommended" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventTopicContext_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventTopicEvent" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "eventDefinitionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT true,
    "guidance" TEXT,
    "observerLoadWeight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventTopicEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventTopicAlias" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventTopicAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventTopic_ownerScope_clubId_normalizedName_key" ON "EventTopic"("ownerScope", "clubId", "normalizedName");
CREATE UNIQUE INDEX "EventTopic_slug_key" ON "EventTopic"("slug");
CREATE INDEX "EventTopic_ownerScope_idx" ON "EventTopic"("ownerScope");
CREATE INDEX "EventTopic_clubId_idx" ON "EventTopic"("clubId");
CREATE INDEX "EventTopic_phase_idx" ON "EventTopic"("phase");
CREATE INDEX "EventTopic_focusArea_idx" ON "EventTopic"("focusArea");
CREATE INDEX "EventTopic_isActive_idx" ON "EventTopic"("isActive");
CREATE UNIQUE INDEX "EventTopicContext_topicId_scopeType_targetContext_key" ON "EventTopicContext"("topicId", "scopeType", "targetContext");
CREATE INDEX "EventTopicContext_scopeType_targetContext_idx" ON "EventTopicContext"("scopeType", "targetContext");
CREATE INDEX "EventTopicContext_recommended_idx" ON "EventTopicContext"("recommended");
CREATE UNIQUE INDEX "EventTopicEvent_topicId_eventDefinitionId_key" ON "EventTopicEvent"("topicId", "eventDefinitionId");
CREATE INDEX "EventTopicEvent_topicId_idx" ON "EventTopicEvent"("topicId");
CREATE INDEX "EventTopicEvent_eventDefinitionId_idx" ON "EventTopicEvent"("eventDefinitionId");
CREATE INDEX "EventTopicEvent_recommended_idx" ON "EventTopicEvent"("recommended");
CREATE UNIQUE INDEX "EventTopicAlias_topicId_normalizedAlias_key" ON "EventTopicAlias"("topicId", "normalizedAlias");
CREATE INDEX "EventTopicAlias_normalizedAlias_idx" ON "EventTopicAlias"("normalizedAlias");
CREATE INDEX "MatchTrackingTask_topicId_idx" ON "MatchTrackingTask"("topicId");

ALTER TABLE "MatchTrackingTask" ADD CONSTRAINT "MatchTrackingTask_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "EventTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventTopicContext" ADD CONSTRAINT "EventTopicContext_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "EventTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTopicEvent" ADD CONSTRAINT "EventTopicEvent_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "EventTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTopicEvent" ADD CONSTRAINT "EventTopicEvent_eventDefinitionId_fkey" FOREIGN KEY ("eventDefinitionId") REFERENCES "EventDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTopicAlias" ADD CONSTRAINT "EventTopicAlias_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "EventTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
