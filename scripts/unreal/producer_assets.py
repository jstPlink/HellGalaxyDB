import unreal, json

# ---------------------------------------------------------------------------
# LETTURA (sola lettura): asset del progetto che sembrano icone dei produttori
# (nome con "producer"), con classe e percorso. Serve a collegare ProducerIcon
# (sigla del foglio) all'asset giusto per nome. Non crea, non modifica, non salva.
# Lo invia l'app tramite MCP (execute_python_code, auto_save=false).
# ---------------------------------------------------------------------------


def read():
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    out = []
    for a in ar.get_assets_by_path('/Game', recursive=True):
        n = str(a.asset_name)
        if 'producer' in n.lower():
            out.append({'name': n, 'class': str(a.asset_class_path.asset_name), 'package': str(a.package_name)})
    print(json.dumps({'assets': out}))
