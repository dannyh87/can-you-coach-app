-- AlterTable
ALTER TABLE "ClubTrackingDefinition" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedByUserId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_rejectedByUserId_idx" ON "ClubTrackingDefinition"("rejectedByUserId");

-- AddForeignKey
ALTER TABLE "ClubTrackingDefinition" ADD CONSTRAINT "ClubTrackingDefinition_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
