-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TRACKING_DIRECT_ASSIGNED', 'TRACKING_GROUP_OFFERED', 'TRACKING_ASSIGNMENT_ACCEPTED', 'TRACKING_ASSIGNMENT_DECLINED', 'TRACKING_OFFER_CLAIMED', 'TRACKING_ASSIGNMENT_CANCELLED', 'TRACKING_ASSIGNMENT_CHANGED', 'TRACKING_MATCH_STARTING', 'TRACKING_SUBMISSION_RECEIVED', 'TRACKING_SUBMISSION_REVIEWED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "matchDayId" TEXT,
    "assignmentId" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_assignmentId_idx" ON "Notification"("assignmentId");

-- CreateIndex
CREATE INDEX "Notification_matchDayId_idx" ON "Notification"("matchDayId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_source_idx" ON "Notification"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "MatchContributorAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
