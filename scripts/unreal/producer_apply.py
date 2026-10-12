import unreal, json, base64

# ---------------------------------------------------------------------------
# ProducerIcon degli EDA_ (UNICO campo toccato). Regola dell'utente (2026-10-12):
# la sigla viene dal foglio ENTITIES; si cerca nel progetto la Texture2D
# "ICN_producer_<sigla>" (per NOME, deve essere unica) e la si assegna al campo
# producer_icon dell'EDA_ SOLO se in Unreal e' vuoto (se c'e' gia' un valore vale Unreal).
# Nessun altro campo viene letto per essere scritto. Mai creazioni, mai cancellazioni.
# REGOLA DELL'UTENTE (2026-10-12): le modifiche si fanno TUTTE IN BLOCCO IN MEMORIA e NON si salvano:
# gli asset restano "sporchi" nell'Editor e li salva l'utente quando vuole (nessun checkout, nessun salvataggio).
#   run(payload_b64, apply=False)  -> anteprima (sola lettura) oppure, con apply=True, modifica in memoria
#                                     SOLO gli EDA_ interessati (li lascia sporchi, NON li salva).
# payload: [{"id": "<ID entita'>", "sigla": "<sigla>"}]
# Lo invia l'app tramite MCP (execute_python_code, auto_save=false); l'agente blocca apply=True
# se sul PC dell'utente manca HG_UE_ALLOW_WRITE=1.
# ---------------------------------------------------------------------------

FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Entities'
EAL = unreal.EditorAssetLibrary


def run(payload_b64, apply=False):
    items = json.loads(base64.b64decode(payload_b64).decode('utf-8'))
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    flt = unreal.ARFilter(class_paths=[unreal.TopLevelAssetPath('/Script/Engine', 'Texture2D')], package_paths=['/Game'], recursive_paths=True)
    tex = {}
    for a in ar.get_assets(flt):
        n = str(a.asset_name)
        if n.lower().startswith('icn_producer_'):
            tex.setdefault(n, []).append(str(a.package_name))
    dirty = set(str(p.get_name()) for p in unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages())
    out = {'apply': bool(apply), 'counts': {'assegna': 0, 'gia_assegnata': 0, 'uguale': 0, 'eda_mancante': 0, 'texture_mancante': 0, 'texture_ambigua': 0, 'sporco': 0, 'errore': 0}, 'items': [], 'saved': []}
    c = out['counts']
    for it in items:
        eid, sigla = str(it.get('id', '')).strip(), str(it.get('sigla', '')).strip()
        rep = {'id': eid, 'sigla': sigla, 'action': ''}
        try:
            path = FOLDER + '/EDA_' + eid
            name = 'ICN_producer_' + sigla
            paths = tex.get(name, [])
            if not EAL.does_asset_exist(path):
                rep['action'] = 'eda_mancante'
            elif len(paths) == 0:
                rep['action'] = 'texture_mancante'
            elif len(paths) > 1:
                rep['action'] = 'texture_ambigua'
                rep['note'] = ', '.join(sorted(paths))
            elif path in dirty:
                rep['action'] = 'sporco'
            else:
                asset = EAL.load_asset(path)
                cur = asset.get_editor_property('producer_icon')
                if cur is not None:
                    rep['action'] = 'uguale' if cur.get_name() == name else 'gia_assegnata'
                    rep['unreal'] = cur.get_name()
                else:
                    rep['action'] = 'assegna'
                    if apply:
                        asset.modify()  # segna l'asset come sporco (transazione), senza salvarlo
                        asset.set_editor_property('producer_icon', EAL.load_asset(paths[0]))
                        out['saved'].append(path)  # nome storico: elenco degli asset modificati (NON salvati)
        except Exception as ex:
            rep['action'] = 'errore'
            rep['note'] = str(ex)[:160]
        c[rep['action']] = c.get(rep['action'], 0) + 1
        if rep['action'] not in ('uguale',):
            out['items'].append(rep)
    print(json.dumps(out))
