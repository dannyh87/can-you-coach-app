-- CreateTable
CREATE TABLE "MatchDayEventType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchDayId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchDayEventType_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchDayEventType_matchDayId_eventType_key" ON "MatchDayEventType"("matchDayId", "eventType");
