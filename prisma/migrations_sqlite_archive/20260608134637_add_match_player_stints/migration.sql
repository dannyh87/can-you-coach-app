-- CreateTable
CREATE TABLE "MatchPlayerStint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchDayId" TEXT NOT NULL,
    "matchDayPlayerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "half" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "startMatchSecond" INTEGER,
    "endMatchSecond" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchPlayerStint_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchPlayerStint_matchDayPlayerId_fkey" FOREIGN KEY ("matchDayPlayerId") REFERENCES "MatchDayPlayer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchPlayerStint_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
