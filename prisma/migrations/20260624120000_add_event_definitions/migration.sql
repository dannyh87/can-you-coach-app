-- CreateEnum
CREATE TYPE "EventDefinitionScope" AS ENUM ('GLOBAL', 'CLUB');

-- CreateEnum
CREATE TYPE "EventDefinitionMatchPhase" AS ENUM ('IN_POSSESSION', 'OUT_OF_POSSESSION', 'TRANSITION', 'SET_PIECES', 'DISCIPLINE_MATCH_ADMIN');

-- CreateEnum
CREATE TYPE "EventDefinitionCategory" AS ENUM ('PASSING', 'RECEIVING', 'DRIBBLING_1V1', 'SHOOTING', 'DEFENDING', 'GOALKEEPING', 'DISCIPLINE', 'INJURIES', 'OTHER');

-- CreateEnum
CREATE TYPE "EventDefinitionAgePhase" AS ENUM ('FOUNDATION', 'YOUTH', 'ADULT');

-- CreateEnum
CREATE TYPE "EventDefinitionFourCorner" AS ENUM ('TECHNICAL', 'TACTICAL', 'PHYSICAL', 'PSYCHOLOGICAL_SOCIAL');

-- CreateEnum
CREATE TYPE "EventDefinitionPosition" AS ENUM ('ALL', 'GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD', 'WIDE_PLAYER', 'CENTRAL_PLAYER');

-- CreateTable
CREATE TABLE "EventDefinition" (
    "id" TEXT NOT NULL,
    "scope" "EventDefinitionScope" NOT NULL DEFAULT 'GLOBAL',
    "clubId" TEXT,
    "legacyEventType" "MatchEventType",
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "matchPhase" "EventDefinitionMatchPhase" NOT NULL,
    "category" "EventDefinitionCategory" NOT NULL,
    "agePhases" "EventDefinitionAgePhase"[],
    "fourCorner" "EventDefinitionFourCorner" NOT NULL,
    "positionRelevance" "EventDefinitionPosition"[],
    "enabledByDefault" BOOLEAN NOT NULL DEFAULT false,
    "benchmarkable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventDefinition_legacyEventType_key" ON "EventDefinition"("legacyEventType");

-- CreateIndex
CREATE UNIQUE INDEX "EventDefinition_slug_key" ON "EventDefinition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EventDefinition_normalizedName_key" ON "EventDefinition"("normalizedName");

-- CreateIndex
CREATE INDEX "EventDefinition_scope_isActive_idx" ON "EventDefinition"("scope", "isActive");

-- CreateIndex
CREATE INDEX "EventDefinition_enabledByDefault_idx" ON "EventDefinition"("enabledByDefault");

-- CreateIndex
CREATE INDEX "EventDefinition_benchmarkable_idx" ON "EventDefinition"("benchmarkable");
