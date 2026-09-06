-- Add team/club visibility and quick-custom metadata foundations.
CREATE TYPE "ClubTrackingDefinitionVisibilityScope" AS ENUM ('TEAM', 'CLUB');
CREATE TYPE "ClubTrackingObservationPolarity" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

ALTER TABLE "ClubTrackingDefinition"
ADD COLUMN "teamId" TEXT,
ADD COLUMN "visibilityScope" "ClubTrackingDefinitionVisibilityScope" NOT NULL DEFAULT 'CLUB',
ADD COLUMN "countingDefinition" TEXT,
ADD COLUMN "eventCategory" "EventDefinitionCategory",
ADD COLUMN "polarity" "ClubTrackingObservationPolarity" NOT NULL DEFAULT 'NEUTRAL';

-- Existing rows are intentionally preserved as club-wide definitions.
UPDATE "ClubTrackingDefinition"
SET "visibilityScope" = 'CLUB', "teamId" = NULL
WHERE "visibilityScope" <> 'CLUB' OR "teamId" IS NOT NULL;

ALTER TABLE "MatchDayEventType"
ADD COLUMN "clubTrackingDefinitionId" TEXT;

-- Support a composite FK that proves team-private definitions belong to the same club.
ALTER TABLE "Team"
ADD CONSTRAINT "Team_id_clubId_key" UNIQUE ("id", "clubId");

ALTER TABLE "ClubTrackingDefinition"
ADD CONSTRAINT "ClubTrackingDefinition_teamId_clubId_fkey"
FOREIGN KEY ("teamId", "clubId") REFERENCES "Team"("id", "clubId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClubTrackingDefinition"
ADD CONSTRAINT "ClubTrackingDefinition_visibility_team_check"
CHECK (
  ("visibilityScope" = 'TEAM' AND "teamId" IS NOT NULL)
  OR
  ("visibilityScope" = 'CLUB' AND "teamId" IS NULL)
);

ALTER TABLE "MatchDayEventType"
ADD CONSTRAINT "MatchDayEventType_clubTrackingDefinitionId_fkey"
FOREIGN KEY ("clubTrackingDefinitionId") REFERENCES "ClubTrackingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The previous uniqueness was club-wide and would block equal team-private names across teams.
DROP INDEX "ClubTrackingDefinition_clubId_kind_normalizedName_key";

CREATE UNIQUE INDEX "ClubTrackingDefinition_club_unique_name"
ON "ClubTrackingDefinition" ("clubId", "kind", "normalizedName")
WHERE "visibilityScope" = 'CLUB';

CREATE UNIQUE INDEX "ClubTrackingDefinition_team_unique_name"
ON "ClubTrackingDefinition" ("teamId", "kind", "normalizedName")
WHERE "visibilityScope" = 'TEAM';

CREATE UNIQUE INDEX "MatchDayEventType_matchDayId_clubTrackingDefinitionId_key"
ON "MatchDayEventType" ("matchDayId", "clubTrackingDefinitionId");

CREATE INDEX "ClubTrackingDefinition_teamId_idx" ON "ClubTrackingDefinition"("teamId");
CREATE INDEX "ClubTrackingDefinition_clubId_visibilityScope_idx" ON "ClubTrackingDefinition"("clubId", "visibilityScope");
CREATE INDEX "ClubTrackingDefinition_clubId_teamId_idx" ON "ClubTrackingDefinition"("clubId", "teamId");
CREATE INDEX "MatchDayEventType_clubTrackingDefinitionId_idx" ON "MatchDayEventType"("clubTrackingDefinitionId");

-- The stricter MatchDayEventType identity check is intentionally deferred until the
-- end-to-end custom slice, because existing production-compatible rows may be
-- legacy-only while standard rows may also retain eventType as compatibility data.
