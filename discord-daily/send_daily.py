#!/usr/bin/env python3
"""Invia il messaggio del giorno su un canale Discord tramite webhook.

I messaggi stanno in messages.txt, separati da una riga contenente solo `---`.
Ogni giorno viene scelto il messaggio successivo del pool (rotazione basata
sulla data): niente ripetizioni finché il pool non è esaurito, poi ricomincia.

Variabili d'ambiente:
  DISCORD_WEBHOOK_URL   (obbligatoria) URL del webhook del canale
  DISCORD_USERNAME      (opzionale) nome mostrato sul messaggio
  DISCORD_AVATAR_URL    (opzionale) URL dell'avatar mostrato
  SCHEDULE              (opzionale) cron che ha avviato il workflow; serve a
                        inviare solo dal run giusto rispetto all'ora legale
  FORCE                 (opzionale) "true" per inviare ignorando il controllo
  DRY_RUN               (opzionale) "true" per stampare senza inviare
"""

import json
import os
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Rome")
MESSAGES_FILE = Path(__file__).with_name("messages.txt")
# Data di partenza della rotazione: in questo giorno esce il messaggio n. 1.
START_DATE = date(2026, 10, 16)

# Il workflow parte alle 05:00 e alle 06:00 UTC; solo uno dei due corrisponde
# alle 07:00 italiane (05 UTC con l'ora legale, 06 UTC con l'ora solare).
CRON_FOR_OFFSET = {2: "0 5 * * *", 1: "0 6 * * *"}


def load_messages() -> list[str]:
    raw = MESSAGES_FILE.read_text(encoding="utf-8")
    blocks = [b.strip() for b in raw.replace("\r\n", "\n").split("\n---\n")]
    messages = [b for b in blocks if b]
    if not messages:
        sys.exit("messages.txt non contiene messaggi")
    for i, m in enumerate(messages, 1):
        if len(m) > 2000:
            sys.exit(f"Il messaggio n. {i} supera i 2000 caratteri ammessi da Discord")
    return messages


def main() -> None:
    now = datetime.now(TZ)
    schedule = os.environ.get("SCHEDULE", "")
    force = os.environ.get("FORCE", "").lower() == "true"
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"

    if schedule and not force:
        offset_hours = int(now.utcoffset().total_seconds() // 3600)
        if CRON_FOR_OFFSET.get(offset_hours) != schedule:
            print(f"Run '{schedule}' non corrisponde alle 07:00 di Roma oggi: salto.")
            return

    messages = load_messages()
    index = (now.date() - START_DATE).days % len(messages)
    content = messages[index]
    print(f"Messaggio {index + 1}/{len(messages)} del {now.date()}:\n{content}")

    if dry_run:
        return

    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if not url:
        sys.exit("DISCORD_WEBHOOK_URL non impostata")

    payload = {"content": content, "allowed_mentions": {"parse": []}}
    if os.environ.get("DISCORD_USERNAME"):
        payload["username"] = os.environ["DISCORD_USERNAME"]
    if os.environ.get("DISCORD_AVATAR_URL"):
        payload["avatar_url"] = os.environ["DISCORD_AVATAR_URL"]

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "discord-daily/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        print(f"Inviato (HTTP {resp.status})")


if __name__ == "__main__":
    main()
