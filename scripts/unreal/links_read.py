import unreal, json, base64

# ---------------------------------------------------------------------------
# LETTURA (sola lettura) dei COLLEGAMENTI degli asset di ogni entita' in Unreal:
# quali asset esistono per l'ID (EDA_, CIDA_, LDA_, SIDA_, SMDA_ e i Blueprint
# CI_, BP_ACS_Loot_, SML_SI_, SML_SM_) e chi li referenzia (hard + soft) oltre agli
# asset della stessa entita' e alla tabella DT_EntityTranslations (generata dagli script).
# Non crea, non modifica, non salva niente. Lo invia l'app tramite MCP
# (execute_python_code, auto_save=false): nel progetto Unreal non va aggiunto nessun file.
# ---------------------------------------------------------------------------

ROOT = '/Game/2_LOGIC/Entities'
DA_PREFIXES = ['EDA_', 'CIDA_', 'LDA_', 'SIDA_', 'SMDA_']
BP_PREFIXES = ['CI_', 'BP_ACS_Loot_', 'SML_SI_', 'SML_SM_']
TRANSLATIONS = ROOT + '/DT_EntityTranslations'


def read(ids_b64):
    ids = json.loads(base64.b64decode(ids_b64).decode('utf-8'))
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    opts = unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True, include_hard_package_references=True,
        include_searchable_names=False, include_soft_management_references=False,
        include_hard_management_references=False)
    byname = {}
    for a in ar.get_assets_by_path(ROOT, recursive=True):
        byname.setdefault(str(a.asset_name), []).append(str(a.package_name))
    out = {}
    for id_ in ids:
        found = {}  # nome asset -> [pacchetti]
        for p in DA_PREFIXES + BP_PREFIXES:
            if p + id_ in byname:
                found[p + id_] = byname[p + id_]
        family = set(pk for v in found.values() for pk in v)
        res = {'assets': {}, 'inTranslations': False}
        for name, pkgs in found.items():
            kind = 'bp' if any(name.startswith(p) for p in BP_PREFIXES) else 'da'
            ext = []
            for pk in pkgs:
                try:
                    for r in ar.get_referencers(pk, opts):
                        r = str(r)
                        if r == pk or r in family:
                            continue
                        if r == TRANSLATIONS:
                            res['inTranslations'] = True
                            continue
                        ext.append(r)
                except Exception as e:
                    ext.append('ERR ' + str(e)[:40])
            res['assets'][name] = {'kind': kind, 'copies': len(pkgs), 'refs': len(set(ext)), 'sample': sorted(set(ext))[:4]}
        out[id_] = res
    print(json.dumps({'links': out}))
