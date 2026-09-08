"""Extract HCA Results match data into a resumable SQLite database."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import sqlite3
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BASE_URL = "https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds"
DEFAULT_DB = Path("data/hca_results.sqlite")
DEFAULT_RAW = Path("data/results_raw")
SEASON_IDS = {"2024": "113", "2025": "114", "2026": "115"}


def parse_jsonp(text: str) -> dict[str, Any]:
    start = text.find("(")
    end = text.rfind(")")
    if start < 0 or end <= start:
        raise ValueError("response is not a JSONP object")
    payload = json.loads(text[start + 1 : end])
    if not isinstance(payload, dict):
        raise ValueError("JSONP payload is not an object")
    return payload


def fetch_jsonp(url: str, retries: int = 3) -> tuple[str, dict[str, Any]]:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "HCA-results-analytics/1.0"},
            )
            with urllib.request.urlopen(request, timeout=45) as response:
                text = response.read().decode("utf-8")
            return text, parse_jsonp(text)
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
            last_error = error
            if attempt + 1 < retries:
                time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(str(last_error or "feed request failed"))


def feed_url(name: str) -> str:
    return f"{BASE_URL}/{name}"


def raw_path(raw_root: Path, match_id: int, feed_type: str) -> Path:
    directory = raw_root / str(match_id)
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{feed_type}.js"


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def source_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def setup_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS seasons (
            season_id TEXT PRIMARY KEY,
            season_year INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS competitions (
            competition_id INTEGER PRIMARY KEY,
            season_id TEXT NOT NULL,
            name TEXT,
            competition_type TEXT,
            raw_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS matches (
            match_id INTEGER PRIMARY KEY,
            competition_id INTEGER,
            season_id TEXT,
            match_status TEXT,
            match_date TEXT,
            match_type TEXT,
            team1_id INTEGER,
            team1_name TEXT,
            team2_id INTEGER,
            team2_name TEXT,
            toss_team TEXT,
            toss_details TEXT,
            result_text TEXT,
            points_text TEXT,
            ground_id INTEGER,
            ground_name TEXT,
            city TEXT,
            target TEXT,
            revised_overs TEXT,
            revised_target TEXT,
            required_run_rate TEXT,
            umpire1 TEXT,
            umpire2 TEXT,
            third_umpire TEXT,
            referee TEXT,
            raw_schedule_json TEXT,
            raw_summary_json TEXT
        );
        CREATE TABLE IF NOT EXISTS teams (
            team_id INTEGER PRIMARY KEY,
            team_name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS match_teams (
            match_id INTEGER NOT NULL,
            team_id INTEGER,
            team_name TEXT,
            batting_order INTEGER,
            PRIMARY KEY (match_id, team_id)
        );
        CREATE TABLE IF NOT EXISTS players (
            player_id TEXT PRIMARY KEY,
            player_name TEXT
        );
        CREATE TABLE IF NOT EXISTS match_squads (
            match_id INTEGER NOT NULL,
            team_id INTEGER,
            team_name TEXT,
            player_id TEXT,
            player_name TEXT,
            source_group TEXT,
            PRIMARY KEY (match_id, team_id, player_name)
        );
        CREATE TABLE IF NOT EXISTS officials (
            match_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            name TEXT,
            PRIMARY KEY (match_id, role)
        );
        CREATE TABLE IF NOT EXISTS innings (
            match_id INTEGER NOT NULL,
            innings_no INTEGER NOT NULL,
            batting_team_id INTEGER,
            bowling_team_id INTEGER,
            raw_json TEXT NOT NULL,
            PRIMARY KEY (match_id, innings_no)
        );
        CREATE TABLE IF NOT EXISTS batting_cards (
            match_id INTEGER NOT NULL,
            innings_no INTEGER NOT NULL,
            player_id TEXT,
            player_name TEXT,
            team_id INTEGER,
            runs REAL,
            balls REAL,
            fours REAL,
            sixes REAL,
            strike_rate REAL,
            dot_balls REAL,
            out_desc TEXT,
            raw_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bowling_cards (
            match_id INTEGER NOT NULL,
            innings_no INTEGER NOT NULL,
            player_id TEXT,
            player_name TEXT,
            team_id INTEGER,
            overs TEXT,
            maidens REAL,
            runs REAL,
            wickets REAL,
            wides REAL,
            no_balls REAL,
            economy REAL,
            legal_balls REAL,
            dot_balls REAL,
            raw_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ball_events (
            match_id INTEGER NOT NULL,
            innings_no INTEGER NOT NULL,
            ball_unique_id TEXT,
            over_no INTEGER,
            ball_no TEXT,
            batting_team_id INTEGER,
            striker_id TEXT,
            striker_name TEXT,
            non_striker_id TEXT,
            non_striker_name TEXT,
            bowler_id TEXT,
            bowler_name TEXT,
            runs REAL,
            bat_runs REAL,
            extras REAL,
            wides REAL,
            no_balls REAL,
            byes REAL,
            leg_byes REAL,
            is_dot INTEGER,
            is_four INTEGER,
            is_six INTEGER,
            is_wicket INTEGER,
            wicket_type TEXT,
            dismissed_player_id TEXT,
            commentary TEXT,
            new_commentary TEXT,
            x_pitch TEXT,
            y_pitch TEXT,
            video_file TEXT,
            raw_json TEXT NOT NULL,
            PRIMARY KEY (match_id, innings_no, ball_unique_id)
        );
        CREATE TABLE IF NOT EXISTS fall_of_wickets (
            match_id INTEGER NOT NULL,
            innings_no INTEGER NOT NULL,
            wicket_no INTEGER,
            player_id TEXT,
            player_name TEXT,
            score REAL,
            fall_over TEXT,
            raw_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS partnerships (
            match_id INTEGER NOT NULL,
            innings_no INTEGER NOT NULL,
            row_number INTEGER,
            striker_id TEXT,
            striker_name TEXT,
            non_striker_id TEXT,
            non_striker_name TEXT,
            partnership_total REAL,
            striker_runs REAL,
            striker_balls REAL,
            extras REAL,
            non_striker_runs REAL,
            non_striker_balls REAL,
            min_over TEXT,
            max_over TEXT,
            raw_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS source_feeds (
            source_url TEXT PRIMARY KEY,
            match_id INTEGER,
            feed_type TEXT,
            status TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            content_sha256 TEXT,
            raw_path TEXT,
            error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_matches_competition ON matches(competition_id);
        CREATE INDEX IF NOT EXISTS idx_matches_ground ON matches(ground_name);
        CREATE INDEX IF NOT EXISTS idx_ball_events_match_innings ON ball_events(match_id, innings_no, over_no);
        CREATE INDEX IF NOT EXISTS idx_ball_events_players ON ball_events(striker_id, bowler_id);
        CREATE INDEX IF NOT EXISTS idx_batting_player ON batting_cards(player_id);
        CREATE INDEX IF NOT EXISTS idx_bowling_player ON bowling_cards(player_id);
        """
    )


def is_result(row: dict[str, Any]) -> bool:
    status = str(row.get("MatchStatus") or "").lower()
    text = " ".join(
        str(row.get(key) or "")
        for key in ("Comments", "Commentss", "Result", "MatchComment")
    ).lower()
    if any(token in status for token in ("live", "upcoming", "fixture", "scheduled")):
        return False
    if any(token in status for token in ("complete", "result", "end", "abandon", "cancel")):
        return True
    return any(token in text for token in (" won ", "tied", "draw", "no result", "abandon")) or bool(
        row.get("IsMatchEnd")
    )


def value(row: dict[str, Any], key: str) -> Any:
    return row.get(key)


def delete_match(connection: sqlite3.Connection, match_id: int) -> None:
    for table in (
        "match_teams",
        "match_squads",
        "officials",
        "innings",
        "batting_cards",
        "bowling_cards",
        "ball_events",
        "fall_of_wickets",
        "partnerships",
    ):
        connection.execute(f"DELETE FROM {table} WHERE match_id = ?", (match_id,))
    connection.execute("DELETE FROM matches WHERE match_id = ?", (match_id,))
    connection.execute("DELETE FROM source_feeds WHERE match_id = ?", (match_id,))


def record_feed(
    connection: sqlite3.Connection,
    url: str,
    match_id: int | None,
    feed_type: str,
    status: str,
    content: str | None,
    path: Path | None,
    error: str | None = None,
) -> None:
    connection.execute(
        """INSERT OR REPLACE INTO source_feeds
        (source_url, match_id, feed_type, status, fetched_at, content_sha256, raw_path, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            url,
            match_id,
            feed_type,
            status,
            datetime.now(timezone.utc).isoformat(),
            source_hash(content) if content else None,
            str(path) if path else None,
            error,
        ),
    )


def save_feed(
    connection: sqlite3.Connection,
    raw_root: Path,
    url: str,
    match_id: int,
    feed_type: str,
) -> dict[str, Any] | None:
    try:
        content, payload = fetch_jsonp(url)
        path = raw_path(raw_root, match_id, feed_type)
        path.write_text(content, encoding="utf-8")
        record_feed(connection, url, match_id, feed_type, "success", content, path)
        return payload
    except Exception as error:
        record_feed(connection, url, match_id, feed_type, "failed", None, None, str(error))
        return None


def insert_summary(connection: sqlite3.Connection, schedule: dict[str, Any], summary: dict[str, Any]) -> None:
    row = summary.get("MatchSummary", [{}])[0] if summary.get("MatchSummary") else schedule
    match_id = int(row.get("MatchID") or schedule.get("MatchID"))
    connection.execute(
        """INSERT OR REPLACE INTO matches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            match_id, row.get("CompetitionID"), str(row.get("SeasonID") or ""), row.get("MatchStatus") or schedule.get("MatchStatus"),
            row.get("MatchDate") or schedule.get("MatchDate"), row.get("MatchType") or schedule.get("MatchType"),
            row.get("Team1ID") or schedule.get("FirstBattingTeamID"), row.get("Team1") or schedule.get("FirstBattingTeamName"),
            row.get("Team2ID") or schedule.get("SecondBattingTeamID"), row.get("Team2") or schedule.get("SecondBattingTeamName"),
            row.get("TossTeam") or schedule.get("TossTeam"), row.get("TossDetails") or schedule.get("TossDetails"),
            row.get("Comments") or row.get("Commentss") or schedule.get("Comments"), row.get("PointsComments"),
            row.get("GroundID") or schedule.get("GroundID"), row.get("GroundName") or schedule.get("GroundName"),
            row.get("city") or schedule.get("city"), row.get("Target"), row.get("RevisedOver"), row.get("RevisedTarget"),
            row.get("RequiredRunRate"), row.get("Umpire1Name") or row.get("GroundUmpire1"),
            row.get("Umpire2Name") or row.get("GroundUmpire2"), row.get("ThirdUmpire") or row.get("ThirdUmpireName"),
            row.get("Referee") or row.get("RefereeName"), json_text(schedule), json_text(row),
        ),
    )
    match_teams = [
        (row.get("Team1ID") or schedule.get("FirstBattingTeamID"), row.get("Team1") or schedule.get("FirstBattingTeamName"), 1),
        (row.get("Team2ID") or schedule.get("SecondBattingTeamID"), row.get("Team2") or schedule.get("SecondBattingTeamName"), 2),
    ]
    for team_id, team_name, order in match_teams:
        if team_id is None and not team_name:
            continue
        connection.execute("INSERT OR IGNORE INTO teams(team_id, team_name) VALUES (?, ?)", (team_id, team_name or ""))
        connection.execute("INSERT OR REPLACE INTO match_teams VALUES (?, ?, ?, ?)", (match_id, team_id, team_name, order))
    officials = {
        "ground_umpire_1": row.get("GroundUmpire1") or row.get("Umpire1Name"),
        "ground_umpire_2": row.get("GroundUmpire2") or row.get("Umpire2Name"),
        "third_umpire": row.get("ThirdUmpire") or row.get("ThirdUmpireName"),
        "referee": row.get("Referee") or row.get("RefereeName"),
    }
    for role, name in officials.items():
        connection.execute("INSERT OR REPLACE INTO officials VALUES (?, ?, ?)", (match_id, role, name))


def insert_squad(connection: sqlite3.Connection, match_id: int, payload: dict[str, Any]) -> None:
    for group in ("squadA", "squadB"):
        for row in payload.get(group, []) or []:
            team_name = row.get("TeamName")
            player_name = str(row.get("PlayerName") or "").strip()
            if not player_name:
                continue
            connection.execute(
                "INSERT OR REPLACE INTO match_squads VALUES (?, ?, ?, ?, ?, ?)",
                (match_id, None, team_name, None, player_name, group),
            )


def insert_innings(connection: sqlite3.Connection, match_id: int, innings_no: int, payload: dict[str, Any]) -> int:
    innings = payload.get(f"Innings{innings_no}", payload)
    batting = innings.get("BattingCard", []) or []
    bowling = innings.get("BowlingCard", []) or []
    over_history = innings.get("OverHistory", []) or []
    if not batting and not bowling and not over_history:
        return 0
    batting_team_id = batting[0].get("TeamID") if batting else None
    bowling_team_id = bowling[0].get("TeamID") if bowling else None
    connection.execute(
        "INSERT OR REPLACE INTO innings VALUES (?, ?, ?, ?, ?)",
        (match_id, innings_no, batting_team_id, bowling_team_id, json_text(innings)),
    )
    for row in batting:
        player_id = str(row.get("PlayerID") or row.get("PLAYER_ID") or "")
        name = str(row.get("PlayerName") or "").strip()
        if player_id:
            connection.execute("INSERT OR REPLACE INTO players VALUES (?, ?)", (player_id, name))
        connection.execute(
            """INSERT INTO batting_cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (match_id, innings_no, player_id, name, row.get("TeamID"), row.get("Runs"), row.get("Balls"),
             row.get("Fours"), row.get("Sixes"), row.get("StrikeRate"), row.get("DotBalls"), row.get("OutDesc"), json_text(row)),
        )
    for row in bowling:
        player_id = str(row.get("PlayerID") or "")
        name = str(row.get("PlayerName") or "").strip()
        if player_id:
            connection.execute("INSERT OR REPLACE INTO players VALUES (?, ?)", (player_id, name))
        connection.execute(
            """INSERT INTO bowling_cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (match_id, innings_no, player_id, name, row.get("TeamID"), row.get("Overs"), row.get("Maidens"),
             row.get("Runs"), row.get("Wickets"), row.get("Wides"), row.get("NoBalls"), row.get("Economy"),
             row.get("TotalLegalBallsBowled"), row.get("DotBalls"), json_text(row)),
        )
    for row in over_history:
        connection.execute(
            """INSERT OR REPLACE INTO ball_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (match_id, innings_no, row.get("BallUniqueID") or row.get("BallID"), row.get("OverNo"), row.get("BallNo"),
             row.get("BattingTeamID"), row.get("StrikerID"), row.get("BatsManName"), row.get("NonStrikerID"),
             row.get("NonStrikerName"), row.get("BowlerID"), row.get("BowlerName"), row.get("Runs"), row.get("RunRuns") or row.get("BallRuns"),
             row.get("Extras"), row.get("IsWide"), row.get("IsNoBall"), row.get("IsBye"), row.get("IsLegBye"), row.get("IsDotball"),
             row.get("IsFour"), row.get("IsSix"), row.get("IsWicket"), row.get("WicketType"), row.get("OutBatsManID"),
             row.get("Commentry"), row.get("NewCommentry"), row.get("Xpitch"), row.get("Ypitch"), row.get("VideoFile"), json_text(row)),
        )
    for row in innings.get("FallOfWickets", []) or []:
        connection.execute(
            "INSERT INTO fall_of_wickets VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (match_id, innings_no, row.get("FallWickets"), row.get("PlayerID"), row.get("PlayerName"), row.get("FallScore"), row.get("FallOvers"), json_text(row)),
        )
    for row in innings.get("PartnershipScores", []) or []:
        connection.execute(
            "INSERT INTO partnerships VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (match_id, innings_no, row.get("RowNumber"), row.get("StrikerID"), row.get("Striker"), row.get("NonStrikerID"),
             row.get("NonStriker"), row.get("PartnershipTotal"), row.get("StrikerRuns"), row.get("StrikerBalls"), row.get("Extras"),
             row.get("NonStrikerRuns"), row.get("NonStrikerBalls"), row.get("MatchMinOver"), row.get("MatchMaxOver"), json_text(row)),
        )
    return len(over_history)


def extract_match(db_path: Path, raw_root: Path, schedule: dict[str, Any], refresh: bool) -> dict[str, int]:
    match_id = int(schedule["MatchID"])
    connection = sqlite3.connect(db_path, timeout=60)
    connection.execute("PRAGMA journal_mode = WAL")
    try:
        existing = connection.execute("SELECT 1 FROM matches WHERE match_id = ?", (match_id,)).fetchone()
        if existing and not refresh:
            return {"matches": 0, "skipped": 1, "balls": 0, "failed": 0}
        if refresh:
            delete_match(connection, match_id)
        summary_url = feed_url(f"{match_id}-matchsummary.js")
        summary = save_feed(connection, raw_root, summary_url, match_id, "matchsummary")
        if summary is None:
            connection.commit()
            return {"matches": 0, "skipped": 0, "balls": 0, "failed": 1}
        insert_summary(connection, schedule, summary)
        squad = save_feed(connection, raw_root, feed_url(f"{match_id}-squad.js"), match_id, "squad")
        if squad:
            insert_squad(connection, match_id, squad)
        balls = 0
        failed = 0
        for innings_no in range(1, 5):
            payload = save_feed(connection, raw_root, feed_url(f"{match_id}-Innings{innings_no}.js"), match_id, f"innings{innings_no}")
            if payload is None:
                continue
            balls += insert_innings(connection, match_id, innings_no, payload)
        connection.commit()
        return {"matches": 1, "skipped": 0, "balls": balls, "failed": failed}
    finally:
        connection.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", nargs="+", default=["2024", "2025", "2026"], choices=sorted(SEASON_IDS))
    parser.add_argument("--competition-ids", nargs="*", type=int)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW)
    parser.add_argument("--workers", type=int, default=8, help="Parallel schedule feed workers")
    parser.add_argument("--refresh", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.db.parent.mkdir(parents=True, exist_ok=True)
    args.raw_dir.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(args.db)
    setup_database(connection)
    for year in args.years:
        connection.execute("INSERT OR REPLACE INTO seasons VALUES (?, ?)", (SEASON_IDS[year], int(year)))
    catalog_url = feed_url("competition.js")
    catalog_text, catalog = fetch_jsonp(catalog_url)
    catalog_path = args.raw_dir / "competition.js"
    catalog_path.write_text(catalog_text, encoding="utf-8")
    record_feed(connection, catalog_url, None, "competition", "success", catalog_text, catalog_path)
    competitions = [item for item in catalog.get("competition", []) if str(item.get("SeasonID")) in {SEASON_IDS[y] for y in args.years}]
    if args.competition_ids:
        competitions = [item for item in competitions if int(item["CompetitionID"]) in args.competition_ids]
    for item in competitions:
        competition_id = int(item["CompetitionID"])
        connection.execute(
            "INSERT OR REPLACE INTO competitions VALUES (?, ?, ?, ?, ?)",
            (competition_id, str(item.get("SeasonID")), item.get("CompetitionName"), item.get("CompetitionType"), json_text(item)),
        )
        schedule_url = feed_url(f"{competition_id}-matchschedule.js")
        try:
            schedule_text, schedule_payload = fetch_jsonp(schedule_url)
            schedule_path = args.raw_dir / f"competition-{competition_id}-matchschedule.js"
            schedule_path.write_text(schedule_text, encoding="utf-8")
            record_feed(connection, schedule_url, None, "matchschedule", "success", schedule_text, schedule_path)
        except Exception as error:
            record_feed(connection, schedule_url, None, "matchschedule", "failed", None, None, str(error))
            continue
        matches = [row for row in schedule_payload.get("Matchsummary", []) if is_result(row)]
        jobs = [(item, row) for row in matches]
        for _, row in jobs:
            row["SeasonID"] = str(item.get("SeasonID"))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            futures = [executor.submit(extract_match, args.db, args.raw_dir, row, args.refresh) for _, row in jobs]
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                print(json.dumps(result))
    counts = {}
    for table in ("matches", "innings", "ball_events", "batting_cards", "bowling_cards", "fall_of_wickets", "partnerships", "source_feeds"):
        counts[table] = connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    failed = connection.execute("SELECT COUNT(*) FROM source_feeds WHERE status = 'failed'").fetchone()[0]
    connection.commit()
    connection.close()
    print(json.dumps({"database": str(args.db), "counts": counts, "failed_feeds": failed}, indent=2))


if __name__ == "__main__":
    main()
