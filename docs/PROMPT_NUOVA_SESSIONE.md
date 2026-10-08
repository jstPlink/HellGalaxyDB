# Prompt per riprendere il lavoro in una nuova sessione

Ultimo aggiornamento: 2026-10-08 (fine giornata, v0.2.6), l'utente cambia computer: la nuova sessione deve verificare l'app sull'Editor Unreal. Copiare il blocco qui sotto come primo messaggio della nuova sessione (cartella di lavoro: la cartella del repository HellGalaxyDB sul nuovo computer: fare `git pull` e `git log` per vedere la versione).

````
Riprendi il lavoro sul progetto HellGalaxyDB (app Node senza dipendenze npm + SQLite, in C:\Users\franc\Desktop\Github\HellGalaxyDB). Rispondi sempre in italiano.

OBIETTIVO DELL'UTENTE
Rimpiazzare l'uso dei fogli Google con l'app, in modo completamente funzionante, per PIÙ PERSONE che lavorano in parallelo. Oggi (M1) il foglio Google è il master e l'app lo legge; i campi non compilati bene si leggono da Unreal Engine. In futuro (M2) la direzione sarà solo app -> Unreal con un click. L'app NON parla mai direttamente con l'Editor Unreal, nemmeno in locale: passa dall'AGENTE (scripts/unreal_agent.js, "Avvia agente Unreal.bat") che gira sul PC dove è aperto l'Editor e si collega in uscita all'app; il localhost si comporta come il server. Il resto dell'app (vecchie pagine moduli, quest, stazioni, nemici = gruppo DATABASE) è FERMO: non cambiare l'organizzazione finché l'app non funziona come i fogli Google.

1) LEGGI PRIMA, PER INTERO, NEL SEGUENTE ORDINE
- CLAUDE.md
- docs/DOCUMENTAZIONE.md -> §0 stato funzionale, §0b risposte dell'utente e domande aperte, backlog (punti 7-9), API, tabelle, variabili d'ambiente
- docs/PIANO_PUSH_UNREAL.md -> §0 DECISIONI DELL'UTENTE numerate 1-34 (hanno la precedenza su tutto il resto del file) e §9 (agente)
- docs/INTERVENTI_UNREAL.md (cancellazioni e interventi reali su Unreal: decisi ma NON eseguiti; sezione D = interventi del 2026-10-08)
- docs/LOCALIZZAZIONE.md (fogli Localization Master e HS - Events, DataTable)
- docs/AUDIT_UNREAL_2026-10-07.md (liste lette da Unreal, solo riferimento)
Controlla anche la memoria automatica (MEMORY.md).

2) VINCOLI (non negoziabili)
- Progetto Unreal D:/Plastic/HellGalaxy: NON modificare né creare file o asset (nemmeno documenti) senza chiedere. L'utente ci lavora in parallelo con un'altra sessione Claude su un ramo dedicato al crafting (oggi risulta sporco il suo BPW_SR_Crafting_Screen: non è nostro). L'app lo LEGGE soltanto, SEMPRE tramite l'agente, con auto_save:"false". La scrittura è bloccata due volte: nel codice dell'app e sul PC dell'agente (HG_UE_ALLOW_WRITE=1 necessario in entrambi). Non abilitarla senza via libera esplicito. Nessun commit/check-in su Plastic.
- Cancellazioni in Unreal: decise ma non eseguite (docs/INTERVENTI_UNREAL.md: gruppo A 126 sicuri + gruppo B 467 DA e 352 BP orfani + asset Test* = da cancellare; gruppo C 91 referenziati = NON cancellare). L'utente ha detto "aspetta": prima di cancellare ripeti la verifica dei riferimenti (scripts/unreal_cleanup.js) e chiedi il quando.
- Commit e push SOLO quando lo chiede l'utente. Prima: aggiorna docs/DOCUMENTAZIONE.md e README.md, incrementa il file VERSION (oggi 0.2.6 pubblicata; il prossimo commit sarà 0.2.7), aggiungi i nuovi script a Dockerfile e ai paths di .github/workflows/docker-image.yml. Il lavoro fino alla v0.2.2 è committato. Dopo la v0.2.2 le modifiche locali sono solo quelle fatte in seguito.
- Il NAS/Docker non è stato aggiornato dall'ultima pubblicazione. Non esporre il tool in HTTPS senza autenticazione (HG_API_TOKEN utenti; HG_AGENT_TOKEN per l'agente; il token locale sta nel .env, non stamparlo).
- Se hai un dubbio su un campo (prezzo, rarità, testi) chiedi: "vale Unreal" solo per ProducerIcon, Quality, mesh, shield mesh e icone (Texture2D); in più, per decisione esplicita, per il cargo (stack/attractable/force to inspect) di COL-StationSupply_* e dei piloni PY-*.
- Nessun blocco sulle modifiche degli utenti (troppa frizione): solo notifica "X ha modificato Y" con refresh.

3) STATO ATTUALE (verificalo leggendo i documenti)
- App su http://localhost:8936 (preview_start nome "hellgalaxy", oppure `node server.js`; dopo ogni modifica al server riavviarlo). Agente: `node scripts/unreal_agent.js` o "Avvia agente Unreal.bat" (serve HG_AGENT_TOKEN nel .env; l'indicatore in alto mostra "Agente: nome / non connesso"). Test: `node --test tests/tool_tests.js` (36 passano; usano un finto Editor in modalità diretta, HG_UE_MODE=direct).
- Agente: l'app genera da sola il .bat da scaricare (clic su "Agente: non connesso" -> "Scarica agente (.bat)"), uguale in localhost e sul server; si aggiorna da solo con l'app (codice di uscita 42). Sul NAS servono HG_AGENT_TOKEN e HG_API_TOKEN nel compose.
- Barra in alto: ENTITIES (Entities 271, Modules 140, Cargo/Loot 271, Items 31) | LOCALIZATION MASTER (Identities, Entities, Quest, EventsAudio; la colonna ENGLISH di Entities è modificabile con doppio clic ed è collegata a Label/BriefDescription di ENTITIES) | EVENTS (MainEvents 665, EventTexts 895) | DATABASE (ferme) | Impostazioni (tema, cambio utente). All'avvio schermata di accesso (utente senza password) e "Sincronizza Unreal" automatico; pulsanti in alto: Sincronizza Unreal (sola lettura, finestra delle discrepanze) e Aggiorna Unreal (solo i dati cambiati; scrittura bloccata). Clic su "N modifiche in sospeso" = elenco con ripristino per riga. Passo 4 server: HG_REMOTE_URL + HG_REMOTE_TOKEN. Tema predefinito chiaro "Fogli Google". Versione sotto il titolo. Pulsanti: "Leggi collegamenti Unreal" (ENTITIES; etichette in uso / 0 utilizzi / senza BP / non in Unreal) e "Aggiorna il progetto" (barra in alto: Data Asset -> DataTable -> Blueprint -> server, con stato di ogni passo; oggi solo anteprima; Blueprint e server NON implementati; "Applica" bloccato).
- DataTable eventi: anteprima provata sull'Editor vero, tutte identiche (665/665/895). Apply scritto, mai eseguito. Prima scrittura prevista su DT_EventsSignature (senza testi).
- Dati letti da Unreal salvati nel DB dell'app (entities_ue, sheet_ue, modules_ue, entity_links). Station supply e piloni: cargo allineato a Unreal.
- Decisioni dell'utente sui Test*: da cancellare da Unreal, restare nei fogli; in futuro l'app li creerà con un solo collegamento proveniente dall'app (non implementato).

3b) NUOVO COMPUTER (2026-10-08)
- Dopo `git pull`: `node server.js` (Node 22.5+ / 24). Il `.env` non è nel repository: il token dell'agente viene generato dal server (data/agent_token.txt), gli indirizzi dei fogli sono in scripts/sheets_defaults.json. Il database data/hellgalaxy.db è nel repository (contiene le decisioni dell'utente).
- Sul PC dell'Editor: nell'app clic su "Agente: non connesso" -> "Scarica agente (.bat)" e avviarlo (serve Node.js); l'Editor Unreal deve essere aperto sul progetto HellGalaxy.
- Novità della v0.2.5 da conoscere: righe nuove/eliminate (cestino e "+ Nuova riga"), pulsante "Controlli" (qualità dati), "Cronologia" (chi/cosa/quando, ripristino righe), colore utente, indirizzi fogli predefiniti. I dati del NAS sono separati da quelli locali (il NAS non ha le decisioni locali finché non si invia il pacchetto con HG_REMOTE_URL o si rifà "Scarica dal foglio" + "Sincronizza Unreal").

4) COME INIZIARE
a) Riassumi in 10 righe lo stato che hai capito e mostra le domande aperte (DOCUMENTAZIONE §0b + backlog punto 9) NUMERATE con numeri.
b) Controlla che l'agente sia connesso e l'Editor raggiungibile con GET /api/unreal/ping e GET /api/agent/status (solo lettura). Non fare altro su Unreal.
c) Poi aspetta le risposte dell'utente. Prossimi passi proposti: (1) passo 3 "Blueprint" in sola anteprima; (2) passo 4 "server" (invio dei dati dall'app locale al server con token); (3) tag di collegamento su Modules/Cargo/Items; (4) scelta dell'agente con più Editor; (5) Fase 1 push EDA_ e prima scrittura DataTable solo con via libera.

5) STILE DI LAVORO
- Ad ogni risposta chiudi con "Stato attuale dell'app: …" coerente con docs/DOCUMENTAZIONE.md §0 e aggiorna i documenti ad ogni richiesta che cambia qualcosa.
- I punti a cui l'utente deve rispondere vanno numerati con NUMERI (1, 2, 3…), non lettere (richiesta del 2026-10-08).
- Verifica sul serio (test e prova nel browser/Editor in sola lettura) e di' con onestà cosa non hai potuto provare.
- Per gli script usa Write/Edit, non heredoc di shell (i backslash si perdono); i file sorgente hanno fine riga CRLF: preservali.
- NUOVO (2026-10-08): l'utente vuole che tu lavori SULL'EDITOR per verificare la funzionalità dell'app. Questo NON significa che la scrittura sia già sbloccata: prima chiedi (1) se l'altra sessione sul ramo crafting ha finito, (2) il via libera esplicito a HG_UE_ALLOW_WRITE=1 sull'app E sul PC dell'agente, (3) conferma che si salva senza check-in su Plastic. Poi segui docs/PIANO_PUSH_UNREAL.md §12 (verifica graduale: DT_EventsSignature -> altre DataTable -> piccolo lotto EDA_ -> resto; Blueprint e cancellazioni dopo). Prima di tutto verifica in sola lettura (ping, asset sporchi, Sincronizza Unreal, Controlli).
6) NOVITÀ v0.2.6 E COSE DA FARE (2026-10-08 sera; l'utente riprende il 2026-10-09 mattina)
- Leggi docs/DOCUMENTAZIONE.md §0 (righe v0.2.6) e il backlog punto 10. Fatto: schede FOGLI GOOGLE (3 livelli) e DATABASE (Moduli con 5 sotto-categorie e grafici, Consumable, Item, Collectable), texture/mesh da Unreal (scripts/media.js, scripts/unreal/media_export.py, agente versione 2), contatore dello spazio, verifica di sincronizzazione prima di "Applica su Unreal" (scripts/unreal_drift.js), Sincronizza Unreal solo al login.
- Da fare: collection Quest, Stations, Enemies (poi Localization e altre); controllare in SOLA LETTURA i Blueprint associati per mesh/immagini degli oggetti non-modulo SOLO quando l'utente lo chiede; esportare i media anche sul server; aggiornamento automatico della lettura salvata dopo un apply; ripresa degli interventi Unreal in pausa. Rispondi alle domande aperte numerate dell'ultimo messaggio dell'assistente (vedi cronologia/documentazione §0b).
````
