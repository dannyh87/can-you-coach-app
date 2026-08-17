CREATE TYPE "MatchDayEventTrackingScope" AS ENUM ('TEAM', 'PLAYER');

ALTER TABLE "MatchDay" ADD COLUMN "eventTrackingScope" "MatchDayEventTrackingScope" NOT NULL DEFAULT 'TEAM';

UPDATE "MatchDay" SET "eventTrackingScope" = 'PLAYER';
