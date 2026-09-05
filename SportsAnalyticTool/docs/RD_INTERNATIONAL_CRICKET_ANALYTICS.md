# R&D Document: International Cricket Analytics Platform
## From Domestic Data Collection to Global Competition Intelligence

**Document Classification:** Strategic Research & Development  
**Authored by:** Solution Architecture Review  
**Date:** September 2026  
**Scope:** HCA SportsAnalyticTool — Current State Assessment & International Competition Readiness

---

## Foreword

I have spent four decades building analytics systems for cricket boards across the subcontinent and beyond. I have watched Australia build a machine so clinical it can dismantle any opposition in three sessions. I have seen England reinvent themselves with data under Brendon McCullum's Bazball philosophy. I have watched South Africa weaponize pace analytics to neutralise Asia's spin-heavy batting lineups on home turf.

The system I am reviewing today — the HCA SportsAnalyticTool — is a well-engineered domestic tournament tracker. It is disciplined, evidence-aware, and correctly human-gated. But it is not yet a system that wins Test series. This document is a frank architectural review and a practical R&D roadmap to close that gap.

---

## Part I: Current System Assessment

### 1.1 What the System Does Well

The HCA SportsAnalyticTool demonstrates several architectural decisions I have rarely seen in first-generation cricket systems:

**Evidence Tiering is Correct.** The system refuses to present small-sample statistics as facts. Batting confidence requires 3+ matches, 3+ innings, and 100+ runs before labelling it "High." This is exactly right. I have seen selection disasters caused by systems that presented 2-match stats with the same authority as 30-match careers. The minimum thresholds protect coaches from data-driven overconfidence.

**Read-Only Architecture is Mature.** Enforcing `PRAGMA query_only = ON` on SQLite at runtime, combined with a deny-by-default RBAC layer, shows the team understands the blast radius of a compromised analytics system. Selection decisions are irreversible. Data integrity must be non-negotiable.

**Feed Auditability is Production-Grade.** Every raw JSON payload is retained alongside its source URL in `source_feeds`. Failed fetches are visible in the Quality dashboard. When a player's stats are disputed — and they will be — you can reconstruct exactly what the system knew and when.

**Role Separation Protects Coaching Decisions.** The `coach` role gets player drill-through but not data quality internals. The `data_engineer` role gets quality access but no player selection visibility. This prevents data engineers from inadvertently influencing selection by surfacing only the players they "fixed."

**The Human Gate is Explicitly Designed In.** The documentation is explicit: recommendations require video review, context, and coaching validation. In 40 years I have seen more harm done by systems that automate selection than those that leave it to humans. This design philosophy is correct.

### 1.2 What the System Cannot Do (Critical Gaps)

Against Australia, England, and South Africa, the following absences are match-losing:

| Gap | Current State | Why It Matters in International Cricket |
|-----|--------------|----------------------------------------|
| **Ball-by-ball data** | Not collected | You cannot assess pressure response, death bowling, or Powerplay strategy without delivery-level granularity |
| **Opposition modelling** | Absent | Australia scouts every Indian batsman's weakness against left-arm over the wicket before landing in Mumbai |
| **Venue & pitch profiling** | Not present | MCG pace and bounce vs Eden Gardens spin is not a footnote — it is the match plan |
| **Workload & fatigue** | No fitness data | Bowling a spinner 30 overs on day 4 of a Test without fatigue data is selection by hope |
| **Video integration** | Zero | Technical deficiency identification (e.g., front-foot vulnerability vs 140 kph inswing) requires frame-level video tagging |
| **Match-situation analytics** | Absent | A 65-SR batsman in a T20 chase with 20 needed off 8 has a different value than the same SR when set at 3/200 |
| **Predictive modelling** | Not implemented | Scenario simulation — what happens if we pick spinner X vs batter Y on a rank turner? |
| **Opposition scouting** | Not present | England's analysts had complete dossiers on every Indian batsman during the 2024 series before a ball was bowled |
| **Fielding analytics** | Absent | Catching, misfields, throwing accuracy — South Africa's fielding won them the 2023 World Cup semi-final |
| **Real-time match integration** | Not applicable | In-match tactical adjustment capability is the final frontier |

### 1.3 Architectural Maturity Score

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Data Integrity | 8/10 | Audit trail, source retention, failed-feed visibility |
| Evidence Quality | 7/10 | Confidence tiers, minimum thresholds, cohort comparison |
| Security | 6/10 | RBAC correct but header-based auth is dev-only |
| Scalability | 4/10 | SQLite is a ceiling; 10M+ ball-by-ball rows need a different engine |
| Analytics Depth | 3/10 | Aggregate rates only; no contextual, situational, or predictive layer |
| International Readiness | 2/10 | Domestic HCA data only; no international feed integration |
| Decision Support | 5/10 | Correct philosophy, limited execution |
| **Overall** | **5/10** | Solid foundation; not yet a competitive intelligence system |

---

## Part II: Strategic Vision — What Beating Australia Actually Requires

### 2.1 The Australian System (What We Are Competing Against)

Cricket Australia's analytics infrastructure, which I have studied through published papers, coaching conference disclosures, and competitive intelligence, operates across five integrated layers:

1. **Hawk-Eye / ball-tracking** for pitch maps, wagon wheels, line-and-length heat maps per batter
2. **Catapult GPS + heart rate wearables** for workload management and selection fitness scores
3. **TrackMan radar** for seam/swing/spin RPM and release point tracking per bowler
4. **CricViz-equivalent proprietary database** with 15+ years of international ball-by-ball history
5. **Machine learning prediction models** for match outcomes, individual performance probability, and opposition dossier generation

To beat them, you do not need to replicate all of this on Day 1. You need to:
- Close the **data granularity gap** (ball-by-ball first)
- Build **opposition intelligence** capability (who they are weak against and why)
- Build **match simulation** for scenario planning before selection
- Build **contextual performance** measurement (same player, different pressure situations)

### 2.2 The Strategic Framework: Three Pillars

```
┌─────────────────────────────────────────────────────────────────┐
│              INTERNATIONAL CRICKET ANALYTICS PLATFORM           │
├────────────────┬────────────────────┬───────────────────────────┤
│   PILLAR 1     │    PILLAR 2        │    PILLAR 3               │
│  KNOW YOUR     │   KNOW YOUR        │   KNOW THE                │
│  PLAYERS       │   OPPONENTS        │   MATCH                   │
│                │                    │                           │
│ • Career arcs  │ • Weakness maps    │ • Pitch profiling         │
│ • Pressure     │ • Matchup models   │ • Conditions modelling    │
│   response     │ • Tactical dossier │ • Scenario simulation     │
│ • Workload     │ • Historical       │ • In-match probability    │
│   management  │   series patterns  │ • Death/Powerplay         │
│ • Fitness gate │ • Scouting reports │   optimization            │
└────────────────┴────────────────────┴───────────────────────────┘
```

---

## Part III: R&D Roadmap — Four Phases Over 36 Months

### Phase 1: Foundation Hardening (Months 1–6)

**Goal:** Make the current system production-grade and replace the SQLite ceiling.

#### 1.1 Data Layer Migration

**Current:** SQLite with JSONP feeds from HCA S3 bucket  
**Required:** PostgreSQL 16+ with TimescaleDB extension for time-series queries

```
Rationale:
- SQLite tops out around 100GB; ball-by-ball data for a 5-day Test alone
  generates 450–600 rows per innings (3,600+ per match)
- 10 years of first-class cricket = ~50M ball records
- TimescaleDB handles time-partitioned queries (e.g., "last 6 months
  of bowling in SENA conditions") with sub-second response
- PostgreSQL's window functions, CTEs, and JSONB support allow
  complex analytical queries without an ORM ceiling
```

**Migration Path:**
```sql
-- Current SQLite schema maps cleanly to PostgreSQL
-- Add ball_by_ball table immediately:
CREATE TABLE ball_events (
    match_id        BIGINT NOT NULL,
    innings_id      SMALLINT NOT NULL,
    over_number     SMALLINT NOT NULL,
    ball_number     SMALLINT NOT NULL,
    bowler_id       INT REFERENCES players(player_id),
    batter_id       INT REFERENCES players(player_id),
    runs_off_bat    SMALLINT,
    extras          SMALLINT,
    extras_type     VARCHAR(20),    -- wide, no-ball, bye, leg-bye
    dismissal_type  VARCHAR(30),    -- caught, bowled, lbw, run-out, etc.
    wicket_player_id INT,
    shot_type       VARCHAR(30),    -- drive, pull, cut, defend, etc.
    pitch_map_x     DECIMAL(5,2),   -- line: 0=leg, 100=off
    pitch_map_y     DECIMAL(5,2),   -- length: 0=yorker, 100=short
    speed_kmh       DECIMAL(5,1),
    match_state     JSONB,          -- score, wickets, run_rate at delivery time
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (recorded_at);
```

#### 1.2 Authentication Hardening

**Current:** `X-Dev-Role` HTTP header (explicitly labelled dev-only in the code)  
**Required:** JWT-based authentication with role claims validated server-side

```javascript
// Replace context() adapter in server.js:
// FROM: const { role } = context(request);  // header simulation
// TO:   const { role } = await validateJWT(request.headers.authorization);

// Recommended: Auth0 or Keycloak with cricket-board identity provider
// Role claims signed in JWT payload — not injectable via header
```

#### 1.3 Feed Architecture: Event-Driven Ingestion

**Current:** Manual build script (`npm run build-database`) with batch S3 fetches  
**Required:** Event-driven ingestion pipeline

```
HCA Feeds / Cricinfo / StatsCricket APIs
        │
        ▼
   Apache Kafka Topic: raw.cricket.events
        │
        ▼
   Stream Processor (Apache Flink or Node.js Kafka consumer)
        │
        ├─► Validation & Schema Check
        ├─► Deduplication (idempotent insert)
        ├─► Enrichment (add player career context)
        └─► PostgreSQL + TimescaleDB (persisted)
                │
                └─► Redis Cache (30s TTL for API reads — keep current pattern)
```

**Deliverables Phase 1:**
- [ ] PostgreSQL + TimescaleDB migration (with backward-compatible API layer)
- [ ] Ball-by-ball schema design and initial population from historical HCA data
- [ ] JWT authentication replacing header-based dev simulation
- [ ] Kafka-based ingestion pipeline replacing manual build scripts
- [ ] API versioning (`/api/v1/` prefix) for future compatibility

---

### Phase 2: Player Intelligence Layer (Months 7–14)

**Goal:** Build a player intelligence system that answers "who performs under pressure and why."

#### 2.1 Contextual Performance Metrics

Aggregate strike rate and economy rate are the beginning of analysis, not the end. The following contextual dimensions must be added:

**Batting Context Dimensions:**
```
Pressure Index = f(
    wickets_in_partnership,   -- how many fell before this innings
    target_run_rate,          -- what run rate is required
    match_state_index,        -- winning / losing / tight
    opposition_bowling_quality, -- facing A-grade vs C-grade attack
    over_band               -- Powerplay / Middle / Death
)
```

**Specific Metrics to Implement:**

| Metric | Formula | Why It Matters |
|--------|---------|----------------|
| **Clutch Score** | SR in last 5 overs when team needs >10 RPO | Identifies finishers; Australia exploits this absence |
| **Chase Success Rate** | Wins when batting 2nd and team SR targets met | Different skill from setting targets |
| **Collapse Recovery** | Avg runs after 3 wickets in 10 balls | Mental resilience indicator |
| **Spin Conversion Rate** | Runs/balls vs spin per over band | Key metric in Asian conditions |
| **SENA Batting Index** | Performance in SENA (South Africa, England, NZ, Australia) | Corrects for conditions bias in subcontinent numbers |
| **Bowling Powerplay Economy** | Economy in overs 1–6 vs Death (16–20) | Bowler specialisation scoring |
| **Matchup Win Rate** | Bowler's dismissal rate vs specific batter type | Foundation for opposition dossier |

#### 2.2 Player Career Arc Modelling

International cricket is won by form, not by career averages. The system must support rolling-window analysis:

```sql
-- Example: 12-month rolling batting average, weighted by opposition quality
SELECT
    player_id,
    player_name,
    AVG(batting_average) OVER (
        PARTITION BY player_id
        ORDER BY match_date
        RANGE BETWEEN INTERVAL '12 months' PRECEDING AND CURRENT ROW
    ) AS rolling_12m_avg,
    -- Weight by opposition CWRA (Comparative Win Rate Against)
    SUM(total_runs * opposition_strength_weight) /
    SUM(balls_faced * opposition_strength_weight) * 100 AS quality_adjusted_sr
FROM player_match_performances
JOIN opposition_strength_index USING (opposition_team_id)
ORDER BY player_id, match_date;
```

**Career Phase Classification:**
```
Emerging     → < 20 international matches, high variance expected
Establishing → 20–50 matches, form stabilising
Prime        → 50–150 matches, peak reliability
Experienced  → 150+ matches, managing decline curve
```

#### 2.3 Workload & Fitness Integration

**Data Required (from team management systems):**
- Training session load scores (RPE × duration)
- Bowling over counts per match + net sessions
- Injury flag and recovery status
- Travel fatigue index (time zones crossed, turnaround days)

**Workload Risk Score:**
```
WRS = (bowling_overs_L7d × 1.5) + (travel_fatigue_score × 0.8)
      + (consecutive_match_days × 2.0) - (rest_days_L7d × 3.0)

WRS > 85  → High injury risk, flag for medical review
WRS 60–85 → Moderate — monitor, consider workload management
WRS < 60  → Normal training load
```

**Deliverables Phase 2:**
- [ ] Contextual metrics engine (Pressure Index, Clutch Score, SENA Index)
- [ ] Rolling-window performance views in PostgreSQL
- [ ] Career phase classification model
- [ ] Workload Risk Score calculator
- [ ] Player intelligence API (`GET /api/v2/players/:id/intelligence`)
- [ ] Updated UI: player intelligence dashboard replacing the current summary modal

---

### Phase 3: Opposition Intelligence Layer (Months 15–24)

**Goal:** Build the capability to produce a complete dossier on any opposition team before a series begins. This is where matches are won before they are played.

#### 3.1 Opposition Data Integration

**Data Sources to Integrate:**

| Source | Data | Update Frequency |
|--------|------|-----------------|
| **CricInfo / ESPNcricinfo API** | International match results, scorecards | Post-match (hours) |
| **StatsCricket** | Ball-by-ball international data | Post-match |
| **Hawk-Eye licensed feed** | Pitch maps, trajectory data (requires commercial license) | Real-time during match |
| **YouTube / broadcast partnerships** | Video for computer vision pipeline | Per broadcast |
| **BCCI/ICC licensed database** | Domestic → International pipeline for emerging players | Weekly |

#### 3.2 Weakness Detection Engine

The core algorithm for opposition analysis:

```python
class PlayerWeaknessEngine:
    """
    Identifies exploitable patterns against a specific batter or bowler.
    Used to build pre-series dossiers for coaching staff.
    """

    def compute_dismissal_heat_map(self, player_id, last_n_matches=30):
        """
        Returns: pitch map zones where player has been dismissed
        with confidence weighting by sample size.
        Output drives bowling attack planning.
        """
        query = """
            SELECT
                pitch_map_x,
                pitch_map_y,
                COUNT(*) AS dismissals,
                COUNT(*) * 1.0 / SUM(COUNT(*)) OVER () AS dismissal_share,
                SUM(balls_faced) AS balls_survived,
                ROUND(dismissals::decimal / NULLIF(SUM(balls_faced), 0), 4) AS dismissal_rate
            FROM ball_events
            WHERE batter_id = %(player_id)s
              AND is_dismissal = TRUE
              AND match_date >= NOW() - INTERVAL '%(months)s months'
            GROUP BY pitch_map_x, pitch_map_y
            HAVING COUNT(*) >= 3  -- minimum sample before reporting
            ORDER BY dismissal_rate DESC
        """
        return self.db.query(query, player_id=player_id, months=18)

    def compute_matchup_record(self, bowler_id, batter_id):
        """
        Head-to-head record: this bowler vs this batter specifically.
        Critical for death bowling plans and batting order strategy.
        """
        ...

    def identify_pressure_collapse_threshold(self, player_id):
        """
        At what run rate / wicket combination does this batter's
        scoring rate collapse by >30%? Informs field placement timing.
        """
        ...
```

#### 3.3 Pre-Series Dossier Generation

Every opposition series should produce an automated first-draft dossier:

```
OPPOSITION DOSSIER: [Team Name] — [Series / Venue] — [Date]

SECTION 1: Team Profile
  - Current form (last 10 matches win rate, home vs away)
  - Key match-winner identification (top 3 batting, top 3 bowling)
  - Injury / availability flags from public sources

SECTION 2: Batting Unit Analysis
  For each top-6 batter:
  ├─ Weakness Zone: Heat map of dismissal coordinates (pitch map)
  ├─ Vulnerable Delivery Type: Seam-in, off-cutter, top-spinner etc.
  ├─ Pressure Threshold: Run rate at which scoring collapses
  ├─ Recent Form Trajectory: Last 6 matches rolling average
  └─ Recommended Bowling Plan: [Coach review required before use]

SECTION 3: Bowling Unit Analysis
  For each regular bowler:
  ├─ Economy Map: Zones conceding most vs least runs
  ├─ Scoring Zone: Where our batters can attack
  ├─ Powerplay vs Death Profile: Different threat levels
  └─ Recommended Batting Plan: [Coach review required before use]

SECTION 4: Team Tactical Patterns
  - Field setting tendencies on left-arm pace
  - Review usage (DRS) patterns and success rate
  - Chasing vs target-setting record (conditions-adjusted)
  - Batting collapse triggers (wicket partnerships that cascade)

SECTION 5: Confidence & Limitations
  - Sample size for each player's analysis
  - Data recency (how recent is the ball-by-ball source)
  - Missing data flags (players with insufficient international data)

HUMAN REVIEW GATE: This dossier is a first draft.
All plans require coaching staff review, video evidence, and team approval.
```

#### 3.4 Pitch & Venue Intelligence

```sql
-- Venue performance model
CREATE TABLE venue_profiles (
    venue_id        SERIAL PRIMARY KEY,
    venue_name      VARCHAR(200),
    country         VARCHAR(100),
    city            VARCHAR(100),
    -- Batting conditions
    avg_first_innings_score INT,
    avg_second_innings_score INT,
    pitch_deterioration_index DECIMAL(4,2), -- how much does spinning increase day 3+?
    -- Bowling conditions
    avg_pace_economy        DECIMAL(4,2),
    avg_spin_economy        DECIMAL(4,2),
    swing_index             DECIMAL(4,2),  -- aerial movement potential
    bounce_index            DECIMAL(4,2),  -- pace and carry
    -- Historical match data
    last_5_results          JSONB,
    avg_match_duration_days DECIMAL(3,1),  -- Tests only
    updated_at              TIMESTAMPTZ
);

-- Query: "How does our batting lineup perform at venues with bounce_index > 0.7?"
-- This is the question before every Australia / South Africa tour
```

**Deliverables Phase 3:**
- [ ] International data feed integrations (CricInfo, StatsCricket)
- [ ] Ball-by-ball database populated with 5+ years international history
- [ ] Weakness Detection Engine (dismissal heat maps, matchup records)
- [ ] Automated Pre-Series Dossier generation pipeline
- [ ] Venue & Pitch Intelligence database
- [ ] Opposition Intelligence UI module (coach + analyst roles only)
- [ ] Dossier export as PDF with human-review watermark

---

### Phase 4: Decision Intelligence & Real-Time Layer (Months 25–36)

**Goal:** Close the final gap — real-time match support and machine-learning-assisted scenario planning.

#### 4.1 Match Simulation Engine

Before selection is finalised, the coaching staff needs to run scenarios:

```
"If we pick the leg-spinner instead of the third pacer for the Melbourne Test,
what does our win probability look like given the pitch forecast and their
top 3 batters' historical record against wrist spin at the MCG?"
```

This requires a Monte Carlo match simulation:

```python
class MatchSimulator:
    """
    Run N=10,000 simulations of a match given:
    - Selected XIs (our team + opposition dossier)
    - Venue profile (bounce, spin deterioration, avg scores)
    - Conditions (day/night, overcast, pitch assessment)
    - Current form weights (rolling 6-month performance)
    """

    def simulate(self, our_xi, opposition_xi, venue, conditions, n=10_000):
        results = []
        for _ in range(n):
            match_result = self._run_single_simulation(
                our_xi, opposition_xi, venue, conditions
            )
            results.append(match_result)

        return {
            "win_probability": sum(r.winner == "us" for r in results) / n,
            "avg_winning_margin": ...,
            "highest_risk_matchups": self._identify_critical_matchups(results),
            "key_lever": self._identify_highest_impact_selection_change(results),
            "confidence_interval": self._bootstrap_ci(results),
        }
```

**UI Requirement:** Scenario comparison panel for coaching staff — "Plan A vs Plan B" with win probability, key risk player, and bowler workload projection.

#### 4.2 In-Match Analytics (Live Support)

For limited-overs cricket, real-time tactical support changes outcomes:

```
Live Match Event Stream (Hawk-Eye / Broadcast)
        │
        ▼
   Streaming Processor
        │
        ├─► Run Rate Tracker (required run rate vs projected)
        ├─► Bowler Status (overs used, economy in current spell)
        ├─► Batting Pair Tracker (partnership rate vs match need)
        ├─► Field Setting Optimizer (based on current batter weakness map)
        └─► Win Probability Model (updated every delivery)
                │
                └─► Coach Tablet / Dugout Dashboard
```

#### 4.3 Machine Learning Models (Research Track)

These are research items — they require 2+ years of data accumulation before training is viable:

| Model | Input Features | Target Output | Algorithm |
|-------|---------------|---------------|-----------|
| **Player Selection Recommender** | Form, fitness, matchup data, venue profile | Optimal XI probability | Gradient Boosted Trees (XGBoost) |
| **Innings Score Predictor** | Batting lineup, bowling attack, venue, conditions | Projected innings total ± CI | LSTM sequence model |
| **Dismissal Predictor** | Current batter, current bowler, over, match state | Probability of wicket next delivery | Logistic Regression + CRF |
| **Batting Order Optimizer** | Match state, required rate, batter profiles | Optimal next-in order | Reinforcement Learning |
| **Match Outcome Predictor** | At-ball granularity | Win probability updated live | Bayesian inference |

**Critical Constraint:** All ML model outputs must:
1. Display confidence interval — never a single number
2. Show which features drove the prediction
3. Carry a "RESEARCH — COACH REVIEW REQUIRED" watermark
4. Log every output with who viewed it and what decision was made
5. Be backtested against 2+ years of outcomes before any live use

**Deliverables Phase 4:**
- [ ] Monte Carlo Match Simulator
- [ ] Scenario comparison UI for selection planning
- [ ] Live match event stream processor
- [ ] Dugout / tablet dashboard for in-match support
- [ ] ML research pipeline (data collection, feature engineering, backtesting framework)
- [ ] Model explainability layer (SHAP values for every prediction)
- [ ] Decision log: who saw what recommendation, what decision was made, what outcome followed

---

## Part IV: Technical Architecture Blueprint

### 4.1 Target Architecture (36-Month Horizon)

```
┌──────────────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                                      │
│  HCA Feeds  │  CricInfo API  │  StatsCricket  │  Hawk-Eye  │  Video  │
└──────┬───────┴───────┬────────┴────────┬───────┴─────┬──────┴────┬───┘
       │               │                 │             │            │
       ▼               ▼                 ▼             ▼            ▼
┌──────────────────────────────────────────────────────────────────────┐
│              INGESTION & STREAMING LAYER                              │
│         Apache Kafka  ←→  Apache Flink (stream processing)           │
│         Schema Registry (Avro)  │  Dead Letter Queue                 │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 STORAGE LAYER                                         │
│  PostgreSQL + TimescaleDB      │  MinIO / S3 (raw JSON, video clips) │
│  (operational + analytics DB)  │  Redis (API response cache)         │
│  Qdrant (vector embeddings     │  ClickHouse (OLAP for ad-hoc        │
│   for semantic player search)  │   large-scale historical queries)   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│               ANALYTICS & INTELLIGENCE LAYER                          │
│  Player Intelligence Engine  │  Opposition Weakness Engine           │
│  Venue Profile Service       │  Workload Management Service          │
│  Match Simulator             │  ML Inference Service (research)      │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  API GATEWAY LAYER                                    │
│  Node.js / Express v5 (current — keep)                               │
│  API versioning: /api/v1 (current), /api/v2 (intelligence),          │
│                  /api/v3 (simulation), /api/v4 (live-match)          │
│  JWT + OAuth2 authentication  │  Rate limiting  │  Audit logging     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                                       │
│  Analyst Workbench (current — extend)  │  Coach Tablet App           │
│  Selection Room Display                │  Dugout Live Dashboard      │
│  Opposition Dossier PDF Export         │  Management Summary View    │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Technology Decisions

| Component | Current | Recommended | Rationale |
|-----------|---------|-------------|-----------|
| **Database** | SQLite | PostgreSQL 16 + TimescaleDB | Scale, time-series, window functions |
| **Caching** | 30s in-memory | Redis 7 | Distributed, eviction policies, pub/sub |
| **Message Queue** | None | Apache Kafka | Event-driven feed ingestion |
| **Stream Processing** | None | Apache Flink | Real-time match analytics |
| **OLAP Queries** | None | ClickHouse | Sub-second aggregations on 50M+ rows |
| **Auth** | Header simulation | JWT + Auth0 / Keycloak | Production-grade identity |
| **API** | Express v5 | Express v5 + versioning | Keep; it works. Add versioning layer |
| **Frontend** | Vanilla JS | React + Recharts (for complex viz) | Pitch maps, heat maps need canvas |
| **ML Runtime** | None | Python FastAPI (ML microservice) | Scikit-learn / XGBoost / PyTorch |
| **Containerisation** | Docker Compose | Kubernetes (prod) + Docker Compose (dev) | Horizontal scaling for match day load |
| **Monitoring** | None | Grafana + Prometheus | Know when data quality degrades |

### 4.3 Data Governance — Non-Negotiable Rules

Having seen analytics scandals destroy coach careers, I mandate the following:

1. **No automated selection output** — every recommendation is labelled "DRAFT" and requires a named human sign-off before circulation
2. **Immutable audit log** — every query, every export, every dossier view is logged with user identity, timestamp, and decision context
3. **Data lineage** — every metric must trace to source deliveries; no "trust me" computed columns
4. **Confidence must be visible** — if a metric has fewer than 10 data points, the UI shows "INSUFFICIENT DATA" not a number
5. **Opposition data is confidential** — analyst access to dossiers is logged; leaks can end careers and are a security issue, not a data issue
6. **Expiry on predictions** — any ML prediction older than 48 hours before a match must be regenerated; stale predictions are dangerous

---

## Part V: Specific Recommendations to Beat Australia, England, South Africa

### Beating Australia in Australia

Australia's pace attack (140+ kph) at MCG and SCG exploits two things:
1. **Bounce off a hard length** against batters who are strong on the front foot
2. **Lateral movement in the seam corridor** outside off-stump in the first 20 overs

**Analytics Required:**
- Build a "bounce vulnerability index" for every Indian batter (% times dismissed by balls over hip height)
- Identify which batters have >60% front-foot scoring — they need off-stump net practice simulation before the tour
- Bowl-length heat map for Mitchell Starc, Josh Hazlewood, Pat Cummins — this is available from CricInfo but must be systematically extracted and matched to our batters' dismissal zones

**Actionable Output for Coaches:**
```
PRE-TOUR ALERT: [Batter Name]
Bounce Vulnerability Index: HIGH
- 68% of dismissals in last 24 months came from balls above hip height
- 82% of short-pitch dismissals were off the front foot
- Hazlewood's primary delivery at MCG (back-of-a-length, 132 kph,
  seaming away) matches dismissal profile at 71% confidence
RECOMMENDED: 40 overs of short-pitch practice against left-arm pace
             before the Perth Test. Assign fielding in deep gully simulation.
[COACH APPROVAL REQUIRED BEFORE SHARING WITH PLAYER]
```

### Beating England in England

England's Bazball in 2022–24 is primarily about declaration aggression and team SR targets of 4.0+ in Tests. Their weakness:
- Fragile batting collapses when early wickets fall in seaming conditions (4 wins in 2024 series came after 40+ run partnerships but collapses triggered when SR < 2.0)
- Batter vulnerabilities to top-spinners who push it outside leg stump (Crawley, Root to away spin)

**Analytics Required:**
- Reverse-engineer England's "Bazball SR targets" — what run rate forces them into errors?
- Map Root's record against top-spin (wrist spin turning away) — it is the known gap
- Identify which England batters have low "Pressure Recovery Rate" — if they lose 2 wickets in 10 balls, which ones fail to reset?

### Beating South Africa in South Africa

Newlands Cape Town (swing), Wanderers Johannesburg (pace), Durban (spin/turn later) — each venue is a different match plan. South Africa's strength is seam movement in the first session. Their analytical weakness (visible in published data):
- Their batting middle-order has historically collapsed against high-quality off-spin in the 3rd innings of Tests
- Rabada's economy in the death overs of white-ball cricket has risen 15% since 2023 — suggesting a pattern that can be exploited

**Analytics Required:**
- Venue decomposition: Separate South Africa's home performance by pitch condition type (pace, swing, turn)
- Build a "conditions mismatch score" — where our bowlers' natural skills mismatch with the venue's pitch profile
- Track Rabada's delivery sequencing in death overs — CricViz data suggests he over-relies on the slower ball right, and smart data analysis of wagon wheels in last 3 overs can confirm the pattern

---

## Part VI: Investment & Resourcing

### 6.1 Team Structure

| Role | Phase | FTE | Skill Set |
|------|-------|-----|-----------|
| **Data Engineer** (Lead) | 1–4 | 1 | PostgreSQL, Kafka, Python ETL |
| **Data Engineer** (Junior) | 1–4 | 1 | Node.js, API integration, pipeline |
| **Analytics Engineer** | 2–4 | 1 | SQL analytics, statistical modelling |
| **ML Engineer** | 3–4 | 1 | Python, XGBoost, PyTorch, MLflow |
| **Backend Engineer** | 1–4 | 1 | Node.js/Express, API design |
| **Frontend Engineer** | 2–4 | 1 | React, D3.js / Recharts, dashboards |
| **Cricket Domain Expert** | 1–4 | 0.5 | Former analyst / senior coach — validates metric definitions |
| **DevOps / Platform** | 1–4 | 0.5 | Kubernetes, monitoring, security |

### 6.2 Data Licensing Budget (Estimated)

| Data Source | Estimated Annual Cost | What You Get |
|------------|----------------------|-------------|
| ESPNcricinfo Premium API | USD 15,000–25,000 | Scorecards, historical stats, ball-by-ball (limited) |
| StatsCricket / CricViz | USD 30,000–60,000 | Ball-by-ball international, pitch maps |
| Hawk-Eye Licensed Feed | USD 80,000–150,000 | Full trajectory data, pitch maps in real-time |
| TrackMan Radar (India only) | USD 20,000–40,000 | Bowling release metrics in nets/domestic |
| Video Broadcast Rights | Negotiated via BCCI/ICC | Clip licensing for computer vision training |

*Hawk-Eye is the single highest-value data source for pitch map work. Prioritise Phase 3 budget here.*

---

## Part VII: What Must NOT Be Built

Having watched systems fail across four decades, I offer equal weight to what to avoid:

1. **Do not build an automated selection engine.** Every cricket board that has tried this — and I have seen three — has eventually had the system blamed for a bad selection that a human made while following a flawed recommendation. The system's job is to eliminate surprises, not make decisions.

2. **Do not expose ML confidence scores as percentages.** "72% chance of dismissal" will be taken as gospel by coaches under pressure. Show it as a range: "between 60% and 85% based on 34 prior matchups." Ranges communicate uncertainty; point estimates create false confidence.

3. **Do not build a public-facing analytics dashboard.** Opposition analysts watch everything. Australia's analyst team monitored CricInfo's publicly accessible team data before the 2023 World Cup to refine their plans. Keep all competitive intelligence behind authentication with granular access logging.

4. **Do not skip the human review gate.** When a dossier or recommendation is generated, it must require a named human (coach or lead analyst) to mark it as "Reviewed and approved for circulation" before it goes to the captain or selection panel. This is not bureaucracy — it is the difference between analytics-informed selection and analytics-automated selection.

5. **Do not let data recency decay silently.** A player's form from 18 months ago is almost irrelevant. Build automatic staleness warnings: "This analysis is based on data that is 14 months old. Regenerate before the series."

---

## Part VIII: Immediate Next Steps (Next 90 Days)

These can begin without any budget approval — they use existing infrastructure:

### 8.1 Data Enrichment (No Cost)
- [ ] Add `match_type` field to all existing records (T20 / ODI / First-Class / List A) — currently not differentiated
- [ ] Add `over_band` classification to player stats queries (Powerplay / Middle / Death) — calculable from existing data
- [ ] Implement rolling-window views in the current SQLite: `CREATE VIEW v_rolling_12m_batting AS ...`
- [ ] Add `venue_name` and `match_date` to existing player stats where available in source JSON

### 8.2 Architecture Proof of Concept (Low Cost)
- [ ] Stand up a PostgreSQL 16 instance locally and migrate the HCA SQLite schema
- [ ] Validate all existing API queries perform correctly against PostgreSQL (syntax differences are minimal)
- [ ] Design the `ball_events` table schema; document how it would be populated from CricInfo if licensed

### 8.3 Domain Modelling (No Cost — Knowledge Work)
- [ ] Define the "Contextual Performance Metrics" with a cricket domain expert: what does a 1.0 Pressure Index look like? What score is "elite"?
- [ ] Map which of our target players have publicly available ball-by-ball data in CricInfo's free tier
- [ ] Identify one opposition team (start with England or Australia) and manually build a first-draft dossier from public data — this proves the dossier format works before any automation

### 8.4 UI Improvements (Current Stack — Hours, Not Weeks)
- [ ] Add "over band" filter to the player view (Powerplay / Middle / Death economy)
- [ ] Add tournament-type filter (T20 vs 50-over vs First-Class) — the data exists; the filter does not
- [ ] Replace the `X-Dev-Role` header mechanism with a login form and session cookie, even if it is not production auth — eliminate the security anti-pattern from all non-local environments

---

## Closing Assessment

The HCA SportsAnalyticTool is a foundation worth building on. It is more disciplined about evidence quality than systems I have seen deployed by Test-playing nations. The evidence tiering, the audit trail, the read-only access model, and the human review philosophy are correct.

But it is a domestic tournament tracker today. To beat Australia in Perth, England at Lord's, or South Africa at Newlands, you need ball-by-ball intelligence, opposition weakness maps, venue-calibrated selection analysis, and real-time match support.

The 36-month roadmap in this document closes that gap — phase by phase, without overbuilding, and without removing the human judgment that wins series.

The data does not win matches. Coaches and players win matches. The data eliminates the surprises that defeat them before they leave the dressing room.

---

*Document Status: DRAFT — Architecture Review Board Approval Required*  
*Next Review: After Phase 1 Milestone Completion*  
*Classification: CONFIDENTIAL — Coaching Staff and Architecture Team Only*