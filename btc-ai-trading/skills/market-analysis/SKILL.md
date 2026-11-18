---
name: market-analysis
description: Surveillance multi-timeframe du BTC perpétuel Hyperliquid (prix, volumes, volatilité, spread, mouvements anormaux, fraîcheur des données) par l'agent Market Scanner. À utiliser pour analyser l'état courant du marché, expliquer une anomalie ou vérifier la qualité des données avant toute décision. Ne prend jamais de position.
metadata:
  agent: market_scanner
  code: agents/market_scanner.py, market_data/, analysis/features.py
  version: "1.0"
---

# Market Analysis (Agent 1 — Market Scanner)

## Description
Le Market Scanner résume en continu l'état du BTC sur 1m, 5m, 15m, 30m, 1h et 4h à partir des
données Hyperliquid (WebSocket `candle`, `l2Book`, `trades`, `activeAssetCtx` + amorçage REST
`candleSnapshot`). Il détecte des opportunités à analyser mais **ne trade jamais**.

## Objectif
Fournir aux autres agents une photographie fiable et horodatée du marché, et signaler tout ce qui
rend une décision dangereuse (données anciennes, spread anormal, mouvement extrême).

## Compétences
- Variation de prix par timeframe (`ret_1`), z-score des rendements (`ret_z`).
- Volatilité : ATR %, rang percentile de l'ATR sur une fenêtre glissante (`atr_pct_rank`).
- Volumes : z-score du volume (`vol_z`), pics de volume.
- Spread et déséquilibre du carnet (10 / 25 bps), flux agresseur acheteur/vendeur.
- Alignement du momentum multi-timeframe (signe de la pente EMA20).
- Contrôle de fraîcheur de chaque flux (`MarketDataStore.freshness`).

## Méthodes
1. N'utiliser que les bougies **clôturées** (`MarketDataStore.closed`) — jamais la bougie en formation.
2. Calculer les features causales (`analysis.features.compute_features`).
3. Marquer une anomalie si `|ret_z| ≥ 3`, `range_atr ≥ 2.5` ou `vol_z ≥ 3`.
4. Marquer une opportunité : sweep de liquidité, cassure de structure, expansion de volatilité après squeeze.
5. Publier un `AgentReport` (statut `warning` s'il existe des anomalies).

## Règles de décision
- Une anomalie n'est **pas** un signal de trade : elle est transmise au Regime Detector (qui peut imposer NEWS_DRIVEN).
- Données d'un flux requis > 30 s : le Risk Manager bloque les entrées ; > `MAX_DATA_STALENESS_SECONDS` (90 s) : arrêt (kill switch).

## Conditions de validation
- Tous les timeframes requis présents avec ≥ 2 bougies clôturées.
- Carnet et contexte (funding, mark) mis à jour récemment.

## Conditions de refus
- Flux WebSocket coupé, REST en échec répété, carnet vide ou croisé : rapport en `warning`, aucune entrée possible.

## Exemples structurés
```json
{"agent": "market_scanner", "summary": "BTC 64,666 | vol normal | alignment +0.33 | 0 anomalies, 0 opportunities",
 "data": {"spread_bps": 0.155, "book_imbalance_10bps": 0.12, "volatility_state": "normal",
          "anomalies": [], "opportunities": ["15m: liquidity sweep"]}}
```
```json
{"anomalies": ["1m: abnormal move (return z=5.2)", "1m: volume spike (z=4.1)"], "status": "warning"}
```
