import unreal, json

# ---------------------------------------------------------------------------
# LETTURA (sola lettura) di CIDA_ (cargo item), LDA_ (loot) e SIDA_ (item) dall'Editor.
# Non crea, non modifica, non salva niente. Lo invia l'app tramite MCP
# (execute_python_code, auto_save=false): nel progetto Unreal non va aggiunto nessun file.
# ---------------------------------------------------------------------------

BASE = '/Game/2_LOGIC/Entities/DataAssets'
FOLDERS = {'cargo': BASE + '/CargoItems', 'loots': BASE + '/Loots', 'items': BASE + '/Items'}

ITEM_PROPS = [
    'power_consumption', 'incorporated', 'quality',
    'translational_force', 'torque', 'booster_multiplier', 'stress_drive_multiplier', 'speed_increment', 'boost_charge_consumption',
    'power_generated', 'max_power', 'max_connections', 'heat_dissipation', 'max_heat',
    'range', 'scanner_range', 'scanner_recharge_time', 'scanner_duration',
    'shield_integrity', 'time_before_start_recharging', 'unit_recharge_time', 'attraction_force',
    'max_ais_slots', 'power_consumption_per_ai', 'max_warp_speed', 'mineral_fuel_consumption', 'warp_radar_range',
    'slot_number', 'max_sonic_matter', 'max_boost_charge', 'boost_recharge_rate', 'recovery_threshold_percent',
]


def _prop(o, *names):
    for n in names:
        try:
            return o.get_editor_property(n)
        except Exception:
            pass
    return None


def _num(v):
    return v if isinstance(v, (bool, int, float)) else None


def _enum_name(v):
    try:
        return v.name
    except Exception:
        return str(v) if v is not None else None


def read(kind):
    folder = FOLDERS[kind]
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    items = []
    unloadable = []
    for a in ar.get_assets(unreal.ARFilter(package_paths=[folder], recursive_paths=True)):
        o = a.get_asset()
        if o is None:  # redirector o asset non caricabile: segnalato, non letto
            unloadable.append(str(a.package_name))
            continue
        sub = str(a.package_path)
        sub = sub[len(folder):].strip('/') if sub.startswith(folder) else sub
        d = {'asset': str(a.asset_name), 'folder': sub, 'class': o.get_class().get_name()}
        if kind == 'cargo':
            d['stack_value'] = _num(_prop(o, 'stack_value'))
            d['can_be_sold'] = _num(_prop(o, 'can_be_sold', 'b_can_be_sold'))
        elif kind == 'loots':
            d['attractable'] = _num(_prop(o, 'attractable'))
            d['force_to_inspect'] = _num(_prop(o, 'force_to_inspect'))
            meshes = _prop(o, 'loot_static_mesh') or []
            d['loot_static_mesh'] = [(m.get_name() if m is not None else None) for m in meshes]
        else:
            d['item_type'] = _enum_name(_prop(o, 'item_type'))
            props = {}
            for p in ITEM_PROPS:
                v = _num(_prop(o, p))
                if v is not None:
                    props[p] = v
            d['props'] = props
            d['quality'] = props.get('quality')
        items.append(d)
    print(json.dumps({'read': items, 'unloadable': unloadable}))
