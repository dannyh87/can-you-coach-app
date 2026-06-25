-- DropIndex
DROP INDEX IF EXISTS "SpectatorAccess_userId_key";

-- CreateIndex
CREATE INDEX "SpectatorAccess_userId_idx" ON "SpectatorAccess"("userId");
