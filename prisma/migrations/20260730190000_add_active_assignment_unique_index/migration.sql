-- Enforce one active contributor assignment per tracking task while preserving declined,
-- submitted and cancelled assignment history.
CREATE UNIQUE INDEX "MatchContributorAssignment_one_active_per_task"
ON "MatchContributorAssignment" ("trackingTaskId")
WHERE "status" IN ('PENDING', 'OFFERED', 'ACCEPTED', 'IN_PROGRESS');
