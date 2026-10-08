import unreal, json, base64

# ---------------------------------------------------------------------------
# Push delle entita' dall'app Hell Galaxy Database ai Data Asset EDA_<ID>.
# Questo file NON sta nel progetto Unreal: lo invia l'app all'Editor tramite
# MCP (execute_python_code, auto_save=false) insieme al payload (base64).
#
# Regole (decise dall'utente, vedi docs/PIANO_PUSH_UNREAL.md):
#  - crea gli EDA_ mancanti, aggiorna quelli esistenti, salva SOLO gli asset toccati;
#  - nessun commit/check-in; nessuna cancellazione, nessuna rinomina;
#  - asset sporchi di altri: ignorati; un asset da modificare che e' gia' sporco: saltato;
#  - icone: solo Texture2D, risolte per NOME (mai per path); vale Unreal in caso di
#    contraddizione; icona vuota nell'app = non tocco; materiali di Unreal = non tocco;
#  - ProducerIcon: se Unreal ce l'ha vale Unreal; se e' vuoto uso ICN_producer_<sigla>;
#  - testi (Label/BriefDescription): stessa logica del flusso Google (NSLOCTEXT con
#    namespace "Entity_ID__<proprieta'>", chiave "<namespace>_<NomeAsset>"; testo
#    vuoto o "[C]" = non localizzato); campo vuoto nell'app = non tocco;
#  - valori non validi: errore sulla riga, campo non scritto, le altre righe proseguono.
# ---------------------------------------------------------------------------

DEFAULT_FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Entities'
PREFIX = 'EDA_'

ENUM_ENTITY_TYPE = {
    'None': unreal.NTEntityType.ENT_ET_NONE,
    'Unknown': unreal.NTEntityType.ENT_ET_UNKNOWN,
    'Item': unreal.NTEntityType.ENT_ET_ITEM,
    'Module': unreal.NTEntityType.ENT_ET_MODULE,
    'Collectable': unreal.NTEntityType.ENT_ET_COLLECTABLE,
    'Consumable': unreal.NTEntityType.ENT_ET_CONSUMABLE,
}
ENUM_RARITY = {
    'Salvage': unreal.NTRarityType.ENT_RT_SALVAGE,
    'Common': unreal.NTRarityType.ENT_RT_COMMON,
    'Uncommon': unreal.NTRarityType.ENT_RT_UNCOMMON,
    'Rare': unreal.NTRarityType.ENT_RT_RARE,
    'Epic': unreal.NTRarityType.ENT_RT_EPIC,
    'Mythic': unreal.NTRarityType.ENT_RT_MYTHIC,
    'Legendary': unreal.NTRarityType.ENT_RT_LEGENDARY,
}

EAL = unreal.EditorAssetLibrary
_ar = unreal.AssetRegistryHelpers.get_asset_registry()
_tex_index = None


def _texture_index():
    global _tex_index
    if _tex_index is None:
        idx = {}
        flt = unreal.ARFilter(class_paths=[unreal.TopLevelAssetPath('/Script/Engine', 'Texture2D')],
                              package_paths=['/Game'], recursive_paths=True)
        for a in _ar.get_assets(flt):
            idx.setdefault(str(a.asset_name), []).append(str(a.package_name))
        _tex_index = idx
    return _tex_index


def _resolve_texture(name):
    """Ritorna (oggetto|None, nota|None). Risolve per NOME tra le Texture2D del progetto."""
    paths = _texture_index().get(name, [])
    if not paths:
        return None, "texture '%s' non trovata" % name
    if len(paths) > 1:
        return None, "texture '%s' ambigua (%d asset con lo stesso nome): %s" % (name, len(paths), ', '.join(sorted(paths)))
    return EAL.load_asset(paths[0]), None


def _text_str(t):
    try:
        return unreal.TextLibrary.conv_text_to_string(t)
    except Exception:
        return str(t)


def _to_int(v):
    s = str(v).strip()
    f = float(s)
    return int(f)


def _dirty_packages():
    try:
        return set(p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages())
    except Exception:
        return set()


def inventory(folder=DEFAULT_FOLDER):
    """Elenco degli EDA_ presenti (per trovare gli orfani). Sola lettura."""
    names = []
    for a in _ar.get_assets(unreal.ARFilter(package_paths=[folder], recursive_paths=True)):
        names.append(str(a.asset_name))
    print(json.dumps({'inventory': names}))


def _plan_entity(e, asset, asset_name, rep):
    """Calcola le modifiche. asset puo' essere None (da creare). Ritorna dict proprieta' -> (da, a, valore)."""
    changes = {}

    def cur(prop):
        if asset is None:
            return None
        try:
            return asset.get_editor_property(prop)
        except Exception:
            return None

    def note(msg):
        rep['warnings'].append(msg)

    # entity_id
    if asset is None or cur('entity_id') != e['id']:
        changes['entity_id'] = (cur('entity_id'), e['id'], e['id'])

    # testi
    for prop, key in (('label', 'Label'), ('brief_description', 'BriefDescription')):
        v = '' if e.get(key) is None else str(e.get(key))
        if v.strip() == '':
            continue  # vuoto nell'app: non tocco
        cur_t = cur(prop)
        cur_s = _text_str(cur_t) if cur_t is not None else ''
        if cur_s == v:
            continue
        if '[C]' in v:
            if cur_s.strip() != '':
                note("%s: placeholder [C] nell'app, tengo il testo di Unreal" % prop)
                continue
            changes[prop] = (cur_s, v, unreal.Text(v))
        else:
            ns = 'Entity_ID__' + prop
            changes[prop] = (cur_s, v, unreal.NSLOCTEXT(ns, ns + '_' + asset_name, v))

    # enum
    for prop, key, table in (('entity_type', 'EntityType', ENUM_ENTITY_TYPE), ('base_rarity', 'BaseRarity', ENUM_RARITY)):
        v = '' if e.get(key) is None else str(e.get(key)).strip()
        if v == '':
            continue
        if v not in table:
            rep['errors'].append("%s: valore non valido '%s' (campo non scritto)" % (key, v))
            continue
        c = cur(prop)
        if asset is None or c != table[v]:
            changes[prop] = (str(c) if c is not None else None, v, table[v])

    # prezzo
    v = '' if e.get('BasePrice') is None else str(e.get('BasePrice')).strip()
    if v != '':
        try:
            iv = _to_int(v)
            c = cur('base_price')
            if asset is None or c != iv:
                changes['base_price'] = (c, iv, iv)
        except Exception:
            rep['errors'].append("BasePrice: valore non numerico '%s' (campo non scritto)" % v)

    # icona (solo Texture2D, vale Unreal)
    name = '' if e.get('Icon') is None else str(e.get('Icon')).strip()
    if name:
        c = cur('icon')
        if c is not None:
            if not isinstance(c, unreal.Texture2D):
                rep['skipped_icons'].append("icona di Unreal non e' un'immagine (%s): non toccata" % c.get_class().get_name())
            elif c.get_name() != name:
                rep['discrepancies'].append("icona: Unreal '%s' / app '%s': vale Unreal, non scritto" % (c.get_name(), name))
        else:
            obj, n = _resolve_texture(name)
            if obj is None:
                note('icona: ' + n)
            else:
                changes['icon'] = (None, name, obj)

    # producer icon (vale Unreal; se vuoto uso il foglio/app)
    sigla = '' if e.get('ProducerIcon') is None else str(e.get('ProducerIcon')).strip()
    if sigla:
        c = cur('producer_icon')
        if c is None:
            obj, n = _resolve_texture('ICN_producer_' + sigla)
            if obj is None:
                note('producer: ' + n)
            else:
                changes['producer_icon'] = (None, 'ICN_producer_' + sigla, obj)
                rep['producer_first_write'] = True
        elif c.get_name() != 'ICN_producer_' + sigla:
            rep['discrepancies'].append("producer: Unreal '%s' / app '%s': vale Unreal, non scritto" % (c.get_name(), sigla))
    return changes


def run(payload_b64, apply=False, folder=DEFAULT_FOLDER):
    entities = json.loads(base64.b64decode(payload_b64).decode('utf-8'))
    dirty = _dirty_packages()
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    if apply and not EAL.does_directory_exist(folder):
        EAL.make_directory(folder)
    out = {'apply': bool(apply), 'folder': folder, 'items': [], 'counts': {'create': 0, 'update': 0, 'unchanged': 0, 'skipped': 0, 'error': 0},
           'producer_first_write': 0, 'discrepancies': 0, 'warnings': 0, 'saved': []}
    for e in entities:
        eid = str(e.get('id', '')).strip()
        rep = {'id': eid, 'action': 'unchanged', 'fields': [], 'warnings': [], 'errors': [], 'discrepancies': [], 'skipped_icons': [], 'producer_first_write': False}
        try:
            if not eid:
                raise ValueError('ID mancante')
            asset_name = PREFIX + eid
            path = folder + '/' + asset_name
            exists = EAL.does_asset_exist(path)
            asset = EAL.load_asset(path) if exists else None
            if exists and asset is None:
                raise ValueError('asset esistente ma non caricabile')
            if exists and (folder + '/' + asset_name) in dirty:
                rep['action'] = 'skipped'
                rep['warnings'].append('asset gia\' sporco (modifiche non salvate di altri): non toccato')
            else:
                changes = _plan_entity(e, asset, asset_name, rep)
                rep['fields'] = [{'f': k, 'from': (None if v[0] is None else str(v[0])), 'to': str(v[1])} for k, v in changes.items()]
                if not exists:
                    rep['action'] = 'create'
                elif changes:
                    rep['action'] = 'update'
                if apply and (not exists or changes):
                    if not exists:
                        asset = asset_tools.create_asset(asset_name, folder, unreal.CPP_DA_Entity, unreal.DataAssetFactory())
                        if asset is None:
                            raise ValueError('creazione asset fallita')
                    for k, v in changes.items():
                        asset.set_editor_property(k, v[2])
                    try:
                        EAL.checkout_loaded_asset(asset)
                    except Exception:
                        pass
                    if not EAL.save_loaded_asset(asset, False):
                        rep['errors'].append('salvataggio fallito (asset di sola lettura? checkout non riuscito?)')
                    else:
                        out['saved'].append(path)
        except Exception as ex:
            rep['errors'].append(str(ex)[:200])
            rep['action'] = 'error'
        # errori su singoli campi (valore non valido): l'azione prevista resta, l'errore e' elencato
        if rep['errors'] and rep['action'] == 'unchanged':
            rep['action'] = 'error'
        c = out['counts']
        c[rep['action']] = c.get(rep['action'], 0) + 1
        if rep['errors']:
            out['with_errors'] = out.get('with_errors', 0) + 1
        if rep['producer_first_write']:
            out['producer_first_write'] += 1
        out['discrepancies'] += len(rep['discrepancies'])
        out['warnings'] += len(rep['warnings'])
        if rep['action'] != 'unchanged' or rep['errors'] or rep['warnings'] or rep['discrepancies'] or rep['skipped_icons']:
            out['items'].append(rep)
    print(json.dumps(out))
