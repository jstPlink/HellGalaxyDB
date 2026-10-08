import unreal, json, base64

# ---------------------------------------------------------------------------
# DataTable degli eventi: export (SOLA LETTURA) e import (SCRITTURA, bloccata dall'app).
# Lo invia l'app tramite MCP (execute_python_code, auto_save=false): nel progetto Unreal
# non va aggiunto nessun file.
#   export_all()                 -> {path: csv} delle tre tabelle, per l'anteprima (non modifica nulla)
#   import_one(path, csv_b64)    -> riempie la DataTable dal CSV e salva SOLO quell'asset
#                                   (chiamato dall'app solo con HG_UE_ALLOW_WRITE=1 e conferma esplicita)
# ---------------------------------------------------------------------------

TABLES = {
    'signature': '/Game/2_LOGIC/EventSystem/DT_EventsSignature',
    'rules': '/Game/2_LOGIC/DialoguePlayer/DT_DialoguesMultiplicityRules',
    'texts': '/Game/2_LOGIC/DialoguePlayer/DT_EventsText',
}


def export_all():
    out = {}
    for key, path in TABLES.items():
        t = unreal.EditorAssetLibrary.load_asset(path)
        if t is None:
            out[key] = None
            continue
        out[key] = unreal.DataTableFunctionLibrary.export_data_table_to_csv_string(t)
    print(json.dumps({'tables': out}))


def import_one(key, csv_b64):
    path = TABLES[key]
    csv = base64.b64decode(csv_b64).decode('utf-8')
    t = unreal.EditorAssetLibrary.load_asset(path)
    if t is None:
        print(json.dumps({'ok': False, 'error': 'DataTable non trovata: ' + path}))
        return
    ok = unreal.DataTableFunctionLibrary.fill_data_table_from_csv_string(t, csv)
    saved = False
    if ok:
        saved = bool(unreal.EditorAssetLibrary.save_asset(path, only_if_is_dirty=False))
    print(json.dumps({'ok': bool(ok), 'saved': saved, 'path': path}))
