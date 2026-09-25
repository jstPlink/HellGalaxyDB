# Hell Galaxy Database — prototipo

Tool a schede per esplorare e modificare i moduli (Corpo, Motori, Armi
Primarie/Secondarie, Produttori) del gioco, con export immagini per Unreal e
un accenno di sincronizzazione Google Sheet (ancora mockup). I dati vivono in
un database SQLite reale, letti e scritti da un piccolo server Node.

## Struttura

- `hellgalaxy.html` — l'interfaccia del tool. Va aperta tramite il server (vedi
  sotto), non più come file locale a doppio click: carica i dati via
  `fetch('/api/data')`.
- `server.js` — server HTTP (solo moduli Node integrati, nessuna dipendenza
  npm): serve `hellgalaxy.html`/`images/` e espone l'API REST che legge/scrive
  `data/hellgalaxy.db`.
- `data/hellgalaxy.db` — il database SQLite (una riga per modulo, tabella
  `modules`; una riga per produttore con immagine, tabella `producers`). Ogni
  riga modulo tiene sia i valori correnti (`current_json`, modificabili dal
  tool) sia quelli originali da CSV (`original_json`, usati per il badge
  "modifiche in sospeso" e per il ripristino).
- `data/` — i CSV sorgente originali (`HS - Entity - *.csv`) più i JSON
  estratti (`data_*.json`), usati solo per popolare/aggiornare il database
  (vedi sotto), non più incollati dentro `hellgalaxy.html`.
- `images/` — le immagini caricate dal tool, una per modulo/produttore
  (`images/<categoria>/<ID>.jpg`, `images/producers/<Nome>.jpg`), scritte
  direttamente dal server.
- `scripts/build_data.ps1` — rigenera i `data_*.json` a partire dai CSV in
  `data/`. Da eseguire con PowerShell:
  `powershell -ExecutionPolicy Bypass -File scripts\build_data.ps1`
- `scripts/migrate_to_db.js` — crea o aggiorna `data/hellgalaxy.db` a partire dai
  `data_*.json` (vedi sotto).
- `scripts/import_hellgalaxy_images.py` — script da eseguire nella Python console
  dell'Editor di Unreal per importare le immagini esportate dal tool (ZIP,
  Impostazioni → Esporta ZIP immagini) e collegarle ai Data Asset. Ha una
  sezione `CONFIG` in cima da adattare al progetto Unreal reale.

## Avviare il tool

Richiede Node.js 22.5+ (senza flag da Node 24 in su, per `node:sqlite`).

```
node server.js
```

poi apri `http://localhost:8936` nel browser. Alla primissima esecuzione, se
`data/hellgalaxy.db` non esiste ancora:

```
node scripts/migrate_to_db.js
```

## Docker (NAS)

Sul NAS serve **solo** `docker-compose.yml`: l'immagine non si costruisce lì
ma viene scaricata da GitHub Container Registry
(`ghcr.io/jstplink/hellgalaxydb:latest`). La costruisce GitHub Actions
(`.github/workflows/docker-image.yml`) a ogni push su `main` che cambia codice
o dati sorgente (o a mano da Actions → Immagine Docker → Run workflow).
Database e immagini caricate stanno in due volumi Docker (`hellgalaxy-data`,
`hellgalaxy-images`), quindi l'immagine contiene solo il codice.

1. Fai il push su GitHub e aspetta che l'Action finisca (tab Actions).
2. In GitHub → Packages controlla la visibilità del pacchetto: l'immagine
   contiene i dati sorgente del gioco, tienila privata. Se è privata, sul NAS
   fai il login una volta (password = token GitHub con permesso `read:packages`):
   `docker login ghcr.io -u jstPlink`
3. Carica sul NAS il solo `docker-compose.yml` e lancia
   `docker compose up -d` (su Synology: Container Manager → Progetto).
   Il tool risponde su `http://IP-NAS:8936`.

Al primo avvio il database viene creato dai `data_*.json` contenuti
nell'immagine (non dal tuo `data/hellgalaxy.db` locale) e vengono copiate le
immagini iniziali. A ogni riavvio i JSON/CSV sorgente vengono riallineati a
quelli dell'immagine e gli "originali" nel database aggiornati con `--update`,
senza toccare i valori modificati dal tool. Per aggiornare il codice sul NAS,
dopo il push e la build: `docker compose pull && docker compose up -d`. Per il
backup copia i volumi (o usa cartelle del NAS al loro posto, vedi commento nel
compose).

Se vuoi costruire l'immagine a mano (serve il progetto intero sul NAS):
`docker build -t ghcr.io/jstplink/hellgalaxydb:latest .`

### Cloudflare Tunnel

Nel `docker-compose.yml` c'è un servizio `cloudflared` commentato: decommentalo
e incolla il token del tunnel al posto di `INCOLLA_QUI_IL_TOKEN`. Nel
dashboard Zero Trust il Public Hostname deve puntare a `http://hellgalaxy:8936`.

**Attenzione: il tool non ha nessuna autenticazione.** Chi conosce l'URL
pubblico può leggere e modificare tutto (le API `PUT`/`DELETE`, il ripristino
globale) e scaricare anche `data/hellgalaxy.db`. Metti una policy Cloudflare
Access (login via email) davanti all'hostname prima di renderlo pubblico.

## Continuare su un altro computer

Il progetto usa Seafile per sincronizzare l'intera cartella (incluso
`data/hellgalaxy.db` e `images/`) tra i computer, quindi non serve ricopiare o
ricollegare nulla manualmente: basta aprire la cartella sincronizzata e
lanciare `node server.js` lì.

**Importante**: tieni il server acceso su un solo computer alla volta.
`hellgalaxy.db` è un file SQLite: se la sincronizzazione lo riscrive mentre un
altro processo lo ha aperto (o mentre è a metà di una scrittura), rischia la
corruzione. Prima di passare a un altro computer, chiudi il server (Ctrl+C) e
aspetta che Seafile finisca di sincronizzare.

## Se aggiorni i CSV in `data/`

```
powershell -ExecutionPolicy Bypass -File scripts\build_data.ps1
node scripts/migrate_to_db.js --update
```

`--update` aggiunge i moduli nuovi e aggiorna il valore "originale" di
riferimento di quelli già presenti, **senza toccare** i valori correnti o le
immagini già modificati dal tool.

## Nota sul link Artifact

Il tool richiedeva in passato un server esterno per essere ripubblicato come
Claude Artifact statico. Da quando i dati vivono nel database, `hellgalaxy.html`
non funziona più da solo (serve `server.js` per rispondere a `/api/*`): il
vecchio link pubblicato non è più aggiornato.
