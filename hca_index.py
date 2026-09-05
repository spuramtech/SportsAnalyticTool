"""
Pull the player index from hycricket.org/HCA/fc-archive.htm and store
serial number, display name, and relative file URL into player_index table.
No individual page scraping — just the archive index.
"""

import sqlite3
import re
import requests
from bs4 import BeautifulSoup

ARCHIVE_URL = "https://www.hycricket.org/HCA/fc-archive.htm"
DB_PATH = r"d:\Personal\R&D\hca_players.db"


def setup_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS player_index (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            serial_no   INTEGER,
            name        TEXT NOT NULL,
            file_url    TEXT NOT NULL,
            era         TEXT,
            UNIQUE(file_url, serial_no)
        )
    """)
    conn.commit()


def era_from_url(url):
    if "fc_34-83" in url:
        return "1934-1983"
    if "fc_84-03" in url:
        return "1984-2003"
    if "fc_04-08" in url:
        return "2004-2008"
    return None


def fetch_index():
    print(f"Fetching {ARCHIVE_URL} ...")
    resp = requests.get(ARCHIVE_URL, timeout=20)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding or "utf-8"
    soup = BeautifulSoup(resp.text, "html.parser")

    players = []

    # Structure: each row has 3 TDs — serial no | player name | "Click Here" link
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href.startswith("hyd_fc/"):
            continue

        tr = a.find_parent("tr")
        if not tr:
            continue

        cells = tr.find_all("td")
        if len(cells) < 3:
            continue

        # Cell 0: serial number
        serial_text = cells[0].get_text(" ", strip=True)
        serial_no = int(re.sub(r"[^\d]", "", serial_text)) if re.search(r"\d", serial_text) else None

        # Cell 1: player name — collapse internal whitespace
        name_text = " ".join(cells[1].get_text(" ", strip=True).split())

        if name_text:
            players.append((serial_no, name_text, href))

    return players


def main():
    players = fetch_index()
    print(f"Found {len(players)} entries on the archive page.")

    conn = sqlite3.connect(DB_PATH)
    setup_table(conn)

    inserted = 0
    skipped = 0
    for serial_no, name, file_url in players:
        era = era_from_url(file_url)
        try:
            conn.execute(
                "INSERT OR IGNORE INTO player_index (serial_no, name, file_url, era) VALUES (?,?,?,?)",
                (serial_no, name, file_url, era),
            )
            if conn.execute("SELECT changes()").fetchone()[0]:
                inserted += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"  Error inserting {name}: {e}")

    conn.commit()

    total = conn.execute("SELECT COUNT(*) FROM player_index").fetchone()[0]
    print(f"Inserted: {inserted}  |  Skipped (duplicate): {skipped}  |  Total in DB: {total}")

    print("\nSample rows:")
    for row in conn.execute("SELECT serial_no, name, file_url, era FROM player_index ORDER BY serial_no LIMIT 10"):
        print(f"  {row[0]:>4}  {row[1]:<45}  {row[2]:<50}  {row[3]}")

    conn.close()
    print(f"\nDB: {DB_PATH}")


if __name__ == "__main__":
    main()