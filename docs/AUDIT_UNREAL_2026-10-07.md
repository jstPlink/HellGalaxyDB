# Audit degli asset Unreal letti dall'Editor — 2026-10-07

> Generato in **sola lettura** (Asset Registry + `get_editor_property`, `auto_save:"false"`, nessun asset toccato o salvato). Fonte: Editor UE 5.8 aperto su HellGalaxy via MCP `127.0.0.1:8010`. Confrontato col foglio ENTITIES/Modules letto il 2026-10-07. **Nessuna cancellazione è stata fatta né va fatta senza conferma esplicita dell'utente.**

## Decisioni dell'utente collegate a questo audit (2026-10-07)

- **Cancellazione (futura, solo con conferma esplicita)**: l'utente vuole eliminare tutti i Data Asset **non utili, copiati male o non realmente collegati al foglio Google**. Decisione da prendere caso per caso quando l'app sarà funzionante (§D e §E sono gli elenchi di partenza). Mai cancellare in automatico; il push si limita a elencarli.
- **Mesh**: gli `SMDA_` senza mesh vanno segnati (§A). Il campo **shield mesh** (`shield_static_mesh`, 97 SMDA lo hanno) **va importato nell'app**.
- **Icone**: il campo icona dell'app accetta **solo immagini** (Texture2D). Gli EDA senza immagine sono segnati (§B); gli asset con materiali / che puntano a `UI_Markers` sono elencati (§C) e **non** vengono importati come icona.
- **EDA non presenti nel foglio**: segnati 10 in §D (l'utente verifica se sono utili o da cancellare); l'elenco completo è in §D2.
- **Discrepanze foglio/Unreal**: segnate nei documenti; l'utente valuterà cosa tenere quando l'app sarà operativa.
- **SMDA/EDA che esistono solo in Unreal**: l'elenco è salvato qui; l'utente deciderà se cancellarli o importarli nell'app.

## A. `SMDA_*` senza `static_mesh` assegnata (56)

Colonne: asset · cartella sotto `Modules/` · presente nel tab `Modules` del foglio?

| Asset | Cartella | Nel foglio |
|---|---|---|
| `SMDA_BODY05-Fregade` | /MainBody | no |
| `SMDA_BODY06-AppioBody` | /MainBody | no |
| `SMDA_MOD68-HeliconEngine` | /MainEngine | sì |
| `SMDA_MOD08-Gun_M` | /PrimaryWeapon | sì |
| `SMDA_MOD100-TestGun` | /PrimaryWeapon | no |
| `SMDA_MOD20-Blades` | /PrimaryWeapon | sì |
| `SMDA_MOD53-GatlingIron_S` | /PrimaryWeapon | no |
| `SMDA_MOD66-BladeGatling` | /PrimaryWeapon | sì |
| `SMDAMOD07-Gun_S_00` | /PrimaryWeapon | no |
| `SMDAMOD07-Gun_S_01` | /PrimaryWeapon | no |
| `SMDAMOD07-Gun_S_02` | /PrimaryWeapon | no |
| `SMDAMOD07-Gun_S_03` | /PrimaryWeapon | no |
| `SMDAMOD07-Gun_S_04` | /PrimaryWeapon | no |
| `SMDAMOD07-Gun_S_05` | /PrimaryWeapon | no |
| `SMDAMOD07-Gun_S_06` | /PrimaryWeapon | no |
| `SMDAMOD07-Gun_S_07` | /PrimaryWeapon | no |
| `SMDAMOD10-Laser_S` | /PrimaryWeapon | no |
| `SMDAMOD11-Laser_L` | /PrimaryWeapon | no |
| `SMDAMOD15-Gatling_01` | /PrimaryWeapon | no |
| `SMDAMOD21-Gatling_02` | /PrimaryWeapon | no |
| `SMDA_Empire_PY-P1_P1_S` | /Pylon | no |
| `SMDA_Empire_PY-P2_DP1_S` | /Pylon | no |
| `SMDA_Empire_PY-P3_DP2_S` | /Pylon | no |
| `SMDA_Gold_PY-P1_P1_S` | /Pylon | no |
| `SMDA_Gold_PY-P2_DP1_S` | /Pylon | no |
| `SMDA_Gold_PY-P3_DP2_S` | /Pylon | no |
| `SMDA_Iron_PY-P1_P1_S` | /Pylon | no |
| `SMDA_Iron_PY-P2_DP1_S` | /Pylon | no |
| `SMDA_Iron_PY-P3_DP2_S` | /Pylon | no |
| `SMDA_Maalaxmi_PY-P1_P1_S` | /Pylon | no |
| `SMDA_Maalaxmi_PY-P2_DP1_S` | /Pylon | no |
| `SMDA_Maalaxmi_PY-P3_DP2_S` | /Pylon | no |
| `SMDA_PY-DP1_DP1_L` | /Pylon | no |
| `SMDA_PY-DP1_DP1_M` | /Pylon | no |
| `SMDA_PY-DP1_DP1_S` | /Pylon | no |
| `SMDA_PY-DP1_DP2_L` | /Pylon | no |
| `SMDA_PY-DP1_DP2_M` | /Pylon | no |
| `SMDA_PY-DP1_DP2_S` | /Pylon | no |
| `SMDA_PY-DP1_DP3_L` | /Pylon | no |
| `SMDA_PY-DP1_DP3_M` | /Pylon | no |
| `SMDA_PY-DP1_DP3_S` | /Pylon | no |
| `SMDA_PY-DP2_DP2_L` | /Pylon | no |
| `SMDA_PY-DP2_DP2_M` | /Pylon | no |
| `SMDA_PY-DP2_DP2_S` | /Pylon | no |
| `SMDA_PY-DP2_DP3_L` | /Pylon | no |
| `SMDA_PY-DP2_DP3_M` | /Pylon | no |
| `SMDA_PY-DP2_DP3_S` | /Pylon | no |
| `SMDA_PY-DP3_DP3_L` | /Pylon | no |
| `SMDA_PY-DP3_DP3_M` | /Pylon | no |
| `SMDA_PY-DP3_DP3_S` | /Pylon | no |
| `SMDA_PY-P1_DP3_S` | /Pylon | no |
| `SMDA_PY-P2_DP3_S` | /Pylon | no |
| `SMDA_PY-P3_DP3_S` | /Pylon | no |
| `SMDAMOD12-RocketLauncher_M` | /SecondaryWeapon | no |
| `SMDAMOD13-RocketLauncher_L` | /SecondaryWeapon | no |
| `SMDAMOD14-AlienRocketLauncher_L` | /SecondaryWeapon | no |

Di questi, **nel foglio** (quindi da sistemare per primi): `SMDA_MOD68-HeliconEngine`, `SMDA_MOD08-Gun_M`, `SMDA_MOD20-Blades`, `SMDA_MOD66-BladeGatling`.

## B. `EDA_*` senza icona (8)

| Asset | entity_type | Nel foglio ENTITIES |
|---|---|---|
| `EDA_BoosterGenerator_L` | ENT_ET_ITEM | sì |
| `EDA_BoosterGenerator_M` | ENT_ET_ITEM | sì |
| `EDA_BoosterGenerator_S` | ENT_ET_ITEM | sì |
| `EDA_BoosterGenerator_XS` | ENT_ET_ITEM | sì |
| `EDA_COL-IronCode_A` | ENT_ET_NONE | no |
| `EDA_MOD100-TestGun` | ENT_ET_MODULE | no |
| `EDA_MOD15b-Gatling_01_Poor` | ENT_ET_MODULE | no |
| `EDA_MOD15c-Gatling_01_Premium` | ENT_ET_MODULE | no |

## C. Icone che NON sono immagini (materiali ecc.) e/o puntano a `UI_Markers`

Classi delle icone degli EDA: `{"Texture2D":133,"MaterialInstanceConstant":21}`. Regola decisa: **l'app accetta solo `Texture2D`**; questi asset restano com'è in Unreal e non entrano nell'app come icona.

**C1 — icona di classe diversa da Texture2D (64)**

| EDA | Classe | Icona |
|---|---|---|
| `EDA_TestHeatSink` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestPowPlan` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestRadar` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestSecEng` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestShieldGen` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestWarpDrive` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `DA_Entity_Gold` | MaterialInstanceConstant | `/Game/PCK/AdvancedSceneTools/ACS/Collectable/Loot/ChildLoots/Goods/UI/MI_LootGold.MI_LootGold` |
| `DA_Entity_Iron` | MaterialInstanceConstant | `/Game/PCK/AdvancedSceneTools/ACS/Collectable/Loot/ChildLoots/Goods/UI/MI_LootIron.MI_LootIron` |
| `DA_Entity_Rock` | MaterialInstanceConstant | `/Game/PCK/AdvancedSceneTools/ACS/Collectable/Loot/ChildLoots/Goods/UI/MI_LootRock.MI_LootRock` |
| `EDA_COL-EngineSphere` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_COL_GenericItem.MI_COL_GenericItem` |
| `EDA_COL-RocketAmmo` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Collectables/MI_COL_RocketAmmo.MI_COL_RocketAmmo` |
| `EDA_COL-ShieldCharger` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_COL_GenericItem.MI_COL_GenericItem` |
| `EDA_MOD00-StartingEngine` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/MI_MOD_SonicExtractor_L.MI_MOD_SonicExtractor_L` |
| `EDA_MOD21a-IntGatling` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/MI_MOD_Gatling_01.MI_MOD_Gatling_01` |
| `EDA_MOD26-Shield_01` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD27-Shield_02` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD28-HeatShield` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD32-WormEngine` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD33-WormTail` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD34-MaalaxmiEngine_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD35-MaalaxmiEngine_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD36-MaalaxmiEngine_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD40-RaiderGatling01` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD43-SonicMatterExtractor_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/MI_MOD_SonicExtractor_S.MI_MOD_SonicExtractor_S` |
| `EDA_PY-DP1_DP1_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP1.MI_MOD_PY_DP1_DP1` |
| `EDA_PY-DP1_DP1_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP1.MI_MOD_PY_DP1_DP1` |
| `EDA_PY-DP1_DP1_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP1.MI_MOD_PY_DP1_DP1` |
| `EDA_PY-DP1_DP2_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP2.MI_MOD_PY_DP1_DP2` |
| `EDA_PY-DP1_DP2_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP2.MI_MOD_PY_DP1_DP2` |
| `EDA_PY-DP1_DP2_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP2.MI_MOD_PY_DP1_DP2` |
| `EDA_PY-DP1_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP3.MI_MOD_PY_DP1_DP3` |
| `EDA_PY-DP1_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP3.MI_MOD_PY_DP1_DP3` |
| `EDA_PY-DP1_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP3.MI_MOD_PY_DP1_DP3` |
| `EDA_PY-DP2_DP2_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP2.MI_MOD_PY_DP2_DP2` |
| `EDA_PY-DP2_DP2_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP2.MI_MOD_PY_DP2_DP2` |
| `EDA_PY-DP2_DP2_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP2.MI_MOD_PY_DP2_DP2` |
| `EDA_PY-DP2_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP3.MI_MOD_PY_DP2_DP3` |
| `EDA_PY-DP2_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP3.MI_MOD_PY_DP2_DP3` |
| `EDA_PY-DP2_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP3.MI_MOD_PY_DP2_DP3` |
| `EDA_PY-DP3_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP3_DP3.MI_MOD_PY_DP3_DP3` |
| `EDA_PY-DP3_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP3_DP3.MI_MOD_PY_DP3_DP3` |
| `EDA_PY-DP3_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP3_DP3.MI_MOD_PY_DP3_DP3` |
| `EDA_PY-P1_DP1_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP1.MI_MOD_PY_P1_DP1` |
| `EDA_PY-P1_DP1_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP1.MI_MOD_PY_P1_DP1` |
| `EDA_PY-P1_DP1_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP1.MI_MOD_PY_P1_DP1` |
| `EDA_PY-P1_DP2_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP2.MI_MOD_PY_P1_DP2` |
| `EDA_PY-P1_DP2_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP2.MI_MOD_PY_P1_DP2` |
| `EDA_PY-P1_DP2_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP2.MI_MOD_PY_P1_DP2` |
| `EDA_PY-P1_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP3.MI_MOD_PY_P1_DP3` |
| `EDA_PY-P1_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP3.MI_MOD_PY_P1_DP3` |
| `EDA_PY-P1_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP3.MI_MOD_PY_P1_DP3` |
| `EDA_PY-P2_DP2_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP2.MI_MOD_PY_P2_DP2` |
| `EDA_PY-P2_DP2_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP2.MI_MOD_PY_P2_DP2` |
| `EDA_PY-P2_DP2_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP2.MI_MOD_PY_P2_DP2` |
| `EDA_PY-P2_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP3.MI_MOD_PY_P2_DP3` |
| `EDA_PY-P2_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP3.MI_MOD_PY_P2_DP3` |
| `EDA_PY-P2_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP3.MI_MOD_PY_P2_DP3` |
| `EDA_PY-P3_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P3_DP3.MI_MOD_PY_P3_DP3` |
| `EDA_PY-P3_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P3_DP3.MI_MOD_PY_P3_DP3` |
| `EDA_PY-P3_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P3_DP3.MI_MOD_PY_P3_DP3` |
| `EDA_SecEng_Tier1` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestAiAugSys` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestHeatSink2` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestTractBeam` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |

**C2 — icona nella cartella `/Game/4_LVLPRESETS/UI_Markers` (61)**

| EDA | Classe | Icona |
|---|---|---|
| `EDA_TestHeatSink` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestPowPlan` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestRadar` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestSecEng` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestShieldGen` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestWarpDrive` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_COL-EngineSphere` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_COL_GenericItem.MI_COL_GenericItem` |
| `EDA_COL-RocketAmmo` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Collectables/MI_COL_RocketAmmo.MI_COL_RocketAmmo` |
| `EDA_COL-ShieldCharger` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_COL_GenericItem.MI_COL_GenericItem` |
| `EDA_MOD00-StartingEngine` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/MI_MOD_SonicExtractor_L.MI_MOD_SonicExtractor_L` |
| `EDA_MOD21a-IntGatling` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/MI_MOD_Gatling_01.MI_MOD_Gatling_01` |
| `EDA_MOD26-Shield_01` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD27-Shield_02` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD28-HeatShield` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD32-WormEngine` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD33-WormTail` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD34-MaalaxmiEngine_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD35-MaalaxmiEngine_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD36-MaalaxmiEngine_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD40-RaiderGatling01` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_MOD43-SonicMatterExtractor_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/MI_MOD_SonicExtractor_S.MI_MOD_SonicExtractor_S` |
| `EDA_PY-DP1_DP1_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP1.MI_MOD_PY_DP1_DP1` |
| `EDA_PY-DP1_DP1_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP1.MI_MOD_PY_DP1_DP1` |
| `EDA_PY-DP1_DP1_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP1.MI_MOD_PY_DP1_DP1` |
| `EDA_PY-DP1_DP2_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP2.MI_MOD_PY_DP1_DP2` |
| `EDA_PY-DP1_DP2_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP2.MI_MOD_PY_DP1_DP2` |
| `EDA_PY-DP1_DP2_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP2.MI_MOD_PY_DP1_DP2` |
| `EDA_PY-DP1_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP3.MI_MOD_PY_DP1_DP3` |
| `EDA_PY-DP1_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP3.MI_MOD_PY_DP1_DP3` |
| `EDA_PY-DP1_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP1_DP3.MI_MOD_PY_DP1_DP3` |
| `EDA_PY-DP2_DP2_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP2.MI_MOD_PY_DP2_DP2` |
| `EDA_PY-DP2_DP2_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP2.MI_MOD_PY_DP2_DP2` |
| `EDA_PY-DP2_DP2_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP2.MI_MOD_PY_DP2_DP2` |
| `EDA_PY-DP2_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP3.MI_MOD_PY_DP2_DP3` |
| `EDA_PY-DP2_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP3.MI_MOD_PY_DP2_DP3` |
| `EDA_PY-DP2_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP2_DP3.MI_MOD_PY_DP2_DP3` |
| `EDA_PY-DP3_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP3_DP3.MI_MOD_PY_DP3_DP3` |
| `EDA_PY-DP3_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP3_DP3.MI_MOD_PY_DP3_DP3` |
| `EDA_PY-DP3_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_DP3_DP3.MI_MOD_PY_DP3_DP3` |
| `EDA_PY-P1_DP1_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP1.MI_MOD_PY_P1_DP1` |
| `EDA_PY-P1_DP1_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP1.MI_MOD_PY_P1_DP1` |
| `EDA_PY-P1_DP1_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP1.MI_MOD_PY_P1_DP1` |
| `EDA_PY-P1_DP2_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP2.MI_MOD_PY_P1_DP2` |
| `EDA_PY-P1_DP2_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP2.MI_MOD_PY_P1_DP2` |
| `EDA_PY-P1_DP2_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP2.MI_MOD_PY_P1_DP2` |
| `EDA_PY-P1_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP3.MI_MOD_PY_P1_DP3` |
| `EDA_PY-P1_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP3.MI_MOD_PY_P1_DP3` |
| `EDA_PY-P1_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P1_DP3.MI_MOD_PY_P1_DP3` |
| `EDA_PY-P2_DP2_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP2.MI_MOD_PY_P2_DP2` |
| `EDA_PY-P2_DP2_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP2.MI_MOD_PY_P2_DP2` |
| `EDA_PY-P2_DP2_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP2.MI_MOD_PY_P2_DP2` |
| `EDA_PY-P2_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP3.MI_MOD_PY_P2_DP3` |
| `EDA_PY-P2_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP3.MI_MOD_PY_P2_DP3` |
| `EDA_PY-P2_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P2_DP3.MI_MOD_PY_P2_DP3` |
| `EDA_PY-P3_DP3_L` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P3_DP3.MI_MOD_PY_P3_DP3` |
| `EDA_PY-P3_DP3_M` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P3_DP3.MI_MOD_PY_P3_DP3` |
| `EDA_PY-P3_DP3_S` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/Modules/Pylons/MI_MOD_PY_P3_DP3.MI_MOD_PY_P3_DP3` |
| `EDA_SecEng_Tier1` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestAiAugSys` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestHeatSink2` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |
| `EDA_TestTractBeam` | MaterialInstanceConstant | `/Game/4_LVLPRESETS/UI_Markers/MI_UIM_MN_GoldPyramid.MI_UIM_MN_GoldPyramid` |

## D. 10 `EDA_*` non presenti nel foglio ENTITIES (da verificare: utili o da cancellare?)

| Asset | entity_type | Icona |
|---|---|---|
| `DA_Entity_Gold` | ENT_ET_COLLECTABLE | `MI_LootGold` |
| `DA_Entity_Iron` | ENT_ET_COLLECTABLE | `MI_LootIron` |
| `DA_Entity_Rock` | ENT_ET_COLLECTABLE | `MI_LootRock` |
| `EDA_COL-SonicMatter` | ENT_ET_COLLECTABLE | `T_COL_GenericCrystal` |
| `EDA_COL-Antimony` | ENT_ET_COLLECTABLE | `T_COL_Antimony` |
| `EDA_COL-Arodisium` | ENT_ET_COLLECTABLE | `T_COL_GenericRadioactive` |
| `EDA_COL-Ashedium` | ENT_ET_COLLECTABLE | `T_COL_GenericRadioactive` |
| `EDA_COL-Atedex` | ENT_ET_COLLECTABLE | `T_COL_GenericRadioactive` |
| `EDA_COL-Aureuryrin` | ENT_ET_COLLECTABLE | `T_COL_Generic` |
| `EDA_COL-BlueEnergyStorage` | ENT_ET_COLLECTABLE | `T_COL_Generic` |

### D2. Elenco completo `EDA_*` non nel foglio (159)

`DA_Entity_Gold`, `DA_Entity_Iron`, `DA_Entity_Rock`, `EDA_COL-Antimony`, `EDA_COL-Arodisium`, `EDA_COL-Ashedium`, `EDA_COL-Atedex`, `EDA_COL-Aureuryrin`, `EDA_COL-BlueEnergyStorage`, `EDA_COL-Bolognum`, `EDA_COL-Brass`, `EDA_COL-Cobalt`, `EDA_COL-ControlSystem`, `EDA_COL-Copper`, `EDA_COL-Corder`, `EDA_COL-Credits`, `EDA_COL-CrystalDust`, `EDA_COL-Dercor`, `EDA_COL-DetonationSystem`, `EDA_COL-EXKnob`, `EDA_COL-EXRefiner`, `EDA_COL-Echilium`, `EDA_COL-F-5-D`, `EDA_COL-Farnezius`, `EDA_COL-Fuel`, `EDA_COL-Gallium`, `EDA_COL-GatlingAmmo`, `EDA_COL-Genusirius`, `EDA_COL-GoldCode_A`, `EDA_COL-GoldCode_B`, `EDA_COL-GoldCode_C`, `EDA_COL-GoldenLoot_A`, `EDA_COL-Goldsmith`, `EDA_COL-Gyzer`, `EDA_COL-Hademy`, `EDA_COL-HiFreqWave`, `EDA_COL-IG-Relay`, `EDA_COL-InputSphere`, `EDA_COL-InstantIntegrity`, `EDA_COL-IonicCharcoalRed`, `EDA_COL-IonicCharcoal`, `EDA_COL-IronCode_A`, `EDA_COL-IronLoot00`, `EDA_COL-Iron`, `EDA_COL-Ironyrin`, `EDA_COL-Iyzer`, `EDA_COL-Jidereum`, `EDA_COL-Joniscus`, `EDA_COL-Kilmin`, `EDA_COL-Lavherius`, `EDA_COL-Lithium`, `EDA_COL-LogPro`, `EDA_COL-Lollipop`, `EDA_COL-LowFreqWave`, `EDA_COL-Lyv`, `EDA_COL-Manganese`, `EDA_COL-Mercury`, `EDA_COL-MetalPesticide`, `EDA_COL-Mimicrum`, `EDA_COL-MinesAmmo`, `EDA_COL-Nickel`, `EDA_COL-OpalMind`, `EDA_COL-Orichalcum`, `EDA_COL-Otuliseom`, `EDA_COL-Ox-Zubirio`, `EDA_COL-Palladium`, `EDA_COL-Pewter`, `EDA_COL-PolishedCylinder`, `EDA_COL-PolymerizerWebSystem`, `EDA_COL-Polys-999`, `EDA_COL-PressureStabilizer`, `EDA_COL-Promethium`, `EDA_COL-RadioactiveWaste`, `EDA_COL-Rakedder`, `EDA_COL-ReInnovator`, `EDA_COL-RedEnergyStorage`, `EDA_COL-Rock`, `EDA_COL-RocketAmmo`, `EDA_COL-Sarfkron`, `EDA_COL-Shen-ten`, `EDA_COL-ShieldCharger`, `EDA_COL-Silver`, `EDA_COL-Sohelium`, `EDA_COL-SonicMatter_Asteroids`, `EDA_COL-SonicMatter_Black`, `EDA_COL-SonicMatter_Elephants`, `EDA_COL-SonicMatter_Green`, `EDA_COL-SonicMatter_InsectKiss`, `EDA_COL-SonicMatter_Outpost`, `EDA_COL-SonicMatter_Red`, `EDA_COL-SonicMatter_SnakeHead`, `EDA_COL-SonicMatter`, `EDA_COL-SorterPYR`, `EDA_COL-StaticElectricityS`, `EDA_COL-Sunyus`, `EDA_COL-Tin`, `EDA_COL-Titanium`, `EDA_COL-TranslatorAI`, `EDA_COL-Trismuth`, `EDA_COL-Tungsten`, `EDA_COL-Uranium`, `EDA_COL-Vlynker`, `EDA_COL-Vytted`, `EDA_COL-Waste`, `EDA_COL-Yaker`, `EDA_COL-Zinc`, `EDA_COL-Zirconium`, `EDA_COL-Ziudder`, `EDA_MOD00-StartingEngine`, `EDA_MOD100-TestGun`, `EDA_MOD15b-Gatling_01_Poor`, `EDA_MOD15c-Gatling_01_Premium`, `EDA_MOD21a-IntGatling`, `EDA_MOD43-SonicMatterExtractor_S`, `EDA_MOD53-GatlingIron_S`, `EDA_MOD54-LaserGold_L`, `EDA_PY-DP1_DP1_L`, `EDA_PY-DP1_DP1_M`, `EDA_PY-DP1_DP1_S`, `EDA_PY-DP1_DP2_L`, `EDA_PY-DP1_DP2_M`, `EDA_PY-DP1_DP2_S`, `EDA_PY-DP1_DP3_L`, `EDA_PY-DP1_DP3_M`, `EDA_PY-DP1_DP3_S`, `EDA_PY-DP2_DP2_L`, `EDA_PY-DP2_DP2_M`, `EDA_PY-DP2_DP2_S`, `EDA_PY-DP2_DP3_L`, `EDA_PY-DP2_DP3_M`, `EDA_PY-DP2_DP3_S`, `EDA_PY-DP3_DP3_L`, `EDA_PY-DP3_DP3_M`, `EDA_PY-DP3_DP3_S`, `EDA_PY-P1_DP1_L`, `EDA_PY-P1_DP1_M`, `EDA_PY-P1_DP1_S`, `EDA_PY-P1_DP2_L`, `EDA_PY-P1_DP2_M`, `EDA_PY-P1_DP2_S`, `EDA_PY-P1_DP3_L`, `EDA_PY-P1_DP3_M`, `EDA_PY-P1_DP3_S`, `EDA_PY-P1_P3_L`, `EDA_PY-P1_P3_M`, `EDA_PY-P1_P3_S`, `EDA_PY-P2_DP2_L`, `EDA_PY-P2_DP2_M`, `EDA_PY-P2_DP2_S`, `EDA_PY-P2_DP3_L`, `EDA_PY-P2_DP3_M`, `EDA_PY-P2_DP3_S`, `EDA_PY-P2_P3_L`, `EDA_PY-P2_P3_M`, `EDA_PY-P2_P3_S`, `EDA_PY-P3_DP3_L`, `EDA_PY-P3_DP3_M`, `EDA_PY-P3_DP3_S`, `EDA_TestHeatSink2`

## E. `SMDA_*` che esistono in Unreal ma non nel tab `Modules` (121)

Probabili asset legacy o copiati male (alcuni con nome senza underscore dopo `SMDA`). Salvati per decidere in seguito se cancellarli o importarli nell'app.

**/Cargo** (5): `SMDA_MOD04-Cargo_S`, `SMDA_MOD04-Cargo_XS`, `SMDA_MOD05-Cargo_M`, `SMDA_MOD06-Cargo_L`, `SMDA_MOD31-WormCargo`

**/Decoration** (1): `SMDA_MOD33-WormTail`

**/DefensiveWeapon** (1): `SMDA_MOD16-MineDropper`

**/FuelTank** (1): `SMDA_MOD29-FuelTank`

**/MainBody** (3): `SMDA_BODY01-Spartan_Tier5`, `SMDA_BODY05-Fregade (senza mesh)`, `SMDA_BODY06-AppioBody (senza mesh)`

**/MainEngine** (8): `SMDA_MOD00-StartingEngine`, `SMDA_MOD00-TestEngine`, `SMDA_MOD00a-InternalEngine_00`, `SMDA_MOD00a-InternalEngine_01`, `SMDA_MOD01a-Engine_Iron_M`, `SMDA_MOD34-MaalaxmiEngine_S`, `SMDA_MOD35-MaalaxmiEngine_M`, `SMDA_MOD36-MaalaxmiEngine_L`

**/NuclearRocket** (3): `SMDA_MOD22-Bomb`, `SMDA_MOD23-MOAB666`, `SMDA_MOD24-NeptuneMissile`

**/PrimaryWeapon** (32): `SMDAMOD07-Gun_S_00 (senza mesh)`, `SMDAMOD07-Gun_S_01 (senza mesh)`, `SMDAMOD07-Gun_S_02 (senza mesh)`, `SMDAMOD07-Gun_S_03 (senza mesh)`, `SMDAMOD07-Gun_S_04 (senza mesh)`, `SMDAMOD07-Gun_S_05 (senza mesh)`, `SMDAMOD07-Gun_S_06 (senza mesh)`, `SMDAMOD07-Gun_S_07 (senza mesh)`, `SMDAMOD10-Laser_S (senza mesh)`, `SMDAMOD11-Laser_L (senza mesh)`, `SMDAMOD15-Gatling_01 (senza mesh)`, `SMDAMOD21-Gatling_02 (senza mesh)`, `SMDA_COL-RehunRelic`, `SMDA_MOD100-TestGun (senza mesh)`, `SMDA_MOD10a-IntLaser`, `SMDA_MOD15-Gatling_03`, `SMDA_MOD15a-IntGatling`, `SMDA_MOD15b-Gatling_01_Poor`, `SMDA_MOD15b-IntGatling`, `SMDA_MOD15c-Gatling_01_Premium`, `SMDA_MOD21a-IntGatling`, `SMDA_MOD53-GatlingIron_S (senza mesh)`, `SMDA_MOD54-LaserGold_L`, `SMDA_MOD55-GatlingLevel1_S`, `SMDA_MOD55-GatlingLevel2_S`, `SMDA_MOD55-GatlingLevel3_S`, `SMDA_MOD55-GatlingLevel4_S`, `SMDA_MOD56-Organic_S`, `SMDA_MOD56c-Organic_Starting`, `SMDA_MOD57-Organic_M`, `SMDA_MOD58-Organic_L`, `SMDA_MOD59-OrganicLevel_S`

**/Pylon** (56): `SMDA_Empire_PY-P1_P1_S (senza mesh)`, `SMDA_Empire_PY-P2_DP1_S (senza mesh)`, `SMDA_Empire_PY-P3_DP2_S (senza mesh)`, `SMDA_Gold_PY-P1_P1_S (senza mesh)`, `SMDA_Gold_PY-P2_DP1_S (senza mesh)`, `SMDA_Gold_PY-P3_DP2_S (senza mesh)`, `SMDA_Iron_PY-P1_P1_S (senza mesh)`, `SMDA_Iron_PY-P2_DP1_S (senza mesh)`, `SMDA_Iron_PY-P3_DP2_S (senza mesh)`, `SMDA_MOD37-StdToolbox`, `SMDA_MOD38-DefuseToolbox`, `SMDA_Maalaxmi_PY-P1_P1_S (senza mesh)`, `SMDA_Maalaxmi_PY-P2_DP1_S (senza mesh)`, `SMDA_Maalaxmi_PY-P3_DP2_S (senza mesh)`, `SMDA_PY-DP1_DP1_L (senza mesh)`, `SMDA_PY-DP1_DP1_M (senza mesh)`, `SMDA_PY-DP1_DP1_S (senza mesh)`, `SMDA_PY-DP1_DP2_L (senza mesh)`, `SMDA_PY-DP1_DP2_M (senza mesh)`, `SMDA_PY-DP1_DP2_S (senza mesh)`, `SMDA_PY-DP1_DP3_L (senza mesh)`, `SMDA_PY-DP1_DP3_M (senza mesh)`, `SMDA_PY-DP1_DP3_S (senza mesh)`, `SMDA_PY-DP2_DP2_L (senza mesh)`, `SMDA_PY-DP2_DP2_M (senza mesh)`, `SMDA_PY-DP2_DP2_S (senza mesh)`, `SMDA_PY-DP2_DP3_L (senza mesh)`, `SMDA_PY-DP2_DP3_M (senza mesh)`, `SMDA_PY-DP2_DP3_S (senza mesh)`, `SMDA_PY-DP3_DP3_L (senza mesh)`, `SMDA_PY-DP3_DP3_M (senza mesh)`, `SMDA_PY-DP3_DP3_S (senza mesh)`, `SMDA_PY-P1_DP1_L`, `SMDA_PY-P1_DP1_M`, `SMDA_PY-P1_DP1_S`, `SMDA_PY-P1_DP2_L`, `SMDA_PY-P1_DP2_M`, `SMDA_PY-P1_DP2_S`, `SMDA_PY-P1_DP3_L`, `SMDA_PY-P1_DP3_M`, `SMDA_PY-P1_DP3_S (senza mesh)`, `SMDA_PY-P1_P3_L`, `SMDA_PY-P1_P3_M`, `SMDA_PY-P1_P3_S`, `SMDA_PY-P2_DP2_L`, `SMDA_PY-P2_DP2_M`, `SMDA_PY-P2_DP2_S`, `SMDA_PY-P2_DP3_L`, `SMDA_PY-P2_DP3_M`, `SMDA_PY-P2_DP3_S (senza mesh)`, `SMDA_PY-P2_P3_L`, `SMDA_PY-P2_P3_M`, `SMDA_PY-P2_P3_S`, `SMDA_PY-P3_DP3_L`, `SMDA_PY-P3_DP3_M`, `SMDA_PY-P3_DP3_S (senza mesh)`

**/SecondaryWeapon** (6): `SMDAMOD12-RocketLauncher_M (senza mesh)`, `SMDAMOD13-RocketLauncher_L (senza mesh)`, `SMDAMOD14-AlienRocketLauncher_L (senza mesh)`, `SMDA_MOD16-MineDropper`, `SMDA_MOD43-SonicMatterShooter_S`, `SMDA_NPC_MOD30-RocketLauncher_S`

**/SonicMatterExtractor** (3): `SMDA_MOD17-SonicMatterExtractor_S`, `SMDA_MOD18-SonicMatterExtractor_M`, `SMDA_MOD19-SonicMatterExtractor_L`

**/Toolbox** (2): `SMDA_MOD37-StdToolbox`, `SMDA_MOD38-DefuseToolbox`

**Stesso nome SMDA in più cartelle (5)**: `SMDA_MOD37-StdToolbox` → /Pylon, /Toolbox; `SMDA_MOD20-Blades` → /Decoration, /PrimaryWeapon; `SMDA_MOD16-MineDropper` → /DefensiveWeapon, /SecondaryWeapon; `SMDA_MOD08-Gun_M` → /PrimaryWeapon, /Turret; `SMDA_MOD38-DefuseToolbox` → /Pylon, /Toolbox

## F. Entità del foglio senza `EDA_` in Unreal

`COL-RocketsRecharge`

## G. Discrepanze foglio ↔ Unreal (campo icona, ID in comune)

Icona uguale: 187 · diversa: 0 · solo nel foglio: 0 · **solo in Unreal (foglio vuoto): 79** — da valutare quando si farà funzionare l'app (M1: il campo vuoto del foglio si legge da Unreal, ma solo se è un'immagine, §C). Elenco dei 79:

| EDA | Icona in Unreal | Classe |
|---|---|---|
| `EDA_TestHeatSink` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_TestPowPlan` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_TestRadar` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_TestSecEng` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_TestShieldGen` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_TestWarpDrive` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_COL-AimBoost_L` | `T_CON_Generic` | Texture2D |
| `EDA_COL-AimBoost_M` | `T_CON_Generic` | Texture2D |
| `EDA_COL-AimBoost_S` | `T_CON_Generic` | Texture2D |
| `EDA_COL-EngineSphere` | `MI_COL_GenericItem` | MaterialInstanceConstant |
| `EDA_COL-IntegrityRecover_L` | `T_CON_Generic` | Texture2D |
| `EDA_COL-IntegrityRecover_M` | `T_CON_Generic` | Texture2D |
| `EDA_COL-IntegrityRecover_S` | `T_CON_Generic` | Texture2D |
| `EDA_COL-NetShieldEnhancer_L` | `T_CON_Generic` | Texture2D |
| `EDA_COL-NetShieldEnhancer_M` | `T_CON_Generic` | Texture2D |
| `EDA_COL-NetShieldEnhancer_S` | `T_CON_Generic` | Texture2D |
| `EDA_COL-PowerAmmo` | `T_CON_Generic` | Texture2D |
| `EDA_COL-PowerFuel_L` | `T_CON_Generic` | Texture2D |
| `EDA_COL-PowerFuel_M` | `T_CON_Generic` | Texture2D |
| `EDA_COL-PowerFuel_S` | `T_CON_Generic` | Texture2D |
| `EDA_COL-ShieldRecover_L` | `T_CON_Generic` | Texture2D |
| `EDA_COL-ShieldRecover_M` | `T_CON_Generic` | Texture2D |
| `EDA_COL-ShieldRecover_S` | `T_CON_ShieldRepairer` | Texture2D |
| `EDA_COL-StationSupply_A` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_B` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_C` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_D` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_E` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_F` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_G` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_H` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_I` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_J` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_K` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_L` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_M` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_N` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_O` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_P` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_Q` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_R` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_S` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_T` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_U` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_V` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_W` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_X` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_Y` | `T_COL_Generic` | Texture2D |
| `EDA_COL-StationSupply_Z` | `T_COL_Generic` | Texture2D |
| `EDA_COL-WeaponCoolerA_L` | `T_CON_Generic` | Texture2D |
| `EDA_COL-WeaponCoolerA_M` | `T_CON_Generic` | Texture2D |
| `EDA_COL-WeaponCoolerA_S` | `T_CON_Generic` | Texture2D |
| `EDA_COL-WeaponCoolerB` | `T_CON_Generic` | Texture2D |
| `EDA_COL-WeaponOverloadA` | `T_CON_Generic` | Texture2D |
| `EDA_COL-WeaponOverloadB` | `T_CON_Generic` | Texture2D |
| `EDA_MOD00-BladeShipEngine` | `T_SB_Blade` | Texture2D |
| `EDA_MOD01-EngineLevel1_S` | `T_MOD_Engine_S` | Texture2D |
| `EDA_MOD01-EngineLevel2_S` | `T_MOD_Engine_S` | Texture2D |
| `EDA_MOD01-EngineLevel3_S` | `T_MOD_Engine_S` | Texture2D |
| `EDA_MOD01-EngineLevel4_S` | `T_MOD_Engine_S` | Texture2D |
| `EDA_MOD01-EngineLevel_S` | `T_MOD_Engine_S` | Texture2D |
| `EDA_MOD26-Shield_01` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_MOD27-Shield_02` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_MOD28-HeatShield` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_MOD32-WormEngine` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_MOD33-WormTail` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_MOD34-MaalaxmiEngine_S` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_MOD35-MaalaxmiEngine_M` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_MOD36-MaalaxmiEngine_L` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_MOD40-RaiderGatling01` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_MOD68-HeliconEngine` | `T_Item_Power_A` | Texture2D |
| `EDA_MOD69-HeliconGatling` | `T_Item_Power_A` | Texture2D |
| `EDA_MOD70-HeliconEngine_Premium` | `MOD70-HeliconEngine_Premium` | Texture2D |
| `EDA_MOD71-HeliconGatling_Premium` | `T_MOD71-HeliconGatling_Premium` | Texture2D |
| `EDA_SBDY05-Helicon` | `T_SB_Helicon` | Texture2D |
| `EDA_SBDY06-Blade` | `T_SB_Blade` | Texture2D |
| `EDA_SecEng_Tier1` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_TestAiAugSys` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |
| `EDA_TestTractBeam` | `MI_UIM_MN_GoldPyramid` | MaterialInstanceConstant |

## H. `quality` negli SMDA_/SIDA_ di Unreal vs foglio (Items + Modules)

Letti 306 asset (SMDA+SIDA, 305 con la proprietà): 171 righe del foglio hanno un asset corrispondente; **5 differenze** (regola decisa dall'utente: vale Unreal; l'app scriverà `quality` negli SMDA/SIDA al push). Altri 131 asset Unreal non hanno riga nel foglio. 199 asset hanno `quality` > 0.

| Asset | Unreal | Foglio | ENTITIES |
|---|---|---|---|
| `SMDA_MOD08-Gun_M` | 10 | 222 | 222 |
| `SMDA_MOD20-Blades` | 10 | 222 | 222 |
| `SMDA_MOD67-BladeRocketLauncher` | 951 | 945 | 945 |
| `SMDA_MOD30b-StartingRocketLauncher` | 461 | 460 | 460 |
| `SMDA_MOD30a-RocketLauncher_S_Poor` | 445 | 443 | 443 |

Decisione dell'utente: i due con valore 10 in Unreal indicano moduli **non usati** (il valore non conta): si usa quello del foglio. Per le altre tre vale Unreal.

Nota: le tre differenze piccole sembrano un ricalcolo recente del foglio non ancora propagato in Unreal (da verificare con l'utente); le due con valore 10 sembrano segnaposto in Unreal.

## I. ProducerIcon: Unreal vs foglio (EDA con `producer_icon` assegnato, 12)

Valore di Unreal vs sigla del foglio: tutti i 11 confrontabili sono **diversi** (es. `EDA_BODY01-Spartan`: Unreal Tolec, foglio KnB; `EDA_MOD01-Engine_S`: Unreal TTF, foglio Entity). Regola decisa: **vale Unreal**; l'app si compila da Unreal alla prima lettura. Il 12° (`EDA_COL-SonicMatter`, non nel foglio) usa `IMG_COL_GenericItem`, non un `ICN_producer_*`.

## J. Confronto foglio ↔ Unreal letto dall'app (2026-10-07, sola lettura; "Leggi da Unreal")

EDA_ letti 429 · entità nell'app 271 · corrispondenti 270 · senza EDA: `COL-RocketsRecharge` · EDA solo in Unreal: 159 (vedi §D2).
Campi che l'app prende da Unreal (foglio vuoto/non utilizzabile): **icona 60**, **produttore 11** (tutti contraddizioni: vale Unreal), nome 0, descrizione 0.
Icone di Unreal non-immagine (non importate): 19; EDA senza icona: 4.
**Solo confronto, vale il foglio, nessuna modifica** (da valutare quando si farà funzionare l'app): tipo 26, rarità 31, prezzo 63, nome 0, descrizione 1.

### J1. Prezzo diverso (63)
- BODY00-StaringBody: foglio 900 / Unreal 500
- BODY01-Spartan: foglio 2700 / Unreal 1800
- BODY02-Dragon: foglio 2100 / Unreal 1600
- BODY03-Principal: foglio 1300 / Unreal 600
- BODY04-AppioBody: foglio 1300 / Unreal 700
- BODY14-IronScale: foglio 3200 / Unreal 2100
- BODY15-GoldWings: foglio 3200 / Unreal 2100
- BODY16-IronScaleRust: foglio 2900 / Unreal 1500
- BODY17-GoldWingsDust: foglio 2700 / Unreal 1500
- SBDY01-Eagle: foglio 3400 / Unreal 1800
- SBDY03-Fly: foglio 2700 / Unreal 1600
- SBDY05-Helicon: foglio 4200 / Unreal 2900
- SBDY06-Blade: foglio 3500 / Unreal 2400
- MOD00-StartingShipEngine: foglio 0 / Unreal 100
- MOD07-Gun_S_00: foglio 500 / Unreal 400
- MOD07-Gun_S_01: foglio 100 / Unreal 0
- MOD07-Gun_S_02: foglio 800 / Unreal 300
- MOD07-Gun_S_03: foglio 600 / Unreal 300
- MOD07-Gun_S_04: foglio 600 / Unreal 400
- MOD07-Gun_S_05: foglio 100 / Unreal 0
- MOD07-Gun_S_06: foglio 100 / Unreal 0
- MOD07-Gun_S_07: foglio 100 / Unreal 0
- MOD07-Gun_S_07_Premium: foglio 100 / Unreal 0
- MOD08-Gun_M: foglio 100 / Unreal 0
- MOD10-Laser_S: foglio 300 / Unreal 700
- MOD10b-Laser_S_Poor: foglio 500 / Unreal 200
- MOD10c-Laser_Starting: foglio 400 / Unreal 100
- MOD11b-Laser_L_Poor: foglio 100 / Unreal 0
- MOD11-Laser_L: foglio 100 / Unreal 0
- MOD11c-Laser_L_Premium: foglio 100 / Unreal 0
- MOD15-Gatling_00: foglio 300 / Unreal 100
- MOD15-Gatling_01: foglio 300 / Unreal 0
- MOD15-Gatling_02: foglio 300 / Unreal 0
- MOD20-Blades: foglio 100 / Unreal 0
- MOD21-Gatling_02: foglio 100 / Unreal 0
- MOD21b-Gatling_02_Poor: foglio 100 / Unreal 0
- MOD21c-Gatling_02_Premium: foglio 100 / Unreal 0
- MOD40-RaiderGatling01: foglio 100 / Unreal 0
- MOD41-Gatling_S: foglio 300 / Unreal 200
- MOD41a-Gatling_S_Poor: foglio 400 / Unreal 100
- MOD41b-Gatling_S_Premium: foglio 600 / Unreal 500
- MOD41c-Gatling_S_Marianan: foglio 800 / Unreal 600
- MOD42-Gatling_M: foglio 100 / Unreal 0
- MOD50b-SonicMatterShooter_XS: foglio 0 / Unreal 100
- MOD53-GatlingIron_M: foglio 100 / Unreal 0
- MOD54-LaserGold_S: foglio 100 / Unreal 0
- MOD55-GatlingLevel_S: foglio 100 / Unreal 0
- MOD56-LaserLevel_S: foglio 100 / Unreal 0
- MOD60-AlienGatling_S: foglio 100 / Unreal 0
- MOD61-AlienGatling_M: foglio 100 / Unreal 0
- MOD63-EWasEngine: foglio 400 / Unreal 200
- MOD64-BladeEngine: foglio 1000 / Unreal 2200
- MOD65-BladeLaser: foglio 800 / Unreal 1000
- MOD66-BladeGatling: foglio 1100 / Unreal 1000
- MOD69-HeliconGatling: foglio 100 / Unreal 0
- MOD70-HeliconEngine_Premium: foglio 800 / Unreal 1700
- MOD71-HeliconGatling_Premium: foglio 1500 / Unreal 800
- MOD72-GatlingGold_S: foglio 100 / Unreal 0
- MOD73-GatlingIron_S: foglio 100 / Unreal 0
- MOD74-RadiantLaser_L: foglio 400 / Unreal 1300
- MOD75-DragonThrust_M: foglio 700 / Unreal 1000
- MOD77-LaserSpike_S: foglio 900 / Unreal 200
- MOD78-RageGun_S: foglio 700 / Unreal 200

### J2. Rarità diversa (31)
- BODY00-StaringBody: foglio "Uncommon" / Unreal "Common"
- BODY01-Spartan: foglio "Legendary" / Unreal "Epic"
- BODY02-Dragon: foglio "Mythic" / Unreal "Epic"
- BODY03-Principal: foglio "Rare" / Unreal "Common"
- BODY04-AppioBody: foglio "Rare" / Unreal "Common"
- BODY14-IronScale: foglio "Legendary" / Unreal "Mythic"
- BODY16-IronScaleRust: foglio "Legendary" / Unreal "Rare"
- SBDY01-Eagle: foglio "Legendary" / Unreal "Epic"
- SBDY03-Fly: foglio "Legendary" / Unreal "Epic"
- MOD07-Gun_S_02: foglio "Epic" / Unreal "Common"
- MOD07-Gun_S_03: foglio "Rare" / Unreal "Common"
- MOD07-Gun_S_04: foglio "Rare" / Unreal "Common"
- MOD10-Laser_S: foglio "Common" / Unreal "Rare"
- MOD10b-Laser_S_Poor: foglio "Uncommon" / Unreal "Salvage"
- MOD10c-Laser_Starting: foglio "Uncommon" / Unreal "Salvage"
- MOD15-Gatling_00: foglio "Common" / Unreal "Salvage"
- MOD15-Gatling_01: foglio "Common" / Unreal "Salvage"
- MOD15-Gatling_02: foglio "Common" / Unreal "Salvage"
- MOD41-Gatling_S: foglio "Common" / Unreal "Salvage"
- MOD41a-Gatling_S_Poor: foglio "Uncommon" / Unreal "Salvage"
- MOD41b-Gatling_S_Premium: foglio "Rare" / Unreal "Uncommon"
- MOD41c-Gatling_S_Marianan: foglio "Epic" / Unreal "Rare"
- MOD63-EWasEngine: foglio "Uncommon" / Unreal "Salvage"
- MOD64-BladeEngine: foglio "Mythic" / Unreal "Legendary"
- MOD66-BladeGatling: foglio "Mythic" / Unreal "Epic"
- MOD70-HeliconEngine_Premium: foglio "Epic" / Unreal "Legendary"
- MOD71-HeliconGatling_Premium: foglio "Legendary" / Unreal "Epic"
- MOD74-RadiantLaser_L: foglio "Uncommon" / Unreal "Legendary"
- MOD75-DragonThrust_M: foglio "Rare" / Unreal "Epic"
- MOD77-LaserSpike_S: foglio "Epic" / Unreal "Common"
- MOD78-RageGun_S: foglio "Rare" / Unreal "Salvage"

### J3. Tipo diverso (26)
- COL-StationSupply_A: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_B: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_C: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_D: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_E: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_F: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_G: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_H: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_I: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_J: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_K: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_L: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_M: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_N: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_O: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_P: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_Q: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_R: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_S: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_T: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_U: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_V: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_W: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_X: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_Y: foglio "Consumable" / Unreal "Collectable"
- COL-StationSupply_Z: foglio "Consumable" / Unreal "Collectable"

### J4. Descrizione diversa (1)
- MOD03b-Engine_L_Poor: foglio "The HIS M-engine patent evolved into this Reduced Transmissi" / Unreal "The HIS Propulser 44 patent evolved into this Reduced Transm"

### J5. Produttore: foglio ≠ Unreal (11, vale Unreal)
- BODY01-Spartan: foglio KnB / Unreal Tolec
- BODY02-Dragon: foglio Entity / Unreal IGF
- BODY03-Principal: foglio IGF / Unreal Entity
- BODY04-AppioBody: foglio Tolec / Unreal HomeInSpace
- MOD01-Engine_XS: foglio Entity / Unreal Rebext
- MOD01-Engine_S: foglio Entity / Unreal TTF
- MOD02-Engine_M: foglio HomeInSpace / Unreal Cagetastic
- MOD03-Engine_L: foglio HomeInSpace / Unreal Entity
- MOD07-Gun_S_07: foglio IGF / Unreal Abby
- MOD13-RocketLauncher_L: foglio Rebext / Unreal KnB
- MOD16-MineDropper: foglio KnB / Unreal IGF

### J6. Icone di Unreal che non sono immagini (19)
- COL-EngineSphere (MaterialInstanceConstant: MI_COL_GenericItem)
- TestAiAugSys (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- TestHeatSink (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- TestPowPlan (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- TestRadar (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- TestSecEng (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- SecEng_Tier1 (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- TestShieldGen (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- TestTractBeam (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- TestWarpDrive (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- MOD26-Shield_01 (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- MOD27-Shield_02 (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- MOD28-HeatShield (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- MOD32-WormEngine (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- MOD33-WormTail (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- MOD34-MaalaxmiEngine_S (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- MOD35-MaalaxmiEngine_M (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- MOD36-MaalaxmiEngine_L (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)
- MOD40-RaiderGatling01 (MaterialInstanceConstant: MI_UIM_MN_GoldPyramid)

### J7. EDA senza icona (4)
- BoosterGenerator_S
- BoosterGenerator_XS
- BoosterGenerator_M
- BoosterGenerator_L

## K. Moduli: foglio (tab Modules) ↔ SMDA_ di Unreal, letti dall'app (2026-10-07, sola lettura)

Tab Modules importato esattamente: **140 righe, 12 sezioni** (MainBody 22, MainEngine 35, PrimaryWeapon 45, SecondaryWeapon 14, Pylon 24; Cargo, FuelTank, Turret, Decoration, NuclearRocket, SonicMatterExtractor, Toolbox vuote). SMDA_ letti: 263; corrispondenti ai moduli del foglio: **140/140**.
Campi che l'app prende da Unreal: **mesh 136**, **shield mesh 79**, **quality 3**. **Statistiche** (consumi, danni, velocità, ecc.): foglio e Unreal **coincidono** per tutte le righe (0 differenze).

### K1. Moduli del foglio senza mesh in Unreal (4)
- MOD68-HeliconEngine
- MOD08-Gun_M
- MOD20-Blades
- MOD66-BladeGatling
(`MOD08-Gun_M` ha due SMDA in cartelle diverse: quello in `PrimaryWeapon` non ha mesh, quello in `Turret` sì — vedi K3.)

### K2. Quality diversa (vale Unreal)
- MOD30a-RocketLauncher_S_Poor: foglio 443 / Unreal 445
- MOD30b-StartingRocketLauncher: foglio 460 / Unreal 461
- MOD67-BladeRocketLauncher: foglio 945 / Unreal 951
(I due moduli con Quality 10 in Unreal — `MOD08-Gun_M`, `MOD20-Blades` — sono "non usati": si usa il valore del foglio, nessuna segnalazione.)

### K3. Stesso SMDA_ in più cartelle di Unreal (5) — da sistemare, l'app sceglie quello nella cartella della sezione del foglio
- SMDA_MOD37-StdToolbox: Pylon / Toolbox
- SMDA_MOD38-DefuseToolbox: Toolbox / Pylon
- SMDA_MOD08-Gun_M: Turret / PrimaryWeapon
- SMDA_MOD16-MineDropper: SecondaryWeapon / DefensiveWeapon
- SMDA_MOD20-Blades: PrimaryWeapon / Decoration

### K4. SMDA_ in Unreal che non sono nel tab Modules (103) — mai cancellati
`SMDA_BODY01-Spartan_Tier5`, `SMDA_BODY05-Fregade`, `SMDA_BODY06-AppioBody`, `SMDA_COL-RehunRelic`, `SMDA_Empire_PY-P1_P1_S`, `SMDA_Empire_PY-P2_DP1_S`, `SMDA_Empire_PY-P3_DP2_S`, `SMDA_Gold_PY-P1_P1_S`, `SMDA_Gold_PY-P2_DP1_S`, `SMDA_Gold_PY-P3_DP2_S`, `SMDA_Iron_PY-P1_P1_S`, `SMDA_Iron_PY-P2_DP1_S`, `SMDA_Iron_PY-P3_DP2_S`, `SMDA_MOD00-StartingEngine`, `SMDA_MOD00-TestEngine`, `SMDA_MOD00a-InternalEngine_00`, `SMDA_MOD00a-InternalEngine_01`, `SMDA_MOD01a-Engine_Iron_M`, `SMDA_MOD04-Cargo_S`, `SMDA_MOD04-Cargo_XS`, `SMDA_MOD05-Cargo_M`, `SMDA_MOD06-Cargo_L`, `SMDA_MOD100-TestGun`, `SMDA_MOD10a-IntLaser`, `SMDA_MOD15-Gatling_03`, `SMDA_MOD15a-IntGatling`, `SMDA_MOD15b-Gatling_01_Poor`, `SMDA_MOD15b-IntGatling`, `SMDA_MOD15c-Gatling_01_Premium`, `SMDA_MOD16-MineDropper`, `SMDA_MOD17-SonicMatterExtractor_S`, `SMDA_MOD18-SonicMatterExtractor_M`, `SMDA_MOD19-SonicMatterExtractor_L`, `SMDA_MOD21a-IntGatling`, `SMDA_MOD22-Bomb`, `SMDA_MOD23-MOAB666`, `SMDA_MOD24-NeptuneMissile`, `SMDA_MOD29-FuelTank`, `SMDA_MOD31-WormCargo`, `SMDA_MOD33-WormTail`, `SMDA_MOD34-MaalaxmiEngine_S`, `SMDA_MOD35-MaalaxmiEngine_M`, `SMDA_MOD36-MaalaxmiEngine_L`, `SMDA_MOD37-StdToolbox`, `SMDA_MOD38-DefuseToolbox`, `SMDA_MOD43-SonicMatterShooter_S`, `SMDA_MOD53-GatlingIron_S`, `SMDA_MOD54-LaserGold_L`, `SMDA_MOD55-GatlingLevel1_S`, `SMDA_MOD55-GatlingLevel2_S`, `SMDA_MOD55-GatlingLevel3_S`, `SMDA_MOD55-GatlingLevel4_S`, `SMDA_MOD56-Organic_S`, `SMDA_MOD56c-Organic_Starting`, `SMDA_MOD57-Organic_M`, `SMDA_MOD58-Organic_L`, `SMDA_MOD59-OrganicLevel_S`, `SMDA_Maalaxmi_PY-P1_P1_S`, `SMDA_Maalaxmi_PY-P2_DP1_S`, `SMDA_Maalaxmi_PY-P3_DP2_S`, `SMDA_NPC_MOD30-RocketLauncher_S`, `SMDA_PY-DP1_DP1_L`, `SMDA_PY-DP1_DP1_M`, `SMDA_PY-DP1_DP1_S`, `SMDA_PY-DP1_DP2_L`, `SMDA_PY-DP1_DP2_M`, `SMDA_PY-DP1_DP2_S`, `SMDA_PY-DP1_DP3_L`, `SMDA_PY-DP1_DP3_M`, `SMDA_PY-DP1_DP3_S`, `SMDA_PY-DP2_DP2_L`, `SMDA_PY-DP2_DP2_M`, `SMDA_PY-DP2_DP2_S`, `SMDA_PY-DP2_DP3_L`, `SMDA_PY-DP2_DP3_M`, `SMDA_PY-DP2_DP3_S`, `SMDA_PY-DP3_DP3_L`, `SMDA_PY-DP3_DP3_M`, `SMDA_PY-DP3_DP3_S`, `SMDA_PY-P1_DP1_L`, `SMDA_PY-P1_DP1_M`, `SMDA_PY-P1_DP1_S`, `SMDA_PY-P1_DP2_L`, `SMDA_PY-P1_DP2_M`, `SMDA_PY-P1_DP2_S`, `SMDA_PY-P1_DP3_L`, `SMDA_PY-P1_DP3_M`, `SMDA_PY-P1_DP3_S`, `SMDA_PY-P1_P3_L`, `SMDA_PY-P1_P3_M`, `SMDA_PY-P1_P3_S`, `SMDA_PY-P2_DP2_L`, `SMDA_PY-P2_DP2_M`, `SMDA_PY-P2_DP2_S`, `SMDA_PY-P2_DP3_L`, `SMDA_PY-P2_DP3_M`, `SMDA_PY-P2_DP3_S`, `SMDA_PY-P2_P3_L`, `SMDA_PY-P2_P3_M`, `SMDA_PY-P2_P3_S`, `SMDA_PY-P3_DP3_L`, `SMDA_PY-P3_DP3_M`, `SMDA_PY-P3_DP3_S`

### K5. Asset legacy senza prefisso `SMDA_` (15) — ignorati
`SMDAMOD14-AlienRocketLauncher_L`, `SMDAMOD13-RocketLauncher_L`, `SMDAMOD12-RocketLauncher_M`, `SMDAMOD21-Gatling_02`, `SMDAMOD15-Gatling_01`, `SMDAMOD11-Laser_L`, `SMDAMOD10-Laser_S`, `SMDAMOD07-Gun_S_07`, `SMDAMOD07-Gun_S_06`, `SMDAMOD07-Gun_S_05`, `SMDAMOD07-Gun_S_04`, `SMDAMOD07-Gun_S_03`, `SMDAMOD07-Gun_S_02`, `SMDAMOD07-Gun_S_01`, `SMDAMOD07-Gun_S_00`

## L. Cargo/Loot e Items: foglio ↔ asset di Unreal, letti dall'app (2026-10-08, sola lettura)

### L1. CargoItemsAndLoots ↔ CIDA_ / LDA_
Foglio: 271 righe. Unreal: 427 CIDA_ e 500 LDA_; corrispondenti: 270/271 (manca solo `COL-RocketsRecharge`, l'entità nuova).
Mesh del loot: **nessuna** né nel foglio né negli LDA_ (0 loot con mesh in Unreal) → niente da importare.
Differenze foglio ≠ Unreal (solo segnalate, vale il foglio): **StackValue 94**, **Attractable 26**, **ForceToInspect 53** (es. `COL-StationSupply_*`: foglio 10 / Unreal 100; probabile modifica del foglio non ancora propagata, come per tipo e prezzo in §J).
`bCanBeSold` disattivato: COL-StationSupply_X. Asset con lo stesso ID in più cartelle: 0.
**CIDA_ non nel foglio (154)** e **LDA_ non nel foglio (154)** — mai cancellati:
`CIDA_COL-Antimony`, `CIDA_COL-Arodisium`, `CIDA_COL-Ashedium`, `CIDA_COL-Atedex`, `CIDA_COL-Aureuryrin`, `CIDA_COL-BlueEnergyStorage`, `CIDA_COL-Bolognum`, `CIDA_COL-Brass`, `CIDA_COL-Cobalt`, `CIDA_COL-ControlSystem`, `CIDA_COL-Copper`, `CIDA_COL-Corder`, `CIDA_COL-Credits`, `CIDA_COL-CrystalDust`, `CIDA_COL-Dercor`, `CIDA_COL-DetonationSystem`, `CIDA_COL-EXKnob`, `CIDA_COL-EXRefiner`, `CIDA_COL-Echilium`, `CIDA_COL-F-5-D`, `CIDA_COL-Farnezius`, `CIDA_COL-Fuel`, `CIDA_COL-Gallium`, `CIDA_COL-GatlingAmmo`, `CIDA_COL-Genusirius`, `CIDA_COL-GoldCode_A`, `CIDA_COL-GoldCode_B`, `CIDA_COL-GoldCode_C`, `CIDA_COL-GoldenLoot_A`, `CIDA_COL-Goldsmith`, `CIDA_COL-Gyzer`, `CIDA_COL-Hademy`, `CIDA_COL-HiFreqWave`, `CIDA_COL-IG-Relay`, `CIDA_COL-InputSphere`, `CIDA_COL-IonicCharcoal`, `CIDA_COL-IonicCharcoalRed`, `CIDA_COL-Iron`, `CIDA_COL-IronLoot00`, `CIDA_COL-Ironyrin`, `CIDA_COL-Iyzer`, `CIDA_COL-Jidereum`, `CIDA_COL-Joniscus`, `CIDA_COL-Kilmin`, `CIDA_COL-Lavherius`, `CIDA_COL-Lithium`, `CIDA_COL-LogPro`, `CIDA_COL-Lollipop`, `CIDA_COL-LowFreqWave`, `CIDA_COL-Lyv`, `CIDA_COL-Manganese`, `CIDA_COL-Mercury`, `CIDA_COL-MetalPesticide`, `CIDA_COL-Mimicrum`, `CIDA_COL-MinesAmmo`, `CIDA_COL-Nickel`, `CIDA_COL-OpalMind`, `CIDA_COL-Orichalcum`, `CIDA_COL-Otuliseom`, `CIDA_COL-Ox-Zubirio`, `CIDA_COL-Palladium`, `CIDA_COL-Pewter`, `CIDA_COL-PolishedCylinder`, `CIDA_COL-PolymerizerWebSystem`, `CIDA_COL-Polys-999`, `CIDA_COL-PressureStabilizer`, `CIDA_COL-Promethium`, `CIDA_COL-RadioactiveWaste`, `CIDA_COL-Rakedder`, `CIDA_COL-ReInnovator`, `CIDA_COL-RedEnergyStorage`, `CIDA_COL-Rock`, `CIDA_COL-RocketAmmo`, `CIDA_COL-Sarfkron`, `CIDA_COL-Shen-ten`, `CIDA_COL-Silver`, `CIDA_COL-Sohelium`, `CIDA_COL-SonicMatter`, `CIDA_COL-SonicMatter_Asteroids`, `CIDA_COL-SonicMatter_Black`, `CIDA_COL-SonicMatter_Elephants`, `CIDA_COL-SonicMatter_Green`, `CIDA_COL-SonicMatter_InsectKiss`, `CIDA_COL-SonicMatter_Outpost`, `CIDA_COL-SonicMatter_Red`, `CIDA_COL-SonicMatter_SnakeHead`, `CIDA_COL-SorterPYR`, `CIDA_COL-StaticElectricityS`, `CIDA_COL-Sunyus`, `CIDA_COL-Tin`, `CIDA_COL-Titanium`, `CIDA_COL-TranslatorAI`, `CIDA_COL-Trismuth`, `CIDA_COL-Tungsten`, `CIDA_COL-Uranium`, `CIDA_COL-Vlynker`, `CIDA_COL-Vytted`, `CIDA_COL-Waste`, `CIDA_COL-Yaker`, `CIDA_COL-Zinc`, `CIDA_COL-Zirconium`, `CIDA_COL-Ziudder`, `CIDA_MOD00-StartingEngine`, `CIDA_MOD100-TestGun`, `CIDA_MOD13b-RocketLauncher_L_Poor`, `CIDA_MOD15b-Gatling_01_Poor`, `CIDA_MOD15c-Gatling_01_Premium`, `CIDA_MOD21a-IntGatling`, `CIDA_MOD43-SonicMatterExtractor_S`, `CIDA_MOD53-GatlingIron_S`, `CIDA_MOD54-LaserGold_L`, `CIDA_PY-DP1_DP1_L`, `CIDA_PY-DP1_DP1_M`, `CIDA_PY-DP1_DP1_S`, `CIDA_PY-DP1_DP2_L`, `CIDA_PY-DP1_DP2_M`, `CIDA_PY-DP1_DP2_S`, `CIDA_PY-DP1_DP3_L`, `CIDA_PY-DP1_DP3_M`, `CIDA_PY-DP1_DP3_S`, `CIDA_PY-DP2_DP2_L`, `CIDA_PY-DP2_DP2_M`, `CIDA_PY-DP2_DP2_S`, `CIDA_PY-DP2_DP3_L`, `CIDA_PY-DP2_DP3_M`, `CIDA_PY-DP2_DP3_S`, `CIDA_PY-DP3_DP3_L`, `CIDA_PY-DP3_DP3_M`, `CIDA_PY-DP3_DP3_S`, `CIDA_PY-P1_DP1_L`, `CIDA_PY-P1_DP1_M`, `CIDA_PY-P1_DP1_S`, `CIDA_PY-P1_DP2_L`, `CIDA_PY-P1_DP2_M`, `CIDA_PY-P1_DP2_S`, `CIDA_PY-P1_DP3_L`, `CIDA_PY-P1_DP3_M`, `CIDA_PY-P1_DP3_S`, `CIDA_PY-P1_P3_L`, `CIDA_PY-P1_P3_M`, `CIDA_PY-P1_P3_S`, `CIDA_PY-P2_DP2_L`, `CIDA_PY-P2_DP2_M`, `CIDA_PY-P2_DP2_S`, `CIDA_PY-P2_DP3_L`, `CIDA_PY-P2_DP3_M`, `CIDA_PY-P2_DP3_S`, `CIDA_PY-P2_P3_L`, `CIDA_PY-P2_P3_M`, `CIDA_PY-P2_P3_S`, `CIDA_PY-P3_DP3_L`, `CIDA_PY-P3_DP3_M`, `CIDA_PY-P3_DP3_S`, `CIDA_TestHeatSink2`
`LDA_COL-Antimony`, `LDA_COL-Arodisium`, `LDA_COL-Ashedium`, `LDA_COL-Atedex`, `LDA_COL-Aureuryrin`, `LDA_COL-BlueEnergyStorage`, `LDA_COL-Bolognum`, `LDA_COL-Brass`, `LDA_COL-Cobalt`, `LDA_COL-ControlSystem`, `LDA_COL-Copper`, `LDA_COL-Corder`, `LDA_COL-Credits`, `LDA_COL-CrystalDust`, `LDA_COL-Dercor`, `LDA_COL-DetonationSystem`, `LDA_COL-EXKnob`, `LDA_COL-EXRefiner`, `LDA_COL-Echilium`, `LDA_COL-F-5-D`, `LDA_COL-Farnezius`, `LDA_COL-Fuel`, `LDA_COL-Gallium`, `LDA_COL-GatlingAmmo`, `LDA_COL-Genusirius`, `LDA_COL-GoldCode_A`, `LDA_COL-GoldCode_B`, `LDA_COL-GoldCode_C`, `LDA_COL-GoldenLoot_A`, `LDA_COL-Goldsmith`, `LDA_COL-Gyzer`, `LDA_COL-Hademy`, `LDA_COL-HiFreqWave`, `LDA_COL-IG-Relay`, `LDA_COL-InputSphere`, `LDA_COL-IonicCharcoal`, `LDA_COL-IonicCharcoalRed`, `LDA_COL-Iron`, `LDA_COL-IronLoot00`, `LDA_COL-Ironyrin`, `LDA_COL-Iyzer`, `LDA_COL-Jidereum`, `LDA_COL-Joniscus`, `LDA_COL-Kilmin`, `LDA_COL-Lavherius`, `LDA_COL-Lithium`, `LDA_COL-LogPro`, `LDA_COL-Lollipop`, `LDA_COL-LowFreqWave`, `LDA_COL-Lyv`, `LDA_COL-Manganese`, `LDA_COL-Mercury`, `LDA_COL-MetalPesticide`, `LDA_COL-Mimicrum`, `LDA_COL-MinesAmmo`, `LDA_COL-Nickel`, `LDA_COL-OpalMind`, `LDA_COL-Orichalcum`, `LDA_COL-Otuliseom`, `LDA_COL-Ox-Zubirio`, `LDA_COL-Palladium`, `LDA_COL-Pewter`, `LDA_COL-PolishedCylinder`, `LDA_COL-PolymerizerWebSystem`, `LDA_COL-Polys-999`, `LDA_COL-PressureStabilizer`, `LDA_COL-Promethium`, `LDA_COL-RadioactiveWaste`, `LDA_COL-Rakedder`, `LDA_COL-ReInnovator`, `LDA_COL-RedEnergyStorage`, `LDA_COL-Rock`, `LDA_COL-RocketAmmo`, `LDA_COL-Sarfkron`, `LDA_COL-Shen-ten`, `LDA_COL-ShieldCharger`, `LDA_COL-Silver`, `LDA_COL-Sohelium`, `LDA_COL-SonicMatter`, `LDA_COL-SonicMatter_Asteroids`, `LDA_COL-SonicMatter_Black`, `LDA_COL-SonicMatter_Elephants`, `LDA_COL-SonicMatter_Green`, `LDA_COL-SonicMatter_InsectKiss`, `LDA_COL-SonicMatter_Outpost`, `LDA_COL-SonicMatter_Red`, `LDA_COL-SonicMatter_SnakeHead`, `LDA_COL-SorterPYR`, `LDA_COL-StaticElectricityS`, `LDA_COL-Sunyus`, `LDA_COL-Tin`, `LDA_COL-Titanium`, `LDA_COL-TranslatorAI`, `LDA_COL-Trismuth`, `LDA_COL-Tungsten`, `LDA_COL-Uranium`, `LDA_COL-Vlynker`, `LDA_COL-Vytted`, `LDA_COL-Waste`, `LDA_COL-Yaker`, `LDA_COL-Zinc`, `LDA_COL-Zirconium`, `LDA_COL-Ziudder`, `LDA_MOD00-StartingEngine`, `LDA_MOD100-TestGun`, `LDA_MOD13b-RocketLauncher_L_Poor`, `LDA_MOD15b-Gatling_01_Poor`, `LDA_MOD15c-Gatling_01_Premium`, `LDA_MOD21a-IntGatling`, `LDA_MOD53-GatlingIron_S`, `LDA_MOD54-LaserGold_L`, `LDA_PY-DP1_DP1_L`, `LDA_PY-DP1_DP1_M`, `LDA_PY-DP1_DP1_S`, `LDA_PY-DP1_DP2_L`, `LDA_PY-DP1_DP2_M`, `LDA_PY-DP1_DP2_S`, `LDA_PY-DP1_DP3_L`, `LDA_PY-DP1_DP3_M`, `LDA_PY-DP1_DP3_S`, `LDA_PY-DP2_DP2_L`, `LDA_PY-DP2_DP2_M`, `LDA_PY-DP2_DP2_S`, `LDA_PY-DP2_DP3_L`, `LDA_PY-DP2_DP3_M`, `LDA_PY-DP2_DP3_S`, `LDA_PY-DP3_DP3_L`, `LDA_PY-DP3_DP3_M`, `LDA_PY-DP3_DP3_S`, `LDA_PY-P1_DP1_L`, `LDA_PY-P1_DP1_M`, `LDA_PY-P1_DP1_S`, `LDA_PY-P1_DP2_L`, `LDA_PY-P1_DP2_M`, `LDA_PY-P1_DP2_S`, `LDA_PY-P1_DP3_L`, `LDA_PY-P1_DP3_M`, `LDA_PY-P1_DP3_S`, `LDA_PY-P1_P3_L`, `LDA_PY-P1_P3_M`, `LDA_PY-P1_P3_S`, `LDA_PY-P2_DP2_L`, `LDA_PY-P2_DP2_M`, `LDA_PY-P2_DP2_S`, `LDA_PY-P2_DP3_L`, `LDA_PY-P2_DP3_M`, `LDA_PY-P2_DP3_S`, `LDA_PY-P2_P3_L`, `LDA_PY-P2_P3_M`, `LDA_PY-P2_P3_S`, `LDA_PY-P3_DP3_L`, `LDA_PY-P3_DP3_M`, `LDA_PY-P3_DP3_S`, `LDA_TestHeatSink2`
Asset senza prefisso CIDA_/LDA_ (79, ignorati): `DA_CI_Gold`, `DA_CI_Iron`, `DA_CI_Rock`, `BODY01-Spartan`, `BODY02-Dragon`, `BODY03-Principal`, `COL-Aluminium`, `COL-Bolognum`, `COL-Brass`, `COL-Cobalt`, `COL-Copper`, `COL-Corder`, `COL-Crystal`, `COL-CrystalDust`, `COL-Echilium`, `COL-Gallium`, `COL-Gold`, `COL-Hademy`, `COL-IonicCharcoal`, `COL-Iron`, `COL-Lithium`, `COL-Mercury`, `COL-MetalJunk`, `COL-Mimicrum`, `COL-Nickel`, `COL-Orichalcum`, `COL-Palladium`, `COL-Pewter`, `COL-Polys-999`, `COL-Promethium`, `COL-RadioactiveWaste`, `COL-Radium`, `COL-Recondigen`, `COL-Rock`, `COL-Shen-ten`, `COL-Silver`, `COL-SonicMatter`, `COL-Sunyus`, `COL-Tin`, `COL-Titanium`, `COL-Trismuth`, `COL-Tungsten`, `COL-Uranium`, `COL-Waste`, `COL-Zinc`, `COL-Zirconium`, `DA_Loot_Gold`, `DA_Loot_Iron`, `DA_Loot_Rock`, `MOD01-Engine_S`, `MOD02-Engine_M`, `MOD03-Engine_L`, `MOD04-Cargo_S`, `MOD05-Cargo_M`, `MOD06-Cargo_L`, `MOD07-Gun_S_00`, `MOD07-Gun_S_01`, `MOD07-Gun_S_02`, `MOD07-Gun_S_03`, `MOD07-Gun_S_04`, `MOD07-Gun_S_05`, `MOD07-Gun_S_06`, `MOD07-Gun_S_07`, `MOD08-Gun_M`, `MOD10-Laser_S`, `MOD11-Laser_L`, `MOD12-RocketLauncher_M`, `MOD13-RocketLauncher_L`, `MOD14-AlienRocketLauncher_L`, `MOD15-Gatling_01`, `MOD16-MineDropper`, `MOD17-SonicMatterExtractor_S`, `MOD18-SonicMatterExtractor_M`, `MOD19-SonicMatterExtractor_L`, `MOD20-Blades`, `MOD21-Gatling_02`, `MOD22-Bomb`, `SBDY01-Eagle`, `SBDY02-Classic`

Elenco completo delle differenze campione:
- COL-StationSupply_A.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_A.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_A.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_B.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_B.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_B.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_C.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_C.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_C.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_D.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_D.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_D.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_E.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_E.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_E.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_F.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_F.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_F.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_G.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_G.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_G.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_H.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_H.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_H.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_I.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_I.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_I.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_J.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_J.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_J.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_K.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_K.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_K.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_L.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_L.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_L.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_M.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_M.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_M.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_N.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_N.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_N.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_O.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_O.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_O.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_P.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_P.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_P.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_Q.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_Q.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_Q.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_R.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_R.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_R.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_S.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_S.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_S.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_T.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_T.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_T.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_U.StackValue: foglio 10 / Unreal 100
- COL-StationSupply_U.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_U.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_V.StackValue: foglio 1 / Unreal 100
- COL-StationSupply_V.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_V.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_W.StackValue: foglio 1 / Unreal 100
- COL-StationSupply_W.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_W.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_X.StackValue: foglio 1 / Unreal 100
- COL-StationSupply_X.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_X.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_Y.StackValue: foglio 1 / Unreal 100
- COL-StationSupply_Y.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_Y.ForceToInspect: foglio TRUE / Unreal false
- COL-StationSupply_Z.StackValue: foglio 1 / Unreal 100
- COL-StationSupply_Z.Attractable: foglio FALSE / Unreal true
- COL-StationSupply_Z.ForceToInspect: foglio TRUE / Unreal false
- PY-P1_P1_S.StackValue: foglio 1 / Unreal 10
- PY-P1_P1_M.StackValue: foglio 1 / Unreal 10

### L2. Items ↔ SIDA_
Foglio: 31 righe in 11 sezioni. Unreal: 42 SIDA_ letti, **31/31 corrispondenti**.
**Quality**: la colonna `Quality` del tab Items è **vuota in tutte le 31 righe**; l'app la prende da Unreal (31 campi). Statistiche: foglio e Unreal coincidono, tranne {"PowerConsumption":1} (TestAiAugSys.PowerConsumption: foglio 0 / Unreal 5).
SIDA_ non nel foglio (3): `SIDA_InternalCargo_StationRoom`, `SIDA_Test`, `SIDA_TestHeatSink2`.
Cartella Unreal ≠ sezione del foglio: `TestAiAugSys: foglio AiAugmentationsSystem / cartella Unreal AiAugmentationSystem` (la cartella degli item di Unreal si chiama `AiAugmentationSystem`, il foglio `AiAugmentationsSystem`).
Asset **non caricabili** (redirector o rotti, non letti): `SIDA_SonicMatterCollector_S`.
Stesso nome SIDA_ in più cartelle (8): `SIDA_Test: ShieldGenerator / SecondaryEngine`; `SIDA_Test: ShieldGenerator / Radar`; `SIDA_Test: ShieldGenerator / PowerGenerator`; `SIDA_Test: ShieldGenerator / HeatSink`; `SIDA_Test: ShieldGenerator / AiAugmentationSystem`; `SIDA_TestAiAugSys: AiAugmentationSystem / AiAugmentationsSystem`; `SIDA_Test: ShieldGenerator / TractorBeam`; `SIDA_Test: ShieldGenerator / WarpDrive`.
