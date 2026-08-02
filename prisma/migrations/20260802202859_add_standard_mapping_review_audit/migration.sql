-- CreateEnum
CREATE TYPE "ClubTrackingStandardMappingRejectionCategory" AS ENUM ('NOT_EQUIVALENT', 'EVENT_PATTERN_MISMATCH', 'SCOPE_CONTEXT_MISMATCH', 'OUTCOME_MISMATCH', 'BENCHMARK_INCOMPATIBLE', 'BETTER_STANDARD_EXISTS', 'NEEDS_CLARIFICATION', 'DUPLICATE_MAPPING', 'OTHER');

-- AlterTable
ALTER TABLE "ClubTrackingDefinition" ADD COLUMN     "standardMappingRejectionCategory" "ClubTrackingStandardMappingRejectionCategory",
ADD COLUMN     "standardMappingRejectionReason" TEXT,
ADD COLUMN     "standardMappingReviewedAt" TIMESTAMP(3),
ADD COLUMN     "standardMappingReviewedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_standardMappingReviewedByUserId_idx" ON "ClubTrackingDefinition"("standardMappingReviewedByUserId");

-- CreateIndex
CREATE INDEX "ClubTrackingDefinition_mappingStatus_kind_idx" ON "ClubTrackingDefinition"("mappingStatus", "kind");

-- AddForeignKey
ALTER TABLE "ClubTrackingDefinition" ADD CONSTRAINT "ClubTrackingDefinition_standardMappingReviewedByUserId_fkey" FOREIGN KEY ("standardMappingReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
