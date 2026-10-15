# Messaggio Discord giornaliero

Ogni giorno alle **07:00 (ora italiana)** una GitHub Action pubblica in un canale
Discord il messaggio del giorno, preso a rotazione da `messages.txt`.

## Setup

1. **Webhook** – In Discord: *Impostazioni canale → Integrazioni → Webhook →
   Nuovo webhook*. Copia l'URL.
2. **Secret** – Su GitHub: *Settings → Secrets and variables → Actions → New
   repository secret*, nome `DISCORD_WEBHOOK_URL`, valore l'URL copiato.
3. **(Opzionale) Nome e avatar** – Nella stessa pagina, scheda *Variables*:
   `DISCORD_USERNAME` (es. il tuo nome) e `DISCORD_AVATAR_URL` (URL di
   un'immagine). In alternativa impostali direttamente sul webhook in Discord.
4. **Messaggi** – Incolla i tuoi 100 messaggi in `messages.txt`, separati da una
   riga che contiene solo `---`. Un messaggio può essere su più righe
   (max 2000 caratteri).
5. **Test** – *Actions → Discord messaggio giornaliero → Run workflow*. Con
   "dry run" spuntato mostra solo il messaggio nei log; togli la spunta per
   inviarlo davvero.

## Come funziona

- I messaggi ruotano in ordine: il 16/10/2026 esce il n. 1, il giorno dopo il
  n. 2, e così via; finiti i 100, si riparte dal primo. Per cambiare il punto di
  partenza modifica `START_DATE` in `send_daily.py`.
- Le Actions usano orari UTC, quindi il workflow parte sia alle 05:00 sia alle
  06:00 UTC e lo script invia solo da quello che corrisponde alle 07:00 di Roma
  (gestisce in automatico ora legale e solare).
- GitHub può ritardare i job schedulati di qualche minuto nei momenti di carico.
- Le menzioni (`@everyone`, `@utente`) sono disattivate per sicurezza.
