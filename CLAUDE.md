# HellGalaxyDB

Documentazione tecnica: `docs/DOCUMENTAZIONE.md` (leggila prima di lavorare). Guida d'uso rapida: `README.md`. Piano per l'invio dei dati a Unreal (tasto nell'app): `docs/PIANO_PUSH_UNREAL.md` (leggilo prima di toccare qualsiasi cosa legata a Unreal).

Altri documenti da leggere: `docs/INTERVENTI_UNREAL.md` (tutto ciò che richiede modifiche reali a Unreal, non eseguito), `docs/LOCALIZZAZIONE.md` (fogli di localizzazione/eventi e DataTable), `docs/AUDIT_UNREAL_2026-10-07.md` (letture da Unreal), `docs/DOCUMENTAZIONE.md` §0 (stato) e §0b (domande in sospeso), `docs/PROMPT_NUOVA_SESSIONE.md` (prompt per riprendere).

## Regole

- **Progetto Unreal (`D:/Plastic/HellGalaxy`): NON modificare né creare file/asset** (documentazione compresa) senza chiedere: l'utente ci lavora in parallelo con un'altra sessione (ramo crafting). L'app lo **legge soltanto** (MCP dell'Editor, `auto_save:"false"`); la scrittura è bloccata da `HG_UE_ALLOW_WRITE`. Cancellazioni solo dopo verifica dei riferimenti e con via libera esplicito. Mai commit/check-in su Plastic.
- **Commit e push del repository dell'app solo su richiesta esplicita** dell'utente.
- **Ad ogni risposta ricordare lo stato funzionale attuale dell'app** e aggiornare `docs/DOCUMENTAZIONE.md` §0; **numerare con lettere/numeri i punti a cui l'utente deve rispondere**.
- Lingua dell'assistente: italiano.

- **Prima di ogni commit e push** aggiorna `docs/DOCUMENTAZIONE.md` (e il `README.md` se cambia l'uso) con le modifiche fatte: API, schema DB, script, deploy, data di aggiornamento e commit di riferimento. Includi l'aggiornamento della documentazione nello stesso commit.
- Nuovi script di migrazione: aggiungili anche a `Dockerfile`, `docker-entrypoint.sh` e ai `paths` di `.github/workflows/docker-image.yml`.
- Lingua di UI, commenti e commit: italiano. Nessuna dipendenza npm.
- Non esporre il tool via HTTPS senza autenticazione.
