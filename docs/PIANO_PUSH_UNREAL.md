# Piano: dall'app a Unreal con un click (push) — documento per le sessioni future

**Data**: 2026-10-07
**Stato**: PIANO. Nessuna riga di codice di questo piano è stata scritta né in questo repository né in `D:\Plastic\HellGalaxy` (a parte la documentazione). Lo scopo di questo file è che una sessione futura possa partire da qui senza rifare l'analisi.
**Sostituisce**: `D:\Plastic\HellGalaxy\Docs\Specs\Data_Pipeline\Entities_Unreal_Link_Plan.md` (che prevedeva il modello inverso: Unreal che legge dall'app tramite un widget nell'Editor). Il piano generale `Entities_Sync_Operational_Guide.md` resta valido per i vincoli (§3) e le decisioni D1–D7.
**Leggere prima**: `docs/DOCUMENTAZIONE.md` (stato del tool), `D:\Plastic\HellGalaxy\CLAUDE.md` (regole del progetto Unreal) e `D:\Plastic\HellGalaxy\Docs\Guides\UnrealMCP_ToolSelection.md` (obbligatorio prima di usare qualsiasi tool `unreal-mcp`/`fathom`).

---

## 0. Decisioni dell'utente (2026-10-07, seconda tornata) — hanno la precedenza sul resto del documento

1. **`UnrealReferences` non va replicato.** Era un approccio macchinoso (importare asset in Unreal, copiare i path nel foglio) e si rompeva a ogni rinomina/spostamento. Il database + l'app sono l'unica fonte: **tutto parte dall'app e aggiorna il progetto senza interventi nell'Editor**. Nessuna tabella di riferimenti path nell'app.
2. **Moduli**: delle pagine del vecchio documento Entities, le pagine specifiche dei moduli (Body/Engine/Primary/Secondary) servivano solo a controllare meglio i moduli; **l'unica pagina realmente collegata a Unreal era `MODULES`**. Quello che conta è che i dati di quel tab arrivino nel progetto. Ogni riga modulo dell'app deve avere **la sua mesh, la sua immagine e i suoi dati**, e il push li passa a Unreal senza tab aggiuntive.
3. **Ordine**: per ora **solo ENTITIES** (Data Asset `EDA_`). Se funziona, poi Blueprint e static mesh "dove necessario".
4. **Creare e aggiornare**: il push crea gli asset mancanti e aggiorna quelli esistenti (vale anche per i BP quando arriveranno).
5. **Salvataggio**: salvare gli asset modificati/sporchi; **mai commit né push (check-in) su Plastic**: aspetta la conferma esplicita dell'utente. (Interpretazione adottata: il checkout locale necessario per poter salvare è consentito; il check-in no. Riconfermare alla prima implementazione.)
6. **Rinviate** (l'utente le riproporrà): domanda 4 (`ProducerIcon`, `Quality`) e domanda 5 (come trattare i moduli di ENTITIES senza riga nel tab Modules — la differenza è voluta; **chiedere all'utente** quando si arriva ai moduli).

7. **Mesh dei moduli**: leggerle dagli `SMDA_<ID>` già esistenti in Unreal (molte sono già assegnate) e importarle nell'app. **Icone/immagini dei moduli**: leggerle dagli `EDA_<ID>` (proprietà `icon`) e importarle nell'app. Per i **nuovi** dati l'assistente sceglie dove mettere le texture: quasi certamente `/Game/3_ASSETS/UI/…` (cartella da definire, vedi §0.2).
8. **Due modalità operative** (dettaglio in §0.3): **M1** = master il foglio Google, i campi non compilati correttamente si leggono da Unreal; **M2** = (al momento del distacco dal foglio) una lettura dello stato attuale da Unreal e poi direzione unica app → Unreal. Gli script Google restano attivi in parallelo per ora.
10. **SMDA senza mesh**: vanno **segnati** (elenco in `docs/AUDIT_UNREAL_2026-10-07.md` §A: 56 asset, di cui 3 nel foglio). **Shield mesh**: il campo `shield_static_mesh` degli SMDA **va importato nell'app** (97 SMDA lo hanno).
11. **Icone: l'app accetta solo immagini (`Texture2D`)**. Gli asset con materiali (`MaterialInstanceConstant`) o che puntano a `/Game/4_LVLPRESETS/UI_Markers` **non** vengono importati come icona; elenco in audit §C (64 EDA con icona non-immagine, 61 in UI_Markers). **EDA senza immagine** segnati in audit §B (8). Regola di sicurezza per il push (da confermare): campo icona **vuoto nell'app = non toccare** l'icona esistente in Unreal (mai azzerare un materiale).
12. **Pulizia asset (futura, solo con conferma esplicita)**: l'utente vuole **cancellare tutti i Data Asset non utili, copiati male o non realmente collegati al foglio Google**. Mai in automatico: il push li elenca soltanto. Elenchi di partenza nell'audit: 159 `EDA_` non nel foglio (§D, **10 segnalati in evidenza per la verifica dell'utente**, completo in §D2) e 121 `SMDA_` non nel tab Modules (§E). Quando l'app sarà funzionante l'utente deciderà caso per caso se **cancellarli o importarli nell'app**.
13. **Discrepanze foglio ↔ Unreal**: vanno segnate nei documenti (audit §G: 79 icone presenti solo in Unreal); si decide cosa tenere quando l'app sarà operativa. Per ora M1: vince il foglio.
14. **Nuove texture**: approccio approvato (§0.2): sotto `/Game/3_ASSETS/UI/`, nome `T_<ID>`, mai spostare/rinominare le esistenti.
15. **Moduli: importare esattamente tutti i dati dal foglio Google** (tab `Modules`, tutte le sezioni, **tutte le colonne**, comprese quelle oltre `S`: `Price`, `Rarity`, `Hull`, `Shield`, ecc., con le intestazioni reali di ogni sezione). Verificato il 2026-10-07: le 116 righe oggi nell'app sono **tutte** nel tab (22 MainBody, 35 MainEngine, 45 PrimaryWeapon, 14 SecondaryWeapon) e il tab ne ha **24 in più, tutte `Pylon`** (`PY-P1_P1_S/M/L`, …); le altre sezioni (Cargo, FuelTank, Turret, Decoration, NuclearRocket, SonicMatterExtractor, Toolbox) hanno solo l'intestazione, nessuna riga. Le 116 righe esistenti **non hanno immagini caricate né modifiche locali** (verificato sul DB), quindi la fusione per ID non perde nulla. Le 4 pagine di categoria diventano **viste/filtri** della stessa tabella.
16. **EDA 429 vs 271**: chiarito dall'audit (§0.1 e `AUDIT_UNREAL_2026-10-07.md`): non è colpa della ricerca ricorsiva (tutti gli EDA stanno direttamente in `Entities/`); 159 non sono nel foglio e sono elencati, mai cancellati.
17. **Testi `Label` / `BriefDescription` (localizzazione)**, soluzione **temporanea** dell'utente: si legge il **valore grezzo (raw) della cella** del foglio ENTITIES; se non è utilizzabile, si legge **da Unreal** il testo già assegnato agli `EDA_` (nome e descrizione corretti). **Più avanti** si collegherà il foglio reale della localizzazione (`LocalizationMaster`, struttura ancora da fornire): è un **intervento da fare dopo** aver collegato tutte le funzioni di aggiornamento delle entità a Unreal (backlog in `docs/DOCUMENTAZIONE.md`). Nota tecnica: in Unreal `Label`/`BriefDescription` sono `FText` (spesso `NSLOCTEXT` con namespace `Entity_ID__label` e chiave `Entity_ID__label_EDA_<ID>`, o testo non localizzato se vuoto o `[C]`): leggere sia la stringa sorgente sia lo stato localizzato/non localizzato e **non alterarli** nel push.
18. **ProducerIcon** (decisione 2026-10-07): trattarlo come gli altri dati che in Unreal sono presenti ma che lo script/foglio non gestisce correttamente: la cella dell'app si **compila con i dati di Unreal la prima volta** (lettura degli `EDA_` → `producer_icon`, risolto in sigla dal nome `ICN_producer_<sigla>`). **In caso di contraddizione col foglio vince Unreal**, perché quei valori funzionano in gioco.
19. **Quality** (decisione 2026-10-07): il valore corretto sta negli **`SMDA_`** (e `SIDA_` per gli item). Quando l'utente clicca "aggiorna Unreal" dall'app, **l'app modifica gli `SMDA_`/`SIDA_`** scrivendo `quality`. Letto il 2026-10-07: 306 asset (SMDA+SIDA), 171 righe del foglio con asset corrispondente, **5 differenze** (vedi `AUDIT_UNREAL_2026-10-07.md` §H). `ENTITIES.Quality` è una copia: nell'app resta come campo del modulo/item (origine Unreal), non come dato dell'entità. La scrittura di `quality` appartiene alle fasi Items/Modules (SIDA/SMDA), **non** alla fase 1 (solo `EDA_`).
20. **Regola sulle contraddizioni**: dove foglio e Unreal hanno valori diversi per questi dati (ProducerIcon, Quality, icone, mesh) **si legge Unreal**. ⚠️ Estensione ad altri campi (BasePrice, rarità, testi…) **non confermata**: una differenza lì può essere una modifica voluta fatta nel foglio dopo l'ultimo script (es. `MOD50b-SonicMatterShooter_XS` BasePrice 100→0). Da chiedere/definire campo per campo prima di implementare il fallback.
21. **Quality = 10 in Unreal**: significa che quel modulo **non è usato**; il valore non ha importanza. Per `SMDA_MOD08-Gun_M` e `SMDA_MOD20-Blades` si usa il valore del foglio (222) senza segnalare conflitto. Per le altre tre differenze (951/945, 461/460, 445/443) vale Unreal (decisione p.19).
22. **ProducerIcon, entità che nel foglio hanno la sigla ma in Unreal no (187)**: **si usano i dati del foglio** (mai arrivati in Unreal, ma probabilmente era l'intento). Regola completa: valore di Unreal se assegnato (12 EDA, vince Unreal in caso di contraddizione); altrimenti sigla del foglio. Il push della **fase 1** include quindi `ProducerIcon` (risolto per nome come `ICN_producer_<sigla>`): **per 187 EDA è la prima volta che il campo viene scritto in Unreal** → segnalarlo esplicitamente nel dry run. Eccezione: `EDA_COL-SonicMatter` (non nel foglio) ha `IMG_COL_GenericItem`, non un `ICN_producer_*`: non toccarlo.
23. **La regola "vale Unreal" NON si estende ad altri campi** (BasePrice, rarità, testi…). **Se c'è un dubbio, chiedere all'utente** invece di decidere. Regola valida solo per: `ProducerIcon`, `Quality`, mesh, shield mesh, icone (solo Texture2D).
24. **Station supply**: `COL-StationSupply_*` trattati come **Collectable**, non guardare il foglio (2026-10-08).
25. **Asset di test**: si cancellano (richiesta dell'utente) — `SIDA_Test*`, `TestAiAugSys` — ma **solo dopo verifica dei riferimenti** e senza modificare il progetto finché l'altra sessione lavora sul ramo crafting: elenco verificato in `docs/INTERVENTI_UNREAL.md`.
26. **Nomenclature errate** (es. `SMDAMOD07-Gun_S_00`, `DA_Entity_Gold`) e altri EDA/CIDA/LDA/SMDA con errori simili: cancellare **se non collegati ad altri asset** (verificato: 127 sicuri, vedi `docs/INTERVENTI_UNREAL.md`). `DA_Entity_Gold/Iron/Rock` NON sono liberi: sono usati da `CI_*`/`BP_ACS_Loot_*` referenziati da una tabella `DEP_DT_CargoItemTranslation`.
27. **Cancellazioni (2026-10-08)**: si cancellano i Data Asset **e** i Blueprint che non sono usati da nulla (gruppi A e B di `docs/INTERVENTI_UNREAL.md`); **non** si cancellano i Data Asset referenziati (gruppo C). La torretta `SMDA_MOD08-Gun_M` è già stato cancellato dall'utente.
28. **Formato delle domande**: i punti a cui l'utente deve rispondere vanno numerati con lettere/numeri; le domande in sospeso stanno in `docs/DOCUMENTAZIONE.md` §0b.
29. **Commit/push (2026-10-08)**: solo quando lo dice l'utente; prima aggiornare la documentazione; ogni commit+push incrementa `VERSION` (mostrata sotto il titolo).
30. **Station supply e piloni `PY-*`**: il cargo vale Unreal (stack/attractable/force to inspect). I piloni hanno stack elevato per permettere di montare molti moduli gratuitamente.
31. **Asset di test**: rimuoverli da Unreal per pulizia, **lasciarli nei fogli**; in seguito saranno creati dall'app con un solo collegamento proveniente dall'app. **Marcatura dei collegamenti**: le righe vanno trascritte tutte e marcate (in uso / 0 utilizzi / senza BP / non in Unreal…): futuri tag del database.
32. **Processo "Aggiorna il progetto"**: ordine Data Asset → DataTable → Blueprint → server; se già sul server aggiorna direttamente Unreal (da definire); stato di ogni passo sempre visibile.
34. **Agente (2026-10-08)**: l'app non parla mai direttamente con l'Editor, nemmeno in locale (il localhost si comporta come il server); più utenti ⇒ niente blocchi sulle modifiche, solo notifica "X ha modificato Y" con refresh. Implementato (§9 realizzato).
33. **Interfaccia**: finché l'app non funziona come i fogli Google, non si cambia l'organizzazione (le vecchie pagine moduli restano ferme).
9. L'assistente deve **ricordare sempre lo stato funzionale attuale dell'app**: tenuto in `docs/DOCUMENTAZIONE.md` §0.

### 0.1 Stato reale di Unreal letto dall'Editor (2026-10-07, sola lettura, nessun asset toccato né salvato)
Letti via MCP `execute_python_code` con `auto_save:"false"`: tutti gli `SMDA_*` sotto `/Game/2_LOGIC/Entities/DataAssets/Modules` e tutti gli `EDA_*` sotto `.../Entities`.

**Mesh (SMDA_)**
- 263 asset letti (258 ID unici; 5 ID compaiono in cartelle diverse): **203 con `static_mesh` assegnata**, 55 senza; 97 hanno anche `shield_static_mesh` (campo che il foglio non ha).
- Le 140 righe del tab `Modules` hanno **tutte** un SMDA in Unreal; **137 su 140 hanno la mesh**. Senza mesh: `MOD68-HeliconEngine`, `MOD20-Blades`, `MOD66-BladeGatling`.
- La colonna `StaticMesh` del foglio è **vuota in tutte le 140 righe**: la mesh esiste solo in Unreal → l'unica fonte è l'SMDA. 27 mesh sono condivise da più moduli (es. `SM_Gatling_Body` usata da 10, `SM_SmallEngine` da 9).
- **Unreal contiene molti più SMDA del foglio**: ~118 ID presenti in Unreal ma non nel tab `Modules` (cargo, motori interni, pylon `PY-*` ecc.; alcuni con nomi anomali tipo `SMDAMOD07-Gun_S_00` senza underscore). Probabili asset legacy/orfani: **mai cancellarli**, elencarli e chiedere all'utente cosa farne.
- Path mesh tipici: `/Game/3_ASSETS/Ship/ModularShip/Modules/...`. Un solo nome mesh compare con più path distinti.

> L'elenco completo e aggiornato di tutti gli asset citati sta in **`docs/AUDIT_UNREAL_2026-10-07.md`** (generato in sola lettura dall'Editor).

**Icone (EDA_)**
- 429 asset `EDA_*` in Unreal contro 271 ID nel foglio: **159 EDA non sono in ENTITIES** (es. `COL-SonicMatter`, `DA_Entity_Gold`, `COL-Antimony`…) e 1 entità del foglio non ha EDA (`COL-RocketsRecharge`, quella nuova). Tutti gli EDA stanno direttamente nella cartella `Entities/` (nessuna sottocartella).
- 421 EDA su 429 hanno un'`icon`; 12 hanno `producer_icon`. Gli EDA con `entity_type` Module sono 226 (223 con icona).
- Confronto con la colonna `Icon` del foglio sugli ID in comune: **187 identiche, 0 diverse, 0 solo nel foglio, 79 solo in Unreal** (foglio vuoto, Unreal compilata: es. `TestHeatSink`, `COL-AimBoost_L` → `T_CON_Generic`). Questi 79 sono i candidati naturali del fallback "leggi da Unreal".
- **L'`icon` non è sempre una Texture2D**: alcune sono materiali (es. `MI_UIM_MN_GoldPyramid`) e molte stanno in `/Game/4_LVLPRESETS/UI_Markers/...` (47 sui moduli) oltre che in `/Game/3_ASSETS/UI/Icons/Modules[/Pylons|/Items|/MainBodies]`. Decisione dell'utente (§0 p.11): **l'app accetta solo `Texture2D`**; materiali e `UI_Markers` restano in Unreal e vengono solo elencati (audit §C). Classi reali delle icone degli EDA: 133 `Texture2D`, 21 `MaterialInstanceConstant`.
- Le entità Module senza SMDA sono solo 2 (`MOD26-Shield_01`, `MOD27-Shield_02`), entrambe con icona.

### 0.2 Dove mettere le nuove texture (proposta, da confermare alla prima implementazione)
Seguire le cartelle già in uso: `/Game/3_ASSETS/UI/Icons/Modules/` per i moduli (sottocartelle `MainBodies`, `Pylons`, `Items` come oggi), `/Game/3_ASSETS/UI/Icons/...` per le entità non-modulo (verificare la cartella usata da `T_COL_*` e `T_CON_*`), nome `T_<ID>`. Mai nelle cartelle `4_LVLPRESETS`. Le texture esistenti non si spostano né si rinominano.

### 0.3 Modalità operative
- **M1 — foglio master (in uso)**: ogni campo si calcola così: valore del foglio se compilato e valido; altrimenti valore letto da Unreal (SMDA/EDA). "Non compilato correttamente" = vuoto, `#N/A`/errore di formula, valore fuori elenco (enum non valido) o placeholder; da confermare con l'utente l'elenco esatto. Se foglio e Unreal hanno entrambi un valore diverso: **vince il foglio** e la differenza si segnala nel report. Il valore preso da Unreal viene salvato nell'app con l'indicazione dell'origine (`source: unreal`) e **non** viene scritto sul foglio (D1).
- **M2 — app master (futuro)**: al momento del distacco si fa **un'unica lettura completa** dello stato di Unreal (tutte le famiglie in scope) e la si salva come base. Da lì in poi il flusso è **solo app → Unreal**; la lettura da Unreal si disattiva (o resta solo come strumento di confronto/diagnosi, mai come sorgente).
- Il passaggio M1→M2 è un'azione esplicita e reversibile fino a quando l'utente non conferma; prima va fatto un backup del database.
- Fino al passaggio, gli script Python Google di Unreal e l'app possono scrivere sugli stessi asset: nel report del push segnalare gli asset cambiati da altri dall'ultima lettura.

### Come sostituire `UnrealReferences` (verificato sull'Editor, 2026-10-07, sola lettura)
Risoluzione **per nome** tramite l'Asset Registry dell'Editor, al momento del push: il nome dell'asset (es. `T_COL_Crystal`) è la chiave, non il path. Prova fatta con l'Editor aperto sui dati reali:
- Texture2D nel progetto: 9310. Nomi icona usati da ENTITIES: 99 → **98 trovati per nome**; 1 mancante (`T_COL_RocketsRecharge`, l'entità nuova: l'asset non esiste ancora); 1 **ambiguo** (`T_SB_Helicon` esiste in due cartelle: `Icons/Modules/MainBodies/` e `Icons/MainBodies/`).
- Dei 146 path di `UnrealReferences`: **4 sono già rotti** (asset spostati/rinominati: `T_MB_StartingBody`, `T_MOD78-RageGun_S`, `T_BODY14-IronScale`, `T_BODY15-GoldWings`) e **tutti e 4 si risolvono correttamente per nome**. Conferma che la strategia per-nome elimina il problema segnalato dall'utente.
- Regole proposte: nome univoco → usa; più asset con lo stesso nome → **warning "ambiguo" e campo non scritto** (l'utente sceglie o rinomina); nessun asset → warning e campo non scritto (oppure, se l'app ha un'immagine per quella riga, vedi sotto).
- **Da decidere con l'utente (domande L–M in §10)** come l'app fornisce mesh e immagini: (1) riferimento per nome a un asset già esistente nel progetto, con un selettore nell'app alimentato **in tempo reale dall'Editor** (ricerca Asset Registry via MCP), oppure (2) l'app custodisce il file (immagine; per le mesh un FBX) e il push lo **importa** in Unreal (`AssetImportTask`), come già prevedeva `scripts/import_hellgalaxy_images.py`.
- Nota dati: nella cartella `DataAssets/Entities` dell'Editor risultano **429 asset** contro 271 entità del foglio: la ricerca era ricorsiva e può includere sottocartelle; da verificare (potrebbero essere orfani da elencare nel report, mai da cancellare).

### ⏸️ Vincolo corrente (2026-10-07, ha la precedenza su tutto): NON scrivere su Unreal
L'utente lavora in parallelo, con un'altra sessione Claude, su un ramo del progetto Unreal dedicato al **crafting**. Finché non dà il via libera: **nessun file e nessun asset del progetto Unreal va toccato** (la scrittura `apply` è bloccata da `HG_UE_ALLOW_WRITE`). Gli interventi consentiti sono solo quelli dell'app per **leggere correttamente i dati tra Unreal e il foglio Google**: implementati la lettura degli `EDA_` ("Leggi da Unreal", valori effettivi, confronto) e restano da fare, in sola lettura, la lettura di `SMDA_` (mesh, shield mesh, quality) con l'import dei moduli dal tab `Modules`. La Fase 1 "push `EDA_`" è **in pausa** (codice pronto ma non collegato).

## 1. Obiettivo (decisione dell'utente, 2026-10-07)

> Far funzionare il passaggio di dati **dall'applicazione al progetto Unreal premendo un tasto nell'app**, non da Unreal. Non è obbligatorio riusare gli strumenti degli script Python già esistenti: gli script Google servono **solo per capire quali Data Asset, Blueprint e altro** vanno modificati.

Catena finale:

```
Foglio Google ──(pull, già fatto)──► App (DB SQLite, modifiche locali) ──(tasto "Invia a Unreal")──► Editor Unreal aperto
```

Il foglio resta la fonte di verità finché non c'è parità (D1). Il push verso Unreal parte dai valori `current` dell'app.

## 2. Canale app → Unreal: verificato

L'Editor UE 5.8 espone un **server MCP HTTP** (plugin nativo + VibeUE) già usato dalle sessioni Claude (`.mcp.json` del progetto Unreal: `unreal-mcp` → `http://127.0.0.1:8010/mcp`; porta cambiata da 8000 a 8010 il 2026-10-05 perché la 8000 è occupata da `Manager.exe`; `ModelContextProtocol.StartServer 8010` per riavviarlo nell'Editor in esecuzione).

Verificato il 2026-10-07 dal terminale (nessuna modifica fatta, solo `initialize` + `tools/list`):

1. `POST http://127.0.0.1:8010/mcp` con header `Content-Type: application/json` e `Accept: application/json,text/event-stream`, body JSON-RPC `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"hgdb","version":"1"}}}` → risposta 200 con header **`Mcp-Session-Id`** (da rimandare in tutte le chiamate successive).
2. `notifications/initialized` (senza id), poi `tools/list`. Strumenti presenti: `execute_python_code`, `discover_python_module`, `discover_python_class`, `discover_python_function`, `list_python_subsystems`, `list_toolsets`, `describe_toolset`, `call_tool`, `capture_image`, `deep_research`, `terrain_data`.
3. **`execute_python_code`**: argomenti `code` (stringa, deve iniziare con `import unreal`) e **`auto_save`** (stringa; default `true`: prima di eseguire **salva tutto il contenuto sporco e i world package** — l'app deve passare sempre `"false"`). La risposta riporta stdout, stderr, stato e `resident_maps`.
4. `GET` sull'endpoint risponde 405: è normale (serve POST).

Quindi l'app (Node, `server.js`) può eseguire Python dentro l'Editor con `fetch`, senza dipendenze. **Requisiti**: Editor aperto sul **progetto HellGalaxy**, stessa macchina dell'app (o rete locale; sconsigliato esporre la porta), nessuna Play-In-Editor in corso.

### Alternative valutate
| Opzione | Esito |
|---|---|
| Plugin Remote Control (HTTP porta 30010) | Non abilitato nel `.uproject` (verificato: nessuna risposta su 30010). Richiederebbe modificare il `.uproject`. Scartata: l'MCP c'è già. |
| Commandlet headless (`UnrealEditor-Cmd -run=pythonscript`) | L'Editor deve essere chiuso, avvio lento, e nel progetto un commandlet (`PkgInfo`) è già crashato su asset del ciclo BP. Tenere come ripiego, non come strada principale. |
| Unreal che legge dall'app (pull, piano precedente) | Scartata dall'utente: il tasto deve stare nell'app. Il codice di lettura può comunque servire se l'app gira sul NAS (§9). |

## 3. Architettura proposta

```
UI app: sezione ENTITIES → "Invia a Unreal (anteprima)" / "Applica"
   │  POST /api/unreal/push?mode=dry|apply&scope=entities
   ▼
server.js
   1. costruisce il payload (JSON) dalle tabelle del DB (valori current)
   2. lo scrive in  <UE_PROJECT_DIR>/Saved/HGDB/payload.json   (stesso PC)
   3. chiama l'MCP:  execute_python_code(code="import unreal; import HGDBApply; print(HGDBApply.run(r'…/payload.json', apply=False))", auto_save="false")
   4. legge il report JSON stampato da Python e lo restituisce alla UI
   ▼
Editor Unreal (main thread, bloccato durante la chiamata)
   Content/Python/HGDBApply.py  (+ HGDBConvert.py)
   - legge payload, confronta con gli asset esistenti (dry run: nessuna scrittura)
   - apply: crea/aggiorna solo gli asset che cambiano, li salva uno per uno, restituisce il report
```

Scelte e motivazioni:
- **File di handoff** invece del codice inline: niente problemi di escaping/lunghezza, payload leggibile per debug. Il percorso del progetto Unreal sta in una variabile d'ambiente/`.env` dell'app (`HG_UE_PROJECT_DIR`, es. `D:\Plastic\HellGalaxy`), l'URL MCP in `HG_UE_MCP_URL` (default `http://127.0.0.1:8010/mcp`). Mai nel repository.
- **A lotti**: una singola chiamata blocca l'Editor e può andare in timeout. Il server divide in lotti (es. 40 asset) e fa una chiamata per lotto, aggiornando l'avanzamento nella UI.
- **Nuovi moduli Python nuovi, senza Google né pandas**: `HGDBApply.py`, `HGDBConvert.py` in `Content/Python/`. Non importare `CreateACSData.py` (all'import crea cartelle, importa `GoogleToCSV`→`gspread`/OAuth e dipende da pandas).
- **Dry run obbligatorio prima di applicare** (stesso schema del pull dal foglio): report con `create`, `update` (con i campi), `unchanged`, `warnings` (icone/mesh non trovate), `orphans` (solo elenco).
- **Non cancellare e non rinominare mai** (D4). Gli asset orfani sono solo elencati.
- Sicurezza: l'endpoint `/api/unreal/*` esiste solo se `HG_UE_PROJECT_DIR` è configurato; con `HG_API_TOKEN` attivo richiede il token come tutte le `/api/*`. Un'app esposta pubblicamente **non deve** raggiungere l'MCP dell'Editor.

## 4. Cosa il foglio produce oggi in Unreal (analisi degli script esistenti)

Fonte: `D:\Plastic\HellGalaxy\Content\Python\CreateACSData.py` (1402 righe) + `GoogleToCSV.py`. Le due funzioni che contano sono `CreateACSDataAssets()` (riga 735, **Data Asset**) e `CreateACSBP()` (riga 1139, **Blueprint** e tabella traduzioni). Si lanciano da un Editor Utility Widget; **nessuna delle due salva gli asset né fa il checkout** (il salvataggio dipende dall'autosave/dal salvataggio manuale). Foglio: `1g8BDuaZD1QGXds_vMBJWHGRhrc_LIXWPHcFRRTZUheY`.

### 4.1 Tab del foglio letti e range (importanti: il range limita le colonne!)

| Tab | Range in `CreateACSDataAssets` | Range in `CreateACSBP` | Nell'app? |
|---|---|---|---|
| `ENTITIES` | `A:G` | `A:B` | ✅ tabella `entities` (12 colonne) |
| `CargoItemsAndLoots` | `A:N` | `A1:A1000` | ❌ |
| `Items` | `A:K` | `A:B` | ❌ |
| `Modules` | `A:S` | `A:G` | ⚠️ solo parziale: 4 categorie (body/engine/primary/secondary) da CSV diversi (`HS - Entity - Modules - *.csv`, con righe di intestazione di statistiche, non coincidono con il tab) |
| `UnrealReferences` | `A:B` (icone), `C:D` (mesh) | — | 🚫 **Non verrà replicato** (decisione §0): icone e mesh si risolvono per nome dall'Asset Registry o si importano dall'app |

Dati reali letti dal foglio il 2026-10-07 (sola lettura, URL CSV): `ENTITIES` 271 ID, `CargoItemsAndLoots` 271 ID (tutti presenti in ENTITIES e viceversa), `Items` 31 ID, `Modules` 140 ID (tutti in ENTITIES). Quindi **tutte le entità hanno una riga Cargo/Loot e quindi ricevono i BP `CI_` e `BP_ACS_Loot_`**; circa 36 entità di tipo `Module` non hanno riga nel tab `Modules` (e non hanno quindi SMDA né BP `SML_SM_`).

### 4.2 Data Asset (cartella base `/Game/2_LOGIC/Entities/DataAssets/`)

Per ogni riga il flusso fa `CreationAndCommonDataFill` (crea l'asset con `DataAssetFactory` se manca; imposta numeri, bool, stringhe) e `UncommonDataFill` (enum, testi, oggetti: icone/mesh). La colonna → proprietà con `change_camel_to_snake` (es. `BasePrice` → `base_price`).

| Tab/sezione | Classe C++ (`UCPP_DA_*`) | Prefisso | Sottocartella | Colonne → proprietà |
|---|---|---|---|---|
| ENTITIES | `CPP_DA_Entity` | `EDA_` | `Entities/` | `Label`(FText), `BriefDescription`(FText), `EntityType`(enum), `BasePrice`(int), `BaseRarity`(enum), `Icon`(soft object, via UnrealReferences IconName→IconPath); `entity_id` = `(ID)` (impostato alla fine). `ProducerIcon` esiste in C++ ma **non** è letto (fuori da A:G). |
| CargoItemsAndLoots (cargo) | `CPP_DA_CargoItem` | `CIDA_` | `CargoItems/` | solo `StackValue` → `stack_value`. (`bCanBeSold` esiste in C++ ma non è nel foglio.) |
| CargoItemsAndLoots (loot) | `CPP_DA_Loot` | `LDA_` | `Loots/` | `Attractable`, `ForceToInspect` (bool), `LootStaticMesh0..6` → array `loot_static_mesh` di StaticMesh (SMName→SMPath). Le colonne `Override`/`Ovveride` (refuso nel foglio) sono ignorate. |
| Items | `CPP_DA_SecondaryEngine`, `PowerGenerator`, `HeatSink`, `Radar`, `ShieldGenerator`, `TractorBeam`, `AiAugmentationSystem`, `WarpDrive`, `InternalCargo`, `SonicMatterCollector`, `BoostCharger` | `SIDA_` | `Items/<Sezione>/` (la sezione `BoostChargeGenerator` del foglio → cartella DA `BoostCharger`) | `ItemType`(enum), `PowerConsumption`, `Incorporated`, `Quality` + proprietà specifiche (vedi §4.5) |
| Modules | `CPP_DA_MainBody`, `MainEngine`, `Cargo`, `FuelTank`, `Turret`, `Decoration`, `NuclearRocket`, `PrimaryWeapon`, `SecondaryWeapon`, `SonicMatterExtractor`, `Toolbox`, `Pylon` (`DefensiveWeapon` esiste ma è commentato) | `SMDA_` | `Modules/<Sezione>/` | `ItemType`(ignorato), `StaticMesh`, `ModuleType`(enum), `PowerConsumption`, `Incorporated`, `Quality` + specifiche (§4.5) |

Regole di conversione dei valori (da riprodurre fedelmente, `CreateACSData.py` righe 476–620 e 328–368):
- numero (`float(x)` riuscito) → `float`; `TRUE/VERO` → `True`; `FALSE/FALSO` → `False`; altrimenti stringa. Celle vuote (`NaN`) → proprietà non toccata.
- Enum: `NTEntityType` (`Module`,`Consumable`,`Item`,`Collectable`,`None`,`Unknown`), `NTRarityType` (`Salvage`,`Common`,`Uncommon`,`Rare`,`Epic`,`Legendary`,`Mythic`), `NTModuleType`, `NTItemType`, `NTWeaponType`, `NTPrimaryAmmoType`, `NTSecondaryAmmoType`, ecc.: dizionari `NT…Switch` (righe 211–326). Valore non in tabella → il codice attuale restituisce la stringa `"Error in returning Label"` e prosegue: il nuovo codice deve invece **segnalare un errore per riga e non scrivere quel campo**.
- Testi (`Label`, `BriefDescription`): se vuoto o contiene `[C]` → `unreal.Text(valore)` **non localizzato**; altrimenti `NSLOCTEXT("Entity_ID__<proprietà>", "Entity_ID__<proprietà>_<NomeAsset>", valore)` (namespace e chiave sono quelli del flusso attuale e collegano la localizzazione: non cambiarli). Prima di assegnare il testo il flusso azzera il campo con un testo vuoto.
- Icone/mesh: `UnrealReferences` `IconName`→`IconPath`, `SMName`→`SMPath` con `load_asset`. Nome non trovato → il campo resta `None` in silenzio (nel nuovo codice: **warning nel report**).
- Dopo aver impostato tutto, per le entità si imposta `entity_id`.

### 4.3 Blueprint e tabella traduzioni (`CreateACSBP`, cartella base `/Game/2_LOGIC/Entities/BP/`)

Solo per gli ID presenti sia in ENTITIES sia in CargoItemsAndLoots (oggi tutti):

| Asset | Cartella | Classe madre | Proprietà impostate sul CDO |
|---|---|---|---|
| `CI_<ID>` | `BP/CargoItems/` | `/Game/PCK/AdvancedSceneTools/AIS/BPO_CargoItem` | `entity` = EDA_<ID>, `cargo_item` = CIDA_<ID> |
| `BP_ACS_Loot_<ID>` | `BP/Loots/` | `/Game/PCK/AdvancedSceneTools/ACS/Collectable/Loot/BP_ACS_Loot` | `entity`, `loot` = LDA_<ID> |
| `SML_SI_<ID>` (se l'ID è in `Items`) | `BP/Items/<Sezione>/` (nome sezione **grezzo** del foglio) | per sezione: `/Game/2_LOGIC/Ship/BP/Modularity/Items/SML_SI_*` (`BlueprintSwitch`, righe 370–401, con alias `BoostChargeGenerator`, `AiAugmentationsSystem`) | `DA_Item` = SIDA_<ID> (se esiste), `entity` |
| `SML_SM_<ID>` (se l'ID è in `Modules`) | `BP/Modules/<Sezione>/` | per sezione: `/Game/2_LOGIC/Ship/BP/Modularity/Modules/SML_SM_*` (e `Weapon/Primary|Secondary/…`) | `DA_Module` = SMDA_<ID>, `DA_Item` = SMDA_<ID>, `entity`; poi `transact_object` + `close_asset` |
| Consumable/Collectable (né Items né Modules) | solo `CI_` e `BP_ACS_Loot_` | | |

- I BP si **creano solo se mancano** (`BlueprintFactory` con classe madre da `BlueprintSwitch`); poi si impostano le proprietà sul **CDO** della classe generata. Il flusso attuale **non compila né salva** il BP dopo la modifica: il nuovo codice deve `compile_blueprint`, marcare sporco e salvare.
- **`/Game/2_LOGIC/Entities/DT_EntityTranslations`** (DataTable, riga `FCPP_DT_EntityTranslation`: `Item`, `CargoItem`, `Loot` = percorsi dei BP): viene **rigenerata per intero** scrivendo un CSV (`<progetto>/../CSV/DT_EntityTranslations.csv`, colonne `"", Item, CargoItem, Loot`) e caricandolo con `DataTableFunctionLibrary.fill_data_table_from_csv_file`. Le righe vengono dagli ID che hanno BP; per Consumable/Collectable `Item` è vuoto.
- Orfani: `FindAssetsToDelete('/Game/2_LOGIC/Entities/', EntityID, Prefixes=[CI_, BP_ACS_Loot_, SML_SM_, SML_SI_, EDA_, CIDA_, LDA_, SIDA_, SMDA_])` stampa solo un warning degli asset i cui ID non sono più in ENTITIES. Non cancella.

### 4.4 Fragilità del flusso attuale da NON ereditare

1. **Le sezioni dei tab `Items` e `Modules` sono riconosciute per posizione**: `GetDfIndexes` cerca le righe con `(ID)` e poi `GetDataFrame(df, indexes, N)` usa l'**indice N fisso** (Modules: MainEngine=0, Cargo=1, FuelTank=2, Turret=3, Decoration=4, NuclearRocket=5, PrimaryWeapon=6, SecondaryWeapon=7, SonicMatterExtractor=8, Toolbox=9, Pylon=10; MainBody è il blocco sopra la prima intestazione. Items: PowerGenerator=0 … BoostCharger=9, SecondaryEngine sopra). Spostare o aggiungere una sezione nel foglio rompe tutto. **Nell'app la sezione/tipo va salvata come campo esplicito per ogni riga.**
2. Il tipo di BP/cartella si deduce confrontando la posizione della riga con quella delle intestazioni (righe 1266–1347): stessa fragilità.
3. Nessun salvataggio/checkout; nessun dry run; `set_editor_property` su tutti i campi anche se uguali (marca sporchi tutti gli asset).
4. Valori enum sconosciuti ignorati in silenzio; icone/mesh mancanti ignorate in silenzio.
5. `Quality` compare sia in `ENTITIES` (non letta da Unreal) sia in `Items`/`Modules` (letta, `CPP_DA_Item.Quality`): due colonne con lo stesso nome e master non chiaro.
6. Dipende da pandas/gspread/OAuth nel Python dell'Editor, e le credenziali (`credentials.json`, `token.pickle`) stanno in `Content/Python/`.

### 4.5 Proprietà specifiche per classe (da `Source/HauntedSpace/DataStructures/Entities/`)

`CPP_DA_Item` (base degli item): `ItemType`, `PowerConsumption`, `Incorporated`, `Quality`, `Extensions` (non nel foglio). `CPP_DA_Module` (estende Item): `StaticMesh`, `ShieldStaticMesh` (non nel foglio), `ModuleType`, `NOEDIT_SocketsMap` (non nel foglio).

| Classe | Proprietà aggiuntive |
|---|---|
| SecondaryEngine | TranslationalForce, Torque, BoosterMultiplier, StressDriveMultiplier, SpeedIncrement, BoostChargeConsumption |
| PowerGenerator | PowerGenerated, MaxPower, MaxConnections |
| HeatSink | HeatDissipation, MaxHeat, MaxConnections |
| Radar | Range, ScannerRange, ScannerRechargeTime, ScannerDuration |
| ShieldGenerator | ShieldIntegrity, TimeBeforeStartRecharging, UnitRechargeTime |
| TractorBeam | Range, AttractionForce |
| AiAugmentationSystem | MaxAisSlots, PowerConsumptionPerAI |
| WarpDrive | MaxWarpSpeed, MineralFuelConsumption, WarpRadarRange |
| InternalCargo | SlotNumber |
| SonicMatterCollector | MaxSonicMatter |
| BoostCharger | MaxBoostCharge, TimeBeforeStartRecharging, BoostRechargeRate, RecoveryThresholdPercent |
| MainBody | BoosterSpeedMultiplier, StressDriveSpeedMultiplier, MaxSpeed, HullIntegrity, StressDriveStamina, FuelCapacity |
| MainEngine | FuelConsumption, StressDriveFuelConsumption, SpeedIncrement, StressDriveStaminaConsumption, BoostChargeConsumption |
| Cargo | SlotNumber |
| FuelTank | LiquidFuelCapacity |
| Turret | Range, RotationSpeed |
| NuclearRocket | Speed, Range, HullDamage, ShieldDamage, OrganicDamage, GhostDamage |
| Decoration, Pylon, Toolbox | nessuna |
| Weapon (base di Primary/Secondary/SonicMatterExtractor/Defensive) | WeaponType, AmmoMagazineSize, Rate, ChargeTime, BaseDamageMin, BaseDamageMax, CriticalHitChance, CriticalHitMultiplier, ProjectileSpeed, ProjectileAccuracy, ProjectileRange, RotableStructure, HeatGeneration |
| PrimaryWeapon | PrimaryAmmoType (enum) |
| SecondaryWeapon | SecondaryAmmoType (enum) |
| SonicMatterExtractor | AttractionRange |

Colonne del foglio **Items** (intestazioni reali): `SecondaryEngine (ID)`, `ItemType`, `PowerConsumption`, `Incorporated`, `Quality`, `TranslationalForce`, `Torque`, `BoosterMultiplier`, `StressDriveMultiplier`, `SpeedIncrement`, `BoostChargeConsumption` (le altre sezioni hanno la propria riga di intestazione). Colonne del foglio **Modules** (MainBody): `MainBody (ID)`, `ItemType`, `PowerConsumption`, `Incorporated`, `Quality`, `StaticMesh`, `ModuleType`, `BoosterSpeedMultiplier`, `StressDriveSpeedMultiplier`, `HullIntegrity`, `MaxSpeed`, `StressDriveStamina`, `FuelCapacity`, poi colonne vuote e `Price`, `Rarity`, `Hull`, `Shield` (oltre il range `A:S`, quindi **non** lette da Unreal). Le intestazioni complete di tutte le sezioni vanno lette dal foglio quando si implementa (nota: l'export CSV `gviz` perde le etichette di colonna se la riga ha tipi misti; usare `headers=0&range=…` come in `docs` oppure Apps Script).

## 5. Cosa manca nell'app (lavoro lato app)

| Dato | Oggi | Serve |
|---|---|---|
| ENTITIES | ✅ tabella `entities`, pull, UI | niente per la fase 1 |
| CargoItemsAndLoots | assente | tabella `cargo_loot` (`id`, `StackValue`, `Attractable`, `ForceToInspect`, `LootStaticMesh0..6`), stesso schema current/original, pull, UI |
| Items | assente | tabella `items` con campo **`section`** esplicito + tutte le colonne di ogni sezione |
| Modules | parziale (4 categorie da altri CSV) | tabella `modules_full` (o estensione) con campo **`section`** esplicito per le 12 sezioni e tutte le colonne A:S; decidere cosa fare delle 4 categorie esistenti (§10 D) |
| Icone/mesh | assenti | **nessuna tabella di riferimenti**: ogni riga (entità, modulo) porta il **nome** dell'asset Unreal (o il file da importare, §0); il push risolve per nome |
| Push | assente | `scripts/unreal_bridge.js` (client MCP), `POST /api/unreal/push`, `GET /api/unreal/ping`, pulsanti UI |

Ogni nuovo script/tabella: aggiungere a `Dockerfile`, `docker-entrypoint.sh` e ai `paths` del workflow; mantenere CRLF; aggiornare `docs/DOCUMENTAZIONE.md` a ogni passo.

## 6. Fasi (ordine consigliato; ogni fase termina con test e va concordata)

### Fase 0 — Collegamento senza modifiche (mezza giornata)
- **App**: `scripts/unreal_bridge.js`: `ping()` = `initialize` → `notifications/initialized` → `tools/call execute_python_code` con `import unreal; print(unreal.SystemLibrary.get_engine_version())` e `auto_save:"false"`; gestione sessione `Mcp-Session-Id`, timeout configurabile (es. 120 s), errori chiari (Editor chiuso → connessione rifiutata; porta sbagliata). `GET /api/unreal/ping`. Pulsante **"Test collegamento Unreal"** nella sezione ENTITIES (mostra versione engine e nome progetto).
- **Unreal**: nessuna modifica.
- **Test**: T-U0a Editor chiuso → messaggio "Editor non raggiungibile"; T-U0b Editor aperto → versione `5.8.x` e `unreal.Paths.project_dir()`; T-U0c verificare che nessun asset risulti sporco dopo il ping (`auto_save:"false"`).

### Fase 1 — Entità → `EDA_*` (Data Asset delle entità)
- **Unreal (nuovi file in `Content/Python/`)**:
  - `HGDBConvert.py`: copia **pulita da Google/pandas** dei dizionari enum (`NTEntityTypeSwitch`, `NTRarityTypeSwitch`, …), funzione `to_value(raw, current_value)` che applica le regole di §4.2, funzione testi `make_text(prop, asset_name, raw)`, risoluzione icone/mesh (`resolve_icon(name)`).
  - `HGDBApply.py`: `run(payload_path, apply)` → legge il JSON, per ogni entità: calcola il valore desiderato per ognuna delle 6 proprietà + `entity_id`; legge l'asset se esiste; dry run = confronto (testi: confronta stringa sorgente e flag localizzato; icone: confronta path); apply = `create_asset` (se manca) con `DataAssetFactory`, `set_editor_property` solo dei campi che cambiano, `EditorAssetLibrary.save_asset` solo degli asset toccati, checkout se il source control è attivo (§7). Ritorna un JSON `{summary, create[], update[{id,fields}], unchanged, warnings[], errors[], orphans[]}`.
- **App**: `buildEntitiesPayload()` (colonne `(ID)`, `Label`, `BriefDescription`, `EntityType`, `BasePrice`, `BaseRarity`, `Icon`; **non** `LabelKey`, `DescriptionKey`, `Quality`, `ModuleType`, `ProducerIcon`, `extra`); `POST /api/unreal/push?scope=entities&mode=dry|apply`; UI: due pulsanti + pannello report come quello del pull.
- **Icone**: `HGDBApply` risolve il nome icona (`Icon`) cercando una `Texture2D` con quel nome nell'Asset Registry (sotto `/Game`); ambiguo o mancante → warning e campo non scritto (vedi §0). Nessuna dipendenza da `UnrealReferences`.
- **Test di parità**: eseguire il flusso Google esistente su una copia/branch e il push dell'app sugli stessi dati; confrontare i 7 campi di tutti gli `EDA_*` (script di confronto che esporta nome, classe, valori). Secondo apply = 0 modifiche. Controllo a campione con Fathom `get_asset_properties`.

### Fase 2 — Cargo e Loot → `CIDA_*`, `LDA_*`
- App: tabella `cargo_loot` + pull; payload con `StackValue`, `Attractable`, `ForceToInspect`, `LootStaticMesh0..6` (nomi mesh).
- Unreal: `HGDBApply` gestisce le classi `CPP_DA_CargoItem` e `CPP_DA_Loot`; mesh risolte per nome (UnrealReferences o Asset Registry); mesh non trovata → warning.
- Test: parità su tutti gli `CIDA_*`/`LDA_*`; casi: loot senza mesh, loot con 7 mesh.

### Fase 3 — Blueprint `CI_*`, `BP_ACS_Loot_*` + `DT_EntityTranslations`
- Unreal: `ensure_bp(folder, name, parent_path)` (crea se manca, mai rinomina), impostazione CDO (`entity`, `cargo_item`, `loot`), compilazione, salvataggio; rigenerazione della DataTable **senza passare da file CSV condiviso** se possibile (`DataTableFunctionLibrary` o CSV in `Saved/HGDB/`), mantenendo le stesse colonne.
- Test: nessun BP duplicato, tutte le righe della DataTable puntano a BP esistenti, BP compilano senza errori, nessun BP preesistente cambia classe madre.
- **Rischio alto** (crea asset nuovi): chiedere conferma esplicita all'utente prima dell'apply, mostrare nel dry run quali BP verranno creati.

### Fase 4 — Items → `SIDA_*` + `SML_SI_*`
- App: tabella `items` con `section`; Unreal: mappa sezione → (classe DA, cartella DA, cartella BP, BP madre) **esplicita** (tabella in `HGDBConvert.py`, con gli alias `BoostChargeGenerator`↔`BoostCharger` e `AiAugmentationsSystem`).

### Fase 5 — Modules → `SMDA_*` + `SML_SM_*`
- App: tabella dei moduli con `section` (12 sezioni); gestione `StaticMesh` e `ModuleType`; armi con ammo type. Rinviare finché non è chiaro il rapporto con le 4 categorie esistenti (§10 D).

### Fase 6 — Rifiniture
- Elenco orfani nel report (mai cancellazione), localizzazione (`LocalizationMaster`, in attesa della struttura), eventuale modalità "pull" per app su NAS (§9).

## 7. Vincoli e sicurezza (da `CLAUDE.md` di Unreal e dalle decisioni dell'utente)
1. **Non compilare né lanciare build** autonomamente; **nessuna modifica C++** senza conferma (i campi extra D5 — `LabelKey`, `DescriptionKey`, `Quality` di entity, `ModuleType` di entity — non esistono in `CPP_DA_Entity`).
2. **Non rinominare né cancellare asset**; gli orfani sono solo elencati.
3. **Non modificare `BP_UISubsystem` né `EUW_Questv2`**; il widget `EUW_HGDB_Sync` del piano precedente **non serve più** (il tasto è nell'app). I vecchi script Google restano com'è (sorgente `google` invariata).
4. Prima di toccare asset con tool MCP leggere `Docs/Guides/UnrealMCP_ToolSelection.md`. Un'esecuzione `execute_python_code` blocca l'Editor: avvisare l'utente. **`auto_save` sempre `"false"`**; salvare solo gli asset toccati con `save_asset`.
5. **Source control**: il progetto usa Plastic SCM (`D:\Plastic`, plugin `UEPlasticPlugin`). Un asset di sola lettura non si può salvare: nel codice Unreal usare `unreal.SourceControl` per il checkout prima del salvataggio; se non riesce, **segnalare nel report e non scrivere**. Da confermare con l'utente (§10 F).
6. Non eseguire il push se è attiva la Play-In-Editor o se ci sono asset sporchi non salvati che l'utente potrebbe perdere (il dry run deve segnalarlo).
7. Credenziali Google in `Content/Python/`: non toccarle, non copiarle; segnalare all'utente il rischio.
8. Le sessioni future **non** devono usare l'MCP di Unreal in scrittura senza OK dell'utente; la lettura (dry run, `discover_*`) è libera.
9. Nessun token/URL privato nel repository (usare `.env` locale, già ignorato da git).

## 8. Test per l'utente (checklist da seguire dopo ogni fase)

| # | Quando | Cosa fare | Esito atteso |
|---|---|---|---|
| U1 | Fase 0 | Editor chiuso → "Test collegamento Unreal" | Messaggio chiaro "Editor non raggiungibile" |
| U2 | Fase 0 | Editor aperto → stesso pulsante | Versione 5.8.x e percorso del progetto |
| U3 | Fase 0 | Controllare il Content Browser | Nessun asset sporco comparso |
| U4 | Fase 1 | App: modifica un `BasePrice` → "Invia a Unreal (anteprima)" | Il report indica solo quell'`EDA_<ID>` come "da aggiornare (BasePrice)" |
| U5 | Fase 1 | "Applica" | L'asset in Unreal ha il nuovo valore ed è salvato; gli altri `EDA_*` non risultano sporchi |
| U6 | Fase 1 | "Applica" una seconda volta | 0 modifiche |
| U7 | Fase 1 | Cambia l'icona con un nome inesistente | Warning "icona non trovata", asset invariato |
| U8 | Fase 1 | Valore di rarità non valido (`Foo`) | Errore per quella riga, campo non scritto, le altre righe proseguono |
| U9 | Fase 1 | Chiudi l'Editor a metà (o vai in Play) | Il push si ferma con messaggio chiaro; nessun asset a metà |
| U10 | Fase 1 | Parità: flusso Google vs app sullo stesso foglio | Stessi valori per tutti gli `EDA_*` |
| U11 | Fasi 2–5 | Stessa sequenza U4–U10 per ogni famiglia | Come sopra; BP compilati, nessun duplicato |

## 9. App sul NAS, più persone, Editor su altri PC (requisito dell'utente, 2026-10-07)

**Requisito**: l'app andrà sul NAS e più persone potranno lavorare in parallelo; l'app **non** sarà sullo stesso dispositivo del progetto Unreal. Il server MCP dell'Editor ascolta su `127.0.0.1` del PC dell'Editor ed **esegue Python arbitrario**: **non va mai esposto in rete né dietro il tunnel Cloudflare**.

**Soluzione scelta: "agente locale" (connessione in uscita, nessuna porta aperta)**
```
Browser (utente A) ──► App sul NAS ◄──(HTTPS, solo in uscita, token)── Agente sul PC dell'Editor ──► MCP 127.0.0.1:8010 ──► Editor
```
- L'**agente** è un piccolo script Node (`scripts/unreal_agent.js`, riusa `unreal_bridge.js` senza modifiche) che l'utente lancia sul PC dove ha l'Editor aperto. Si registra sul NAS con nome/utente e un **token personale**, e interroga periodicamente (long-polling) la coda dei lavori. Nessuna porta in ingresso sul PC, nessun accesso dal NAS al PC.
- L'app sul NAS ha una **coda di lavori** (tabella `unreal_jobs`: id, tipo `ping|push_dry|push_apply`, scope, agente scelto, payload, stato, report, timestamp, utente). Il pulsante dell'app crea un lavoro; l'agente lo prende, lo esegue sul proprio Editor (stessa logica di §3, con il payload **dentro il lavoro**, non in un file del NAS), restituisce il report; l'app lo mostra.
- Il comportamento attuale (app e Editor sullo stesso PC, chiamata diretta all'MCP) resta come **modalità "diretta"**; la modalità "agente" si sceglie da configurazione. Il codice di push va scritto fin dalla Fase 1 dietro un'interfaccia `UnrealTarget` con due implementazioni (diretta, via agente) per non rifare nulla.
- **Più utenti**: ogni utente ha il proprio agente; nell'app si sceglie **quale Editor** riceve l'aggiornamento (elenco agenti online con ultimo contatto). Un solo push alla volta per agente; coda per gli altri.
- **Attenzione, rischio da decidere con l'utente**: il progetto Unreal è in **Plastic SCM**: se due persone fanno push dai loro Editor, ognuno modifica i propri file `.uasset` (binari, non fondibili) e i due check-in andrebbero in conflitto. Proposta: un push alla volta con **blocco globale** ("in corso da <utente>"), il push **rifiuta di partire** se l'asset da modificare ha un checkout/modifica di altri (Plastic), e si consiglia un solo "utente-push" designato. Da confermare.
- Sicurezza: token per agente (revocabile), `HG_API_TOKEN`/Cloudflare Access davanti all'app, l'agente accetta solo lavori del proprio NAS, il codice Python eseguito viene **costruito dall'agente** da un elenco chiuso di operazioni (ping, push entità…), **mai** codice arbitrario ricevuto dalla rete.
- Fase dedicata (da pianificare dopo la Fase 1, prima del deploy sul NAS): **Fase N — Agente locale e coda lavori**: `scripts/unreal_agent.js`, tabella `unreal_jobs`, rotte `/api/agent/*`, UI di scelta agente, test (agente finto), aggiornamento Docker/compose, documentazione.
- Alternative scartate: aprire la porta MCP in LAN/VPN (esecuzione di codice remoto non autenticata), usare il tunnel Cloudflare verso l'Editor, headless sul NAS (il NAS non ha il progetto né l'Editor).

## 10. Domande aperte per l'utente (le risposte cambiano il lavoro)
- **A.** ~~Scope~~ **Risolta (§0)**: solo `EDA_` (fase 1); poi BP e static mesh dove necessario.
- **B.** ~~BP~~ **Risolta (§0)**: crea e aggiorna.
- **C.** ✅ **Risolta (§0 p.18–19)** (spiegata il 2026-10-07; dettagli sotto):
  - **`ProducerIcon`**: `ENTITIES.ProducerIcon` è compilata in **199** righe (170 Module, 27 Item, 2 Collectable) con 10 sigle (TTF 39, IGF 41, KnB 29, Rebext 21, Entity 18, Cagetastic 14, HomeInSpace 13, Tolec 11, Maison 7, Abby 6) = esattamente i 10 produttori dell'app. In Unreal `CPP_DA_Entity.ProducerIcon` esiste ma il flusso Google **non lo legge mai** (range A:G): solo **12 EDA** lo hanno assegnato a mano e **in 11 su 11 il valore contraddice il foglio** (es. `BODY01-Spartan`: foglio KnB, Unreal Tolec). Gli asset sono `ICN_producer_<sigla>` → risolvibili per nome. Opzioni: (a) ignorare (come oggi); (b) scrivere nel push da foglio/app per tutte le 199 (cambia 187 EDA in più e corregge/sovrascrive i 12); (c) scrivere solo dove Unreal è vuoto e segnalare le discrepanze. Impatto: possibile cambio visivo nella UI di gioco.
  - **`Quality`**: `ENTITIES.Quality` è compilata in 140 righe (solo Module) ed è **identica** a `Quality` dei tab Items/Modules in **tutti i 171 ID confrontabili (0 differenze)**: sembra una copia. `CPP_DA_Entity` non ha `Quality`; ce l'hanno `CPP_DA_Item`/`CPP_DA_Module` (SIDA/SMDA), già letta dal flusso dai tab Items/Modules. Proposta: master = tab Items/Modules (campo dell'item/modulo); `ENTITIES.Quality` solo mostrata come copia e segnalata se diverge.
- **D.** ✅ **Risolta (§0 p.15)**: importare esattamente tutto il tab `Modules`; le 4 categorie sono viste. ~~Parzialmente risolta (§0)~~: le 4 pagine di categoria erano solo viste di controllo; il tab `MODULES` è quello collegato a Unreal. ⏳ Da chiarire quando si arriva ai moduli: come si fondono le 116 righe dell'app con le 140 del tab `Modules`; le 4 categorie diventano filtri delle 12 sezioni?; le colonne oltre `S` (`Price`, `Rarity`, `Hull`, `Shield`) restano solo nell'app?
- **E.** Colonne `Override`/`Ovveride` di CargoItemsAndLoots: confermi che si ignorano? `bCanBeSold` va gestito dall'app?
- **F.** ~~Source control~~ **Risolta (§0)**: salva gli asset modificati; nessun check-in/commit/push senza conferma esplicita.
- **G.** Orfani: solo elenco nel report (proposto) o anche altro?
- **H.** ~~Icone/mesh: UnrealReferences?~~ **Risolta (§0)**: niente `UnrealReferences`; risoluzione per nome/import dall'app.
- **I.** ✅ **Risolta (§9)**: app sul NAS, più utenti, Editor su altri PC → agente locale con coda di lavori. Da confermare: gestione dei conflitti Plastic con più utenti (blocco globale, un utente-push).
- **J.** ⏳ **Rinviata dall'utente** (è voluto che manchino): come trattare nel push le entità `Module` senza riga nel tab Modules (solo `CI_`/Loot, nessun SMDA/SML_SM_). Chiedere quando si arriva ai moduli.
- **K.** ✅ **Risolta (§0 p.8)**: gli script Google restano attivi in parallelo; vedi modalità M1/M2 (§0.3).
- **L.** ✅ **Risolta (§0 p.7)**: le mesh si leggono dagli SMDA esistenti e si importano nell'app come riferimento per nome. Resta da decidere solo come aggiungere mesh **nuove** (selettore alimentato dall'Editor o import FBX): rinviato.
- **M.** ✅ **Risolta (§0 p.7)**: icone lette dagli EDA esistenti; per i nuovi dati texture sotto `/Game/3_ASSETS/UI/` (§0.2). Da verificare: la creazione di `T_COL_RocketsRecharge` dall'immagine dell'app.

## 11. Stato di questo piano
- Analisi script e asset: ✅ (questa sezione §4).
- Canale app→Unreal verificato: ✅ (§2).
- Domande §10: A, B, D, F, H, K, L, M risolte (§0); C e J rinviate dall'utente. L'utente ha segnalato **altri due punti in sospeso** ancora da comunicare.
- Implementazione: ✅ **Fase 0 completata il 2026-10-07** (ping Editor, sola lettura); ✅ **lettura EDA_ da Unreal** (M1, sola lettura) completata; ⏸️ Fase 1 (push EDA_) **in pausa per vincolo dell'utente**: codice scritto ma non collegato e con scrittura bloccata. Quando una fase parte, aggiornare qui lo stato e `docs/DOCUMENTAZIONE.md` §8.

## 12. Piano di verifica sull'Editor (2026-10-08) — da eseguire SOLO con il via libera esplicito dell'utente

Obiettivo: provare che il percorso app → agente → Editor funziona anche in scrittura, a piccoli passi, con possibilità di fermarsi a ogni passo. Prima di iniziare **chiedere**: (a) l'altra sessione sul ramo crafting ha finito (asset sporchi nell'Editor: `BPW_SR_Crafting_Screen` risultava sporco il 2026-10-08 e non è nostro)? (b) l'utente abilita `HG_UE_ALLOW_WRITE=1` sull'app e sul PC dell'agente? (c) il progetto è su Plastic: salvare è consentito, **nessun check-in** (decisione §0 p.5).

Prerequisiti (sola lettura, già funzionanti): agente connesso; "Sincronizza Unreal" senza errori; "Controlli" senza errori; ping dell'Editor con 0 asset sporchi (annotare quali sono prima di iniziare per non attribuirci quelli degli altri).
1. **Test di sola lettura finale**: ricontrollare discrepanze (oggi: 1 EDA da creare, 193 diversi, 2 Blueprint mancanti, DataTable identiche) e annotare i pacchetti sporchi.
2. **Prima scrittura, la più sicura**: `DT_EventsSignature` (nessun testo localizzato). `POST /api/unreal/datatables/apply {table:"signature", confirm:true}`. Verifica: il contenuto esportato dopo l'apply è identico, stesso numero di righe (665), un solo pacchetto salvato (`savedPackages`), nessun altro asset sporco.
3. `DT_DialoguesMultiplicityRules`, poi `DT_EventsText` (qui verificare che il testo FText mantenga namespace/chiave `DT_EventsText [hash]` / `<Riga>_Text`; se l'import li cambia, **fermarsi** e annotarlo in `docs/INTERVENTI_UNREAL.md`).
4. **Data Asset EDA_**: un lotto minimo (es. la creazione di `EDA_COL-RocketsRecharge` e 2-3 aggiornamenti scelti dall'utente) con `entities_push.py` in `apply`; verificare proprietà lette dopo la scrittura, nessun asset non voluto toccato, salvataggio solo degli asset modificati. Poi il resto in lotti da 40 (`HG_UE_BATCH`). Ricordare: per 187 EDA `ProducerIcon` viene scritto per la prima volta; `Test*` vanno esclusi dal push (decisione dell'utente).
5. **Blueprint**: la creazione non è implementata (solo anteprima dei mancanti): scriverla dopo che i passi 2-4 sono verificati.
6. **Cancellazioni** (gruppi A/B di `docs/INTERVENTI_UNREAL.md`): solo dopo ripetizione della verifica dei riferimenti (`scripts/unreal_cleanup.js`) e con il via libera dell'utente; mai prima di aver verificato i passi precedenti.
Dopo ogni passo: ping (asset sporchi), "Sincronizza Unreal" (le discrepanze devono sparire per ciò che è stato scritto), cronologia, e riportare all'utente l'esito con onestà (cosa provato, cosa no). Se un passo fallisce: fermarsi, non riprovare alla cieca, descrivere l'errore.
