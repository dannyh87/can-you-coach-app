-- CreateTable
CREATE TABLE "MatchDayPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "squadStatus" TEXT NOT NULL DEFAULT 'NOT_INVOLVED',
    "startingPosition" TEXT,
    "shirtNumberSnapshot" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchDayPlayer_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchDayPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchDayPlayer_matchDayId_playerId_key" ON "MatchDayPlayer"("matchDayId", "playerId");
