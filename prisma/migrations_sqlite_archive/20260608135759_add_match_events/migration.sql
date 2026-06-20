-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchDayId" TEXT NOT NULL,
    "playerId" TEXT,
    "eventType" TEXT NOT NULL,
    "half" TEXT NOT NULL,
    "matchSecond" INTEGER NOT NULL,
    "ownScoreAtTime" INTEGER NOT NULL,
    "oppositionScoreAtTime" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchEvent_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
