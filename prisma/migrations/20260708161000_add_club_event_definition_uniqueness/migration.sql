-- DropIndex
DROP INDEX "EventDefinition_normalizedName_key";

-- DropIndex
DROP INDEX "EventDefinition_slug_key";

-- CreateIndex
CREATE INDEX "EventDefinition_slug_idx" ON "EventDefinition"("slug");

-- CreateIndex
CREATE INDEX "EventDefinition_normalizedName_idx" ON "EventDefinition"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "EventDefinition_scope_clubId_normalizedName_key" ON "EventDefinition"("scope", "clubId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "EventDefinition_scope_clubId_slug_key" ON "EventDefinition"("scope", "clubId", "slug");
