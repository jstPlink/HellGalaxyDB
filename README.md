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

`Dockerfile` + `docker-compose.yml` fanno girare il server in un container.
Database e immagini stanno in due cartelle sul NAS (`storage/data` e
`storage/images`, montate come volumi): l'immagine contiene solo il codice.

1. Copia il progetto sul NAS (senza `DA CARICARE Modules`, non serve).
2. Crea le cartelle `storage/data` e `storage/images` **prima** di avviare, e
   assicurati che appartengano all'utente con cui gira il container. Nel file
   `.env` accanto al compose scrivi il suo uid:gid (`id nomeutente` da SSH):
   ```
   PUID=1026
   PGID=100
   ```
   Se non lo imposti si usa 1000:1000; se le cartelle non sono scrivibili il
   container si ferma con un messaggio che lo spiega.
3. `docker compose up -d --build` (su Synology: Container Manager → Progetto).
   Il tool risponde su `http://IP-NAS:8936`.

Al primo avvio, con `storage/data` vuota, il database viene creato dai
`data_*.json` e vengono copiate le immagini iniziali. Per **portare sul NAS lo
stato attuale**, prima del primo avvio copia `data/hellgalaxy.db` in
`storage/data/` e la cartella `images/` in `storage/images/` (con il server
locale spento). A ogni riavvio i JSON/CSV sorgente vengono riallineati a quelli
dell'immagine e gli "originali" nel database aggiornati con `--update`, senza
toccare i valori modificati dal tool. Per aggiornare il codice: copia i file
nuovi e rilancia `docker compose up -d --build`. Il backup è la cartella `storage/`.

### Cloudflare Tunnel

Nel `docker-compose.yml` c'è un servizio `cloudflared` commentato: decommentalo
e metti il token del tunnel in `CLOUDFLARE_TUNNEL_TOKEN` (nel `.env`). Nel
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
