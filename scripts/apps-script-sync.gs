/**
 * Hell Galaxy Database — sincronizzazione dati verso Google Sheet.
 *
 * COME INSTALLARLO (una volta per ogni foglio Google che vuoi collegare):
 *  1. Apri il foglio Google Sheets che vuoi usare come destinazione.
 *  2. Estensioni -> Apps Script.
 *  3. Cancella il contenuto di Codice.gs e incolla questo intero file.
 *  4. Menu in alto: Esegui -> scegli la funzione "impostaChiaveSegreta" -> Esegui.
 *     (la prima volta Google chiederà di autorizzare lo script: è normale,
 *     è il TUO script sul TUO foglio, non condivide nulla con l'esterno)
 *     Ti verrà chiesto di scrivere una password a piacere: sarà la chiave
 *     segreta che il tool dovrà mandare per poter scrivere su questo foglio.
 *     Copiala, ti servirà nelle Impostazioni del tool.
 *  5. Menu in alto: Distribuisci -> Nuova distribuzione.
 *     - Tipo: "App web"
 *     - Chi ha accesso: "Chiunque abbia il link"
 *     - Distribuisci.
 *  6. Copia l'URL che termina con /exec: è il link da incollare nel tool
 *     (Impostazioni -> Fogli Google collegati / Fogli Google dei CSV sorgente),
 *     al posto del normale link "docs.google.com/spreadsheets/...".
 *
 * Se in futuro modifichi questo codice, dopo aver salvato devi creare una
 * NUOVA distribuzione (Distribuisci -> Gestisci distribuzioni -> matita ->
 * Nuova versione) perché l'URL /exec resta collegato a una versione fissa.
 *
 * COSA FA: riceve dal tool un elenco di righe (una per modulo/nemico/ecc.),
 * le scrive nella scheda indicata creando le colonne mancanti, aggiornando
 * le righe già presenti (in base alla colonna ID) e aggiungendo quelle nuove
 * in fondo. Non cancella mai righe o colonne che non riceve.
 */

const SECRET_PROPERTY = 'HGD_SYNC_SECRET';

function impostaChiaveSegreta() {
  const ui = SpreadsheetApp.getUi();
  const existing = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
  const prompt = ui.prompt(
    'Chiave segreta di sincronizzazione',
    (existing ? 'Una chiave è già impostata. ' : '') +
      'Scrivi una password a piacere (es. una frase con numeri): sarà da incollare nel tool.',
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  const value = prompt.getResponseText().trim();
  if (!value) { ui.alert('Chiave vuota, non salvata.'); return; }
  PropertiesService.getScriptProperties().setProperty(SECRET_PROPERTY, value);
  ui.alert('Chiave salvata. Ora crea/aggiorna la distribuzione come "App web" e copia l\'URL nel tool.');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Hell Galaxy Sync')
    .addItem('Imposta chiave segreta…', 'impostaChiaveSegreta')
    .addToUi();
}

/** Richiesta GET: solo per verificare che la distribuzione sia attiva. */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Hell Galaxy sync endpoint attivo.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Richiesta POST dal tool. Corpo atteso (JSON):
 * {
 *   "secret": "...",          // deve combaciare con quella salvata sopra
 *   "tab": "Primary",         // nome della scheda; creata se non esiste
 *   "idColumn": "ID",         // colonna usata come chiave per capire update vs nuova riga
 *   "rows": [ { "ID": "...", "Name": "...", ... }, ... ]
 * }
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const savedSecret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);

    if (!savedSecret) return jsonError('Nessuna chiave segreta impostata su questo foglio: esegui "impostaChiaveSegreta" da Apps Script.');
    if (payload.secret !== savedSecret) return jsonError('Chiave segreta errata.', 401);

    const tabName = String(payload.tab || '').trim();
    const idColumn = String(payload.idColumn || 'ID').trim();
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    if (!tabName) return jsonError('Campo "tab" mancante.');
    if (!rows.length) return jsonError('Nessuna riga da scrivere.');

    const result = writeRows(tabName, idColumn, rows);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, ...result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return jsonError('Errore: ' + err.message);
  }
}

function jsonError(message, code) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: message, code: code || 400 }))
    .setMimeType(ContentService.MimeType.JSON);
}

function writeRows(tabName, idColumn, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) sheet = ss.insertSheet(tabName);

  // Unione di tutte le chiavi presenti nelle righe ricevute, per non perdere colonne.
  const incomingKeys = [];
  rows.forEach(row => Object.keys(row).forEach(k => { if (incomingKeys.indexOf(k) === -1) incomingKeys.push(k); }));

  const lastCol = sheet.getLastColumn();
  let headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  headers = headers.filter(h => h !== '');

  // Aggiunge in coda le colonne nuove che non esistevano ancora (o scrive
  // l'intestazione da zero se la scheda è appena stata creata).
  const newHeaders = incomingKeys.filter(k => headers.indexOf(k) === -1);
  if (newHeaders.length) {
    headers = headers.concat(newHeaders);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const idColIndex = headers.indexOf(idColumn);
  if (idColIndex === -1) throw new Error('Colonna ID "' + idColumn + '" non trovata tra le intestazioni.');

  // Mappa ID -> numero riga (1-based, foglio) per le righe già presenti.
  const dataLastRow = sheet.getLastRow();
  const idToRowNum = {};
  if (dataLastRow > 1) {
    const idValues = sheet.getRange(2, idColIndex + 1, dataLastRow - 1, 1).getValues();
    idValues.forEach((r, i) => { if (r[0] !== '') idToRowNum[String(r[0])] = i + 2; });
  }

  let updated = 0, appended = 0;
  const toAppend = [];

  rows.forEach(row => {
    const id = String(row[idColumn] ?? '');
    if (id && idToRowNum[id]) {
      const rowNum = idToRowNum[id];
      // Scrive solo le colonne effettivamente presenti in questa riga, lasciando le altre invariate.
      headers.forEach((h, colIdx) => {
        if (h in row) sheet.getRange(rowNum, colIdx + 1).setValue(row[h]);
      });
      updated++;
    } else {
      toAppend.push(headers.map(h => (h in row ? row[h] : '')));
      appended++;
    }
  });

  if (toAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, headers.length).setValues(toAppend);
  }

  return { tab: tabName, updated, appended, totalColumns: headers.length };
}
