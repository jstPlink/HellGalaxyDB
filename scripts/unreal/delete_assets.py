import unreal, json, base64

# ---------------------------------------------------------------------------
# CANCELLAZIONE di Data Asset inutili. SCRIVE SU UNREAL: l'app la usa solo con
# HG_UE_ALLOW_WRITE=1 e solo dopo conferma esplicita dell'utente.
# Doppia sicurezza: PRIMA di cancellare ogni asset ricontrolla i riferimenti e
# SALTA quelli ancora referenziati da asset che non fanno parte dell'elenco.
# Non salva altro, nessun check-in. EditorAssetLibrary.delete_asset NON controlla i
# riferimenti da solo: il controllo e' qui.
# ---------------------------------------------------------------------------


def delete(payload_b64):
    pkgs = json.loads(base64.b64decode(payload_b64).decode('utf-8'))
    inset = set(pkgs)
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    opts = unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True, include_hard_package_references=True,
        include_searchable_names=False, include_soft_management_references=False,
        include_hard_management_references=False)
    out = {'deleted': [], 'skipped': [], 'failed': []}
    for p in pkgs:
        refs = [str(r) for r in ar.get_referencers(p, opts) if str(r) != p and str(r) not in inset]
        if refs:
            out['skipped'].append([p, refs[:5]])
            continue
        if not unreal.EditorAssetLibrary.does_asset_exist(p):
            out['failed'].append([p, 'non esiste'])
            continue
        try:
            ok = unreal.EditorAssetLibrary.delete_asset(p)
        except Exception as e:
            ok = False
        (out['deleted'] if ok else out['failed']).append(p if ok else [p, 'delete_asset ha risposto False'])
    print(json.dumps(out))
