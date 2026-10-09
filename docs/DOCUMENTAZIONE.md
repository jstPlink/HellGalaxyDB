# Hell Galaxy Database — documentazione tecnica

Ultimo aggiornamento: 2026-10-08, **versione 0.2.9** (commit v0.2.5: indirizzi dei fogli predefiniti, righe nuove/eliminate, controlli di qualità, piloni a stack alto, piano di verifica sull'Editor; v0.2.4: token agente automatico, notifiche visibili, colore/icona utente, cronologia; v0.2.3: agente scaricabile (.bat configurato dall'app); v0.2.2: agente Unreal, DataTable, collegamenti, login utenti, passo 4 server, "Sincronizza/Aggiorna Unreal", pulizia interfaccia, elenco modifiche locali con ripristino per riga). Scrittura su Unreal DISABILITATA; NAS aggiornato dall'immagine GHCR solo al push. Regola: commit/push solo su richiesta dell'utente, sempre dopo aver aggiornato questa documentazione e incrementato `VERSION`.

> **Regola di manutenzione**: questo file va aggiornato a ogni richiesta, commit e push che
> cambia comportamento, API, schema dati, script o deploy, e tiene traccia dello stato
> delle implementazioni (§8). Il `README.md` resta la guida rapida d'uso.

## 0. Stato funzionale attuale dell'app (aggiornato 2026-10-08, dopo agente Unreal, DataTable e collegamenti)

**Struttura dell'app (barra in alto, due livelli)**
- **ENTITIES (foglio)**: Entities · Modules · Cargo/Loot · Items — i dati del foglio ENTITIES e dei tab collegati, con lettura da Unreal.
- **LOCALIZATION MASTER (foglio)**: Identities · Entities · Quest · EventsAudio — copia fedele di sola lettura del foglio di localizzazione (`docs/LOCALIZZAZIONE.md`).
- **EVENTS (foglio)**: MainEvents · EventTexts — le due pagine utili di HS - Events (copia fedele di sola lettura), da cui si generano `DT_EventsSignature`, `DT_DialoguesMultiplicityRules`, `DT_EventsText` (prova di rigenerazione: 665/665/895 righe identiche, `docs/LOCALIZZAZIONE.md`).
- **DATABASE**: Moduli (vecchie pagine Corpo/Motori/Armi/Produttori) · Quest · Stations · Enemies — **ferme in attesa che i fogli funzionino**: restano invariate.
- **Impostazioni**: tra l'altro il **tema** (**Fogli Google** = chiaro, griglia, Arial, **predefinito dal 2026-10-08**; Scuro = tema originale; la scelta è ricordata nel browser).
Obiettivo dell'utente: **rimpiazzare l'uso dei fogli** in modo completamente funzionante; il resto dell'app (vecchie pagine moduli come filtri, ecc.) è sospeso.


> ⚠️ **VINCOLO DELL'UTENTE (2026-10-07): NON TOCCARE FILE O ASSET DEL PROGETTO UNREAL.** Sul progetto lavora in parallelo un'altra sessione Claude su un ramo dedicato al crafting. L'app **legge soltanto** da Unreal (Asset Registry + proprietà, `auto_save:"false"`, 0 pacchetti salvati). La scrittura (`apply`) è **disabilitata nel codice** (serve `HG_UE_ALLOW_WRITE=1`, non impostare senza il via libera esplicito dell'utente). Le sessioni future: nessuna scrittura su `D:\Plastic\HellGalaxy`, nemmeno documentazione, senza chiedere.
> Nota onesta: prima del vincolo avevo creato/modificato **un solo file nel tree Unreal**: `D:\Plastic\HellGalaxy\Docs\Specs\Data_Pipeline\Entities_Unreal_Link_Plan.md` (documento di piano, marcato SUPERATO). Da rimuovere/spostare se l'utente lo chiede.

> Da aggiornare a ogni richiesta; l'assistente deve ricordarlo all'utente a fine risposta.

**Modalità operativa in uso: M1 parziale — il foglio Google è il master, l'app lo legge.**

| Funzione | Stato |
|---|---|
| Esplorare/modificare moduli, nemici, quest, stazioni, produttori (da CSV importati a mano) | ✅ funziona |
| ENTITIES: tabella nel DB (270 righe), modifica locale, ripristino | ✅ funziona |
| ENTITIES: "Scarica dal foglio" con anteprima/applica/conflitti (via URL CSV del foglio, `.env` locale) e "Importa CSV" | ✅ funziona (testato sul foglio reale) |
| Autenticazione opzionale `HG_API_TOKEN`, file sensibili non serviti | ✅ |
| **Fase 0 — "Test collegamento Unreal"** (sezione ENTITIES, `GET /api/unreal/ping`): verifica che l'Editor sia aperto e mostra versione engine, progetto, asset sporchi; sola lettura | ✅ funziona (provato sull'Editor vero: UE 5.8.2, progetto HellGalaxy, 0 pacchetti salvati) |
| Test automatici del tool (35) | ✅ passano |
| **Lettura da Unreal (sola lettura) — "Leggi da Unreal"** nella sezione ENTITIES: legge i 429 `EDA_`, mostra un'anteprima e, con "Salva questi dati nell'app", li memorizza **solo nel DB dell'app** (tabella `entities_ue`). Valori effettivi: nome/descrizione dalla cella (se vuota o "[C]" → Unreal), icona (solo Texture2D) e produttore (vale Unreal), marcati "UE" in tabella; una modifica fatta nell'app vince sempre | ✅ funziona (letto sull'Editor vero: 429 EDA in ~0,9 s; **non ancora salvato** nel DB dell'app: lo decide l'utente col pulsante) |
| **Tab MODULES importato esattamente dal foglio** (sezione "MODULES (foglio)"): 140 righe, 12 sezioni, tutte le colonne (anche quelle senza nome, in "colonne tecniche"), pull con anteprima/applica/conflitti, "Importa CSV", modifica inline e ripristino. Lettura (sola lettura) degli SMDA_: **mesh (136), shield mesh (79), quality (3)**; statistiche foglio = Unreal (0 differenze) | ✅ funziona e **già importato nel DB dell'app** (140 moduli + dati da Unreal; solo DB dell'app, Unreal non toccato) |
| **LOCALIZATION MASTER (foglio)**: 4 tab copiati (Identities 1936 righe, Entities 889, Quest 1725, EventsAudio 1209) come copia fedele di sola lettura; nessuna modifica nell'app finché il foglio è il master | ✅ funziona e già importato (DB dell'app) |
| **EVENTS (foglio)**: MainEvents (665 righe) ed EventTexts (895) importati come copia fedele | ✅ funziona e già importato |
| **Regola EventsAudio (2026-10-08)**: nel tab EventsAudio del Localization Master le righe con la stessa chiave di EventTexts (HS - Events) sono **"in gioco"** (892, riga normale, = righe di `DT_EventsText`); le altre **164** sono **backup per il futuro, non in gioco** (marcate e attenuate nella tabella; 3 righe di `DT_EventsText`, `HM_Escape_A/B/C`, non sono in EventsAudio). Tutto ciò che sta in HS - Events (MainEvents, EventTexts) è in gioco | ✅ marcato nell'app |
| **Decisioni sulle differenze foglio/Unreal (2026-10-08)**: prezzo e rarità seguono il foglio; i 26 `COL-StationSupply_*` sono **Collectable per decisione dell'utente, a prescindere dal foglio** (modifica nell'app: valore dell'app Collectable, originale del foglio Consumable → compare come modificato e un nuovo pull non la sovrascrive; il foglio andrà corretto dall'utente); `MOD03b-Engine_L_Poor`: testo del foglio ("M-engine") confermato | ✅ applicate nell'app |
| **Tema "Fogli Google"** in Impostazioni → Aspetto | ✅ |
| **Tab CARGO/LOOT (`CargoItemsAndLoots`) e ITEMS (`Items`) importati esattamente dal foglio** (sezioni "CARGO/LOOT (foglio)" e "ITEMS (foglio)"): cargo 271 righe (tabella piatta; 462 righe finali senza ID ignorate), items 31 righe in 11 sezioni; anteprima/applica/conflitti, "Importa CSV", modifica inline, ripristino. Pulsante "Leggi da Unreal" per CIDA_ (stack value), LDA_ (attractable, force to inspect, loot mesh) e SIDA_ (quality e statistiche) in **sola lettura**: mesh del loot e quality da Unreal (vale Unreal; Quality 10 = non usato → foglio), tutto il resto solo confronto | ✅ importati nel DB dell'app (dal foglio vero). ✅ **lettura da Unreal provata sull'Editor vero il 2026-10-08** (cargo: 427 CIDA_ + 500 LDA_, 270/271 corrispondenti; items: 42 SIDA_, 31/31; ~1 s ciascuno); risultati in `docs/AUDIT_UNREAL_2026-10-07.md` §L. **I dati letti non sono ancora salvati nel DB dell'app** (premere "Salva questi dati nell'app") |
| Pagine moduli vecchie (Corpo/Motori/Armi, tabella `modules`, 116 righe) | ℹ️ ancora presenti e invariate; diventeranno filtri della nuova tabella (decisione dell'utente) — non ancora fatto, nessun dato perso (le 116 righe non avevano immagini né modifiche) |
| Confronto foglio ↔ Unreal per tipo, rarità, prezzo, descrizione (solo segnalazione, vale il foglio) | ✅ (audit §J) |
| Invio dati a Unreal (push `EDA_`, Fase 1) | ⏸️ **IN PAUSA**: codice scritto (`scripts/unreal_entities.js`, `scripts/unreal/entities_push.py`) ma **non collegato a nessuna rotta/pulsante** e con scrittura bloccata; l'anteprima (dry run) è stata provata una volta sull'Editor (lettura): 1 da creare, 219 da aggiornare (188 per il produttore mai scritto + tipo/rarità/prezzo), 159 orfani |
| **Versione dell'app (2026-10-08)**: file `VERSION` (0.2.5), letto da `server.js`, esposto in `GET /api/health` e mostrato sotto il titolo (sostituisce la scritta "HS MODULES DATABASE"). Regola: incrementarla a ogni commit+push | ✅ |
| **Collegamento ENTITIES ↔ Localization Master › Entities (2026-10-08)**: la colonna ENGLISH del tab Entities è modificabile (doppio clic) e cambia anche `Label`/`BriefDescription` dell'entità con quella chiave (`LabelKey`/`DescriptionKey`), e viceversa; ripristino incluso. Tabella `grid_edits` conserva l'originale del foglio; un nuovo pull del tab mantiene le modifiche locali. `PUT /api/grid/entities/:riga` `{value}` | ✅ test T22 |
| **Dati letti da Unreal salvati nell'app (2026-10-08)**: entities_ue 429, cargo 425, items 34. Station supply: cargo = Unreal (stack 100, attractable vero, force to inspect falso) | ✅ |
| **Collegamenti degli asset in Unreal (2026-10-08)**: pulsante "Leggi collegamenti Unreal" (ENTITIES): per ogni ID elenca gli asset esistenti (EDA_/CIDA_/LDA_/SIDA_/SMDA_ e Blueprint CI_/BP_ACS_Loot_/SML_*) e chi li referenzia (hard+soft, esclusi i "fratelli" e `DT_EntityTranslations`). Etichette nella colonna "Unreal" + filtro: **in uso** / **0 utilizzi** / **senza BP** / **non in Unreal** (badge DT = presente in DT_EntityTranslations). Sola lettura su Unreal, salvato nel DB dell'app (`entity_links`). Letto: 141 in uso, 129 a 0 utilizzi, 1 non in Unreal. Dei 36 moduli senza riga in Modules: 25 a 0 utilizzi, 11 in uso. Pensato come primo "tag" del futuro database | ✅ provato sull'Editor vero |
| **DataTable degli eventi (2026-10-08)**: `scripts/unreal_datatables.js`. Anteprima = esporta le 3 DataTable dall'Editor (sola lettura) e le confronta con quelle generate dal database: **665/665, 665/665, 895/895 righe uguali, 0 differenze**. Applicazione (una DataTable alla volta, `fill_data_table_from_csv_string` + salvataggio di quel solo asset): codice scritto, **bloccato** da `HG_UE_ALLOW_WRITE` e `confirm:true`, **mai eseguito** (non provato: dettagli e dubbio sul testo FText in `docs/INTERVENTI_UNREAL.md`) | ✅ anteprima / ⏸️ apply |
| **"Aggiorna il progetto" (2026-10-08)**: pulsante nella barra in alto, processo in ordine **1 Data Asset → 2 DataTable → 3 Blueprint → 4 server**, con lo stato di ogni passo (in attesa / in corso / ok / errore / bloccato / non implementato / saltato); al primo errore o blocco i passi successivi non partono. Anteprima funzionante (1: 1 da creare, 193 da aggiornare, 77 uguali; 2: tutte uguali); "Applica" bloccato. Passo 3 (Blueprint) **non implementato**; passo 4 (server) implementato (riga "Passo 4"). Se l'app è già sul server dovrà aggiornare direttamente Unreal (agente locale, piano §9: da definire) | ✅ anteprima / ⏸️ apply |
| **Agente Unreal (2026-10-08) — l'app non parla più direttamente con l'Editor, nemmeno in locale**: ogni lettura/aggiornamento è un lavoro in coda (`scripts/agent_hub.js`); l'agente (`scripts/unreal_agent.js`, `Avvia agente Unreal.bat`) gira sul PC dell'Editor, si collega **in uscita** all'app (long-polling, `HG_AGENT_TOKEN`), esegue sull'Editor locale e restituisce il risultato. L'agente **non esegue codice ricevuto**: accetta solo i propri script `scripts/unreal/*.py` + una chiamata con argomenti letterali (validazione, test T24); le **scritture** (delete, import_one, apply=True) sono rifiutate se sul PC dell'agente manca `HG_UE_ALLOW_WRITE=1` (oltre al blocco già presente nell'app). Indicatore "Agente: nome / non connesso" nella barra in alto; senza agente errore chiaro (503 `agent_offline`). Provato sull'Editor vero (ping, collegamenti, DataTable via agente). `HG_UE_MODE=direct` mantiene la chiamata diretta (solo test). Più agenti: oggi il primo libero prende il lavoro (scelta dell'agente da fare) | ✅ |
| **Agente scaricabile (2026-10-08, v0.2.3)**: collegamento all'Editor semplificato, **identico in localhost e sul server**. Clic su "Agente: non connesso" (o dalla finestra di Sincronizza) → **"Scarica agente (.bat)"**: l'app genera `Agente Unreal - Hell Galaxy.bat` già configurato (indirizzo dell'app e token dentro). Si lascia sul desktop (o in `shell:startup`), si fa doppio clic e si tiene aperto sul PC dell'Editor. Il .bat: controlla Node.js (**se manca lo installa da solo**: prima `winget install OpenJS.NodeJS.LTS`, altrimenti scarica l'MSI LTS da nodejs.org; solo se entrambi falliscono apre nodejs.org — modifica non ancora committata, 2026-10-08 sera), **scarica da `GET /api/agent/script` un unico file** (bridge + agente + script Python, estratti in `%LOCALAPPDATA%\HellGalaxyAgent`), avvia l'agente e lo **riavvia da solo**; quando l'app viene aggiornata l'agente esce con codice 42 e il .bat riscarica la versione nuova. `GET /api/agent/bat` (solo utenti autenticati: contiene il token) e `GET /api/agent/script` (token agente). L'indirizzo nel .bat è quello da cui si è scaricato (`X-Forwarded-Host/Proto` dietro tunnel; `HG_PUBLIC_URL` per forzarlo). Sul server servono `HG_AGENT_TOKEN` (e `HG_API_TOKEN`). Provato davvero: .bat scaricato da localhost, eseguito, agente connesso, ping all'Editor vero ok. `Avvia agente Unreal.bat` (cartella del progetto) resta solo per lo sviluppo | ✅ T30 |
| **Token dell'agente automatico + notifiche più visibili (2026-10-08, v0.2.4)**: se `HG_AGENT_TOKEN` non è impostato il server **lo genera al primo avvio** e lo conserva in `data/agent_token.txt` (nel volume, non servito via web, stesso dopo i riavvii): sul NAS non serve più toccare il compose per il download del `.bat` (si può comunque impostare a mano). **Avvisi** (toast) ora in alto al centro, grandi, sopra ogni finestra e cliccabili per chiuderli; gli errori sono rossi e restano 9 s. Il riquadro "X ha modificato…" è fisso in alto a destra sopra tutto e il titolo della scheda del browser diventa "● …" finché non lo chiudi (visibile da un'altra finestra) | ✅ T31 |
| **Colore e icona profilo dell'utente (2026-10-08, v0.2.4)**: alla creazione dell'utente si sceglie un **colore** (12 predefiniti + selettore libero; se manca ne viene dato uno dal nome); la **targhetta in alto** resta neutra (bordo e testo ad alto contrasto) e contiene l'**icona profilo** (**pallino colorato con l'iniziale del nome inscritta** (anello a contrasto)). Cambio colore in Impostazioni → Utente. Colonna `users.color`; `POST /api/users {name, color}` | ✅ T32 |
| **Cronologia delle modifiche (2026-10-08, v0.2.4)**: pulsante **"Cronologia"** in alto. Tabella persistente `history` (data, utente, area, ID riga, campo, valore prima, valore dopo, origine = modifica / ripristino / importazione). Ogni richiesta che scrive viene confrontata con una fotografia delle tabelle di dati (ENTITIES, MODULES, CARGO/LOOT, ITEMS, DATABASE moduli e nemici): copre modifiche, ripristini, importazioni dai fogli e invii dal server locale senza toccare il codice di scrittura. Oltre 500 campi per richiesta: righe di riepilogo. Filtri per area, utente e testo, paginazione. `GET /api/history?area=&user=&q=&before=&limit=`. Non registra le modifiche fatte prima di questa versione né il colore/lettura da Unreal | ✅ T33 |
| **Indirizzi dei fogli predefiniti (2026-10-08, v0.2.5)**: `scripts/sheets_defaults.json` (ID dei fogli e dei tab: non segreti, già nei documenti) fornisce i valori di `HG_SHEET_*`/`HG_LOC_*`/`HG_EVT_*` se non sono nell'ambiente o nel `.env`: sul NAS "Scarica dal foglio" non dà più "Lettura del foglio non configurata" senza toccare il compose (restano valide le variabili d'ambiente, che hanno la precedenza) | ✅ |
| **Righe nuove ed eliminate dall'app (2026-10-08, v0.2.5)**: in ENTITIES, MODULES, CARGO/LOOT e ITEMS pulsante **"+ Nuova riga"** (ID e, dove serve, sezione; la riga nasce vuota con le colonne della sezione, resta "solo nell'app" e un pull non la tocca) e pulsante **cestino** accanto all'ID (conferma; non tocca Unreal; la riga resta eliminata anche dopo un nuovo "Scarica dal foglio" grazie a una "lapide", e si ripristina dalla Cronologia con **"Ripristina riga"**). `scripts/rows_admin.js`: `POST /api/rows/:area` `{id, section}`, `DELETE /api/rows/:area/:id`, `POST /api/rows/:area/:id/restore`, `GET /api/rows/deleted` (area = entities\|modules\|cargo\|items); tabelle `deleted_rows`, `app_rows`. **Colonne nuove/eliminate: non fatte** (toccano la struttura letta da Unreal e dal pull: da definire con l'utente) | ✅ T34 |
| **Controlli di qualità (2026-10-08, v0.2.5)**: pulsante **"Da risolvere"** (ex "Controlli", rosso) in alto, sola lettura (`GET /api/quality`, `scripts/quality_checks.js`): EntityType/BaseRarity/BasePrice fuori elenco, nomi o icone vuoti (considerando anche i valori letti da Unreal), spazi invisibili, chiavi di localizzazione mancanti, nome diverso dal Localization Master, righe di Modules/Cargo/Items senza entità, entità senza Cargo, moduli senza mesh, StackValue/booleani non validi, asset a 0 utilizzi o assenti in Unreal. Sui dati veri: 0 errori, 7 avvisi (26 StackValue vuoti, 23 entità senza icona, 22 senza nome, 17+17 chiavi mancanti, 4 moduli senza mesh, 1 con spazi) | ✅ T35 |
| **Texture e mesh da Unreal nel database (2026-10-08, v0.2.6, non committata)**: `scripts/unreal/media_export.py` (sola lettura sul progetto; scrive solo in `%TEMP%/HGExport`) + `scripts/media.js` + caricamento dell'agente (`uploadExported` in `unreal_agent.js`, solo file della cartella di esportazione). Impostazioni → "Scarica texture e mesh da Unreal" (giallo, provvisorio; "Riesporta tutto" per rifare): inventario (icone `Texture2D` degli EDA_, `static_mesh`/`shield_static_mesh` degli SMDA_), poi lotti (30 texture / 5 mesh) → PNG (256-512 px), **FBX** e un OBJ temporaneo da cui l'app genera l'**anteprima PNG 256 px** (rasterizzatore software in Node, senza dipendenze; l'OBJ viene scartato). Prima esportazione completa: **133 texture, 213 mesh (FBX + anteprima)**, ~4,5 minuti; 2 mesh con nome duplicato in due cartelle ignorate (`SM_BRL_alien`, `SM_BRL_alien_Shield`). File in `data/media/{textures,previews,meshes}` (volume `data`, **non** nel repository né nell'immagine Docker: `.gitignore`/`.dockerignore`; se l'agente è collegato al NAS, i file vanno direttamente sul NAS). Tabelle `media_assets`, `media_links` (ID → icona/mesh/shield). Nella collection **DATABASE › Moduli** compaiono l'icona e l'anteprima della mesh (caricate subito, `loading=lazy`); al clic si apre una finestra con l'anteprima grande e **"Scarica FBX"**: l'FBX viene richiesto al server solo in quel momento (`GET /api/media/mesh/<nome>.fbx`, protetto dal token utenti). **Contatore dello spazio** in Impostazioni → "Spazio occupato sul server" (`GET /api/storage`: database, immagini, texture, anteprime, FBX, altri dati, disco libero). L'agente passa a versione 2 (nuova funzione consentita `export_batch`) | ✅ provato sull'Editor vero (T36 con finto) |
| **Backup del database (2026-10-09, non committata)**: `scripts/backup.js`. Copie coerenti (`VACUUM INTO`) in `data/backups/` (non nel repository né in Docker): **ogni giorno alle 03:00 ora italiana** (e all'avvio se l'ultima ha più di 24 ore; ultime 14), **a mano** (Impostazioni → "Backup del database" → "Crea backup ora"; ultime 20), e **automatico prima di ogni "Applica su Unreal"** (`prima-di-unreal`, ultime 10; se il backup fallisce l'aggiornamento non parte). Impostazioni elenca i backup con orario italiano, tipo, dimensione e "Scarica"; contano nel contatore dello spazio. `GET/POST /api/backups`, `GET /api/backups/<file>` (token API). Ripristino: fermare l'app, copiare il file in `data/hellgalaxy.db`, riavviare. Ogni istanza (locale e server) fa i propri backup. Test T38 | ✅ |
| **Mesh dei Blueprint (2026-10-09, sola lettura)**: l'inventario di `media_export.py` legge anche le dipendenze `StaticMesh` dei Blueprint `BP_ACS_Loot_<ID>` e `SML_SI_<ID>` (ruoli `bp_mesh_N`, solo per ID presenti in ENTITIES). Trovate **8 mesh**: 6 Collectable e 1 Consumable (es. `COL-Crystal` → `SM_Loot_Crystal`, `COL-Radium` → `SM_Loot_Radium` e `SM_Loot_Uranium`); nessuna per gli Item. Scaricate (FBX + anteprima) e visibili nelle collection | ✅ |
| **⚠ Incidente del 2026-10-09 e ripristino del server**: dopo l'attivazione della replica, i test automatici (che avviavano app con database di prova ma leggevano il `.env` vero) hanno inviato al server vero dati finti e eliminazioni (moduli 140 → 3, media a 0, righe di prova). Il locale era intatto. **Misure**: con `HG_DB_PATH` (solo test) `server.js` non legge più il `.env` (fix in v0.2.9); `scripts/ripristina_server.js` (anteprima senza `--applica`) riscrive sul server le righe giuste dal database locale, elimina quelle di prova e riallinea `remote_state`. **Regola per le sessioni future: i test non devono mai poter raggiungere il server vero; non scrivere sul server in blocco senza conferma** | ✅ **ripristino eseguito dall'utente il 2026-10-09 (10:00): tutte le 16 tabelle replicate identiche tra locale e server (140 moduli, 354 media, 7.319 righe di localizzazione), sincronizzazione a due vie ripartita senza conflitti** |
| **Sincronizzazione a DUE VIE locale ↔ server (2026-10-09, v0.2.8)**: oltre all'invio locale → server (sotto), ogni 20 s l'app locale controlla `GET /api/replica/rev` e, se il server è cambiato, scarica **solo le righe cambiate dai colleghi** (`GET /api/replica/manifest` = impronte di tutte le righe, `POST /api/replica/rows` = righe richieste) e le applica in locale (anche eliminazioni, e i file texture/mesh/anteprime). Confronto con l'**ultimo stato condiviso** (`remote_state`): riga cambiata solo da una parte → copiata sull'altra; **cambiata da entrambe, o eliminata da una e cambiata dall'altra, o presente da entrambe senza stato comune con valori diversi → CONFLITTO**: non si sovrascrive, resta com'è su entrambi i lati e compare in **Impostazioni → "Sincronizzazione con il server"** (badge rosso ⚠ sulla scheda Impostazioni) con **"Mantieni la mia"** / **"Prendi quella del server"** (tabella `replica_conflicts`; `GET /api/replica/conflicts`, `POST /api/replica/resolve {table,key,choice}`). Prima di ogni invio si scarica sempre (così i conflitti si vedono prima di sovrascrivere). Un server più vecchio senza `/api/replica/*` viene saltato (solo invio). Comprende tutte le tabelle replicate (anche le letture da Unreal fatte da un collega sul server). Le modifiche scaricate non compaiono nella Cronologia locale. Test T39. **"Aggiorna Unreal" va quindi lanciato da un'app allineata**: dopo l'ultima sincronizzazione (Impostazioni mostra l'ora) | ✅ |
| **Replica automatica verso il server, solo righe cambiate (2026-10-09, v0.2.7)**: `scripts/remote_replica.js`. Ogni modifica fatta in locale (dopo 8 s di attesa), a orari fissi in **ora italiana** (`HG_REMOTE_SYNC_TIMES`, predefinito 08:00, 13:00, 19:00) e all'avvio, invia al server (`HG_REMOTE_URL`, `HG_REMOTE_TOKEN` se il server ha `HG_API_TOKEN`) **solo le righe cambiate** (impronta di ogni riga confrontata con `remote_state`; le eliminazioni locali si propagano; le righe presenti solo sul server non si toccano) con `POST /api/import/delta`; texture, mesh e anteprime (`media_assets`) viaggiano con `POST /api/media/upload` (ora accettato anche con il token API; nuovo `kind=preview`). Stato: `GET /api/remote/status`, invio immediato `POST /api/remote/sync`. **L'invio verso Unreal resta un clic** ("Aggiorna Unreal"). Provato con due istanze locali (T37, 37/37). **Attivazione**: dopo l'aggiornamento del NAS alla v0.2.7, nel `.env` locale togliere il cancelletto da `HG_REMOTE_URL` (e mettere `HG_REMOTE_TOKEN` se il server ha il token) e riavviare: il primo invio è completo (il server pubblicato non aveva righe modificate né cronologia, controllato il 2026-10-09). Modello di `.env`: `.env.example`. **Server oggi senza `HG_API_TOKEN`: chiunque conosca l'indirizzo può leggere e scrivere** | ✅ test / ⏸️ attivazione |
| **Sincronizza Unreal: quando parte e verifica prima di aggiornare (2026-10-08, non committata)**: "Sincronizza Unreal" parte da solo **solo al login** (schermata di accesso, cambio utente, o nuova sessione del browser: `sessionStorage`), **non** a ogni ricarica della pagina. Premendo **"Applica su Unreal"** l'app esegue prima in sottofondo (sola lettura) la **verifica di sincronizzazione** `POST /api/unreal/drift` (`scripts/unreal_drift.js`): rilegge gli EDA_ e gli SMDA_ e li confronta con l'**ultima lettura salvata nell'app** (`entities_ue`, `modules_ue`). Se nulla è cambiato → conferma e aggiornamento; se qualcuno ha modificato Unreal dopo l'ultima lettura (o l'app non ha una lettura salvata, o la verifica non riesce) → finestra **"⚠ L'app non era sincronizzata con Unreal"** con l'elenco delle differenze e tre scelte: **Rileggi Unreal e salva** (sola lettura su Unreal), **Applica comunque**, **Annulla**. Le modifiche fatte nell'app non contano come differenza. Copre Data Asset delle entità e dei moduli (non CIDA/LDA/SIDA né DataTable). Provato sull'Editor vero (nessuna differenza; differenza simulata nel DB rilevata). **Da fare**: dopo un apply riuscito la lettura salvata andrà aggiornata (oggi si rilegge a mano con "Rileggi Unreal e salva"); la scrittura resta bloccata | ✅ verifica / ⏸️ apply |
| **DATABASE a due livelli + sotto-categorie dei moduli con grafici (2026-10-08, non committata)**: il gruppo DATABASE ha ora il secondo livello (Moduli · Consumable · Item · Collectable · Moduli (vecchie pagine) · Quest · Stations · Enemies). **Moduli** ha il terzo livello: *Tutti i moduli*, **Main Body, Engine, Primary, Secondary, Pylons** (sezioni MainBody/MainEngine/PrimaryWeapon/SecondaryWeapon/Pylon di MODULES). Ogni sotto-categoria ha: contatori (totale, con immagine, con mesh, per rarità), ricerca e filtro rarità, **grafico a barre di confronto** come nelle vecchie pagine (metrica a scelta tra le colonne numeriche della sezione, scala max con Reset, etichette orizzontali/45°/90°, colori per rarità, legenda, tooltip, clic sulla barra → statistiche del modulo), e **tabella** con immagine, anteprima mesh (clic → FBX), ID, nome, rarità e tutte le colonne numeriche (ordinabili), pulsante "Statistiche →". Metrica iniziale: HullIntegrity (Body), SpeedIncrement (Engine), DPS (Primary), BaseDamageMax (Secondary), Price (Pylons: oggi tutti 0). Dati letti da MODULES/ENTITIES a ogni apertura. Non portati dalle vecchie pagine: colonne a scelta, produttori, modifica inline dal database (si modifica nei tab foglio) | ✅ provato nel browser |
| **DATABASE › Consumable / Item / Collectable (2026-10-08, non committata)**: tre nuove collection nel gruppo DATABASE, stessa struttura di Moduli: righe = entità di ENTITIES con quell'`EntityType` (Consumable 56, Item 31, Collectable 8); colonne immagine (icona esportata da Unreal), mesh, ID, nome (effettivo), rarità, prezzo (per gli Item anche il tipo, cioè la sezione di Items, con filtro); pulsanti **"Cargo/Loot →"** (Consumable, Collectable) o **"Items →"** (Item) ed **"Entità →"** che aprono il tab del foglio già filtrato sull'ID. Si rileggono ENTITIES, il tab di dettaglio e i media a ogni apertura (le modifiche ai fogli compaiono subito). Immagini: 55/56 consumable, 7/8 collectable, 17/31 item hanno un'icona `Texture2D` esportata (le altre sono materiali o vuote). **Mesh**: l'inventario ora include anche `loot_static_mesh` degli LDA_ (solo per ID presenti in ENTITIES), ma **nessun LDA_ ha mesh assegnate (0 su 424)** e SIDA_/CIDA_ non hanno proprietà mesh: quindi per queste collection **nessuna mesh da scaricare**; eventuali mesh stanno solo nei Blueprint (`BP_ACS_Loot_*`, `SML_SI_*`), non letti | ✅ provato nel browser |
| **Token API sul server (2026-10-09, da attivare dall'utente)**: `docker-compose.yml` legge `HG_API_TOKEN` e `HG_AGENT_TOKEN` da un file `.env` accanto al compose sul NAS (`.env.example`). Con `HG_API_TOKEN` impostato ogni `/api/*` richiede `Authorization: Bearer`: **ogni persona inserisce la password una volta nel browser** (finestra al primo 401, poi ricordata in `localStorage`); le pagine statiche, le immagini e le anteprime restano pubbliche; gli agenti usano il token agente (nel `.bat`); l'app locale usa `HG_REMOTE_TOKEN` (stesso valore). Cambiare il token = tutti lo reinseriscono. Oggi il server non ha token: chiunque conosca l'indirizzo può leggere e scrivere | ⏸️ da attivare |
| **Colonne/schede provvisorie in giallo (2026-10-09)**: le schede DATABASE › Moduli (vecchie pagine), Quest, Stations ed Enemies sono gialle (promemoria); nella pagina "Tutti i moduli" la colonna **"Condizione di sblocco"** (gialla, provvisoria, a destra del tipo; nelle sotto-categorie Main Body/Engine/Primary/Secondary/Pylons subito dopo l'ID) mostra evento di sblocco e stazione presi dal catalogo di Stations (`unlockRules`, `unlockStation`) e dalla colonna `Unlocked In` di MODULES; 44 moduli su 140 ne hanno una. Gli orari della Cronologia sono in ora italiana | ✅ |
| **Scheda "FOGLI GOOGLE" (2026-10-08, non committata)**: i tre gruppi ENTITIES / LOCALIZATION MASTER / EVENTS sono ora una sola scheda in alto con **tre livelli**: FOGLI GOOGLE → (ENTITIES · LOCALIZATION MASTER · EVENTS) → pagine di ciascuno | ✅ |
| **Pallino di chi modifica nelle notifiche (2026-10-08)**: "X ha modificato…" mostra il pallino colorato con l'iniziale dell'utente (colore da `users.color`, `GET /api/changes` ora restituisce `color`) | ✅ |
| **DATABASE › Moduli = prima collection (2026-10-08, non committata)**: la pagina "Moduli" del gruppo DATABASE è ora una vista collegata ai fogli: una riga per ogni modulo di MODULES (foglio) con **immagine** (da `images/<categoria>/<ID>.jpg` se esiste: oggi solo MainBody; altrimenti "–", le icone di Unreal non sono immagini scaricate), **ID**, **nome** (valore effettivo di `Label` da ENTITIES), **tipo di modulo** (sezione + ModuleType) e il pulsante **"Statistiche →"** che apre MODULES (foglio) già filtrato su quel modulo. I dati si rileggono a ogni apertura, quindi una modifica fatta in ENTITIES/MODULES (o un nuovo pull dal foglio) compare subito nella vista. Le vecchie pagine moduli restano come "Moduli (vecchie pagine)". Solo frontend (`hellgalaxy.html`), nessuna nuova API. Prossime collection previste: Quest, Stations, Enemies, Localization (+ proposte: Cargo/Loot, Items, Entities, Events) | ✅ provato nel browser |
| **Notifiche di modifica tra utenti (2026-10-08)**: **nessun blocco** (decisione dell'utente: troppa frizione). Il server registra chi ha modificato cosa (nome scelto in Impostazioni → "Il tuo nome") e gli altri browser (polling 5 s su `GET /api/changes`) mostrano "Mario ha modificato ENTITIES (ID: campi) · Aggiorna i dati". Registro solo in memoria (si azzera al riavvio) | ✅ T26 |
| **Tema chiaro predefinito (2026-10-08)**: "Fogli Google" è il tema di default (Scuro resta scegliendolo in Impostazioni) | ✅ |
| **Accesso utenti (2026-10-08)**: schermata di accesso all'apertura, **senza password**: si sceglie un utente esistente o se ne crea uno (nome unico senza distinzione tra maiuscole, max 40 caratteri). Tabella `users` (name, created_at, last_seen); `GET /api/users`, `POST /api/users {name, create?}` (409 se `create:true` e il nome esiste). Il nome scelto è ricordato nel browser e inviato in `X-HG-User` (usato dalle notifiche di modifica); pulsante "Utente: …" in alto e Impostazioni → Cambia utente | ✅ T27 |
| **Passo 4 "server" (2026-10-08)**: `scripts/server_sync.js`. L'app locale invia al server (NAS) un pacchetto con le tabelle dei fogli e i dati letti da Unreal (`entities`, `entities_ue`, `modules_sheet/_sections/_ue`, `sheet_rows/_sections/_ue`, `grid_tabs/_rows/_edits`, `entity_links`; **non** utenti né vecchie pagine DATABASE). Il server sostituisce quelle tabelle in blocco (transazione, tutto o niente) con `POST /api/import/bundle` (richiede `HG_API_TOKEN`). Config locale: `HG_REMOTE_URL`, `HG_REMOTE_TOKEN`. Anteprima = controllo del collegamento + conteggi; applica = invio. Rotta autonoma `POST /api/remote/push {apply}` (non passa da Unreal). Senza `HG_REMOTE_URL` il passo risulta "saltato". Non tocca Unreal | ✅ T28 |
| **Due pulsanti Unreal (2026-10-08, decisione dell'utente)**: nella barra in alto restano solo **"Sincronizza Unreal"** e **"Aggiorna Unreal"** (versione finale; i pulsanti per sezione restano per ora). **Sincronizza Unreal** (`scripts/unreal_sync.js`, `POST/GET /api/unreal-sync`): **solo lettura** su Unreal, 4 passi (collegamenti/tag, Data Asset, DataTable, Blueprint attesi); salva nell'app solo i tag (`entity_links`) e apre una finestra con le discrepanze (Data Asset da creare/diversi/orfani, DataTable, Blueprint mancanti; elenchi max 300). **Parte da solo dopo l'accesso** (se non ci sono discrepanze: avviso "nessuna discrepanza"; se l'agente è spento: avviso). Provato sull'Editor vero: 355 discrepanze (1 EDA da creare, 193 diversi, 2 Blueprint mancanti su 713 attesi, DataTable identiche). **Aggiorna Unreal** = il processo a 4 passi già esistente (solo i dati diversi); scrittura **bloccata** finché l'utente non sblocca Unreal | ✅ T29 (lettura) / ⏸️ scrittura |
| **Passo 3 Blueprint (2026-10-08)**: anteprima in sola lettura = quali Blueprint attesi mancano (`CI_`/`BP_ACS_Loot_` per gli ID in Cargo, `SML_SM_` se in Modules, `SML_SI_` se in Items, piano §4.3) dai collegamenti letti; la **creazione non è implementata** (richiede scrittura) | ✅ anteprima / ⏸️ creazione |
| **Tag "Unreal" su Modules, Cargo/Loot e Items (2026-10-08)**: stessa colonna di ENTITIES (in uso / 0 utilizzi / senza BP / non in Unreal), stesso ID dell'entità; si aggiorna con "Sincronizza Unreal" | ✅ |
| **Pulizia interfaccia (2026-10-08)**: pulsanti "Sincronizza Unreal", "Aggiorna Unreal", "Ripristina tutto" a dimensione doppia; schede (gruppi, sotto-schede, Impostazioni) con contorno ben visibile; **rimossi** "Test collegamento Unreal" e "Leggi collegamenti Unreal" (sostituiti da "Sincronizza Unreal" e dall'indicatore dell'agente); i pulsanti **provvisori** ("Importa CSV", "Leggi da Unreal", "Solo colonne Unreal") sono **gialli**; il contorno di modifica di una cella è uno solo (outline); **clic su "Agente: non connesso"** apre le istruzioni per avviare l'agente (stesso aiuto dalla finestra di Sincronizza se l'agente è spento) | ✅ |
| **Elenco modifiche locali (2026-10-08)**: clic su "N modifiche in sospeso" (barra in alto) apre la lista delle modifiche fatte in locale, per area (ENTITIES, Modules, Cargo/Loot, Items, DATABASE), con valore originale del foglio → valore attuale; il totale coincide con il contatore; ogni riga ha il pulsante **"↺ Ripristina"** (ripristina solo quella riga al valore del foglio, poi ricarica i dati e riapre la lista). Link alla riga del foglio non fatto: l'app non conosce l'indirizzo esatto della riga | ✅ |
| Foglio **HS - Events** (MainEvents, EventTexts → DataTable di Unreal) e collegamento nome/descrizione entità alle chiavi di localizzazione | ⏳ da fare (analisi in `docs/LOCALIZZAZIONE.md`) |
| NAS/Docker aggiornato | ❌ non aggiornato (si lavora solo in locale; nessun commit/push fatto) |

**Decisioni recenti (2026-10-07, non ancora implementate)**: importare nell'app mesh e shield mesh dagli `SMDA_` e le icone dagli `EDA_` (solo `Texture2D`, niente materiali/UI_Markers); segnare SMDA senza mesh ed EDA senza icona; elencare (mai cancellare) gli asset Unreal non collegati al foglio; la pulizia degli asset inutili si deciderà a app funzionante.

**Decisioni del 2026-10-08 sulle cancellazioni**: gruppo A (126 sicuri) e gruppo B (467 DA + 352 BP orfani) **da cancellare**, gruppo C (91 referenziati) **da tenere**; `SMDA_MOD08-Gun_M` della torretta già cancellato dall'utente. **Interventi reali su Unreal da fare quando possibile**: tutto in **`docs/INTERVENTI_UNREAL.md`** (126 cancellazioni sicure verificate, 467 DA + 352 BP orfani da decidere, 91 asset in uso da non cancellare, mesh/icone mancanti, DataTable, righe di test da togliere dai fogli). **Nulla è stato eseguito.**

**Prossimo passo concordato con l'utente (2026-10-08, fine giornata): verificare la funzionalità dell'app sull'Editor Unreal.** Piano di verifica graduale in `docs/PIANO_PUSH_UNREAL.md` §12. Condizione: **la scrittura resta bloccata finché l'utente non la sblocca esplicitamente** (variabile `HG_UE_ALLOW_WRITE=1` sia sull'app sia sul PC dell'agente) e finché l'altra sessione sul ramo crafting non ha finito. Chi riprende il lavoro deve **chiedere** conferma prima di scrivere su Unreal. L'utente sta cambiando computer: dopo il pull il nuovo PC non ha il `.env` (token agente generato dal server, indirizzi dei fogli già in `scripts/sheets_defaults.json`) e deve **scaricare di nuovo il .bat dell'agente** dall'app.

**Interventi da fare (backlog, in ordine indicativo)**
1. Collegare **tutte le funzioni di aggiornamento delle entità a Unreal** (fase 0 ping Editor, fase 1 push `EDA_`; lettura da Unreal dei campi mancanti, SMDA/EDA).
2. ✅ **Fatto (sola lettura)**: tab `Modules` importato esattamente (140 righe), mesh/shield mesh/quality dagli `SMDA_`. Restano: trasformare le 4 pagine moduli vecchie in filtri della nuova tabella; mostrare l'icona dell'entità come immagine del modulo dopo aver salvato i dati letti da Unreal per le entità; decidere cosa fare dei 5 SMDA_ duplicati e dei 103 SMDA_/15 legacy non nel foglio (audit §K).
3. **Dopo** il punto 1: collegare il foglio reale della **localizzazione** (`LocalizationMaster`) per `Label`/`BriefDescription`. Nel frattempo: valore raw della cella; se non utilizzabile, testo letto dall'`EDA_` in Unreal.
4. Decisioni rinviate dall'utente: trattamento delle entità `Module` senza riga nel tab Modules (`ProducerIcon` e `Quality` sono ora decisi: piano §0 p.18–23). La regola "vale Unreal" riguarda solo ProducerIcon, Quality, mesh, shield mesh, icone; per ogni altro dubbio chiedere all'utente.
5. Pulizia asset inutili/copiati male/non collegati al foglio (elenchi in `docs/AUDIT_UNREAL_2026-10-07.md`): solo con conferma esplicita dell'utente, quando l'app sarà funzionante.
6. Passaggio M1 → M2 (distacco dal foglio): una lettura completa da Unreal, poi solo app → Unreal.
7. ✅ **Fatto (2026-10-08): agente locale e coda lavori** (`scripts/agent_hub.js`, `scripts/unreal_agent.js`, `Avvia agente Unreal.bat`). Restano: scelta dell'agente quando ce ne sono più, passo 4 "server" di "Aggiorna il progetto" (invio dei dati al server), installabile Windows dell'agente (per ora basta il `.bat`).
8. NAS/Docker: aggiornare solo a fine prove (oggi non aggiornato). Sul NAS impostare `HG_AGENT_TOKEN` (compose) e usare gli agenti sui PC con l'Editor.
9. **Prossimi passi proposti (2026-10-08)**: (a) passo 3 di "Aggiorna il progetto": Blueprint in sola anteprima (CI_, BP_ACS_Loot_, SML_*, piano §4.3); (b) passo 4: invio dei dati dall'app locale al server con token; (c) tag di collegamento anche su Modules/Cargo/Items; (d) più agenti; (e) Fase 1 (push EDA_) e prima scrittura DataTable **solo con il via libera dell'utente** su `HG_UE_ALLOW_WRITE`; (f) cancellazioni gruppi A/B quando l'utente lo dice.

10. **Da fare (decisi il 2026-10-08, l'utente riprende il lavoro il 2026-10-09 mattina)**:
   - (a) **Collection DATABASE per Quest, Stations ed Enemies** (stesso schema di Moduli/Consumable/Item/Collectable: collegate ai fogli, con immagini/mesh se esistono), poi Localization e le altre tab proposte (Cargo/Loot, Items, Entities, Events).
   - (b) **Controllare i Blueprint associati** (`BP_ACS_Loot_<ID>`, `SML_SI_<ID>`, `CI_<ID>`) **in sola lettura** per trovare mesh/immagini degli oggetti Consumable/Item/Collectable (negli LDA_ nessuna mesh è assegnata): **NON fatto, non farlo finché l'utente non lo chiede**.
   - (c) Rimasto in sospeso: commit+push della v0.2.6 (solo su richiesta), esportazione dei media anche sul **server** (agente collegato al server + "Scarica texture e mesh da Unreal" dal sito del server, oppure copia di `data/media/`), aggiornamento automatico della lettura salvata dopo un apply riuscito, ripresa degli interventi sull'agente/Unreal messi in pausa, aggiornare `docs/PROMPT_NUOVA_SESSIONE.md` (percorso, versione, test).

11. **Promemoria dell'utente (2026-10-09)**: **dopo aver chiuso gli interventi sull'app si parte con Unreal** (scrittura DataTable, Data Asset, Blueprint, cancellazioni: ricordarlo, chiedere i tre via libera del piano §12) e **controllare i Blueprint associati** (mesh/immagini di Consumable/Item/Collectable). Le vecchie pagine moduli restano come promemoria (gialle). Un agente serve **un solo server** (il `.bat` del Desktop punta al server: per localhost serve un secondo agente con il `.bat` scaricato da localhost; oggi ne gira uno nascosto avviato dalla sessione).

**Modalità previste** (decisione dell'utente 2026-10-07; dettagli in `docs/PIANO_PUSH_UNREAL.md` §0):
- **M1 (attuale/principale)**: i dati vengono letti dal **foglio Google**; i campi **non compilati correttamente** (vuoti o non validi) vengono letti da **Unreal Engine** (fallback per campo).
- **M2 (futuro, quando ci si stacca dal foglio)**: **una** lettura dello stato attuale da Unreal, poi direzione **unica app → Unreal**, mai il contrario. Gli script Google esistenti restano attivi in parallelo finché non si passa a M2.

**Stato di partenza per Unreal (2026-10-09)**: app locale e NAS in v0.2.9, dati allineati e sincronizzati a due vie, backup attivi (anche prima di ogni "Applica su Unreal"), verifica di sincronizzazione con Unreal prima di scrivere, colonne/schede provvisorie gialle. Resta da fare lato Unreal: via libera alla scrittura (`HG_UE_ALLOW_WRITE=1` su app e agente), scrittura dei Data Asset dei moduli (`SMDA_`, non ancora implementata), creazione Blueprint (non implementata), cancellazioni; piano di verifica graduale in `docs/PIANO_PUSH_UNREAL.md` §12. **Segnalato all'utente**: `.env - Copia.example` nel repository contiene un token vero (commit `1fde494`): cambiare la password e togliere il file.

## 0b. Domande in sospeso e risposte (aggiornato 2026-10-08, seconda tornata)

> **Regola per l'assistente: i punti a cui l'utente deve rispondere vanno numerati con numeri (non lettere, richiesta del 2026-10-08).**

**Risposte già date dall'utente (2026-10-08)**
- A. Commit e push: fatti (v0.2.0, v0.2.1, v0.2.2). Da ora **solo su richiesta**, con documentazione aggiornata e `VERSION` incrementata.
- B. Cancellazioni in Unreal: **aspettare** (via libera dell'utente + `HG_UE_ALLOW_WRITE`).
- C. (conferma finale 2026-10-08) **Piloni `PY-*`: stack alto per tutti (non acquistabili, se ne devono montare tanti)**; `PY-P2_DP1_GoldPylon_M` portato a stack 10 come gli altri. Station supply: **vale Unreal** (fatto: 26 righe cargo allineate a Unreal). **Piloni `PY-*`: stack elevato voluto** (devono permettere di montare tanti moduli gratuitamente) → **vale Unreal** (fatto: 22 righe cargo allineate a Unreal, stack 10; `PY-P2_DP1_GoldPylon_M` ha stack 1 in Unreal, da rivedere dall'utente).
- D. Asset `Test*`: **rimuovere da Unreal** per pulizia (con le cancellazioni, punto B), **lasciarli nei fogli**. In seguito gli oggetti di test dovranno essere **creati dall'app** e avere **un solo collegamento, proveniente dall'applicazione** (nessun riferimento da altri asset): per ora non si escludono dal push, si pianificherà con la Fase 1.
- E. Mesh di `MOD08-Gun_M`, `MOD68-HeliconEngine`, `MOD20-Blades`, `MOD66-BladeGatling`: la assegnerà l'utente più avanti (non è compito dell'assistente).
- F. Dati letti da Unreal salvati in locale: **fatto** (entities_ue 429, cargo 425, items 34).
- G. 36 entità `Module` senza riga in Modules: l'utente nota che i loro asset sembrano collegati a Blueprint inutilizzati; **si trascrive tutto quello che è nel foglio e si marcano le righe** come collegate / non collegate / altre notifiche (futuri "tag" del database: "senza reference", "0 utilizzi"…) → **fatto** (colonna "Unreal" in ENTITIES, vedi §0). Esito: 25 a 0 utilizzi, 11 in uso.
- H. DataTable con un click: **procedere con il codice** senza modificare Unreal; se serve modificarlo, annotarlo in `docs/INTERVENTI_UNREAL.md` → **fatto** (anteprima provata, apply bloccato).
- I. Collegare `Label`/`BriefDescription` al Localization Master: **fatto** (modifica in un foglio = modifica anche nell'altro; per ora solo per mantenere la stessa interfaccia di Google, in futuro tutto in database).
- J. **Processo di passaggio dati** definito dall'utente: "Aggiorna il progetto" → prima Unreal (Data Asset, poi DataTable, poi Blueprint), poi il server; se già sul server, aggiorna direttamente Unreal (modo da definire); stato visibile per ogni passo. → scheletro **fatto** (§0), passi 3 e 4 da implementare.
- K. Vecchie pagine moduli / icona entità: **non badare a ciò che è stato costruito prima**; sarà la nuova interfaccia, ma non si cambia l'organizzazione finché l'app non funziona come i fogli Google.
- L. Correzioni ai fogli (`COL-StationSupply_*` Consumable→Collectable, `TestAiAugSys`): le fa l'utente.

**Risposte del 2026-10-08 (sera)**
- Entità Consumable "senza nome" (22, descrizione `[C]` nel foglio): **lasciare come sono nel foglio**.
- Blueprint associati (mesh di Consumable/Item/Collectable): **segnato da controllare, non adesso** (backlog punto 10b).
- Prossime collection Quest/Stations/Enemies: **domani mattina** (backlog punto 10a).

**Risposte del 2026-10-08 (quarta tornata)**
- **I fogli Google diventeranno inutili solo quando sarà confermata la totale funzionalità dell'app verso Unreal**: nessuna fretta nel distaccarsi; M1 resta finché l'utente non lo dice.
- Piloni: stack alto per tutti (anche se il foglio ha 1 o vuoto). Test*: segnati "solo foglio" (da escludere dal push) quando si arriva alla Fase 1.
- Piano d'azione: righe nuove/eliminate (fatto), controlli di qualità (fatto), poi scheda "Pulizia Unreal" in sola lettura, backup/esportazione e distacco M2, scelta dell'agente, pagina dettaglio discrepanze.

**Domande aperte (numerate)**
1. ✅ Piloni: vale Unreal (risposta 2026-10-08).
2. ✅ DataTable: prima scrittura su `DT_EventsSignature` (senza testi), poi le altre.
3. ✅ Passo server: l'app locale invia i dati al server (`HG_API_TOKEN`) — **implementato 2026-10-08**; per aggiornare Unreal **dal server** serve un **agente locale** sul PC dell'Editor (non serve se si lavora in locale).
4. ✅ Test*: cancellare da Unreal (con il punto B), poi ricreare dall'app con un solo collegamento proveniente dall'app.

**Risposte del 2026-10-08 (terza tornata)**
- Passo 4 (server): **sì, procedere** → fatto. Login per utente (crea o seleziona, senza password) → fatto. Passo 3 Blueprint: anteprima in sola lettura fatta. Tag di collegamento su Modules/Cargo/Items: fatti. **Interfaccia finale con due soli pulsanti "Sincronizza Unreal" (lettura + finestra delle discrepanze, lanciata dopo il login) e "Aggiorna Unreal" (solo i dati cambiati nell'app): fatta.** **Unreal: nessuna scrittura, la sbloccherà l'utente "in blocco" quando vorrà**; fino ad allora si lavora solo su ciò che non modifica Unreal (nemmeno le cancellazioni dei gruppi A/B). Commit: **non ancora**.

## 1. Cos'è

Tool web per esplorare e modificare i dati di design del gioco **Hell Galaxy**
(progetto Unreal 5.8 in `D:\Plastic\HellGalaxy`): moduli nave, nemici, quest,
stazioni spaziali, produttori, entità. Node.js **senza dipendenze npm**, database
SQLite (`node:sqlite`, Node 22.5+), interfaccia single-page in un solo HTML.
Gira in locale su `http://localhost:8936` e in Docker sul NAS.

## 2. Mappa dei file

| Percorso | Ruolo |
|---|---|
| `server.js` | Server HTTP + API REST. Serve `hellgalaxy.html`, `images/` e i JSON/CSV di `data/` (non serve database, codice, script, docs); legge/scrive `data/hellgalaxy.db`. Porta `8936`. |
| `hellgalaxy.html` | Intera UI (CSS+JS inline). Sezioni: Entities (moduli: Corpo/Motori/Armi/Produttori), **ENTITIES (foglio)**, Quest, Stations, Enemies, Impostazioni. |
| `data/hellgalaxy.db` | Database SQLite. Tabelle: `modules`, `producers`, `enemies`, `entities`. |
| `data/HS - *.csv` | Export manuali dei fogli Google. Sorgente dei JSON e seed iniziale di `entities`. |
| `data/*.json` | JSON generati dai CSV: `data_body/engine/primary/secondary.json`, `enemies.json`, `quests.json`, `stations.json`. |
| `images/` | Immagini caricate dal tool (`images/<categoria>/<ID>.jpg`, `images/producers/`, `logo.svg`). |
| `DA CARICARE Modules/` | PNG di icone moduli ancora da importare in Unreal (non usati dal tool). |
| `scripts/sheet_mappings.js` | **Nuovo.** Mappatura colonne del foglio ENTITIES, parser CSV, normalizzazione righe, confronto foglio↔DB (`diffEntities`). Condiviso da server e migrazione. |
| `scripts/migrate_entities_to_db.js` | **Nuovo.** Crea `entities` e la popola dal CSV **solo se vuota** (`--force` per aggiungere/aggiornare gli originali). |
| `scripts/unreal_bridge.js` | **Nuovo (Fase 0).** Client MCP minimo verso l'Editor Unreal: sessione `Mcp-Session-Id`, `execPython` (sempre `auto_save:"false"`), `ping`. Risposte JSON o SSE, errori chiari (Editor chiuso → 503, timeout → 504). |
| `scripts/unreal_read.js`, `scripts/unreal/entities_read.py` | **Nuovi.** Lettura (sola lettura) degli EDA_ dall'Editor: l'app invia lo script Python via MCP; nel progetto Unreal non si aggiunge nessun file. |
| `docs/PROMPT_NUOVA_SESSIONE.md` | **Nuovo.** Prompt da incollare in una nuova sessione per riprendere il lavoro (letture, vincoli, stato, come iniziare). |
| `docs/INTERVENTI_UNREAL.md` | **Nuovo.** Elenco verificato (sola lettura) di tutto ciò che richiede modifiche reali al progetto Unreal; generato il 2026-10-08, non eseguito. |
| `scripts/unreal_cleanup.js`, `scripts/unreal/refs_check.py`, `scripts/unreal/delete_assets.py` | **Nuovi, non collegati ad alcuna rotta.** Pulizia dei Data Asset inutili: ricerca candidati e verifica dei riferimenti (sola lettura) + cancellazione bloccata (`HG_UE_ALLOW_WRITE=1`, `confirm:true`, ricontrollo dei riferimenti in Python). Usati solo su richiesta esplicita dell'utente. |
| `scripts/grid_tabs.js` | **Nuovo.** Copia fedele di sola lettura dei tab del Localization Master: tabelle `grid_tabs`/`grid_rows`, rotte `GET /api/grid/:tab` e `POST /api/sync/pull/grid/:tab[?apply=1]`. |
| `scripts/tabs_sheet.js`, `scripts/tabs_server.js`, `scripts/unreal/tabs_read.py` | **Nuovi.** Tab generici CargoItemsAndLoots/Items: configurazione, valori effettivi, confronto con Unreal, rotte HTTP e tabelle `sheet_rows`/`sheet_sections`/`sheet_ue`; lettura (sola lettura) di CIDA_/LDA_/SIDA_. |
| `scripts/modules_sheet.js`, `scripts/unreal/modules_read.py` | **Nuovi.** Parsing esatto del tab Modules (una intestazione per sezione, celle senza intestazione → `#<colonna>`), confronto col DB, valori effettivi dei moduli, lettura degli SMDA_ (sola lettura). |
| `scripts/entity_effective.js` | **Nuovo.** Regole dei valori effettivi (foglio/Unreal/app) e confronto completo foglio↔Unreal. |
| `scripts/unreal_links.js`, `scripts/unreal/links_read.py` | **Nuovi (2026-10-08).** Lettura (sola lettura) dei collegamenti degli asset di ogni entità e etichette in-uso / zero-usi / senza-bp / non-in-unreal; tabella `entity_links`. |
| `scripts/unreal_datatables.js`, `scripts/unreal/datatables_io.py` | **Nuovi.** Generazione dal DB e confronto (sola lettura) delle 3 DataTable degli eventi; apply bloccato. |
| `scripts/unreal_sync.js` | **Nuovo (2026-10-08).** "Sincronizza Unreal": job in sola lettura (collegamenti, Data Asset, DataTable, Blueprint attesi) con elenco delle discrepanze; salva solo i tag. |
| `scripts/unreal_drift.js` | **Nuovo (v0.2.6).** Verifica "l'app era sincronizzata con Unreal?" prima di aggiornare (sola lettura). |
| `scripts/server_sync.js` | **Nuovo (2026-10-08).** Pacchetto dati app → server remoto (export/import in transazione, invio con token). |
| `scripts/media.js`, `scripts/unreal/media_export.py` | **Nuovi (v0.2.6).** Media di moduli/entità: caricamento dall'agente, anteprima mesh da OBJ, indice, sincronizzazione a lotti, contatore dello spazio. |
| `scripts/agent_bundle.js` | **Nuovo.** Genera il pacchetto unico dell'agente (`/api/agent/script`) e il `.bat` scaricabile (`/api/agent/bat`). |
| `scripts/project_update.js` | **Nuovo.** Processo "Aggiorna il progetto" a 4 passi con stato per passo. |
| `scripts/unreal_entities.js`, `scripts/unreal/entities_push.py` | **In pausa, non collegati.** Push degli EDA_ (anteprima/apply a lotti); la scrittura è bloccata (`HG_UE_ALLOW_WRITE`). |
| `scripts/migrate_to_db.js`, `migrate_enemies_to_db.js` | Creano/aggiornano `modules`+`producers` e `enemies` (`--update` per i moduli). |
| `scripts/build_data.ps1`, `build_enemies_data.js`, `build_quests_data.js`, `build_stations_data.js` | CSV → JSON. |
| `scripts/apps-script-sync.gs` | Apps Script da incollare nel foglio Google: scrittura righe (`doPost`) e **lettura scheda** (`action: "read"`, nuova). Segreto in proprietà `HGD_SYNC_SECRET`. |
| `scripts/import_hellgalaxy_images.py` | Da eseguire nell'Editor Unreal: importa lo ZIP immagini esportato dal tool. |
| `docs/AUDIT_UNREAL_2026-10-07.md` | **Nuovo.** Elenchi letti da Unreal (SMDA senza mesh, EDA senza icona, materiali/UI_Markers, EDA e SMDA non nel foglio, discrepanze). Sola lettura, nessuna cancellazione. |
| `docs/PIANO_PUSH_UNREAL.md` | **Nuovo.** Piano (non implementato) per il push app → Unreal con un click. |
| `tests/tool_tests.js` | **Nuovo.** Test automatici del tool (§7.1). |
| `Avvia Hell Galaxy Database.bat` | Avvio su Windows. |
| `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `.github/workflows/docker-image.yml` | Deploy NAS (§5). |

## 3. Dati

### 3.1 Schema SQLite

Pattern comune: `current_json` (valori modificabili), `original_json` (riferimento, per il badge "modificato" e il ripristino), `updated_at`.

- `modules(id PK, category, class, name, rarity, price, producer, current_json, original_json, updated_at)` — 116 righe.
- `producers(name PK, image, updated_at)` — 10 righe.
- `enemies(id PK, current_json, original_json, updated_at)` — 74 righe; `ehp` e `threatIndex` ricalcolati a ogni modifica.
- `entities(id PK, current_json, original_json, updated_at)` — **271 righe** dal foglio ENTITIES. `id` = valore di `(ID)`.
- `modules_sheet(id PK, section, ord, current_json, original_json, updated_at)` — **140 righe** del tab Modules; JSON piatto: `(ID)`, `__section`, una chiave per colonna con intestazione, `#<colonna>` per i dati sotto intestazioni vuote. `modules_sections(name PK, headers_json, ord)` — intestazioni di ogni sezione. `modules_ue(id PK, data_json, read_at)` — SMDA_ letti da Unreal (mesh, shield mesh, quality, statistiche).
- `sheet_rows(tab, id, section, ord, current_json, original_json, updated_at)` + `sheet_sections(tab, name, headers_json, ord)` + `sheet_ue(tab, id, data_json, read_at)` — dati dei tab `cargo` (CargoItemsAndLoots) e `items` (Items), con lo stesso schema del tab Modules; `sheet_ue` contiene i dati letti da Unreal (`cargo`: `{cida, lda}`; `items`: `{sida}`).
- `grid_tabs(tab PK, headers_json, row_count, imported_at)` + `grid_rows(tab, row_no, cells_json)` — copia dei tab del Localization Master (`identities`, `entities`, `quest`, `eventsaudio`); `row_no` = numero di riga del foglio.
- `entities_ue(id PK, data_json, read_at)` — **dati letti da Unreal** (EDA_: testi, tipo, rarità, prezzo, icona e produttore come nome+classe). Tabella separata: il pull dal foglio e i ripristini non la toccano. Vuota finché l'utente non preme "Salva questi dati nell'app".

Riga `entities` (JSON): tutte le colonne del foglio con i nomi originali, valori **sempre stringhe** (parità esatta col foglio):
`(ID)`, `Label`, `BriefDescription`, `EntityType` (`Module|Consumable|Item|Collectable`), `BasePrice`, `BaseRarity`, `Icon`, `LabelKey`, `DescriptionKey`, `ProducerIcon`, `ModuleType`, `Quality`, più `extra` (oggetto con le intestazioni non riconosciute, oggi `ModuleType BAKCUP 26.03.26`, da ignorare in Unreal ma conservato). Le prime 7 colonne (A:G) sono quelle che il flusso Unreal legge oggi; le altre sono conservate e mostrate (decisione D5 della guida).

Quests e stations non sono nel DB: la UI legge `data/quests.json` e `data/stations.json`, sola lettura.

`server.js` termina all'avvio se manca `hellgalaxy.db` o la tabella `enemies`; la tabella `entities` viene invece creata (anche vuota) se manca.

### 3.2 Flusso aggiornamento dati

```
Moduli/nemici/quest/stazioni: foglio → export CSV in data/ → build_* → data/*.json → migrate_* → DB
Entities:                     foglio Google ──(Apps Script, action read)──► POST /api/sync/pull/entities ──► tabella entities
                              (seed iniziale una tantum da data/HS - Entity - ENTITIES.csv)
```

Il foglio resta la fonte di verità; il tool **non scrive mai** sul foglio per le entità.

## 4. API REST (`server.js`)

Errori: JSON `{error}`. Body max 20 MB. Se `HG_API_TOKEN` è impostato, ogni `/api/*` tranne `/api/health` richiede `Authorization: Bearer <token>` (altrimenti 401).

| Metodo | Percorso | Funzione |
|---|---|---|
| GET | `/api/health` | `{ok, authRequired, entities, sheetConfigured}` — senza token, per i test di collegamento. |
| GET | `/api/data` | Moduli per categoria + immagini produttori. |
| PUT / POST | `/api/modules/:id`, `/api/modules/:id/revert`, `/api/modules/reset-all` | Modifica / ripristino moduli (con gestione immagini). |
| PUT / DELETE | `/api/producers/:name` | Immagine produttore. |
| GET | `/api/enemies` · PUT `/api/enemies/:id` · POST `…/revert`, `/api/enemies/reset-all` | Nemici. |
| GET | **`/api/entities`** | `{items:[riga current], originals:{id: riga originale}, effective:{id:{Label,BriefDescription,Icon,ProducerIcon:{v,src}}}, ueReadAt, ueCount}`; `src` = `sheet`/`unreal`/`app`. |
| PUT | **`/api/entities/:id`** | Body `{fields}`. Ignora `(ID)` e campi sconosciuti; valori convertiti in stringa. |
| POST | **`/api/entities/:id/revert`**, **`/api/entities/reset-all`** | Ripristino agli originali. |
| POST | **`/api/sync/pull/entities`** | Legge il foglio. Default **dry run**: `{added[], changed[{id,fields}], conflicts[{id,field,sheet,local}], missingInSheet[], unchanged, applied:false}`. Con `?apply=1` scrive; **409** se ci sono conflitti, salvo `&skipConflicts=1` (il valore del tool resta). Mai cancellazioni. |
| POST | **`/api/sync/unreal/entities`** | **Lettura da Unreal (sola lettura su Unreal).** Anteprima: `{readInUnreal, inApp, matched, fills{Label,BriefDescription,Icon,ProducerIcon}, contradictions, iconNotImage, noIcon, missingInUnreal, onlyInUnreal, sheetVsUnreal{entity_type,rarity,base_price,label,brief}, applied:false}`. Con `?apply=1` salva i dati letti in `entities_ue` (solo DB dell'app). Editor chiuso → 503. |
| GET | **`/api/modules-sheet`** | `{items, originals, sections:[{name,headers}], effective:{id:{StaticMesh,ShieldStaticMesh,Quality,Icon:{v,src}}}, ueReadAt, ueCount}`. |
| PUT / POST | **`/api/modules-sheet/:id`**, **`…/revert`**, **`/api/modules-sheet/reset-all`** | Modifica/ripristino (ID e sezione non modificabili). |
| POST | **`/api/sync/pull/modules`** | Come il pull delle entità (anteprima, `?apply=1`, 409 sui conflitti, `&skipConflicts=1`), corpo opzionale `{csv}` (export CSV del tab Modules). Sorgente: `HG_SHEET_MODULES_URL` oppure `HG_SHEET_CSV_URL`+`HG_SHEET_MODULES_GID` (export diretto del tab: la query "gviz" perde le intestazioni di sezione). |
| POST | **`/api/sync/unreal/modules`** | Lettura (sola lettura su Unreal) degli SMDA_; `?apply=1` salva in `modules_ue` (solo DB dell'app). |
| GET / PUT / POST | **`/api/tabs/:tab`** (`cargo`\|`items`), **`/api/tabs/:tab/:id`**, **`…/:id/revert`**, **`…/reset-all`** | Lettura (con `effective` per `LootStaticMesh0..6` o `Quality`), modifica e ripristino. |
| POST | **`/api/sync/pull/tab/:tab`** | Importazione esatta dal tab (anteprima, `?apply=1`, 409 sui conflitti, `&skipConflicts=1`, corpo `{csv}`). Sorgente: `HG_SHEET_CARGO_URL`/`HG_SHEET_ITEMS_URL` oppure `HG_SHEET_CSV_URL` + `HG_SHEET_CARGO_GID`/`HG_SHEET_ITEMS_GID` (export diretto del tab). |
| POST | **`/api/sync/unreal/tab/:tab`** | Lettura (sola lettura su Unreal) di CIDA_+LDA_ o SIDA_; `?apply=1` salva in `sheet_ue` (solo DB dell'app). |
| GET / POST | **`/api/grid/:tab`**, **`/api/sync/pull/grid/:tab`** | Localization Master (`identities`\|`entities`\|`quest`\|`eventsaudio`): lettura della copia e importazione dal foglio (anteprima con righe cambiate/aggiunte/rimosse, `?apply=1`, corpo `{csv}`). |
| POST | **`/api/sync/unreal/links[?apply=1]`** | Lettura (sola lettura su Unreal) dei collegamenti degli asset per tutte le entità; `?apply=1` salva in `entity_links`. `GET /api/entities` restituisce anche `links`, `linksReadAt`. |
| PUT | **`/api/grid/entities/:riga`** | `{value}`: modifica la colonna ENGLISH e aggiorna Label/BriefDescription dell'entità con quella chiave. |
| POST | **`/api/unreal/datatables/preview`**, **`/api/unreal/datatables/apply`** | Anteprima (sola lettura) / scrittura `{table: signature\|rules\|texts, confirm:true}` (403 se `HG_UE_ALLOW_WRITE` non è impostato). |
| POST | **`/api/agent/poll`**, **`/api/agent/result`** | Solo per l'agente (Bearer `HG_AGENT_TOKEN`, non il token utenti). `GET /api/agent/status`: agenti connessi, coda. `GET /api/changes?since=N`: registro delle modifiche. |
| GET / POST | **`/api/project-update`** | Stato dell'ultimo "Aggiorna il progetto" / avvio `{mode: dry\|apply, confirm}`; il processo gira in background e la UI legge lo stato ogni secondo. |
| POST / GET | **`/api/media/sync`** (`{force, limit}`), **`/api/media`**, **`/api/media/mesh/<nome>.fbx`**, **`/api/storage`**, `POST /api/media/upload?kind=texture,mesh,obj&name=` (solo agente, token agente), `GET /media/textures/<nome>.png` e `/media/previews/<nome>.png` (pubblici come `images/`) | Texture/mesh esportate da Unreal, anteprime e spazio occupato (vedi §0). `data/media/` non è servito come statico. |
| GET | **`/api/unreal/ping`** | **Fase 0.** Esegue in sola lettura un piccolo Python nell'Editor (`import unreal`, versione engine, nome/percorso progetto, numero di pacchetti sporchi) e risponde `{ok, engine, project, projectDir, dirtyContent, dirtyMaps, savedPackages, ms, url}`; Editor non raggiungibile → 503 `{ok:false, code:"unreachable", error}`; timeout → 504. Richiede il token se `HG_API_TOKEN` è attivo. |
| GET | altro | File statico (`/` = UI). Bloccati: `*.db`, `*.gs`, `*.sh`, `scripts/`, `tests/`, `docs/`, `server.js`, Dockerfile, compose, `.git*`. |

Sorgenti del pull, in ordine di priorità: CSV nel body (`{"csv": "..."}`, usato dal pulsante **Importa CSV** della UI, nessuna configurazione) → `HG_SHEET_MOCK_CSV` (test) → `HG_SHEET_CSV_URL` → Apps Script (`HG_SHEET_EXEC_URL`+`HG_SHEET_SECRET`). Tutte le sorgenti passano dallo stesso confronto.

Regole del pull: riga nuova → inserita; riga cambiata → per ogni campo cambiato, se nel tool non era stato modificato (`current == original`) si aggiorna `current` e `original`, altrimenti è un conflitto; `original` viene sempre allineato al foglio; righe solo nel tool → `missingInSheet`, mai cancellate.

### 4.1 Variabili d'ambiente del server

| Variabile | Uso |
|---|---|
| `HG_SHEET_EXEC_URL` | URL `/exec` della distribuzione Apps Script (lettura foglio). |
| `HG_SHEET_SECRET` | Chiave segreta (stessa di `HGD_SYNC_SECRET` nello script). |
| `HG_SHEET_CSV_URL` | Alternativa ad Apps Script (nessuna autorizzazione sul foglio): URL CSV, es. `https://docs.google.com/spreadsheets/d/<KEY>/gviz/tq?tqx=out:csv&sheet=ENTITIES`. Funziona solo se il foglio è visibile a chiunque abbia il link. |
| `HG_SHEET_ENTITIES_TAB` | Nome scheda (default `ENTITIES`). |
| `HG_API_TOKEN` | Opzionale: attiva l'autenticazione Bearer sulle API. La UI chiede il token al primo 401 e lo tiene in `localStorage`. |
| `HG_SHEET_MODULES_GID` | ID (gid) del tab Modules nel foglio, per l'export diretto del tab (con `HG_SHEET_CSV_URL`). `HG_SHEET_MODULES_URL` lo sostituisce con un URL completo. |
| `HG_SHEET_CARGO_GID`, `HG_SHEET_ITEMS_GID` | ID (gid) dei tab CargoItemsAndLoots e Items (con `HG_SHEET_CSV_URL`); in alternativa `HG_SHEET_CARGO_URL`/`HG_SHEET_ITEMS_URL`. |
| `HG_EVT_SHEET_KEY`, `HG_EVT_GID_MAINEVENTS`, `HG_EVT_GID_EVENTTEXTS` | Foglio HS - Events e ID delle due pagine utili. |
| `HG_LOC_SHEET_KEY`, `HG_LOC_GID_IDENTITIES`, `HG_LOC_GID_ENTITIES`, `HG_LOC_GID_QUEST`, `HG_LOC_GID_EVENTSAUDIO` | Foglio Localization Master e ID dei 4 tab (export diretto). |
| `HG_AGENT_TOKEN` | Token condiviso con l'agente Unreal (obbligatorio per usare Unreal; sull'app e nel `.env` dell'agente). `HG_SERVER_URL`, `HG_AGENT_NAME`, `HG_UE_ALLOW_WRITE` si impostano solo sul PC dell'agente. |
| `HG_AGENT_TOKEN` (automatico) | Se assente viene generato e salvato in `data/agent_token.txt`. |
| `HG_PUBLIC_URL` | Indirizzo pubblico dell'app da scrivere nel .bat dell'agente (opzionale: di norma si ricava dalla richiesta). |
| `HG_UE_MODE` | `agent` (predefinito) oppure `direct` (chiamata diretta all'MCP: solo test/prove sullo stesso PC). |
| `HG_UE_MCP_URL` | URL del server MCP dell'Editor Unreal (default `http://127.0.0.1:8010/mcp`). Modalità **diretta**: funziona solo se l'app gira sullo stesso PC dell'Editor aperto. Per l'app sul NAS è previsto l'agente locale (piano §9). |
| `HG_UE_TIMEOUT_MS` | Timeout delle chiamate all'Editor (default 120000). |
| `HG_SHEET_MOCK_CSV`, `HG_DB_PATH`, `HG_PORT` | Solo per i test. |

In locale le variabili si possono mettere in un file `.env` nella cartella del progetto (righe `NOME=valore`, già in `.gitignore`, letto da `server.js`; le variabili d'ambiente hanno la precedenza). Il `.env` locale contiene oggi `HG_SHEET_CSV_URL` verso il foglio ENTITIES.

Mai nel repository né nell'HTML. Per Docker vanno aggiunte a `docker-compose.yml` (sezione `environment`, o file `.env` ignorato da git).

## 5. Deploy

- **Locale**: `node server.js` (o il `.bat`). Primo avvio: `migrate_to_db.js`, `migrate_enemies_to_db.js`, `migrate_entities_to_db.js`.
- **Docker/NAS**: GitHub Actions costruisce `ghcr.io/jstplink/hellgalaxydb:latest` a ogni push su `main` che tocca server, HTML, script di migrazione/mappatura, dati o Docker. Sul NAS serve solo `docker-compose.yml`; aggiornare con `docker compose pull && docker compose up -d`.
- **Entrypoint**: verifica volumi → copia sorgenti da `/seed/data` → `migrate_to_db.js` (`--update` se il DB esiste) → `migrate_enemies_to_db.js` → `migrate_entities_to_db.js` (solo seed se vuota) → `node server.js`.
- **Cloudflare Tunnel**: servizio `cloudflared` commentato nel compose. Non esporre il tool senza `HG_API_TOKEN` o Cloudflare Access.
- Ogni nuovo script richiesto all'avvio va aggiunto a Dockerfile, entrypoint e `paths` del workflow.

## 6. Convenzioni

- Italiano per UI, commenti e commit. Nessuna dipendenza npm.
- Un solo computer alla volta con il server acceso se la cartella è sincronizzata con Seafile.
- File sorgente con terminatori CRLF: preservarli quando si modificano.
- `.gitignore`: `server.log`, `server_run.log`, `storage/`, `.env`.

## 7. Test

### 7.1 Test del tool (automatici)

```
node --test tests/tool_tests.js
```

Usano una copia temporanea del DB e una porta libera (18936), con un CSV finto al posto di Apps Script. Coprono: health (T1), contenuto di `/api/entities` (T2), modifica/ripristino (T3), pull senza differenze (T4), nuova/cambiata/assente (T5), conflitti e `skipConflicts` (T6), reset-all (T7), token (T8), file statici protetti (T9), pull da CSV caricato (T10), ping Unreal con finto server MCP: sola lettura, `auto_save:"false"`, sessione, formato SSE, Editor chiuso, token (T11–T13); valori effettivi entità, lettura EDA_, scrittura bloccata (T14–T16); tab Modules: parsing/pull/conflitti e lettura SMDA_ (T17–T18); tab Cargo (tabella piatta, righe senza ID, mesh del loot) e Items (sezioni, quality) con lettura asset (T19–T20). Il DB di test riparte sempre dal CSV (non dipende dal DB vero). Stato: **36/36 passati** (2026-10-08; T36 = media: caricamento con token, anteprima da OBJ, FBX a richiesta, contatore spazio; i test azzerano anche `grid_edits`/`media_*` copiati dal DB vero); T24 = validazione dei lavori dell'agente, T25 = flusso completo app↔agente↔Editor finto (senza agente, token, scrittura bloccata), T26 = notifiche di modifica; T21 = copia fedele dei tab di localizzazione, T22 = collegamento ENTITIES↔Localization, T23 = DataTable (generazione, confronto, scrittura bloccata).

### 7.2 Test di collegamento con Unreal e con il foglio reale

Da scrivere nella fase 3 (§8). Il test del foglio reale richiede che l'utente pubblichi la nuova versione dell'Apps Script e configuri le variabili `HG_SHEET_*`.

## 8. Stato delle implementazioni

Piano di riferimento: `D:\Plastic\HellGalaxy\Docs\Specs\Data_Pipeline\Entities_Sync_Operational_Guide.md`. Ordine concordato con l'utente: **1) app → 2) collegamento Unreal → 3) test di collegamento**.

### Fase 1 — Applicazione allineata al foglio ENTITIES: ✅ implementata e testata in locale

| Voce | Stato |
|---|---|
| Tabella `entities` + seed da CSV (270 righe) | ✅ |
| Mappatura colonne (`sheet_mappings.js`) | ✅ |
| API `GET/PUT/revert/reset-all` entità | ✅ |
| Apps Script: azione `read` | ✅ scritto, ⏳ opzionale: richiede permessi di modifica/deploy sul foglio (l'utente ha segnalato mancanza di autorizzazioni → usare Importa CSV) |
| Pull dal foglio con dry run/apply/conflitti | ✅ testato con CSV finto; ⏳ non ancora provato col foglio reale |
| Verifica sul foglio reale (2026-10-07, via URL CSV, sola lettura, su copia del DB): 269 righe identiche, 1 nuova (`COL-RocketsRecharge`), 1 cambiata (`MOD50b-SonicMatterShooter_XS`.BasePrice), 0 conflitti. Il foglio è ora leggibile con `HG_SHEET_CSV_URL`. | ✅ |
| Normalizzazione valori tra sorgenti (CRLF→LF, `#N/A`→vuoto; `migrate_entities_to_db.js` riallinea i valori già nel DB) | ✅ |
| Aggirare Apps Script (utente senza autorizzazioni di deploy): pulsante **Importa CSV** e `HG_SHEET_CSV_URL` | ✅ (CSV testato in T10; URL provato sul foglio reale) |
| UI: sezione "ENTITIES (foglio)" (tabella 12 colonne, filtri, modifica inline, ripristino, anteprima/applica pull) | ✅ verificata nel browser |
| Autenticazione Bearer opzionale (`HG_API_TOKEN`) | ✅ opt-in; ⏳ punto aperto A1 (scelta definitiva token vs Cloudflare Access) |
| Blocco dei file sensibili nel server statico | ✅ |
| Docker (Dockerfile, entrypoint, workflow) aggiornati | ✅ non provato su NAS |
| Test automatici del tool | ✅ 9/9 |

Non coperto da questa fase (resta com'è): moduli, nemici, quest e stazioni continuano ad arrivare da export CSV manuali; il tab `UnrealReferences` (icone `T_…`) vive ancora solo su Google; localizzazione (`LocalizationMaster`) in attesa della struttura.

### Fase 0 (piano push Unreal) — ✅ completata (2026-10-07)
Pulsante "Test collegamento Unreal", `scripts/unreal_bridge.js`, `GET /api/unreal/ping`, test T11–T13, Dockerfile/workflow aggiornati. Verifica reale: Editor UE 5.8.2 raggiunto in ~1 s, 0 pacchetti salvati, conteggio asset sporchi invariato prima/dopo. Prossimo: **Fase 1** (push `EDA_`, anteprima + applica).

### Fase 2 — Collegamento del progetto Unreal: 📝 piano riscritto (2026-10-07), in attesa di risposte dell'utente

**Cambio di direzione (2026-10-07)**: il tasto sta **nell'app** (push app → Unreal), non in un widget di Unreal. Piano completo, analisi di cosa gli script Google producono in Unreal (Data Asset, Blueprint, DataTable), canale verificato (MCP dell'Editor su `127.0.0.1:8010`, tool `execute_python_code`), fasi, test e domande aperte: **`docs/PIANO_PUSH_UNREAL.md`**. Il vecchio piano `Entities_Unreal_Link_Plan.md` (Unreal che legge dall'app) è superato. Decisioni dell'utente del 2026-10-07 registrate in §0 del piano (niente `UnrealReferences`, solo ENTITIES all'inizio, crea+aggiorna, salva senza check-in). Nessuna implementazione iniziata; prossima azione: risposte alle domande K, L, M del piano, poi Fase 0 (ping dell'Editor).

### Fase 3 — Test di collegamento: ⏳ parte lato tool fatta (§7.1); resto da scrivere dopo la fase 2

Piano: checklist manuale guidata (health → foglio → pull → Unreal legge → dry run → apply → parità con flusso Google → secondo apply = 0 modifiche).

### Passaggi aggiuntivi proposti (da concordare)

1. Provare il pull sul foglio reale: con Importa CSV (subito) oppure con Apps Script se si ottengono i permessi.
2. Decidere A1 (token o Cloudflare Access) prima di qualsiasi esposizione HTTPS.
3. Portare sul tool anche `UnrealReferences` (icone), necessario per la fase 5B della guida.
4. Estendere il pull dal foglio agli altri tab (moduli, nemici, quest, stazioni), oggi basati su CSV manuali.
5. Struttura di `LocalizationMaster` (A3) e verifica di `po_to_csv_and_gsheet.py` (A5).
