#!/bin/sh
# Avvio del container: prepara i volumi (data/ e images/), crea o aggiorna il
# database e poi lancia il server. APP_DIR/SEED_DIR esistono solo per poter
# provare questo script fuori da Docker.
set -eu

APP_DIR="${APP_DIR:-/app}"
SEED_DIR="${SEED_DIR:-/seed}"
cd "$APP_DIR"

for d in data images; do
  mkdir -p "$d" 2>/dev/null || true
  if ! touch "$d/.write-test" 2>/dev/null; then
    echo "ERRORE: $APP_DIR/$d non e' scrivibile dall'utente $(id -u):$(id -g)." >&2
    echo "Imposta 'user:' nel docker-compose.yml con uid:gid proprietario della cartella sul NAS, oppure correggi i permessi della cartella." >&2
    exit 1
  fi
  rm -f "$d/.write-test"
done

# JSON/CSV sorgente: sempre allineati alla versione dentro l'immagine.
# (Il database non e' nel seed, quindi non viene mai toccato.)
cp -R "$SEED_DIR/data/." data/

[ -f images/logo.svg ] || cp "$SEED_DIR/images/logo.svg" images/logo.svg

if [ ! -f data/hellgalaxy.db ]; then
  echo "Primo avvio: creo il database..."
  # Immagini iniziali solo ora: se le copiassi a ogni avvio, un'immagine
  # cancellata dal tool tornerebbe al riavvio successivo.
  cp -Rn "$SEED_DIR/images/." images/ || true
  if ! node scripts/migrate_to_db.js; then
    rm -f data/hellgalaxy.db
    echo "ERRORE: creazione del database fallita." >&2
    exit 1
  fi
else
  node scripts/migrate_to_db.js --update \
    || echo "ATTENZIONE: aggiornamento dei dati sorgente non riuscito, continuo con il database esistente." >&2
fi

node scripts/migrate_enemies_to_db.js \
  || echo "ATTENZIONE: migrazione nemici non riuscita (il server si fermera' se la tabella manca)." >&2

exec node server.js
