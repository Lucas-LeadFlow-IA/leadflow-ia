---
name: technical-analysis
description: Analyse technique multi-timeframe du BTC (EMA 9/20/50/200, RSI, MACD, VWAP, ATR, ADX, Bollinger, volume profile, supports/résistances, BOS, CHOCH, HH/HL/LH/LL) par l'agent Technical Analyst, pour confirmer ou invalider un scénario. À utiliser pour expliquer un biais, vérifier une confirmation ou auditer les indicateurs. Jamais un indicateur isolé comme signal.
metadata:
  agent: technical_analyst
  code: agents/technical_analyst.py, analysis/indicators.py, analysis/structure.py
  version: "1.0"
---

# Technical Analysis (Agent 2 — Technical Analyst)

## Description
Construit un tableau technique par timeframe (5m, 15m, 30m, 1h, 4h) et confirme ou invalide les
scénarios proposés par les stratégies.

## Objectif
Donner un biais directionnel **robuste** : il faut l'accord d'au moins 3 groupes de facteurs
indépendants, sans opposition.

## Compétences
- EMA 9/20/50/200 (récursion standard), RSI / ATR / ADX lissés Wilder (amorçage SMA, vérifié sur l'exemple de Wilder).
- MACD 12/26/9, Bollinger 20/2, VWAP de session UTC, volume profile approximé (POC / VAH / VAL).
- Structure : pivots confirmés `swing_len` barres après, HH/HL/LH/LL, BOS, CHOCH, supports/résistances par clusters.

## Méthodes
Cinq groupes de facteurs, chacun −1/0/+1 (`tf_factors`) :
1. **Tendance** : EMA20 vs EMA50 et prix vs EMA200.
2. **Structure** : HH/HL (+1) ou LH/LL (−1), sinon direction de la dernière cassure.
3. **Momentum** : RSI > 52 **et** histogramme MACD > 0 (symétrique pour −1).
4. **Position** : prix vs VWAP **et** vs moyenne de Bollinger.
5. **Force** : ADX ≥ 20, signe = +DI vs −DI.
Biais d'un timeframe = ±1 seulement si ≥ 3 facteurs d'accord et aucun opposé.

## Règles de décision
- `confirms(direction, tfs)` : refus si un timeframe listé s'oppose ; acceptation si au moins un confirme.
- Aucune décision sur un seul indicateur (RSI survendu seul ≠ achat).

## Conditions de validation
- Indicateurs chauds (EMA200 nécessite ≥ 200 bougies) ; toutes les colonnes finies.
- Test anti look-ahead (`tests/test_no_lookahead.py`) vert.

## Conditions de refus
- Timeframe manquant → scénario non confirmé.
- Biais opposé sur un timeframe de contexte → scénario invalidé.

## Exemples structurés
```json
{"tf": "1h", "factors": {"trend": 1, "structure": 1, "momentum": 1, "location": 0, "strength": 1}, "bias": 1}
```
```json
{"confirms": false, "reasons": ["4h technical bias opposes LONG"]}
```
