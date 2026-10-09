import unreal, json, os, tempfile

# ---------------------------------------------------------------------------
# ESPORTAZIONE (sola lettura sul progetto) di texture e mesh dei moduli/entità.
# Non crea, non modifica, non salva asset: scrive file SOLO in una cartella temporanea del PC
# (%TEMP%/HGExport); l'agente li carica sull'app e poi li cancella.
#   inventory()                              elenco di texture (icone degli EDA_) e mesh (static_mesh e
#                                            shield_static_mesh degli SMDA_, loot_static_mesh degli LDA_) con i proprietari (ID)
#   export_batch(kind="texture", paths="...")  esporta PNG (texture) oppure FBX + OBJ (mesh; l'OBJ serve
#                                            solo all'app per generare l'anteprima e viene scartato)
# ---------------------------------------------------------------------------

EDA_FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Entities'
SMDA_FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Modules'
LDA_FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Loots'
BP_FOLDERS = ['/Game/2_LOGIC/Entities/BP/Loots', '/Game/2_LOGIC/Entities/BP/Items']  # BP_ACS_Loot_<ID> e SML_SI_<ID>: le mesh stanno nei Blueprint


def _prop(o, name):
    try:
        return o.get_editor_property(name)
    except Exception:
        return None


def _assets(folder):
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    return ar.get_assets(unreal.ARFilter(package_paths=[folder], recursive_paths=True))


def _add(table, obj, owner, role, cls_name):
    if obj is None:
        return
    try:
        if obj.get_class().get_name() != cls_name:
            return
        path = obj.get_path_name()
        name = obj.get_name()
    except Exception:
        return
    e = table.setdefault(path, {'name': name, 'path': path, 'owners': []})
    o = {'id': owner, 'role': role}
    if o not in e['owners']:
        e['owners'].append(o)


def inventory():
    textures, meshes = {}, {}
    for a in _assets(EDA_FOLDER):
        n = str(a.asset_name)
        if not n.startswith('EDA_'):
            continue
        o = a.get_asset()
        if o is not None:
            _add(textures, _prop(o, 'icon'), n[4:], 'icon', 'Texture2D')
    for a in _assets(SMDA_FOLDER):
        n = str(a.asset_name)
        if not n.startswith('SMDA_'):
            continue
        o = a.get_asset()
        if o is None:
            continue
        _add(meshes, _prop(o, 'static_mesh'), n[5:], 'static_mesh', 'StaticMesh')
        _add(meshes, _prop(o, 'shield_static_mesh'), n[5:], 'shield_static_mesh', 'StaticMesh')
    for a in _assets(LDA_FOLDER):
        n = str(a.asset_name)
        if not n.startswith('LDA_'):
            continue
        o = a.get_asset()
        if o is None:
            continue
        try:
            arr = list(_prop(o, 'loot_static_mesh') or [])
        except Exception:
            arr = []
        for i, m in enumerate(arr):
            _add(meshes, m, n[4:], 'loot_mesh_%d' % i, 'StaticMesh')
    # mesh referenziate dai Blueprint degli oggetti (loot e item): dipendenze dirette di tipo StaticMesh (sola lettura dell'Asset Registry)
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    opt = unreal.AssetRegistryDependencyOptions(include_soft_package_references=True, include_hard_package_references=True, include_searchable_names=False, include_soft_management_references=False, include_hard_management_references=False)
    for folder in BP_FOLDERS:
        for a in _assets(folder):
            n = str(a.asset_name)
            owner = n[len('BP_ACS_Loot_'):] if n.startswith('BP_ACS_Loot_') else (n[len('SML_SI_'):] if n.startswith('SML_SI_') else None)
            if not owner:
                continue
            i = 0
            for pkg in sorted(str(x) for x in (ar.get_dependencies(a.package_name, opt) or [])):
                if not pkg.startswith('/Game'):
                    continue
                for d in ar.get_assets_by_package_name(pkg):
                    if str(d.asset_class_path.asset_name) == 'StaticMesh':
                        o = d.get_asset()
                        _add(meshes, o, owner, 'bp_mesh_%d' % i, 'StaticMesh')
                        i += 1
    print(json.dumps({'textures': sorted(textures.values(), key=lambda x: x['path']), 'meshes': sorted(meshes.values(), key=lambda x: x['path'])}))


def _export(obj, filename, exporter):
    t = unreal.AssetExportTask()
    t.object = obj
    t.filename = filename
    t.exporter = exporter
    t.automated = True
    t.prompt = False
    t.replace_identical = True
    t.write_empty_files = False
    ok = unreal.Exporter.run_asset_export_task(t)
    return bool(ok) and os.path.exists(filename) and os.path.getsize(filename) > 0


def export_batch(kind="texture", paths=""):
    out_dir = os.path.join(tempfile.gettempdir(), 'HGExport')
    os.makedirs(out_dir, exist_ok=True)
    files, errors = [], []
    for p in [x for x in paths.split(',') if x]:
        try:
            obj = unreal.load_asset(p)
            if obj is None:
                errors.append({'path': p, 'error': 'asset non trovato'})
                continue
            name = obj.get_name()
            if kind == 'texture':
                f = os.path.join(out_dir, name + '.png')
                if _export(obj, f, unreal.TextureExporterPNG()):
                    files.append({'kind': 'texture', 'name': name, 'file': f})
                else:
                    errors.append({'path': p, 'error': 'esportazione PNG non riuscita'})
            else:
                f = os.path.join(out_dir, name + '.fbx')
                g = os.path.join(out_dir, name + '.obj')
                if _export(obj, f, unreal.StaticMeshExporterFBX()):
                    files.append({'kind': 'mesh', 'name': name, 'file': f})
                    if _export(obj, g, unreal.StaticMeshExporterOBJ()):
                        files.append({'kind': 'obj', 'name': name, 'file': g})
                else:
                    errors.append({'path': p, 'error': 'esportazione FBX non riuscita'})
        except Exception as e:
            errors.append({'path': p, 'error': str(e)[:200]})
    print(json.dumps({'dir': out_dir, 'files': files, 'errors': errors}))
