ALTER TABLE "MatchDay" ADD COLUMN "trackPlayerMinutes" BOOLEAN NOT NULL DEFAULT false;

UPDATE "MatchDay" SET "trackPlayerMinutes" = true;
