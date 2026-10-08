# Prompt per riprendere il lavoro in una nuova sessione

Ultimo aggiornamento: 2026-10-08. Copiare il blocco qui sotto come primo messaggio della nuova sessione (cartella di lavoro: `C:\Users\franc\Desktop\Github\HellGalaxyDB`).

````
Riprendi il lavoro sul progetto HellGalaxyDB (app Node senza dipendenze npm + SQLite, in C:\Users\franc\Desktop\Github\HellGalaxyDB). Rispondi sempre in italiano.

OBIETTIVO DELL'UTENTE
Rimpiazzare l'uso dei fogli Google con l'app, in modo completamente funzionante: l'app legge i dati dai fogli (modalità M1: il foglio è il master; i campi non compilati bene si leggono da Unreal Engine) e in futuro (M2) la direzione sarà solo app -> Unreal, con un click, tramite il server MCP dell'Editor (127.0.0.1:8010, tool execute_python_code, SEMPRE auto_save:"false"). Il resto dell'app (vecchie pagine moduli, quest, stazioni, nemici = gruppo DATABASE) è fermo in attesa che i fogli funzionino.

1) LEGGI PRIMA, PER INTERO, NEL SEGUENTE ORDINE
- CLAUDE.md
- docs/DOCUMENTAZIONE.md  -> §0 stato funzionale, §0b DOMANDE IN SOSPESO (A-L), fasi, API, tabelle
- docs/PIANO_PUSH_UNREAL.md -> §0 DECISIONI DELL'UTENTE numerate 1-28 (hanno la precedenza su tutto il resto del file)
- docs/INTERVENTI_UNREAL.md (cancellazioni e interventi reali su Unreal: decisi ma NON eseguiti)
- docs/LOCALIZZAZIONE.md (fogli Localization Master e HS - Events, collegamento alle DataTable)
- docs/AUDIT_UNREAL_2026-10-07.md (liste lette da Unreal, solo riferimento)
Controlla anche la memoria automatica (MEMORY.md).

2) VINCOLI (non negoziabili)
- Progetto Unreal D:/Plastic/HellGalaxy: NON modificare né creare file o asset (nemmeno documenti) senza chiedere. L'utente ci lavora in parallelo con un'altra sessione Claude su un ramo dedicato al crafting. L'app lo LEGGE soltanto (Asset Registry/proprietà). La scrittura è bloccata nel codice (HG_UE_ALLOW_WRITE); non abilitarla senza via libera esplicito. Nessun commit/check-in su Plastic.
- Cancellazioni in Unreal: già decise ma non eseguite (vedi docs/INTERVENTI_UNREAL.md: gruppo A 126 sicuri + gruppo B 467 DA e 352 BP orfani = da cancellare; gruppo C 91 referenziati = NON cancellare). Prima di cancellare qualsiasi cosa ripeti la verifica dei riferimenti (scripts/unreal_cleanup.js) e chiedi conferma sul quando.
- Nessun commit/push del repository dell'app senza richiesta esplicita (ci sono molte modifiche non committate, incluso data/hellgalaxy.db). Prima di ogni commit aggiorna docs/DOCUMENTAZIONE.md e README.md, e aggiungi i nuovi script a Dockerfile e ai paths di .github/workflows/docker-image.yml.
- Il NAS/Docker non è stato aggiornato (si lavora in locale). Non esporre il tool in HTTPS senza autenticazione (HG_API_TOKEN opzionale già presente).
- Se hai un dubbio su un campo (soprattutto prezzo, rarità, testi) chiedi: la regola "vale Unreal" vale SOLO per ProducerIcon, Quality, mesh, shield mesh e icone (solo Texture2D).

3) STATO ATTUALE (verificalo leggendo i documenti)
- App su http://localhost:8936 (avvio: preview_start con nome "hellgalaxy", oppure `node server.js`; legge .env locale con HG_SHEET_*, HG_LOC_*, HG_EVT_* — non committato, non stamparne i valori). Test: `node --test tests/tool_tests.js` (21 passano).
- Barra in alto: ENTITIES (foglio): Entities 271, Modules 140, Cargo/Loot 271, Items 31 | LOCALIZATION MASTER (foglio): Identities, Entities, Quest, EventsAudio (copie fedeli di sola lettura; EventsAudio marca "in gioco"/"backup") | EVENTS (foglio): MainEvents 665, EventTexts 895 (rigenerano identiche DT_EventsSignature, DT_DialoguesMultiplicityRules, DT_EventsText) | DATABASE (vecchie pagine, ferme) | Impostazioni (tema Scuro / Fogli Google).
- Letture da Unreal (sola lettura) funzionanti per EDA_, SMDA_, CIDA_, LDA_, SIDA_; i dati letti sono salvati nel DB dell'app solo per MODULES, per ENTITIES/CARGO/ITEMS manca il click "Salva questi dati nell'app" (domanda F).
- I 26 COL-StationSupply_* sono Collectable nell'app per decisione dell'utente (il foglio dice Consumable e lo correggerà lui).
- Push app->Unreal (Fase 1) e aggiornamento delle 3 DataTable con un click: codice/analisi pronti, in pausa per il vincolo sul progetto Unreal. Agente locale per il NAS: previsto, non fatto.

4) COME INIZIARE
a) Riassumi in 10 righe lo stato che hai capito dai documenti e mostra le DOMANDE IN SOSPESO (§0b) con le lettere, così posso rispondere "A sì, B dopo…".
b) Controlla che l'Editor Unreal sia raggiungibile con GET /api/unreal/ping (solo lettura). Non fare altro su Unreal.
c) Poi aspetta le mie risposte o la mia indicazione su cosa fare.

5) STILE DI LAVORO
- Ad ogni risposta chiudi con una riga "Stato attuale dell'app: …" coerente con docs/DOCUMENTAZIONE.md §0, e aggiorna i documenti ad ogni richiesta che cambia qualcosa.
- I punti a cui devo rispondere vanno sempre numerati con lettere o numeri.
- Verifica sul serio prima di dire che funziona (test e prova nel browser/Editor in sola lettura) e dimmi con onestà cosa non hai potuto provare.
- Per gli script usa file scritti con gli strumenti di modifica (Write/Edit): i backslash nei comandi di shell vengono persi.
````
