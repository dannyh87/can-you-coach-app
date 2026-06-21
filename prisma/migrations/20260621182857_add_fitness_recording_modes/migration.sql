-- AlterTable
ALTER TABLE "FitnessTestType" ADD COLUMN     "allowedRecordingModes" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "preferredRecordingMode" TEXT NOT NULL DEFAULT 'MANUAL';
