-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('LEAGUE', 'CUP', 'FRIENDLY');

-- CreateEnum
CREATE TYPE "MatchVenue" AS ENUM ('HOME', 'AWAY', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'HALF_TIME', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MatchSquadStatus" AS ENUM ('STARTER', 'SUBSTITUTE', 'NOT_INVOLVED');

-- CreateEnum
CREATE TYPE "MatchHalf" AS ENUM ('FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "MatchEventType" AS ENUM ('GOAL', 'ASSIST', 'SHOT_ON_TARGET', 'SHOT_OFF_TARGET', 'PASS_COMPLETE', 'PASS_INCOMPLETE', 'ONE_V_ONE_SUCCESS', 'ONE_V_ONE_UNSUCCESSFUL');

-- CreateEnum
CREATE TYPE "MatchEventCategory" AS ENUM ('ATTACKING', 'IN_POSSESSION', 'OUT_OF_POSSESSION', 'TRANSITION');

-- CreateEnum
CREATE TYPE "FitnessTestSessionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FitnessResultStatus" AS ENUM ('COMPLETED', 'DID_NOT_START', 'INJURED', 'ABSENT', 'DROPPED_OUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "league" TEXT,
    "footballPyramidStep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchDay" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "opposition" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL,
    "venue" "MatchVenue" NOT NULL,
    "ownScore" INTEGER NOT NULL DEFAULT 0,
    "oppositionScore" INTEGER NOT NULL DEFAULT 0,
    "status" "MatchStatus" NOT NULL DEFAULT 'DRAFT',
    "firstHalfStartedAt" TIMESTAMP(3),
    "firstHalfEndedAt" TIMESTAMP(3),
    "secondHalfStartedAt" TIMESTAMP(3),
    "secondHalfEndedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchDayEventType" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "eventType" "MatchEventType" NOT NULL,
    "category" "MatchEventCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchDayEventType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchDayPlayer" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "squadStatus" "MatchSquadStatus" NOT NULL DEFAULT 'NOT_INVOLVED',
    "startingPosition" TEXT,
    "shirtNumberSnapshot" INTEGER,
    "isTracked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchDayPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayerStint" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "matchDayPlayerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "half" "MatchHalf" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "startMatchSecond" INTEGER,
    "endMatchSecond" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPlayerStint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "playerId" TEXT,
    "eventType" "MatchEventType" NOT NULL,
    "half" "MatchHalf" NOT NULL,
    "matchSecond" INTEGER NOT NULL,
    "ownScoreAtTime" INTEGER NOT NULL,
    "oppositionScoreAtTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "squadNumber" INTEGER,
    "preferredPosition" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "joinedClubDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessTestType" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resultUnit" TEXT NOT NULL,
    "higherIsBetter" BOOLEAN NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessTestType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessTestSession" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fitnessTestTypeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "FitnessTestSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessTestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessTestResult" (
    "id" TEXT NOT NULL,
    "fitnessTestSessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "resultValue" DOUBLE PRECISION,
    "resultText" TEXT,
    "status" "FitnessResultStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MatchDayEventType_matchDayId_eventType_key" ON "MatchDayEventType"("matchDayId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "MatchDayPlayer_matchDayId_playerId_key" ON "MatchDayPlayer"("matchDayId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessTestType_userId_name_key" ON "FitnessTestType"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessTestResult_fitnessTestSessionId_playerId_key" ON "FitnessTestResult"("fitnessTestSessionId", "playerId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDay" ADD CONSTRAINT "MatchDay_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDayEventType" ADD CONSTRAINT "MatchDayEventType_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDayPlayer" ADD CONSTRAINT "MatchDayPlayer_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDayPlayer" ADD CONSTRAINT "MatchDayPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStint" ADD CONSTRAINT "MatchPlayerStint_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStint" ADD CONSTRAINT "MatchPlayerStint_matchDayPlayerId_fkey" FOREIGN KEY ("matchDayPlayerId") REFERENCES "MatchDayPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStint" ADD CONSTRAINT "MatchPlayerStint_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessTestType" ADD CONSTRAINT "FitnessTestType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessTestSession" ADD CONSTRAINT "FitnessTestSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessTestSession" ADD CONSTRAINT "FitnessTestSession_fitnessTestTypeId_fkey" FOREIGN KEY ("fitnessTestTypeId") REFERENCES "FitnessTestType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessTestResult" ADD CONSTRAINT "FitnessTestResult_fitnessTestSessionId_fkey" FOREIGN KEY ("fitnessTestSessionId") REFERENCES "FitnessTestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessTestResult" ADD CONSTRAINT "FitnessTestResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

