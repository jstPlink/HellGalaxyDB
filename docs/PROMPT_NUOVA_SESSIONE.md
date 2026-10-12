# Prompt per riprendere il lavoro in una nuova sessione

Ultimo aggiornamento: **2026-10-12 sera** (app pubblicata v0.2.13, committata e pubblicata il 2026-10-12). Copiare il blocco qui sotto come primo messaggio della nuova sessione (cartella di lavoro: la cartella del repository HellGalaxyDB; fare `git status` e `git log` per vedere cosa è committato).

````
Riprendi il lavoro sul progetto HellGalaxyDB (app Node senza dipendenze npm + SQLite, cartella del repository: C:\Users\franc\Desktop\Github\HellGalaxyDB). Rispondi sempre in italiano.

OBIETTIVO DELL'UTENTE
Rimpiazzare l'uso dei fogli Google con l'app, completamente funzionante, per PIÙ PERSONE in parallelo. I fogli Google diventeranno inutili SOLO quando l'utente avrà confermato la totale funzionalità dell'app verso Unreal Engine (nessuna fretta di distaccarsi). Oggi (M1) il foglio è il master e l'app lo legge (i campi non compilati bene si leggono da Unreal). L'app NON scrive mai sui fogli Google: le modifiche (ID, nome, tipo, nuovi moduli…) aggiornano le schede "FOGLI GOOGLE" dell'app. L'app NON parla mai direttamente con l'Editor Unreal, nemmeno in locale: passa dall'AGENTE (scripts/unreal_agent.js; il .bat si scarica dall'app: clic su "Agente: non connesso" → "Scarica agente (.bat)"), che gira sul PC dell'Editor.

1) LEGGI PRIMA, PER INTERO, NEL SEGUENTE ORDINE
- CLAUDE.md
- docs/DOCUMENTAZIONE.md → §0-ter (stato al 2026-10-12 sera e punti aperti), §0-bis (stato al 2026-10-09), §0 (tabella funzioni), §0b (risposte e domande), API, variabili d'ambiente
- docs/PIANO_PUSH_UNREAL.md (§0 decisioni dell'utente numerate, §9 agente, §12 piano di verifica sull'Editor)
- docs/INTERVENTI_UNREAL.md e docs/PULIZIA_UNREAL_2026-10-09.md (cancellazioni: piano da 945 asset)
- docs/LOCALIZZAZIONE.md (fogli e DataTable)
Controlla anche la memoria automatica (MEMORY.md).

2) VINCOLI (non negoziabili)
- Unreal (D:/Plastic/HellGalaxy): scrivere SOLO con il via libera esplicito dell'utente (HG_UE_ALLOW_WRITE=1 sull'app E sul PC dell'agente; oggi nel .env locale c'è già, per la sessione di lavoro del 2026-10-12). REGOLA (2026-10-12): le scritture si fanno TUTTE IN BLOCCO IN MEMORIA e NON si salva né si fa checkout (asset sporchi, salva l'utente). Le cancellazioni (delete_asset) sono immediate su disco. Nessun commit/check-in su Plastic. Se l'Editor sembra bloccato: Rider con debugger collegato (breakpoint su ensure): Resume o non avviare in Debug.
- Il sistema di sicurezza di Claude Code ha RIFIUTATO più volte le cancellazioni in blocco su Unreal (comando di cancellazione dei 945 asset): vanno lanciate dall'utente o autorizzate con una regola di permesso Bash nel file .claude/settings.local.json (es. "Bash(curl:*localhost:8936/api/unreal/cleanup*)"); NON aggirare. Le scritture ProducerIcon invece sono passate.
- Commit e push SOLO quando lo chiede l'utente; prima aggiorna docs/DOCUMENTAZIONE.md e README.md, incrementa VERSION (pubblicata 0.2.13 → prossima 0.2.14) e aggiungi i nuovi script a Dockerfile e ai paths di .github/workflows/docker-image.yml.
- I test non devono mai raggiungere il server vero (HG_MEDIA_REMOTE=0 e HG_DB_PATH nei test); nessuna scrittura in blocco sul server (NAS hgdb.fplinio.it) senza conferma; NON sovrascrivere il .env dell'utente (contiene i token: solo aggiungere righe); non stampare i token.
- Punti da far rispondere all'utente: numerati con NUMERI (1, 2, 3…). Chiudi ogni risposta con "Stato attuale dell'app: …". Dubbi su prezzo/rarità/testi: chiedi ("vale Unreal" solo per ProducerIcon, Quality, mesh, shield mesh, icone, e per il cargo di COL-StationSupply_* e PY-*).
- Nessun blocco sulle modifiche degli utenti: solo notifica "X ha modificato Y".
- Per gli script usa Write/Edit, non heredoc di shell (i backslash si perdono); i sorgenti hanno fine riga CRLF: preservali. Dopo ogni modifica a server.js/scripts riavvia l'app locale.

3) STATO (verificalo leggendo i documenti)
- App locale http://localhost:8936 (preview_start nome "hellgalaxy" oppure `node server.js`). Test: `node --test tests/tool_tests.js` (48 passano; T39 può essere lento/instabile se la macchina è carica: rilanciarlo da solo).
- In LOCALHOST i media (texture, anteprime, FBX) e i caricamenti trascinati negli slot sono INOLTRATI al NAS (HG_REMOTE_URL=https://hgdb.fplinio.it, HG_REMOTE_TOKEN nel .env) — la cartella data/media locale non si usa; HG_MEDIA_REMOTE=0 per disattivare. Il NAS deve avere la versione nuova (rotte /api/custom-media) per accettare i caricamenti.
- Schede: DATABASE = [Modules · Consumable · Item · Collectable] | [Localization (sotto-scheda Modules: ID, nome, descrizione dei moduli + pulsante "Apri modulo →")] | [Modules (OLD) · Quest · Enemies] (Stations tolta); FOGLI GOOGLE = ENTITIES (Entities/Modules/Cargo-Loot/Items) · LOCALIZATION MASTER · EVENTS · STATIONS (GenericLockRules, SpaceStationRules); Impostazioni. Tre livelli di schede (il terzo con lo stesso stile del secondo ma contorno di 1 px, senza rientro).
- Pagina DATABASE › Modules › "Tutti i moduli": colonne Immagine, Mesh (slot dove TRASCINARE un'immagine PNG/JPG o un FBX per assegnarli alla riga), ID/Nome/Tipo modificabili (clic; rinomina ID in tutte le schede; tipo = cambia sezione), Produttore (icona + menu per cambiarlo), "+ Nuovo modulo" (finestra con tutti i campi, parametri del tipo, immagine e mesh; crea entità + riga MODULES + riga Cargo/Loot + testi Localization).
- Colonna "Condizione di sblocco": costruita dal foglio STATIONS importato (GenericLockRules + SpaceStationRules, dal foglio condiviso 10xFLZV-6yaoJHExn650s3hpDTyhMw_BqhI1Ij8qA4Kc); verificata: 193 entità, 0 differenze rispetto al vecchio catalogo.
- Unreal: ProducerIcon scritto in 188 EDA_ (ICN_producer_<sigla>, Texture2D in 3_ASSETS/UI/Icons/Producer; non esistono T_Producer_*). La seconda scrittura (12 ottobre sera) è stata fatta IN MEMORIA: gli asset restavano sporchi e non salvati; se l'Editor è stato chiuso senza salvare vanno rifatti (POST /api/unreal/producer-icons con apply+confirm; anteprima senza apply). 11 EDA_ hanno già una sigla diversa dal foglio e non vengono toccati (vale Unreal). Pulizia di Unreal (950 asset, 5 di prova inclusi) ancora DA ESEGUIRE. Scrittura SMDA_ (mesh, qualità…) ancora da implementare (prima i moduli).
- Due agenti sul PC dell'utente possono competere sui lavori (quello del .bat Desktop può essere una versione vecchia: i lavori rifiutati vengono ripresi da un altro agente).

4) COME INIZIARE
a) Riassumi in 10 righe lo stato che hai capito e mostra le domande aperte (DOCUMENTAZIONE §0-ter) NUMERATE.
b) Controlla in sola lettura: GET /api/health, /api/agent/status, /api/unreal/ping (asset sporchi), anteprima ProducerIcon.
c) Poi aspetta le risposte dell'utente. Prossimi passi proposti: pulizia di Unreal; scrittura degli SMDA_ dei moduli (in memoria, senza salvare); salvataggio dei ProducerIcon da parte dell'utente; poi EDA_/SIDA_ dei moduli, DataTable, Blueprint.
````
