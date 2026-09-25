"""
Importa in Unreal Engine le immagini esportate dall'Hell Galaxy Database e le
collega ai relativi Data Asset.

COME OTTENERE I FILE DI INPUT
1. Nel tool "Hell Galaxy Database" apri la scheda Impostazioni e premi
   "Esporta ZIP immagini".
2. Estrai lo ZIP scaricato (contiene manifest.json + images/<categoria>/<ID>.jpg
   + producers/<Nome>.jpg).
3. Copia la cartella estratta da qualche parte raggiungibile dal tuo progetto
   (es. C:/HellGalaxyExport/) e aggiorna SOURCE_DIR qui sotto.

COME ESEGUIRLO IN UNREAL
- Editor > Window > Developer Tools > Output Log, scheda "Python", incolla ed
  esegui questo file (oppure `exec(open(r"...").read())`), OPPURE
- Tools > Execute Python Script..., OPPURE
- da riga di comando: UnrealEditor-Cmd.exe <Progetto>.uproject -run=pythonscript
  -script="import_hellgalaxy_images.py" (richiede il plugin "Python Editor Script
  Plugin" abilitato in Edit > Plugins).

COSA DEVI ADATTARE PRIMA DI LANCIARLO (vedi CONFIG qui sotto)
- DEST_TEXTURE_DIR: dove verranno importate le texture nel Content Browser.
- DATA_ASSET_DIR_TEMPLATE: dove si trovano i tuoi Data Asset esistenti,
  con {category} e {id} sostituiti automaticamente. Se i tuoi Data Asset
  NON seguono una convenzione di naming basata sull'ID del modulo, imposta
  CREATE_DATA_ASSET_IF_MISSING = False e collega le texture manualmente,
  oppure dimmi come sono organizzati i tuoi asset e adatto lo script.
- ICON_PROPERTY_NAME: il nome esatto della proprietà (UPROPERTY) sul tuo
  Data Asset che deve puntare alla texture (es. "Icon", "PreviewImage",
  "Thumbnail"...). Controllalo nel Blueprint/C++ della tua classe.
- DATA_ASSET_CLASS: la classe del tuo Data Asset (es. "WeaponDataAsset"),
  usata solo se CREATE_DATA_ASSET_IF_MISSING = True.

Questo script NON è stato testato contro il tuo progetto specifico (non ho
visibilità sui tuoi Data Asset o sulla struttura del Content Browser): è un
punto di partenza basato sulle API standard di unreal.py. Se qualcosa non
combacia (nome proprietà, percorso, classe), correggi la sezione CONFIG o
scrivimi in chat i dettagli del tuo progetto e te lo adatto.
"""

import json
import os
import unreal

# =========================== CONFIG ===========================

SOURCE_DIR = r"C:/HellGalaxyExport"                  # cartella con manifest.json + images/ + producers/
DEST_TEXTURE_DIR = "/Game/HellGalaxy/Icons"          # dove importare le texture
DATA_ASSET_DIR_TEMPLATE = "/Game/HellGalaxy/Data/{category}"  # dove cercare/creare i Data Asset
ICON_PROPERTY_NAME = "Icon"                          # nome della UPROPERTY texture sul Data Asset
DATA_ASSET_CLASS = "WeaponDataAsset"                 # classe usata solo se si creano asset mancanti
CREATE_DATA_ASSET_IF_MISSING = False                 # True = crea il Data Asset se non esiste già

# ================================================================

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()


def import_texture(source_path, dest_dir, asset_name):
    """Importa un file immagine come Texture2D e ne restituisce il percorso asset."""
    dest_path = dest_dir.rstrip("/") + "/" + asset_name
    existing = unreal.EditorAssetLibrary.load_asset(dest_path)
    if existing:
        return dest_path

    task = unreal.AssetImportTask()
    task.filename = source_path
    task.destination_path = dest_dir
    task.destination_name = asset_name
    task.automated = True
    task.save = True
    task.replace_existing = True

    asset_tools.import_asset_tasks([task])

    imported = unreal.EditorAssetLibrary.does_asset_exist(dest_path)
    if not imported:
        unreal.log_warning(f"Import fallito per {source_path} -> {dest_path}")
        return None
    return dest_path


def find_or_create_data_asset(data_asset_path):
    if unreal.EditorAssetLibrary.does_asset_exist(data_asset_path):
        return unreal.EditorAssetLibrary.load_asset(data_asset_path)

    if not CREATE_DATA_ASSET_IF_MISSING:
        return None

    package_path, asset_name = data_asset_path.rsplit("/", 1)
    factory = unreal.DataAssetFactory()
    data_asset_class = unreal.load_class(None, f"/Script/YourModule.{DATA_ASSET_CLASS}")
    if not data_asset_class:
        unreal.log_error(
            f"Classe Data Asset '{DATA_ASSET_CLASS}' non trovata: "
            "aggiorna il percorso /Script/<TuoModulo>.<TuaClasse> in find_or_create_data_asset()."
        )
        return None
    factory.set_editor_property("data_asset_class", data_asset_class)
    new_asset = asset_tools.create_asset(asset_name, package_path, None, factory)
    return new_asset


def link_texture_to_data_asset(data_asset, texture_path, id_for_log):
    texture = unreal.EditorAssetLibrary.load_asset(texture_path)
    if not texture:
        unreal.log_warning(f"Texture non trovata per {id_for_log}: {texture_path}")
        return False
    try:
        data_asset.set_editor_property(ICON_PROPERTY_NAME, texture)
    except Exception as exc:
        unreal.log_error(
            f"Impossibile impostare la proprietà '{ICON_PROPERTY_NAME}' su {data_asset.get_name()}: {exc}"
        )
        return False
    unreal.EditorAssetLibrary.save_loaded_asset(data_asset)
    return True


def run():
    manifest_path = os.path.join(SOURCE_DIR, "manifest.json")
    if not os.path.isfile(manifest_path):
        unreal.log_error(f"manifest.json non trovato in {SOURCE_DIR}")
        return

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    imported_count = 0
    linked_count = 0
    skipped = []

    for entry in manifest.get("modules", []):
        module_id = entry["id"]
        category = entry["category"]
        rel_file = entry["file"]
        source_path = os.path.join(SOURCE_DIR, rel_file.replace("/", os.sep))
        if not os.path.isfile(source_path):
            skipped.append((module_id, "file immagine mancante"))
            continue

        texture_asset_name = "T_" + module_id.replace("-", "_")
        texture_path = import_texture(source_path, DEST_TEXTURE_DIR, texture_asset_name)
        if not texture_path:
            skipped.append((module_id, "import texture fallito"))
            continue
        imported_count += 1

        data_asset_dir = DATA_ASSET_DIR_TEMPLATE.format(category=category)
        data_asset_path = data_asset_dir.rstrip("/") + "/DA_" + module_id.replace("-", "_")
        data_asset = find_or_create_data_asset(data_asset_path)
        if not data_asset:
            skipped.append((module_id, f"Data Asset non trovato: {data_asset_path}"))
            continue

        if link_texture_to_data_asset(data_asset, texture_path, module_id):
            linked_count += 1

    unreal.log(f"Importate {imported_count} texture, collegate {linked_count} a Data Asset.")
    if skipped:
        unreal.log_warning("Voci saltate:")
        for item_id, reason in skipped:
            unreal.log_warning(f"  - {item_id}: {reason}")


if __name__ == "__main__":
    run()
