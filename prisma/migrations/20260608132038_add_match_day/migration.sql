-- CreateTable
CREATE TABLE "MatchDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "kickoffAt" DATETIME NOT NULL,
    "opposition" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "ownScore" INTEGER NOT NULL DEFAULT 0,
    "oppositionScore" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchDay_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
