# HCA Analytics Solution Architecture Review

## Review Position

**Assessment:** Strong local prototype and useful analyst workbench; not ready for production or selection-critical use without the corrective actions below.

**Review date:** 2026-09-05  
**Reviewed scope:** Node.js API, browser UI, SQLite ingestion/database, analytical report generator, Docker packaging, and operating documentation.  
**Evidence basis:** Repository source, current SQLite schema, generated report, documented local smoke tests, and the observed HCA JSONP feed pattern.

This review does not claim that the system follows a proprietary standard of Deloitte, McKinsey, BCG, Accenture, Bain, Gartner, ESPNcricinfo, CricViz, or any other named organization. Their internal methods are not available in this repository and cannot be inferred. The recommendations use broadly accepted enterprise analytics controls: lineage, data contracts, reproducibility, least privilege, sample-size safeguards, quality gates, observability, and human review.

### Public comparison lenses

These are comparison lenses, not certifications or claims of endorsement:

- **DAMA-DMBOK-style data management:** ownership, metadata, lineage, quality, and lifecycle controls.
- **CRISP-DM-style analytics lifecycle:** business understanding, data understanding, preparation, modeling, evaluation, and deployment.
- **NIST Cybersecurity Framework-style security controls:** identify, protect, detect, respond, and recover.
- **OWASP ASVS-style application security:** authentication, authorization, validation, session handling, and logging.
- **ISO 27001-style governance discipline:** access control, risk treatment, documented procedures, incident response, and continual improvement.

The repository has evidence for some of these control families, but it is not a compliance assessment and has not been independently audited.

## Executive Decision

**Decision: Conditional approval for controlled internal pilot only.**

The solution is appropriate for a local analyst prototype using historical HCA data. It should not currently be exposed to a public network, used as an automated player-selection system, or treated as a complete high-performance sports science platform.

### What is already good

- Raw feed payloads are preserved and source URLs are recorded.
- Team, player, tournament, leaderboard, and source-feed entities are separated in SQLite.
- Analytical views distinguish descriptive data from calculated metrics.
- The report applies explicit minimum-sample thresholds.
- Missing feed failures are disclosed instead of being silently converted to zero.
- The UI includes source-quality visibility and avoids presenting recommendations as certainty.
- The server opens the database read-only for application queries.

## Findings

Findings are ordered by risk. File references point to the current implementation.

### P0: No authentication or authorization

**Evidence:** [server.js](server.js) serves all API routes and the UI without identity, role, or access checks. The deployment guide describes exposing port 3000 but does not require an authenticated reverse proxy.

**Risk:** Anyone who can reach the service can retrieve player identifiers, performance records, source metadata, and the complete quality-failure list. This is unacceptable for a network-accessible analyst system, especially if future versions add internal notes, fitness data, or selection decisions.

**Corrective action:** Keep the service localhost-only for the pilot. Before shared deployment, place it behind an identity-aware reverse proxy or OIDC gateway, define analyst/coach/admin roles, deny API access by default, and log authenticated access. Add automated authorization tests for every API route.

**Acceptance test:** An unauthenticated request receives `401`; an authenticated analyst can read approved analytical endpoints; an administrator-only endpoint is denied to analysts.

### P0: No audit trail for analyst decisions

**Evidence:** The database stores source feed status but has no analyst, review, decision, approval, or version tables. [HCA_UI_SETUP.md](HCA_UI_SETUP.md) recommends a decision log but the application does not implement one.

**Risk:** A coaching or selection decision cannot be reconstructed: who made it, using which data snapshot, with which rationale, and whether it was later validated.

**Corrective action:** Add immutable `analysis_runs`, `analyst_reviews`, `player_recommendations`, and `team_recommendations` tables. Record database hash/version, report version, user identity, evidence references, rationale, confidence, review date, and outcome. Never overwrite decisions; append corrections as new versions.

**Acceptance test:** An analyst can save a recommendation linked to a player and analysis run; a second user can see the author, timestamp, evidence version, rationale, and status history.

### P1: Ingestion is not transactionally safe

**Evidence:** [build_hca_database.js](build_hca_database.js) deletes derived tables before downloading and inserting the next source snapshot. Feed jobs can fail, and the database is populated after a partial fetch cycle.

**Risk:** An interrupted refresh can leave a mixed or incomplete database that looks valid to the UI. A later analyst may compare partial current data with complete historical data without a visible snapshot state.

**Corrective action:** Build into a new staging database or staging schema. Validate all required feeds and row counts, then atomically promote the validated snapshot. Add `dataset_snapshots` with status `staging`, `validated`, `published`, or `failed`. Keep the last known-good snapshot available for the UI.

**Acceptance test:** Kill a refresh midway; the published database remains unchanged. A failed refresh is visible in the ingestion status and cannot become the active dataset.

### P1: Source schema drift is not detected

**Evidence:** JSON fields are read directly with expressions such as `row.TotalRuns`, `row.TotalRunsConceeded`, and `row.WicketsTaken`. There is no required-field validation, type validation, schema version, or alert when a field is renamed or changes type.

**Risk:** A source-feed change can produce null-heavy records or silently wrong metrics while the application continues to run.

**Corrective action:** Add per-feed JSON schema contracts with required keys, numeric bounds, and allowed types. Store a normalized schema fingerprint per endpoint. Reject or quarantine records that fail validation, and report drift separately from ordinary missing feeds.

**Acceptance test:** A fixture with a renamed required field fails validation and remains quarantined; the last good snapshot remains published.

### P1: Entity identity is not fully mastered

**Evidence:** Team records are keyed globally by `team_id`, while player records are keyed by `(competition_id, team_id, player_id)`. Names are trimmed for some queries but not standardized across all ingestion paths. No canonical alias, merge, or identity-confidence table exists.

**Risk:** The same player/team can be split across spelling, capitalization, or source-ID changes. Cross-season trend analysis can therefore undercount or fragment performance.

**Corrective action:** Introduce canonical `player_dimension` and `team_dimension` tables with source identifiers, normalized display names, aliases, effective dates, and merge history. Preserve the original source name in raw columns. Require a reviewed identity mapping before multi-season aggregation.

**Acceptance test:** Known name variations resolve to one canonical entity while raw source values remain available for audit.

### P1: Analytical comparisons are not context-adjusted

**Evidence:** [generate_analyst_report.js](generate_analyst_report.js) aggregates totals by season/player/team and calculates rates, but the source model currently lacks opposition strength, venue, innings phase, pitch, weather, toss, and match-level context.

**Risk:** The report can identify signals but cannot support causal claims or fair comparisons between different tournament formats and levels. A high rate in a small or weaker cohort may be overstated.

**Corrective action:** Label all current outputs as descriptive. Add match-level and ball-by-ball data, opposition-strength cohorts, venue context, phase splits, and format-aware benchmarks before using the system for development plans or selection ranking.

**Acceptance test:** Every comparative view displays cohort, format, sample size, and data completeness; unsupported causal language is absent from generated recommendations.

### P1: API query design has no pagination or bounded result contract

**Evidence:** [server.js](server.js) returns up to 100 player or team rows, uses fixed result limits, and does not accept page/cursor parameters. `/api/quality` returns up to 100 failed feeds without a total count or pagination metadata.

**Risk:** Analysts may mistake the first 100 rows for the complete population. Future data growth will create silent truncation and inconsistent exports.

**Corrective action:** Add explicit `page`, `page_size`, `total`, and `next_cursor` fields. Set maximum page size, validate all query parameters, and add a downloadable snapshot/export endpoint with an explicit filter and dataset version.

**Acceptance test:** The UI can navigate beyond page 1 and the API response states whether more records exist.

### P1: No automated test suite or CI quality gate

**Evidence:** The repository has syntax checks and manual smoke tests but no unit, integration, API, ingestion-fixture, or browser test files.

**Risk:** Changes to SQL filters, schema, UI rendering, or source parsing can regress without detection. The previous Express catch-all incompatibility demonstrates that startup failures can be found only at runtime.

**Corrective action:** Add tests for JSONP parsing, feed validation, database rebuild atomicity, API filters, authorization, player detail, quality endpoint, and a Playwright smoke flow. Run `npm test`, syntax checks, dependency audit, and container build in CI.

**Acceptance test:** A clean checkout passes the full pipeline; deliberately broken feed fixtures and API filters fail the relevant tests.

### P1: Container deployment has not been verified in the current environment

**Evidence:** The Docker build was attempted but Docker Desktop's Linux engine was unavailable. The container files exist, but the image has not been built or run in this environment.

**Risk:** Packaging, native `better-sqlite3` installation, health checks, and mounted database behavior remain unverified.

**Corrective action:** Build and run the image in CI on Linux. Test the health check, read-only database mount, graceful shutdown, and a clean container start. Pin the base image digest and use a lockfile-verified install.

**Acceptance test:** `docker compose up --build` starts successfully, `/api/summary` returns `200`, the health check becomes healthy, and a read-only database mount works.

### P2: Operational observability is minimal

**Evidence:** [server.js](server.js) logs startup only. There are no structured request logs, latency metrics, error counters, refresh metrics, or alerting hooks.

**Risk:** Operators cannot distinguish a slow query, unavailable database, stale dataset, source outage, or application error without manually reproducing it.

**Corrective action:** Add structured logs with request ID, route, status, latency, dataset version, and error class. Add `/health/live` and `/health/ready` endpoints, refresh metrics, and alerts for stale data, feed failures, schema drift, and elevated API errors. Do not log sensitive payloads.

### P2: No explicit data retention and privacy policy

**Evidence:** Raw source objects and generated databases are retained locally, but the documentation does not define retention, deletion, access, or backup rules.

**Risk:** Player identifiers and future sensitive data may be retained indefinitely or copied into backups without governance.

**Corrective action:** Define data classification, retention periods, backup encryption, access ownership, deletion procedures, and environment separation before adding medical, fitness, or personally sensitive data.

### P2: UI accessibility and analyst export capabilities are incomplete

**Evidence:** [public/index.html](public/index.html) provides semantic headings and labels, but tables are fixed to the first 100 rows, there is no keyboard-oriented table interaction model, no explicit loading/error state, and no CSV export.

**Risk:** Analysts cannot reliably review large populations, recover from API errors, or move a reproducible filtered result into an approved workflow.

**Corrective action:** Add loading, empty, and error states; keyboard-focus styling and dialog focus management; pagination; CSV/JSON export with dataset version; accessible table captions and row actions; and a print/report view.

## Corrective Action Roadmap

### Phase 0: Pilot containment

- Keep the service bound to localhost or a private network.
- Do not add medical, fitness, or confidential selection notes yet.
- Publish the current report only with its data-quality section.
- Record the active database file hash and extraction timestamp.

### Phase 1: Reliability and trust

- Implement staged, atomic ingestion and dataset snapshots.
- Add schema validation and drift detection.
- Add canonical player/team identity mappings.
- Add API pagination, export, and explicit dataset-version metadata.
- Add unit, integration, and browser tests.

### Phase 2: Enterprise access and governance

- Add OIDC authentication, RBAC, audit logs, and analyst decision records.
- Add structured logging, health endpoints, metrics, and alerts.
- Add encrypted backups, retention, and disaster-recovery procedures.
- Build and scan the container in CI.

### Phase 3: High-performance sports analytics

- Ingest match-level and ball-by-ball data.
- Add opposition, venue, pitch, weather, phase, workload, fitness, and video-coded context.
- Establish role-specific benchmarks and analyst-reviewed targets.
- Back-test recommendations against later performance and record calibration/error rates.

## Validation Matrix

| Control area | Current evidence | Status | Required gate |
| --- | --- | --- | --- |
| Source lineage | Raw files, endpoint, feed status | Partial pass | Add dataset snapshot/version |
| Reproducibility | Node builders and lockfile | Partial pass | Add fixtures and CI |
| Data quality | Basic counts and negative-value checks | Partial pass | Add schema contracts and drift alerts |
| Metric definitions | Documented rates and sample thresholds | Pass for prototype | Add format/cohort benchmarks |
| Security | Read-only DB access | Fail for shared deployment | Authentication, RBAC, TLS, audit |
| Reliability | Local rebuild and server smoke test | Partial pass | Atomic staging and rollback |
| Observability | Startup output only | Fail | Structured logs, metrics, health endpoints |
| Analyst workflow | UI filters, drill-through, quality view | Partial pass | Pagination, export, decision log |
| Containerization | Dockerfile and Compose present | Unverified | Linux CI build and runtime test |
| Responsible use | Report caveats and human-review language | Pass for prototype | Governance owner and approval workflow |

## Recommended Acceptance Criteria

The solution should not be called production-ready until all of the following are true:

1. A failed refresh cannot replace the last known-good dataset.
2. Every published metric has a source, dataset version, definition, cohort, and sample-size context.
3. Shared access requires authentication and role-based authorization.
4. Analyst recommendations are immutable, attributable, and auditable.
5. Schema drift and identity changes are detected before publication.
6. API and browser tests run in CI, including a clean Linux container build.
7. Operators receive alerts for stale data, feed failures, and service health issues.
8. Selection or development decisions include non-statistical context and human approval.

## Final Assessment

The current implementation is a credible foundation for a controlled internal pilot. Its strongest qualities are source preservation, explicit evidence thresholds, and clear caveats about what the HCA feeds cannot establish. The highest-priority work is not adding more charts; it is making refreshes atomic, identities trustworthy, access controlled, decisions auditable, and deployment testable. Those controls are what convert an informative prototype into a governed analytics product.
