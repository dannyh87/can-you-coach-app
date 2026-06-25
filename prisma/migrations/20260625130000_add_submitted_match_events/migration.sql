-- CreateEnum
CREATE TYPE "SubmittedMatchEventStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IGNORED');

-- CreateTable
CREATE TABLE "SubmittedMatchEvent" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "eventType" "MatchEventType" NOT NULL,
    "half" "MatchHalf" NOT NULL,
    "matchSecond" INTEGER NOT NULL,
    "ownScoreAtTime" INTEGER NOT NULL,
    "oppositionScoreAtTime" INTEGER NOT NULL,
    "note" TEXT,
    "status" "SubmittedMatchEventStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmittedMatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmittedMatchEvent_matchDayId_playerId_idx" ON "SubmittedMatchEvent"("matchDayId", "playerId");

-- CreateIndex
CREATE INDEX "SubmittedMatchEvent_submittedByUserId_idx" ON "SubmittedMatchEvent"("submittedByUserId");

-- CreateIndex
CREATE INDEX "SubmittedMatchEvent_status_idx" ON "SubmittedMatchEvent"("status");

-- AddForeignKey
ALTER TABLE "SubmittedMatchEvent" ADD CONSTRAINT "SubmittedMatchEvent_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedMatchEvent" ADD CONSTRAINT "SubmittedMatchEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedMatchEvent" ADD CONSTRAINT "SubmittedMatchEvent_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedMatchEvent" ADD CONSTRAINT "SubmittedMatchEvent_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
