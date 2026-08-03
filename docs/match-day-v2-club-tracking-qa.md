# Match Day V2 Club Tracking Manual QA

Use prefix `CYCV2-FINAL-QA-<timestamp>` for any temporary manual QA data. Do not reset the database. Do not delete data outside that prefix.

## Browser Tooling Limitation

No Playwright, Cypress, or repository browser automation is configured. These scenarios require manual browser verification and must not be reported as completed unless actually performed.

## Environment

- Verify `MATCH_DAY_TRACKING_V2=false` or unset first.
- Verify `MATCH_DAY_TRACKING_V2=true` for club-tracking flows.
- Use `ENABLE_ROLE_TESTER=true` only in local development with Clerk disabled.
- Use `/dev/match-tracking` only when `ENABLE_MATCH_TRACKING_DEV_HARNESS=true` and super-admin access are available.

## Checklist

- Flag off: legacy Match Day, standard completed reports, standard Team Tracking Trends, and standard touch-map filters work; club setup/report/trend controls are hidden; direct club URL state fails safely.
- Flag on: Club Tracking Library displays aliases, mapped definitions, rejected/local definitions where supported, and retired definitions with status text.
- Mapping Review: proposed, club-approved, standard-approved, rejected, stale, and retired states show recorded/proposed identity labels.
- Setup: guided and advanced Match Day setup can select standard events, native patterns, event aliases, event mappings, event custom definitions, pattern aliases, and pattern mappings. Do not test or document custom tactical-pattern definitions or custom outcomes.
- Templates: create, apply, duplicate, and copy templates with selected club definitions; verify same-club links persist and cross-club remapping is not offered.
- Assignments: direct, self, and group-offer assignments work for player, unit, and team tasks; ineligible users cannot claim or record.
- Contributor event recording: native standard, alias, standard-approved mapped, club-only mapped, rejected locally usable mapped, and custom event submissions preserve snapshot provenance.
- Contributor pattern recording: native pattern, alias, standard-approved mapped pattern, club-only mapped pattern, locally usable rejected mapped pattern, and retired/stale warning cases preserve outcomes, scope, target, and location.
- Undo: contributors can undo latest pending submitted observations only; submitted/closed assignments and accepted observations cannot be undone; official rows remain untouched.
- Submission: finishing an assignment prevents further recording or undo.
- Coach review: event and pattern review cards show club identity, recorded standard, proposed standard, mapping status/revision, stale warnings, submitter, target, time, note, and location status.
- Repeat acceptance: refreshing or double-submitting accept actions returns the existing official observation and creates no duplicates.
- Match reports: standard totals include native standards, aliases, and standard-approved mappings only; club-only/custom observations are excluded from standard totals.
- Club reports: club section includes one row per official club observation within its club definition and does not create a combined standard-plus-club grand total.
- Touch map: typed standard/club filters remain stable; club-only points do not appear under standard filters; aliases may appear in both intended dimensions; missing coordinates never plot.
- Event CSV: browser download preserves legacy columns and appends provenance fields in order for native, alias, standard-approved mapped, club-only mapped, rejected mapped, and custom events.
- Pattern CSV: browser download preserves outcomes, scope, target, player, unit, location, review status, and provenance for native, alias, standard-approved mapped, club-only mapped, and rejected mapped patterns.
- Completed-match email attachments: event CSV uses the same provenance semantics as browser download; pattern CSV is attached only when official pattern observations exist; summary attachment remains present.
- Team Tracking Trends: standard aliases and standard-approved mappings collapse under recorded standard identity; club-only mapped patterns stay out of standard trends despite non-null `patternId`; club dimension is flag-gated; positive rate shows `0%` when positive outcomes exist but no positives occurred.
- Mobile widths: review cards, contributor controls, CSV buttons, club report cards, mapping details, trends filters, trends chart, and tables wrap or scroll without clipping.
- Keyboard navigation: forms, selects, buttons, details disclosures, modals, and CSV downloads are reachable with visible focus and no pointer-only action.
- Accessibility: labels, headings, status text, table headers, empty states, disclosure text, and chart-adjacent tabular data are present.
- Cleanup: count prefixed QA records, delete only prefixed data, then confirm prefixed counts are zero.
