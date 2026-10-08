# Localizzazione e fogli degli eventi — analisi e stato

Ultimo aggiornamento: 2026-10-08. Sola lettura: nessun file o asset di Unreal è stato toccato.

## 1. I due fogli

| Foglio | Key | Tab (gid) |
|---|---|---|
| **HS - Localization Master** | `1FrM2TIHvHjzHFSVdiASo_xOSjMrj5C_RwAiCfCrS25c` | 21 tab; i primi 4 sono quelli copiati nell'app: Identities (1420525390), Entities (1735809735), Quest (1400436127), EventsAudio (2021382912). Gli altri: Descrizioni brevi Entities, LOCKIT-RULES, Frasi provvisorie, TutorialPanels, Reorder, TUTORIAL TEXTS, Homerus (+Environments, Sequences, Ship), INV - Items, AI - Main, AI - Feedback, Azazel (+Environments), Cutscenes, Lore Oracles |
| **HS - Events** | `1TMRkXs5TxqS6QXVWmtI-wvqe-FbiZ_scdm6ySdpF4LE` | MainEvents (404693476), EventTexts (83578871), VALIDATION, Backup, ShipEvents, DialogueRules, BackupAManella, mainevents BackupaManella, CustomEvents, LeadVoxWords, NOTE TOOL, QuestEvents, QuestEventTexts |

Entrambi sono leggibili con l'export diretto `/export?format=csv&gid=<gid>` (foglio visibile a chiunque abbia il link).

## 2. Collegamento con le DataTable di Unreal (verificato il 2026-10-08)

Nessuno script Python del progetto Unreal cita questi fogli: le DataTable sono state **importate a mano da CSV** (file sorgente `D:/Downloads/DT_EventsSignature.csv`, `DT_DialoguesMultiplicityRules.csv`, `DT_EventsText.csv`). Il legame è stato quindi ricavato confrontando colonne e righe (665 / 665 / 895 righe).

| DataTable (Unreal) | Struct e colonne | Foglio e tab che la alimenta | Prova |
|---|---|---|---|
| `DT_EventsSignature` (`/Game/2_LOGIC/EventSystem/`) | `EventSignature`: Prefix, EventId, System, Multiplicity — 665 righe | **HS - Events › MainEvents** (colonne RowName, Prefix, EventId, System, Multiplicity, …) | 665/665 `RowName` presenti come righe della tabella |
| `DT_DialoguesMultiplicityRules` (`/Game/2_LOGIC/DialoguePlayer/`; il nome reale ha una "s": non `DT_DialogueMultiplicityRules`) | `DialogueEventMultiplicityType`: EventId, MultiplicityType, Multiplicity, Priority — 665 righe | **HS - Events › MainEvents** (colonne MultiplicityType, Multiplicity, Priority) | 665/665 |
| `DT_EventsText` (`/Game/2_LOGIC/DialoguePlayer/`) | `EventText`: Id, Text (NSLOCTEXT), FmodId — 895 righe | **HS - Events › EventTexts** (colonna "FMOD ID" = nome riga, "Text" = testo) **e** **HS - Localization Master › EventsAudio** (prima colonna senza nome = nome riga, ENGLISH = testo) | EventTexts: 895/895 chiavi e 895/895 testi identici; EventsAudio: 892/895 chiavi (mancano `HM_Escape_A/B/C`) e 892/892 testi identici; EventsAudio ha altre 164 chiavi che non sono nella DataTable |

Conclusioni:
- Dei 4 tab del Localization Master copiati nell'app, **solo EventsAudio** è collegato alle DataTable (a `DT_EventsText`). **Identities, Entities e Quest non sono legati a nessuna DataTable**: sono testi/traduzioni con chiavi (`KEY`, `ID`, `ENGLISH`), usati dal sistema di localizzazione di Unreal (`Content/Localization/Game`).
- `Entities` (Localization Master): le chiavi `<ID>-Name` / `<ID>-Description` corrispondono a `LabelKey`/`DescriptionKey` di ENTITIES: 508 chiavi su 542 trovate.
- **`DT_EventsText` ha due sorgenti con gli stessi testi** (Events › EventTexts e Localization Master › EventsAudio). Non è chiaro quale sia il master da cui si importa il CSV: da decidere con l'utente.
- Altri tab di HS - Events **non** legati a queste tre DataTable (0 chiavi in comune): QuestEvents (381 righe), ShipEvents (98), CustomEvents, DialogueRules (20 righe di regole; potrebbe alimentare `DT_EventDialogueRules`, 20 righe, non verificato), QuestEventTexts (vuoto).

### Precisazioni dell'utente (2026-10-08)
- **Identities, Entities, Quest** (Localization Master) sono solo una **vista riassuntiva di controllo**: dai testi di questi tab si aggiornano poi altri fogli. Con un database diventano più comodi da controllare che con i fogli Google.
- Del foglio **HS - Events** sono **realmente utili solo le prime due pagine: MainEvents ed EventTexts**. Le altre non vanno copiate.
- Quindi le tre DataTable sono alimentate così: **MainEvents → `DT_EventsSignature` + `DT_DialoguesMultiplicityRules`**, **EventTexts → `DT_EventsText`**. Il tab **EventsAudio** (Localization Master) contiene gli stessi testi in forma di vista con traduzione (ENGLISH/ITALIAN/DESCRIPTION): la fonte da cui generare `DT_EventsText` è **EventTexts**.

### Regola "in gioco / backup" (2026-10-08)
Tutto ciò che sta nel foglio **HS - Events** (MainEvents, EventTexts) e quindi nelle DataTable è **realmente in gioco** (riga normale). Le **164 righe di EventsAudio** (Localization Master) la cui chiave non è in EventTexts sono **backup per il futuro, non in gioco**: nell'app sono marcate "backup" e attenuate; le altre 892 sono "in gioco". Le tre chiavi di `DT_EventsText` che mancano in EventsAudio sono `HM_Escape_A/B/C`.

### Prova di rigenerazione (2026-10-08, solo lettura)
Costruendo le tre tabelle dalle righe copiate nell'app e confrontandole con quelle esportate dall'Editor: **`DT_EventsSignature` 665/665 righe identiche, `DT_DialoguesMultiplicityRules` 665/665, `DT_EventsText` 895/895** (Id e Text). Cioè l'app, oggi, potrebbe rigenerare le tre DataTable identiche.

## 3. Stato nell'app
Sezione **LOCALIZATION MASTER (foglio)** con 4 sotto-schede (Identities, Entities, Quest, EventsAudio): **copia fedele di sola lettura**, riga per riga, importata dall'export diretto di ciascun tab (`HG_LOC_SHEET_KEY` + `HG_LOC_GID_*` nel `.env`, oppure "Importa CSV"). Righe copiate il 2026-10-08: Identities 1936, Entities 889, Quest 1725, EventsAudio 1209. Il foglio **HS - Events** è nell'app solo con le due pagine utili, nella sezione **EVENTS (foglio)** (copia fedele di sola lettura): **MainEvents 665 righe, EventTexts 895 righe** (`HG_EVT_SHEET_KEY`, `HG_EVT_GID_MAINEVENTS`, `HG_EVT_GID_EVENTTEXTS`).

## 3b. Aggiornare le tre DataTable con un click dall'app (progetto, non attivo)
Tecnicamente fattibile **via MCP**, come per il resto: l'app genera i tre CSV dal database (stesse colonne degli export: `---,Prefix,EventId,System,Multiplicity` / `---,EventId,MultiplicityType,Multiplicity,Priority` / `---,Id,Text,FmodId`), li invia all'Editor e uno script Python li importa con `unreal.DataTableFunctionLibrary.fill_data_table_from_csv_string(...)` (la stessa chiamata già usata dal flusso Google per `DT_EntityTranslations`) e salva le tre DataTable. Il testo in colonna FText può essere inviato come testo semplice: Unreal assegna da solo namespace e chiave (lo schema attuale `NSLOCTEXT("DT_EventsText [hash]", "<Riga>_Text", ...)` è quello generato dall'import). Prima dell'apply: anteprima con le differenze riga per riga; sola scrittura di 3 asset. **Richiede il via libera dell'utente** (oggi la scrittura su Unreal è bloccata perché sul progetto lavora un'altra sessione) e va a lotti/una DataTable alla volta.

## 4. Passi successivi (da decidere con l'utente)
1. ✅ Fatto: MainEvents ed EventTexts sono nell'app (copia fedele).
2. ✅ Deciso: il master di `DT_EventsText` è EventTexts (EventsAudio è una vista).
3. Poi, quando si passerà alla direzione app → Unreal, generare e importare le DataTable dall'app (sola direzione unica).
4. Nome e descrizione delle entità: collegare `Label`/`BriefDescription` alle chiavi del tab Entities (raw della cella, altrimenti Unreal; vedi piano §0 p.17).
