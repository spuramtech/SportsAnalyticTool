"""
pdf_to_db_mapping.py

Extracts HCA player registration records from a PDF, matches them to
existing players in hca_analytics.sqlite by normalised name + club,
and writes the results (DOB, HCA ID, match quality) to a new
player_registration table.

Usage:
  python src/pdf_to_db_mapping.py
  python src/pdf_to_db_mapping.py --pdf docs/other.pdf --db data/hca_analytics.sqlite
  python src/pdf_to_db_mapping.py --dry-run

PII note: Aadhaar numbers and phone numbers are extracted but never stored.
"""

import re
import csv
import sys
import argparse
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from difflib import SequenceMatcher
from collections import defaultdict

# ── Attempt pymupdf import ────────────────────────────────────────────────────
try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        sys.exit("ERROR: pymupdf is not installed. Run: pip install pymupdf")

# ── Constants ─────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent

DEFAULT_PDF = ROOT / "docs" / "001-B-Div-team-regd-players (3).pdf"
DEFAULT_DB  = ROOT / "data" / "hca_analytics.sqlite"

# Lines that appear as fixed page header/footer — always skip
PAGE_HEADER_LINES = {
    "Player_ ID",
    "Player Name",
    "Registered Club",
    "Date Of Birth",
    "Aadhar Number",
    "Contacts",
    "HCA: LIST OF REGISTERED PLAYERS FOR THE SEASON 2024-25",
    "B-DIVISION TEAMS FOR 2 DAY TOURNAMENT",
}

# Age-group suffixes appended to team names in the DB — strip before matching
AGE_SUFFIXES = [
    r"\s*\(under\s*-\s*\d+\)",   # (Under - 16), (Under -19), (Under - 14)
    r"\s*\(u\d+\)",               # (U14), (U16), (U19)
    r"\s*-\s+\d+$",              # -  16 (as in "Karimnagar District  -  16")
    r"\s*\(junior\)",
]
AGE_SUFFIX_RE = re.compile("|".join(AGE_SUFFIXES), re.IGNORECASE)

# HCA registration ID pattern
HCA_ID_RE = re.compile(r"^HCA[A-Z]\d{4,6}$")

# DOB format in PDF
DOB_FMT = "%d %B %Y"

# Valid birth year window — reject clear data anomalies
MIN_BIRTH_YEAR = 1960
MAX_BIRTH_YEAR = 2016

# Fuzzy thresholds
FUZZY_NAME_THRESHOLD = 0.88   # for name similarity (Tier 2)
FUZZY_CLUB_THRESHOLD = 0.85   # for club similarity (Tier 3)

# ── Normalisation ─────────────────────────────────────────────────────────────

def norm_name(text: str) -> str:
    """Upper-case, collapse whitespace."""
    return re.sub(r"\s+", " ", (text or "").strip().upper())


def norm_club(text: str) -> str:
    """Upper-case, strip age-group suffixes, collapse whitespace."""
    text = re.sub(r"\s+", " ", (text or "").strip().upper())
    text = AGE_SUFFIX_RE.sub("", text).strip()
    return text


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()

# ── PDF extraction ────────────────────────────────────────────────────────────

def extract_pdf_records(pdf_path: Path) -> list[dict]:
    """
    Open the PDF and return a list of player record dicts.
    Each page has an 8-line fixed header block followed by
    strict 6-line player blocks:
      [0] HCA registration ID
      [1] Player name
      [2] Registered club
      [3] Date of birth  (kept)
      [4] Aadhaar number (discarded — PII)
      [5] Phone contact  (discarded — PII)
    """
    doc = fitz.open(str(pdf_path))
    print(f"  PDF opened: {len(doc)} pages")

    # Collect all meaningful lines across all pages in one pass
    all_lines = []
    for page in doc:
        for raw in page.get_text().split("\n"):
            line = raw.strip()
            if line and line not in PAGE_HEADER_LINES:
                all_lines.append(line)

    doc.close()

    # Scan for HCA IDs as anchors; extract the next 5 lines as the record
    records = []
    anomalies = []
    i = 0
    while i < len(all_lines):
        line = all_lines[i]
        if HCA_ID_RE.match(line):
            if i + 5 < len(all_lines):
                hca_id   = line
                name     = all_lines[i + 1]
                club     = all_lines[i + 2]
                dob_str  = all_lines[i + 3]
                # all_lines[i+4] = Aadhaar — not stored
                # all_lines[i+5] = Contact  — not stored

                dob = _parse_dob(dob_str)
                if dob is None:
                    anomalies.append({"hca_id": hca_id, "name": name, "issue": f"Cannot parse DOB: {dob_str!r}"})
                    i += 6
                    continue
                if not (MIN_BIRTH_YEAR <= dob.year <= MAX_BIRTH_YEAR):
                    anomalies.append({"hca_id": hca_id, "name": name, "issue": f"DOB year {dob.year} out of expected range"})
                    i += 6
                    continue

                records.append({
                    "hca_id": hca_id,
                    "name":   name.strip(),
                    "club":   club.strip(),
                    "dob":    dob.isoformat(),   # stored as YYYY-MM-DD
                })
                i += 6
            else:
                i += 1
        else:
            i += 1

    print(f"  Extracted: {len(records)} valid player records, {len(anomalies)} anomalies skipped")
    if anomalies:
        for a in anomalies:
            print(f"    ANOMALY: {a['hca_id']} / {a['name']} — {a['issue']}")

    return records


def _parse_dob(dob_str: str):
    try:
        return datetime.strptime(dob_str.strip(), DOB_FMT).date()
    except ValueError:
        return None

# ── DB player loading ─────────────────────────────────────────────────────────

def load_db_players(db_path: Path) -> list[dict]:
    """
    Load all unique (player_id, player_name, team_name) rows from player_stats.
    Deduplicate: one player can appear across many tournaments — we want
    one canonical row per (player_id, base_club) pair.
    """
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.execute(
        "SELECT DISTINCT player_id, player_name, team_name FROM player_stats"
        " WHERE player_name IS NOT NULL AND team_name IS NOT NULL"
    )
    rows = cur.fetchall()
    conn.close()

    players = []
    seen = set()
    for r in rows:
        pid     = r["player_id"]
        pname   = r["player_name"]
        tname   = r["team_name"]
        nn      = norm_name(pname)
        nc      = norm_club(tname)
        key     = (pid, nc)
        if key in seen:
            continue
        seen.add(key)
        players.append({
            "player_id":  pid,
            "player_name": pname,
            "team_name":   tname,
            "norm_name":   nn,
            "norm_club":   nc,
        })

    print(f"  DB loaded: {len(players)} unique (player_id, base_club) entries from player_stats")
    return players


def _build_index(db_players: list[dict]) -> dict:
    """
    Index: norm_club → { norm_name → [player_id] }
    Used for fast club-scoped lookup before fuzzy search.
    """
    idx = defaultdict(lambda: defaultdict(list))
    for p in db_players:
        idx[p["norm_club"]][p["norm_name"]].append(p["player_id"])
    return idx

# ── Matching ──────────────────────────────────────────────────────────────────

def match_players(pdf_records: list[dict], db_players: list[dict]) -> list[dict]:
    """
    Match each PDF record to a DB player_id using a 3-tier strategy.

    Tier 1 — exact normalised name + exact normalised club  → auto-accept
    Tier 2 — fuzzy name (≥88%) + exact club                → flag for review
    Tier 3 — exact name + fuzzy club (≥85%)                → flag for review
    No match                                                → unmatched
    """
    idx = _build_index(db_players)

    # Also build a name-only index for Tier 3
    name_idx = defaultdict(list)
    for p in db_players:
        name_idx[p["norm_name"]].append(p)

    results = []
    counters = {"t1": 0, "t2": 0, "t3": 0, "unmatched": 0}

    for rec in pdf_records:
        nn = norm_name(rec["name"])
        nc = norm_club(rec["club"])
        result_base = {
            "hca_id":    rec["hca_id"],
            "name_pdf":  rec["name"],
            "club_pdf":  rec["club"],
            "dob":       rec["dob"],
        }

        # ── Tier 1: exact name + exact club ───────────────────────────────
        t1_ids = _unique_ids(idx[nc].get(nn, []))
        if len(t1_ids) == 1:
            counters["t1"] += 1
            results.append({**result_base, "player_id": t1_ids[0],
                            "tier": 1, "status": "accepted", "score": 1.0,
                            "db_name": None, "db_club": None})
            continue
        if len(t1_ids) > 1:
            # Same name+club → multiple player_ids (duplicate DB entries)
            results.append({**result_base, "player_id": "|".join(t1_ids),
                            "tier": 1, "status": "review",
                            "score": 1.0, "note": "multiple player_ids for same name+club",
                            "db_name": None, "db_club": None})
            continue

        # ── Tier 2: fuzzy name + exact club ───────────────────────────────
        club_players = [p for players in idx[nc].values() for p in
                        [{"norm_name": n, "player_id": pid}
                         for n, ids in idx[nc].items() for pid in ids]]
        # Rebuild properly
        club_entries = [(n, ids) for n, ids in idx[nc].items()]
        best_t2 = None
        best_score = 0.0
        for cname, ids in club_entries:
            s = similarity(nn, cname)
            if s >= FUZZY_NAME_THRESHOLD and s > best_score:
                best_score = s
                best_t2 = (cname, ids)

        if best_t2:
            cname, ids = best_t2
            uids = _unique_ids(ids)
            counters["t2"] += 1
            results.append({**result_base,
                            "player_id": uids[0] if len(uids) == 1 else "|".join(uids),
                            "tier": 2, "status": "review", "score": round(best_score, 3),
                            "db_name": cname, "db_club": nc})
            continue

        # ── Tier 3: exact name + fuzzy club ───────────────────────────────
        name_matches = name_idx.get(nn, [])
        best_t3 = None
        best_score = 0.0
        for p in name_matches:
            s = similarity(nc, p["norm_club"])
            if s >= FUZZY_CLUB_THRESHOLD and s > best_score:
                best_score = s
                best_t3 = p

        if best_t3:
            counters["t3"] += 1
            results.append({**result_base,
                            "player_id": best_t3["player_id"],
                            "tier": 3, "status": "review", "score": round(best_score, 3),
                            "db_name": best_t3["norm_name"], "db_club": best_t3["norm_club"]})
            continue

        # ── No match ──────────────────────────────────────────────────────
        counters["unmatched"] += 1
        results.append({**result_base, "player_id": None,
                        "tier": None, "status": "unmatched", "score": 0.0,
                        "db_name": None, "db_club": None})

    print(f"  Matching complete:")
    print(f"    Tier 1 (exact / auto-accept): {counters['t1']}")
    print(f"    Tier 2 (fuzzy name, review):  {counters['t2']}")
    print(f"    Tier 3 (fuzzy club, review):  {counters['t3']}")
    print(f"    Unmatched:                    {counters['unmatched']}")
    return results

def _unique_ids(ids: list) -> list:
    seen, out = set(), []
    for x in ids:
        if x not in seen:
            seen.add(x); out.append(x)
    return out

# ── DB schema setup ───────────────────────────────────────────────────────────

def setup_table(conn: sqlite3.Connection):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS player_registration (
            hca_reg_id    TEXT PRIMARY KEY,
            player_id     TEXT,
            full_name_pdf TEXT NOT NULL,
            club_pdf      TEXT NOT NULL,
            date_of_birth TEXT,
            match_tier    INTEGER,
            match_status  TEXT NOT NULL DEFAULT 'pending',
            match_score   REAL,
            db_name_match TEXT,
            db_club_match TEXT,
            source_pdf    TEXT NOT NULL,
            loaded_at     TEXT NOT NULL
        )
    """)
    conn.commit()

# ── Write results ─────────────────────────────────────────────────────────────

def write_results(matches: list[dict], db_path: Path, source_pdf: str, dry_run: bool):
    """
    Write accepted + review rows to player_registration table.
    Write review + unmatched rows to CSV files for human inspection.
    """
    now = datetime.now(timezone.utc).isoformat()

    review_path    = ROOT / "data" / "pdf_mapping_review.csv"
    unmatched_path = ROOT / "data" / "pdf_mapping_unmatched.csv"

    review_rows    = [m for m in matches if m["status"] == "review"]
    unmatched_rows = [m for m in matches if m["status"] == "unmatched"]
    accepted_rows  = [m for m in matches if m["status"] == "accepted"]

    # ── Write CSVs ────────────────────────────────────────────────────────
    _write_csv(review_path, review_rows,
               ["hca_id", "name_pdf", "club_pdf", "dob", "player_id",
                "tier", "score", "db_name", "db_club"])
    print(f"  Review CSV  → {review_path}  ({len(review_rows)} rows)")

    _write_csv(unmatched_path, unmatched_rows,
               ["hca_id", "name_pdf", "club_pdf", "dob"])
    print(f"  Unmatched CSV → {unmatched_path}  ({len(unmatched_rows)} rows)")

    if dry_run:
        print(f"  [DRY RUN] Skipping DB write. Would insert {len(matches)} rows into player_registration.")
        return

    # ── Write to DB ───────────────────────────────────────────────────────
    conn = sqlite3.connect(str(db_path))
    setup_table(conn)

    rows_inserted = 0
    rows_skipped  = 0
    for m in matches:
        try:
            cur = conn.execute("""
                INSERT OR IGNORE INTO player_registration
                (hca_reg_id, player_id, full_name_pdf, club_pdf, date_of_birth,
                 match_tier, match_status, match_score, db_name_match, db_club_match,
                 source_pdf, loaded_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                m["hca_id"],
                m.get("player_id"),
                m["name_pdf"],
                m["club_pdf"],
                m.get("dob"),
                m.get("tier"),
                m["status"],
                m.get("score"),
                m.get("db_name"),
                m.get("db_club"),
                source_pdf,
                now,
            ))
            if cur.rowcount:
                rows_inserted += 1
            else:
                rows_skipped += 1  # hca_reg_id already exists
        except sqlite3.Error as e:
            print(f"  DB ERROR for {m['hca_id']}: {e}")
            rows_skipped += 1

    conn.commit()

    # Quick validation
    total = conn.execute("SELECT COUNT(*) FROM player_registration").fetchone()[0]
    matched = conn.execute(
        "SELECT COUNT(*) FROM player_registration WHERE player_id IS NOT NULL"
    ).fetchone()[0]
    conn.close()

    print(f"  DB write complete: {rows_inserted} new, {rows_skipped} already existed (skipped)")
    print(f"  player_registration table: {total} total rows, {matched} with a player_id")


def _write_csv(path: Path, rows: list[dict], fields: list[str]):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

# ── CLI entrypoint ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Map HCA registration PDF to player DB")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF,
                        help="Path to the HCA registration PDF")
    parser.add_argument("--db",  type=Path, default=DEFAULT_DB,
                        help="Path to hca_analytics.sqlite")
    parser.add_argument("--dry-run", action="store_true",
                        help="Extract and match without writing to the DB")
    args = parser.parse_args()

    if not args.pdf.exists():
        sys.exit(f"ERROR: PDF not found: {args.pdf}")
    if not args.db.exists():
        sys.exit(f"ERROR: Database not found: {args.db}")

    print(f"\n{'='*60}")
    print(f"HCA PDF -> DB Player Mapping")
    print(f"PDF : {args.pdf.name}")
    print(f"DB  : {args.db}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'WRITE'}")
    print(f"{'='*60}\n")

    print("Step 1: Extracting records from PDF...")
    pdf_records = extract_pdf_records(args.pdf)

    print("\nStep 2: Loading existing players from DB...")
    db_players = load_db_players(args.db)

    print("\nStep 3: Matching...")
    matches = match_players(pdf_records, db_players)

    print("\nStep 4: Writing results...")
    write_results(matches, args.db, args.pdf.name, args.dry_run)

    accepted  = sum(1 for m in matches if m["status"] == "accepted")
    review    = sum(1 for m in matches if m["status"] == "review")
    unmatched = sum(1 for m in matches if m["status"] == "unmatched")

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"  Total PDF records : {len(pdf_records)}")
    print(f"  Auto-accepted     : {accepted}  ({accepted/len(pdf_records)*100:.1f}%)")
    print(f"  Needs review      : {review}  ({review/len(pdf_records)*100:.1f}%)")
    print(f"  Unmatched         : {unmatched}  ({unmatched/len(pdf_records)*100:.1f}%)")
    print(f"{'='*60}\n")

    if not args.dry_run:
        print(f"Next steps:")
        print(f"  1. Open data/pdf_mapping_review.csv — manually confirm or reject each row")
        print(f"     then UPDATE player_registration SET match_status='accepted'|'rejected'")
        print(f"  2. Open data/pdf_mapping_unmatched.csv — check if players exist in other divisions")
        print(f"  3. Add more division PDFs to increase coverage beyond B-Division")


if __name__ == "__main__":
    main()