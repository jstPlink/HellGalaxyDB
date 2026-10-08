import unreal, json

# ---------------------------------------------------------------------------
# LETTURA (sola lettura) degli SMDA_ dei moduli dall'Editor Unreal.
# Non crea, non modifica, non salva niente. Lo invia l'app tramite MCP
# (execute_python_code, auto_save=false): nel progetto Unreal non va aggiunto nessun file.
# ---------------------------------------------------------------------------

DEFAULT_FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Modules'

# Proprieta' numeriche/booleane dei Data Asset dei moduli (da Source/HauntedSpace/DataStructures/Entities).
PROPS = [
    'power_consumption', 'incorporated', 'quality',
    'booster_speed_multiplier', 'stress_drive_speed_multiplier', 'max_speed', 'hull_integrity', 'stress_drive_stamina', 'fuel_capacity',
    'fuel_consumption', 'stress_drive_fuel_consumption', 'speed_increment', 'stress_drive_stamina_consumption', 'boost_charge_consumption',
    'slot_number', 'liquid_fuel_capacity', 'range', 'rotation_speed', 'speed', 'hull_damage', 'shield_damage', 'organic_damage', 'ghost_damage',
    'ammo_magazine_size', 'rate', 'charge_time', 'base_damage_min', 'base_damage_max', 'critical_hit_chance', 'critical_hit_multiplier',
    'projectile_speed', 'projectile_accuracy', 'projectile_range', 'rotable_structure', 'heat_generation', 'attraction_range',
]


def _obj(o):
    if o is None:
        return None
    try:
        return {'name': o.get_name(), 'class': o.get_class().get_name(), 'path': o.get_path_name()}
    except Exception:
        return {'name': str(o), 'class': '?', 'path': ''}


def _prop(o, name):
    try:
        return o.get_editor_property(name)
    except Exception:
        return None


def _enum_name(v):
    try:
        return v.name
    except Exception:
        return str(v) if v is not None else None


def read(folder=DEFAULT_FOLDER):
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    items = []
    for a in ar.get_assets(unreal.ARFilter(package_paths=[folder], recursive_paths=True)):
        o = a.get_asset()
        if o is None:  # redirector o asset non caricabile
            continue
        props = {}
        for p in PROPS:
            try:
                v = o.get_editor_property(p)
                if isinstance(v, (bool, int, float)):
                    props[p] = v
            except Exception:
                pass
        sub = str(a.package_path)
        sub = sub[sub.find('/Modules') + len('/Modules'):].strip('/')
        items.append({
            'asset': str(a.asset_name),
            'folder': sub,
            'class': o.get_class().get_name(),
            'static_mesh': _obj(_prop(o, 'static_mesh')),
            'shield_static_mesh': _obj(_prop(o, 'shield_static_mesh')),
            'quality': props.get('quality'),
            'module_type': _enum_name(_prop(o, 'module_type')),
            'props': props,
        })
    print(json.dumps({'read': items}))
