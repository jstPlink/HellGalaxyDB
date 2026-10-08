import unreal, json

# ---------------------------------------------------------------------------
# LETTURA (sola lettura) degli EDA_ delle entita' dall'Editor Unreal.
# Non crea, non modifica, non salva niente. Lo invia l'app tramite MCP
# (execute_python_code, auto_save=false): nel progetto Unreal non va aggiunto nessun file.
# ---------------------------------------------------------------------------

DEFAULT_FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Entities'

ENTITY_TYPE_NAMES = {
    unreal.NTEntityType.ENT_ET_NONE: 'None',
    unreal.NTEntityType.ENT_ET_UNKNOWN: 'Unknown',
    unreal.NTEntityType.ENT_ET_ITEM: 'Item',
    unreal.NTEntityType.ENT_ET_MODULE: 'Module',
    unreal.NTEntityType.ENT_ET_COLLECTABLE: 'Collectable',
    unreal.NTEntityType.ENT_ET_CONSUMABLE: 'Consumable',
}
RARITY_NAMES = {
    unreal.NTRarityType.ENT_RT_SALVAGE: 'Salvage',
    unreal.NTRarityType.ENT_RT_COMMON: 'Common',
    unreal.NTRarityType.ENT_RT_UNCOMMON: 'Uncommon',
    unreal.NTRarityType.ENT_RT_RARE: 'Rare',
    unreal.NTRarityType.ENT_RT_EPIC: 'Epic',
    unreal.NTRarityType.ENT_RT_MYTHIC: 'Mythic',
    unreal.NTRarityType.ENT_RT_LEGENDARY: 'Legendary',
}


def _obj(o):
    if o is None:
        return None
    try:
        return {'name': o.get_name(), 'class': o.get_class().get_name(), 'path': o.get_path_name()}
    except Exception:
        return {'name': str(o), 'class': '?', 'path': ''}


def _text(t):
    if t is None:
        return ''
    try:
        return unreal.TextLibrary.conv_text_to_string(t)
    except Exception:
        return str(t)


def _prop(o, name):
    try:
        return o.get_editor_property(name)
    except Exception:
        return None


def read(folder=DEFAULT_FOLDER):
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    items = []
    for a in ar.get_assets(unreal.ARFilter(package_paths=[folder], recursive_paths=True)):
        name = str(a.asset_name)
        o = a.get_asset()
        if o is None:  # redirector o asset non caricabile
            continue
        et = _prop(o, 'entity_type')
        rt = _prop(o, 'base_rarity')
        price = _prop(o, 'base_price')
        items.append({
            'asset': name,
            'entity_id': _prop(o, 'entity_id'),
            'label': _text(_prop(o, 'label')),
            'brief': _text(_prop(o, 'brief_description')),
            'entity_type': ENTITY_TYPE_NAMES.get(et, str(et)),
            'rarity': RARITY_NAMES.get(rt, str(rt)),
            'base_price': price,
            'icon': _obj(_prop(o, 'icon')),
            'producer_icon': _obj(_prop(o, 'producer_icon')),
        })
    print(json.dumps({'read': items}))
