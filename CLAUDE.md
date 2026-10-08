# HellGalaxyDB

Documentazione tecnica: `docs/DOCUMENTAZIONE.md` (leggila prima di lavorare). Guida d'uso rapida: `README.md`. Piano per l'invio dei dati a Unreal (tasto nell'app): `docs/PIANO_PUSH_UNREAL.md` (leggilo prima di toccare qualsiasi cosa legata a Unreal).

Altri documenti da leggere: `docs/INTERVENTI_UNREAL.md` (tutto ciò che richiede modifiche reali a Unreal, non eseguito), `docs/LOCALIZZAZIONE.md` (fogli di localizzazione/eventi e DataTable), `docs/AUDIT_UNREAL_2026-10-07.md` (letture da Unreal), `docs/DOCUMENTAZIONE.md` §0 (stato) e §0b (domande in sospeso), `docs/PROMPT_NUOVA_SESSIONE.md` (prompt per riprendere).

## Regole

- **Progetto Unreal (`D:/Plastic/HellGalaxy`): NON modificare né creare file/asset** (documentazione compresa) senza chiedere: l'utente ci lavora in parallelo con un'altra sessione (ramo crafting). L'app lo **legge soltanto** (MCP dell'Editor, `auto_save:"false"`); la scrittura è bloccata da `HG_UE_ALLOW_WRITE`. Cancellazioni solo dopo verifica dei riferimenti e con via libera esplicito. Mai commit/check-in su Plastic.
- **Commit e push del repository dell'app solo su richiesta esplicita** dell'utente. Ogni commit+push **incrementa il file `VERSION`** (mostrato sotto il titolo dell'app) e aggiorna la documentazione nello stesso commit.
- **Verifica sull'Editor**: piano graduale in `docs/PIANO_PUSH_UNREAL.md` §12. La scrittura su Unreal si sblocca solo con il via libera esplicito dell'utente (`HG_UE_ALLOW_WRITE=1` sull'app **e** sul PC dell'agente); chiedere sempre prima.
- **L'app non parla mai direttamente con l'Editor Unreal**: passa dall'**agente** (`scripts/unreal_agent.js`, `Avvia agente Unreal.bat`, `HG_AGENT_TOKEN`), anche in locale. Nessun blocco sulle modifiche degli utenti: solo notifiche "X ha modificato Y".
- **Ad ogni risposta ricordare lo stato funzionale attuale dell'app** e aggiornare `docs/DOCUMENTAZIONE.md` §0; **numerare con i NUMERI (1, 2, 3…, non lettere) i punti a cui l'utente deve rispondere**.
- Lingua dell'assistente: italiano. Per gli script usare Write/Edit, non heredoc di shell (i backslash si perdono).

- **Prima di ogni commit e push** aggiorna `docs/DOCUMENTAZIONE.md` (e il `README.md` se cambia l'uso) con le modifiche fatte: API, schema DB, script, deploy, data di aggiornamento e commit di riferimento. Includi l'aggiornamento della documentazione nello stesso commit.
- Nuovi script di migrazione: aggiungili anche a `Dockerfile`, `docker-entrypoint.sh` e ai `paths` di `.github/workflows/docker-image.yml`.
- Lingua di UI, commenti e commit: italiano. Nessuna dipendenza npm.
- Non esporre il tool via HTTPS senza autenticazione.
