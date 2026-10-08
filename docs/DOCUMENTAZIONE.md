# Hell Galaxy Database — documentazione tecnica

Ultimo aggiornamento: 2026-10-08, **versione 0.2.0** (file `VERSION`, mostrata sotto il titolo e in `/api/health`; da incrementare a ogni commit/push). Primo commit/push di tutto il lavoro locale (Fase 0, lettura da Unreal, tab Modules/Cargo/Items, Localization Master, Events, tema); scrittura su Unreal DISABILITATA; commit precedente `c2475be`; NAS aggiornato dall'immagine GHCR dopo il push.

> **Regola di manutenzione**: questo file va aggiornato a ogni richiesta, commit e push che
> cambia comportamento, API, schema dati, script o deploy, e tiene traccia dello stato
> delle implementazioni (§8). Il `README.md` resta la guida rapida d'uso.

## 0. Stato funzionale attuale dell'app (aggiornato 2026-10-08, dopo il Localization Master)

**Struttura dell'app (barra in alto, due livelli)**
- **ENTITIES (foglio)**: Entities · Modules · Cargo/Loot · Items — i dati del foglio ENTITIES e dei tab collegati, con lettura da Unreal.
- **LOCALIZATION MASTER (foglio)**: Identities · Entities · Quest · EventsAudio — copia fedele di sola lettura del foglio di localizzazione (`docs/LOCALIZZAZIONE.md`).
- **EVENTS (foglio)**: MainEvents · EventTexts — le due pagine utili di HS - Events (copia fedele di sola lettura), da cui si generano `DT_EventsSignature`, `DT_DialoguesMultiplicityRules`, `DT_EventsText` (prova di rigenerazione: 665/665/895 righe identiche, `docs/LOCALIZZAZIONE.md`).
- **DATABASE**: Moduli (vecchie pagine Corpo/Motori/Armi/Produttori) · Quest · Stations · Enemies — **ferme in attesa che i fogli funzionino**: restano invariate.
- **Impostazioni**: tra l'altro il **tema** (Scuro / **Fogli Google**: chiaro, griglia, Arial; ricordato nel browser).
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
| Test automatici del tool (21) | ✅ passano |
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
| **Versione dell'app (2026-10-08)**: file `VERSION` (0.2.0), letto da `server.js`, esposto in `GET /api/health` e mostrato sotto il titolo (sostituisce la scritta "HS MODULES DATABASE"). Regola: incrementarla a ogni commit+push | ✅ |
| **Collegamento ENTITIES ↔ Localization Master › Entities (2026-10-08)**: la colonna ENGLISH del tab Entities è modificabile (doppio clic) e cambia anche `Label`/`BriefDescription` dell'entità con quella chiave (`LabelKey`/`DescriptionKey`), e viceversa; ripristino incluso. Tabella `grid_edits` conserva l'originale del foglio; un nuovo pull del tab mantiene le modifiche locali. `PUT /api/grid/entities/:riga` `{value}` | ✅ test T22 |
| **Dati letti da Unreal salvati nell'app (2026-10-08)**: entities_ue 429, cargo 425, items 34. Station supply: cargo = Unreal (stack 100, attractable vero, force to inspect falso) | ✅ |
| Foglio **HS - Events** (MainEvents, EventTexts → DataTable di Unreal) e collegamento nome/descrizione entità alle chiavi di localizzazione | ⏳ da fare (analisi in `docs/LOCALIZZAZIONE.md`) |
| NAS/Docker aggiornato | ❌ non aggiornato (si lavora solo in locale; nessun commit/push fatto) |

**Decisioni recenti (2026-10-07, non ancora implementate)**: importare nell'app mesh e shield mesh dagli `SMDA_` e le icone dagli `EDA_` (solo `Texture2D`, niente materiali/UI_Markers); segnare SMDA senza mesh ed EDA senza icona; elencare (mai cancellare) gli asset Unreal non collegati al foglio; la pulizia degli asset inutili si deciderà a app funzionante.

**Decisioni del 2026-10-08 sulle cancellazioni**: gruppo A (126 sicuri) e gruppo B (467 DA + 352 BP orfani) **da cancellare**, gruppo C (91 referenziati) **da tenere**; `SMDA_MOD08-Gun_M` della torretta già cancellato dall'utente. **Interventi reali su Unreal da fare quando possibile**: tutto in **`docs/INTERVENTI_UNREAL.md`** (126 cancellazioni sicure verificate, 467 DA + 352 BP orfani da decidere, 91 asset in uso da non cancellare, mesh/icone mancanti, DataTable, righe di test da togliere dai fogli). **Nulla è stato eseguito.**

**Interventi da fare (backlog, in ordine indicativo)**
1. Collegare **tutte le funzioni di aggiornamento delle entità a Unreal** (fase 0 ping Editor, fase 1 push `EDA_`; lettura da Unreal dei campi mancanti, SMDA/EDA).
2. ✅ **Fatto (sola lettura)**: tab `Modules` importato esattamente (140 righe), mesh/shield mesh/quality dagli `SMDA_`. Restano: trasformare le 4 pagine moduli vecchie in filtri della nuova tabella; mostrare l'icona dell'entità come immagine del modulo dopo aver salvato i dati letti da Unreal per le entità; decidere cosa fare dei 5 SMDA_ duplicati e dei 103 SMDA_/15 legacy non nel foglio (audit §K).
3. **Dopo** il punto 1: collegare il foglio reale della **localizzazione** (`LocalizationMaster`) per `Label`/`BriefDescription`. Nel frattempo: valore raw della cella; se non utilizzabile, testo letto dall'`EDA_` in Unreal.
4. Decisioni rinviate dall'utente: trattamento delle entità `Module` senza riga nel tab Modules (`ProducerIcon` e `Quality` sono ora decisi: piano §0 p.18–23). La regola "vale Unreal" riguarda solo ProducerIcon, Quality, mesh, shield mesh, icone; per ogni altro dubbio chiedere all'utente.
5. Pulizia asset inutili/copiati male/non collegati al foglio (elenchi in `docs/AUDIT_UNREAL_2026-10-07.md`): solo con conferma esplicita dell'utente, quando l'app sarà funzionante.
6. Passaggio M1 → M2 (distacco dal foglio): una lettura completa da Unreal, poi solo app → Unreal.
7. **Fase N — Agente locale e coda lavori** (requisito NAS/multiutente, `docs/PIANO_PUSH_UNREAL.md` §9): un piccolo agente sul PC dell'Editor che si collega in uscita all'app sul NAS; l'app non raggiunge mai direttamente l'Editor. Da fare dopo la Fase 1 e prima del deploy sul NAS.
8. NAS/Docker: aggiornare solo a fine prove (oggi non aggiornato).

**Modalità previste** (decisione dell'utente 2026-10-07; dettagli in `docs/PIANO_PUSH_UNREAL.md` §0):
- **M1 (attuale/principale)**: i dati vengono letti dal **foglio Google**; i campi **non compilati correttamente** (vuoti o non validi) vengono letti da **Unreal Engine** (fallback per campo).
- **M2 (futuro, quando ci si stacca dal foglio)**: **una** lettura dello stato attuale da Unreal, poi direzione **unica app → Unreal**, mai il contrario. Gli script Google esistenti restano attivi in parallelo finché non si passa a M2.

## 0b. Domande in sospeso — rispondere con la lettera (aggiornato 2026-10-08)

> Per ogni punto indicato qui sotto basta rispondere con la lettera (es. "A sì, B dopo…"). **Regola per l'assistente: da ora in poi i punti a cui l'utente deve rispondere vanno sempre numerati con lettere/numeri.**

- **A. Commit e push.** Non è stato fatto nessun commit/push (modifiche accumulate: nuove sezioni, importazioni, tema, strumenti, documenti; incluso `data/hellgalaxy.db`). Farlo ora (l'assistente lo prepara) o dopo?
- **B. Via libera alle cancellazioni in Unreal** (`docs/INTERVENTI_UNREAL.md`): gruppo A (126) + gruppo B (467 Data Asset + 352 Blueprint), **già decisi**. Manca solo il **quando** (l'altra sessione sul ramo crafting deve aver finito) e l'abilitazione esplicita della scrittura (`HG_UE_ALLOW_WRITE=1`). Prima di cancellare l'assistente ripete la verifica dei riferimenti.
- **C. Cargo degli station supply** (`COL-StationSupply_A…Z`, ora Collectable): quali valori valgono? Foglio (stack 10, attractable falso, force to inspect vero) oppure Unreal (100, vero, falso)? (e per i pylon `PY-*` con differenze simili)
- **D. Altri asset/righe `Test*`** ancora nei fogli: TestHeatSink, TestPowPlan, TestRadar, TestSecEng, TestShieldGen, TestWarpDrive, TestTractBeam, TestHeatSink2. Vanno rimossi anche dai fogli, dall'app e da Unreal? (`TestAiAugSys` è già deciso: si cancella.)
- **E. Mesh di `MOD08-Gun_M`** (ora solo copia `PrimaryWeapon`, senza mesh): va assegnata una mesh? Idem `MOD68-HeliconEngine`, `MOD20-Blades`, `MOD66-BladeGatling`.
- **F. Dati letti da Unreal**: salvarli nell'app per ENTITIES, CARGO/LOOT e ITEMS (per MODULES è già fatto)? È un click per sezione ("Salva questi dati nell'app"): lo fa l'assistente, se confermi.
- **G. Entità `Module` senza riga nel tab Modules** (circa 36, voluto): come trattarle nel push (solo CI_/Loot, nessun SMDA)? — rinviata dall'utente.
- **H. Aggiornare le tre DataTable di eventi con un click** (`docs/LOCALIZZAZIONE.md` §3b): quando sarà consentito scrivere su Unreal, si procede? Una DataTable alla volta, con anteprima.
- **I. Collegare nome e descrizione delle entità** (`Label`/`BriefDescription`) alle chiavi del tab Entities del Localization Master (oggi: valore della cella, altrimenti Unreal): si fa ora o dopo il push?
- **J. Push app → Unreal (Fase 1 del piano)** e **agente locale per il NAS**: riprendere quando l'altra sessione ha finito; ordine proposto: J1 push EDA_, J2 BP/DataTable, J3 agente + NAS.
- **K. Vecchie pagine moduli come filtri** della tabella MODULES e **icona dell'entità come immagine del modulo**: sospese (priorità = rimpiazzare i fogli).
- **L. Righe di test e valori sbagliati nei fogli** da correggere dall'utente: `COL-StationSupply_*` (tipo Consumable → Collectable), `TestAiAugSys` (Items ed ENTITIES), prezzi/rarità seguono già il foglio.

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

Usano una copia temporanea del DB e una porta libera (18936), con un CSV finto al posto di Apps Script. Coprono: health (T1), contenuto di `/api/entities` (T2), modifica/ripristino (T3), pull senza differenze (T4), nuova/cambiata/assente (T5), conflitti e `skipConflicts` (T6), reset-all (T7), token (T8), file statici protetti (T9), pull da CSV caricato (T10), ping Unreal con finto server MCP: sola lettura, `auto_save:"false"`, sessione, formato SSE, Editor chiuso, token (T11–T13); valori effettivi entità, lettura EDA_, scrittura bloccata (T14–T16); tab Modules: parsing/pull/conflitti e lettura SMDA_ (T17–T18); tab Cargo (tabella piatta, righe senza ID, mesh del loot) e Items (sezioni, quality) con lettura asset (T19–T20). Il DB di test riparte sempre dal CSV (non dipende dal DB vero). Stato: **21/21 passati** (2026-10-08); T21 = copia fedele dei tab di localizzazione.

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
