# PDF Player Registration → DB Mapping Design

**Source PDF:** `docs/001-B-Div-team-regd-players (3).pdf`
**What it contains:** HCA official player registration list for B-Division 2-Day Tournament, season 2024-25
**Why it matters:** The PDF is the only source in this project that contains actual Date of Birth for players

---

## 1. What Was Confirmed in the PDF (Actual Data)

| Property | Confirmed Value |
|---|---|
| Pages | 61 |
| Estimated players | ~818 (counted HCA-prefixed ID lines) |
| Division | B-Division, 2-Day Tournament only |
| Season | 2024-25 |
| Clubs covered | ~70 clubs (Adilabad District → West Marredpally, alphabetical) |

### Column structure (repeats as a 6-line block per page header, then player rows)

```
Player_ID         → HCA registration format: HCAx00000  (e.g. HCAA00320, HCAK00502)
Player Name       → Full name in CAPS           (e.g. KAIF, ADE SANTOSH, YELKATURI ROHITH)
Registered Club   → Club or district name       (e.g. Adilabad District, Agarwal Seniors)
Date Of Birth     → Spelled out                 (e.g. 18 September 2005, 30 August 1977)
Aadhar Number     → 12-digit plain text         (e.g. 881262837135)
Contacts          → Phone with 91 prefix        (e.g. 917416514802)
```

Each page repeats the 6-line header block before its player rows. PyMuPDF (`import pymupdf`) is already installed on this machine and reads all pages correctly via `page.get_text()`.

---

## 2. What Is in the Database (Confirmed)

| Property | Confirmed Value |
|---|---|
| Total unique players | 8,730 |
| Player ID format in DB | UUID-like hex string (e.g. `2024f215a1f9503311ef9a9902b8edf`) |
| HCA-prefixed IDs in DB | **Zero** — the `HCAx00000` format does not exist anywhere in the DB |
| Date of Birth in DB | **Not present** — no DOB column in any table |
| Key name fields | `player_name` (mixed case, inconsistent), `team_name` |

The DB player ID (UUID) and the PDF Player_ID (`HCAx00000`) are from **two entirely separate systems**. There is no shared key to join them directly.

---

## 3. The Core Mapping Problem

There is no foreign key. The only bridge between the PDF and the DB is:

> **Normalised player name + normalised club name → look up in DB**

### Confirmed name variation patterns (from actual data inspection)

| PDF name | DB name | Issue |
|---|---|---|
| `ADE SANTOSH` | `Ade Santhosh` | Case + spelling variant ("SANT" vs "SANTH") |
| `AMGOTH SRIKANTH` | `AMGOTH  SRIKANTH` | Double space in DB |
| `AKARAM HARSHITH` | `AKARAM HARSHITH` | Exact match (3 DB entries across 3 teams) |
| `CHANDAN` | `CHANDAN` | Single name — multiple DB entries from different teams |
| `ANAS` | `ANAS` | Single name — 3 DB matches from 3 different teams |
| `KAIF` | *(not found in DB)* | May be in failed feeds or different division |
| `BUSHISAIVAMSHI` | `BUSHISAIVAMSHI` | Exact match, unique — high confidence |

### Confirmed club name variations

| PDF club | DB team_name examples |
|---|---|
| `Mahbubnagar District` | `Mahbubnagar District`, `Mahbubnagar District (Under - 16)`, `Mahbubnagar District (Under - 19)` |
| `Adilabad District` | `Adilabad District`, `Adilabad District (U14)`, `Adilabad District (Under - 16)` |

The DB appends age-group suffixes when the same club appears in age-group tournaments. A normalisation step (strip known suffixes) is required before matching.

---

## 4. Python Extraction Approach

### 4.1 Library

`pymupdf` (already installed). Use `page.get_text()` which returns text in reading order.

### 4.2 Parsing strategy

The page layout is consistent: **each page has a fixed 6-line header block at the top**, then player records follow. Each player record is exactly **6 consecutive lines** in the same column order as the header.

```
Line 0 → Player_ID      (starts with "HCA")
Line 1 → Player Name
Line 2 → Registered Club
Line 3 → Date of Birth
Line 4 → Aadhar Number  (12 digits)
Line 5 → Contact        (10-13 digits starting with 91)
```

The page header block to skip contains:
```
"Player_ ID"
"Player Name"
"Registered Club"
"Date Of Birth"
"Aadhar Number"
"Contacts"
```
And a title line: `"HCA: LIST OF REGISTERED PLAYERS FOR THE SEASON 2024-25"` and `"B-DIVISION TEAMS FOR 2 DAY TOURNAMENT"`.

After stripping those fixed header lines from each page's text, every remaining 6-line group is one player record.

### 4.3 DOB parsing

DOB is spelled out ("18 September 2005"). Python's `datetime.strptime(dob, "%d %B %Y")` handles this directly.

### 4.4 Normalisation before matching

Apply to both the PDF values and the DB values before any comparison:

```
1. Convert to UPPERCASE
2. Strip leading/trailing whitespace
3. Collapse multiple internal spaces to one
4. Remove known DB suffixes from team names:
   " (Under - 16)", " (Under - 19)", " (Under - 23)", " (U14)", " -  16", " (Under -19)"
5. Remove common initials style differences ("B SRIKANTH" → keep as-is; "SRIKANTH B" → keep as-is)
```

### 4.5 Matching tiers

Run in this order. Stop at the first tier that produces a single unambiguous DB match.

**Tier 1 — Exact match (high confidence)**
Normalised PDF name == Normalised DB name  
AND  
Normalised PDF club == Normalised DB team_name (with suffix stripped)

→ Accept automatically. Expected to cover the majority of common, unique-name players.

**Tier 2 — Fuzzy name + exact club (medium confidence)**
Use `difflib.SequenceMatcher` or `rapidfuzz.fuzz.token_sort_ratio` on the name.
Score ≥ 90 + exact normalised club match → flag for human review, do not auto-accept.

Common cause: spelling variants ("SANTOSH" / "SANTHOSH"), missing initials, double spaces.

**Tier 3 — Exact name + fuzzy club (medium confidence)**
Exact normalised name + club similarity ≥ 85.
Flag for human review.

**Tier 4 — Both fuzzy (low confidence)**
Do not auto-accept. Produce a review report only.

**No match**
Log to an unmatched list. Do not guess. These require a separate PDF from another division or manual lookup.

---

## 5. Confidence Killers (Known from Data)

These situations will produce false positives if not handled explicitly:

| Situation | Example from data | Safe handling |
|---|---|---|
| Single-name players, same club in PDF but multiple age-group variants in DB | "ANAS" in Adilabad District — DB has "Adilabad District", "(Under -16)", "(Under -16)" variants | Match only the base club (no age suffix); if still > 1 result, flag |
| Same name, genuinely different clubs | "AKARAM HARSHITH" appears in DB under Mahbubnagar District, Under-16, and Under-19 | After normalising club suffix, if exactly 1 base-club match → accept; if multiple base clubs → flag |
| Name appears in DB but not in PDF's B-Division clubs | "KAIF" in DB: not found | Log as unmatched — likely plays in a different division or had a failed feed |
| DOB anomaly in PDF | `HCAK00512 / ISHANTH / Adilabad District / 5 May 2024` — born in 2024, cannot be a cricket player | Validate DOB makes sense (age 8–60); log anomalies |

---

## 6. PII Handling — What NOT to Store

The PDF contains sensitive personal data. The DB should receive:

| Field | Store? | Reason |
|---|---|---|
| Date of Birth | **Yes** — this is the purpose | Needed for age calculation |
| HCA Player ID (`HCAx00000`) | **Yes** — useful for future PDF cross-references | Not sensitive |
| Aadhar Number | **No** | PII — regulated identifier; do not store in plain text |
| Contact (phone) | **No** | PII |

---

## 7. DB Changes Required

One new table to hold the mapping results without altering existing tables:

```sql
CREATE TABLE IF NOT EXISTS player_registration (
  hca_reg_id     TEXT PRIMARY KEY,       -- e.g. HCAA00320
  player_id      TEXT,                   -- FK → player_stats.player_id (nullable if unmatched)
  full_name_pdf  TEXT NOT NULL,          -- name as it appears in PDF
  club_pdf       TEXT NOT NULL,          -- club as it appears in PDF
  date_of_birth  TEXT,                   -- ISO 8601: YYYY-MM-DD
  match_tier     INTEGER,                -- 1=exact, 2=fuzzy-name, 3=fuzzy-club, NULL=unmatched
  match_status   TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected | review
  source_pdf     TEXT NOT NULL           -- filename of source PDF
);
```

Age is **computed on-demand** from `date_of_birth` and a reference date — it is not stored as a column, because age is a derived value that changes over time.

---

## 8. Coverage Reality Check

| Scope | Count |
|---|---|
| Players in PDF | ~818 |
| Players in DB total | 8,730 |
| PDF covers B-Division only — similar PDFs would be needed for A, C, D divisions | Unknown |
| DB players with no age-group tournament (no indirect age signal either) | 4,138 |
| DB players who play B-Division tournaments | Confirmed overlap by team names above |

Even with a perfect match rate, this PDF covers at most ~9% of the DB player population. To achieve meaningful coverage, equivalent PDFs for A-Division, C-Division, and the age-group registration lists would need to be processed with the same pipeline.

---

## 9. Script Outline (what to build, not the code)

```
pdf_to_db_mapping.py
├── extract_pdf_records(pdf_path)
│     Opens PDF with pymupdf, iterates pages,
│     strips header lines, groups remaining lines into 6-line player records,
│     parses DOB with strptime, validates DOB range (1960–2016),
│     returns list of dicts: {hca_id, name, club, dob}
│
├── load_db_players(db_path)
│     Reads player_stats + team names from SQLite,
│     returns list: {player_id, player_name, team_name}
│
├── normalise(text)
│     Upper, strip, collapse spaces, strip age-group suffixes from club names
│
├── match_players(pdf_records, db_players)
│     For each PDF record, run Tier 1 → 4 in order,
│     returns match result with tier and matched player_id (or None)
│
├── write_results(matches, db_path)
│     Inserts into player_registration table,
│     writes unmatched list to a review CSV
│
└── main()
      Calls above in sequence, prints summary:
      matched (Tier 1), flagged (Tier 2-3), unmatched, anomalies
```

---

## 10. What This Gives Once Done

For any player with a match:
- Exact age on the day of any tournament (`tournament.start_date` − `date_of_birth`)
- Confirmation of whether they played above their registered age group (e.g., a 2005-born player in a U19 2024 tournament is fine; the same player in a senior 2024 tournament is noteworthy)
- A permanent HCA registration anchor that future PDFs can join against without re-matching names

For the **~4,138 DB players with no age-group tournament signal at all**, this PDF is the only current data source that could provide an age anchor.
