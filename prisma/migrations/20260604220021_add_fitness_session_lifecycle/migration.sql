-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FitnessTestSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "fitnessTestTypeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FitnessTestSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FitnessTestSession_fitnessTestTypeId_fkey" FOREIGN KEY ("fitnessTestTypeId") REFERENCES "FitnessTestType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FitnessTestSession" ("createdAt", "date", "fitnessTestTypeId", "id", "notes", "teamId", "updatedAt") SELECT "createdAt", "date", "fitnessTestTypeId", "id", "notes", "teamId", "updatedAt" FROM "FitnessTestSession";
DROP TABLE "FitnessTestSession";
ALTER TABLE "new_FitnessTestSession" RENAME TO "FitnessTestSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
