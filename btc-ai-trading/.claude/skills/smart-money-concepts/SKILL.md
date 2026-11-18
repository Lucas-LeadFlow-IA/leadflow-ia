---
name: smart-money-concepts
description: Concepts Smart Money appliqués au BTC de façon causale et vérifiable — Break of Structure, Change of Character, Fair Value Gaps, Order Blocks, equal highs/lows, liquidity sweeps, faux breakouts. À utiliser pour détecter ou expliquer ces structures dans les données, ou pour auditer leur absence de biais d'anticipation.
metadata:
  agents: technical_analyst, liquidity_analyst
  code: analysis/structure.py
  version: "1.0"
---

# Smart Money Concepts

## Description
Implémentation déterministe, en une passe causale (`compute_structure`), des notions SMC utilisées
par les agents Technique et Liquidité et par les stratégies.

## Objectif
Transformer des notions souvent subjectives en règles exactes, testées, sans regarder le futur.

## Compétences / définitions exactes
- **Swing high/low** : pivot sur `swing_len` barres de chaque côté, **connu seulement à la confirmation** (j + swing_len).
- **BOS haussier** : clôture au-dessus du dernier swing high non cassé, biais déjà haussier ou neutre.
- **CHOCH haussier** : même cassure alors que le biais était baissier (changement de caractère).
- **FVG haussier** : `low[i] > high[i-2]`, taille ≥ 0,1 ATR ; mitigé quand le prix revient dans la zone ; invalidé sur clôture sous le bas.
- **Order Block haussier** : dernière bougie baissière (≤ 10 barres) avant un BOS/CHOCH haussier ; invalidé sur clôture sous son bas.
- **Equal highs/lows** : deux swings à ≤ 0,15 ATR, pas encore cassés → poche de liquidité.
- **Liquidity sweep** : mèche au-delà d'un swing/equal level puis clôture de retour à l'intérieur.
- **Faux breakout** : cassure qui se réintègre dans les 3 barres.

## Méthodes
Une boucle unique sur les barres maintient l'état (swings, biais, zones actives) et écrit des colonnes
par barre (`bos_bull`, `in_fvg_bull`, `ob_bull_top`, `eqh_level`, `sweep_bear`, `bars_since_*`…).

## Règles de décision
- Ces structures sont des **éléments de confluence** dans les scores, jamais des déclencheurs seuls.
- « Stop hunt » = motif de prix uniquement : on ne prétend jamais connaître les stops d'autrui.

## Conditions de validation
- `tests/test_no_lookahead.py` : valeurs identiques sur données tronquées et complètes.
- `test_structure_detects_bos_choch_and_fvg`, `test_fvg_detection`.

## Conditions de refus
- ATR non disponible → tolérances basées sur le range de la barre (documenté) ; zones non publiées si invalidées.

## Exemples structurés
```json
{"bar": 1840, "bos_bull": 1, "ob_bull_top": 64712, "ob_bull_bottom": 64580, "struct_bias": 1}
```
```json
{"bar": 1902, "sweep_bear": 1, "sweep_level": 65120, "note": "mèche au-dessus des equal highs, clôture en dessous"}
```
