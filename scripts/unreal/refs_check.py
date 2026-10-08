import unreal, json, base64

# ---------------------------------------------------------------------------
# VERIFICA (sola lettura) dei riferimenti di un elenco di asset: chi li usa?
# Lo invia l'app tramite MCP (execute_python_code, auto_save=false).
# Non modifica e non salva niente. Per ogni pacchetto restituisce:
#   class       classe dell'asset (es. CPP_DA_Entity, ObjectRedirector)
#   redirect_to destinazione, se e' un redirector
#   refs        pacchetti che lo referenziano (hard + soft), escluso se stesso
# ---------------------------------------------------------------------------


def check(payload_b64):
    pkgs = json.loads(base64.b64decode(payload_b64).decode('utf-8'))
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    opts = unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True, include_hard_package_references=True,
        include_searchable_names=False, include_soft_management_references=False,
        include_hard_management_references=False)
    out = {}
    for p in pkgs:
        d = {'class': None, 'redirect_to': None, 'refs': []}
        try:
            assets = ar.get_assets_by_package_name(p)
            if assets:
                a = assets[0]
                d['class'] = str(a.asset_class_path.asset_name)
                if d['class'] == 'ObjectRedirector':
                    try:
                        d['redirect_to'] = str(a.get_tag_value('DestinationObject'))
                    except Exception:
                        d['redirect_to'] = '?'
            else:
                d['class'] = 'MISSING'
        except Exception as e:
            d['class'] = 'ERR ' + str(e)[:50]
        try:
            d['refs'] = [str(r) for r in ar.get_referencers(p, opts) if str(r) != p]
        except Exception as e:
            d['refs'] = ['ERR ' + str(e)[:60]]
        out[p] = d
    print(json.dumps(out))
