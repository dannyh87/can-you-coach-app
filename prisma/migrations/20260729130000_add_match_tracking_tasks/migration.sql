-- CreateEnum
CREATE TYPE "MatchTrackingScope" AS ENUM ('PLAYER', 'UNIT', 'TEAM');

-- CreateEnum
CREATE TYPE "MatchTrackingTaskStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MatchContributorAssignmentMode" AS ENUM ('SELF', 'DIRECT', 'GROUP_OFFER');

-- CreateEnum
CREATE TYPE "MatchContributorAssignmentStatus" AS ENUM ('PENDING', 'OFFERED', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'SUBMITTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MatchTrackingTask" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "scopeType" "MatchTrackingScope" NOT NULL,
    "playerId" TEXT,
    "unitKey" TEXT,
    "unitLabel" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "sourceTaskId" TEXT,
    "status" "MatchTrackingTaskStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchTrackingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchTrackingTaskEvent" (
    "id" TEXT NOT NULL,
    "trackingTaskId" TEXT NOT NULL,
    "matchDayEventTypeId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchTrackingTaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchContributorAssignment" (
    "id" TEXT NOT NULL,
    "trackingTaskId" TEXT NOT NULL,
    "assignmentMode" "MatchContributorAssignmentMode" NOT NULL,
    "status" "MatchContributorAssignmentStatus" NOT NULL,
    "assignedUserId" TEXT,
    "assignedByUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchContributorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchContributorAssignmentRecipient" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchContributorAssignmentRecipient_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SubmittedMatchEvent" ADD COLUMN "assignmentId" TEXT;

-- CreateIndex
CREATE INDEX "MatchTrackingTask_matchDayId_idx" ON "MatchTrackingTask"("matchDayId");
CREATE INDEX "MatchTrackingTask_createdByUserId_idx" ON "MatchTrackingTask"("createdByUserId");
CREATE INDEX "MatchTrackingTask_playerId_idx" ON "MatchTrackingTask"("playerId");
CREATE INDEX "MatchTrackingTask_sourceTaskId_idx" ON "MatchTrackingTask"("sourceTaskId");
CREATE INDEX "MatchTrackingTask_status_idx" ON "MatchTrackingTask"("status");
CREATE UNIQUE INDEX "MatchTrackingTaskEvent_trackingTaskId_matchDayEventTypeId_key" ON "MatchTrackingTaskEvent"("trackingTaskId", "matchDayEventTypeId");
CREATE INDEX "MatchTrackingTaskEvent_trackingTaskId_idx" ON "MatchTrackingTaskEvent"("trackingTaskId");
CREATE INDEX "MatchTrackingTaskEvent_matchDayEventTypeId_idx" ON "MatchTrackingTaskEvent"("matchDayEventTypeId");
CREATE INDEX "MatchContributorAssignment_trackingTaskId_idx" ON "MatchContributorAssignment"("trackingTaskId");
CREATE INDEX "MatchContributorAssignment_assignedUserId_idx" ON "MatchContributorAssignment"("assignedUserId");
CREATE INDEX "MatchContributorAssignment_assignedByUserId_idx" ON "MatchContributorAssignment"("assignedByUserId");
CREATE INDEX "MatchContributorAssignment_status_idx" ON "MatchContributorAssignment"("status");
CREATE INDEX "MatchContributorAssignment_assignmentMode_idx" ON "MatchContributorAssignment"("assignmentMode");
CREATE UNIQUE INDEX "MatchContributorAssignmentRecipient_assignmentId_userId_key" ON "MatchContributorAssignmentRecipient"("assignmentId", "userId");
CREATE INDEX "MatchContributorAssignmentRecipient_assignmentId_idx" ON "MatchContributorAssignmentRecipient"("assignmentId");
CREATE INDEX "MatchContributorAssignmentRecipient_userId_idx" ON "MatchContributorAssignmentRecipient"("userId");
CREATE INDEX "SubmittedMatchEvent_assignmentId_idx" ON "SubmittedMatchEvent"("assignmentId");

-- AddForeignKey
ALTER TABLE "MatchTrackingTask" ADD CONSTRAINT "MatchTrackingTask_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchTrackingTask" ADD CONSTRAINT "MatchTrackingTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchTrackingTask" ADD CONSTRAINT "MatchTrackingTask_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchTrackingTask" ADD CONSTRAINT "MatchTrackingTask_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "MatchTrackingTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchTrackingTaskEvent" ADD CONSTRAINT "MatchTrackingTaskEvent_trackingTaskId_fkey" FOREIGN KEY ("trackingTaskId") REFERENCES "MatchTrackingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchTrackingTaskEvent" ADD CONSTRAINT "MatchTrackingTaskEvent_matchDayEventTypeId_fkey" FOREIGN KEY ("matchDayEventTypeId") REFERENCES "MatchDayEventType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchContributorAssignment" ADD CONSTRAINT "MatchContributorAssignment_trackingTaskId_fkey" FOREIGN KEY ("trackingTaskId") REFERENCES "MatchTrackingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchContributorAssignment" ADD CONSTRAINT "MatchContributorAssignment_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchContributorAssignment" ADD CONSTRAINT "MatchContributorAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchContributorAssignmentRecipient" ADD CONSTRAINT "MatchContributorAssignmentRecipient_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "MatchContributorAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchContributorAssignmentRecipient" ADD CONSTRAINT "MatchContributorAssignmentRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmittedMatchEvent" ADD CONSTRAINT "SubmittedMatchEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "MatchContributorAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
