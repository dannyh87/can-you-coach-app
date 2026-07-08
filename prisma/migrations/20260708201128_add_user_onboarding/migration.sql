-- CreateEnum
CREATE TYPE "OnboardingRole" AS ENUM ('CLUB_OFFICIAL', 'COACH', 'PARENT_SPECTATOR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingRole" "OnboardingRole";
