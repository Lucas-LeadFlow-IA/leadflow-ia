---
name: liquidity-analysis
description: Analyse de liquidité du BTC sur Hyperliquid par le Liquidity Analyst — sweeps, equal highs/lows, déséquilibre et murs du carnet L2, pics de volume, FVG, order blocks, faux breakouts, flux agresseur. À utiliser pour évaluer où se trouve la liquidité, expliquer un biais de liquidité ou vérifier pourquoi les zones de liquidation ne sont pas estimées.
metadata:
  agent: liquidity_analyst
  code: agents/liquidity_analyst.py, analysis/orderbook.py
  version: "1.0"
---

# Liquidity Analysis (Agent 3 — Liquidity Analyst)

## Description
Agrège les structures de liquidité multi-timeframe (1m → 4h) et le microstructure live (carnet L2
20 niveaux, trades publics) en un **biais de liquidité** borné dans [−1, 1].

## Objectif
Indiquer si la liquidité récemment prise / disponible favorise un scénario long ou short.

## Compétences
- Sweeps récents (≤ 3 barres), equal highs/lows actifs, FVG / OB touchés, faux breakouts.
- Carnet : spread (bps), profondeur à 10 / 25 bps, déséquilibre `(bid − ask)/(bid + ask)`, murs (≥ 5× médiane).
- Flux : volume agresseur acheteur vs vendeur sur 60 s (`trade_flow`).

## Méthodes
Score pondéré par timeframe (1m 0,5 … 1h 1,25) : sweep haussier +w, baissier −w ; zone FVG/OB
±0,5w ; faux breakout ±0,75w ; + déséquilibre du carnet + 0,5 × delta du flux ; normalisé /4 et borné.

## Règles de décision
- Le biais de liquidité alimente les scores (intraday, range) ; il ne déclenche jamais seul.
- **Zones de liquidation : non estimées** — l'API publique n'expose pas de carte fiable ; aucune
  estimation inventée. Le rapport l'indique explicitement.
- En backtest, l'historique L2 n'existe pas via l'API : composante carnet neutre (signalé dans le rapport).

## Conditions de validation
- Carnet non vide, non croisé, spread ≤ 5 bps ; mise à jour < 30 s.

## Conditions de refus
- Carnet absent ou périmé : la composante carnet est ignorée et le Risk Manager peut bloquer (spread / fraîcheur).

## Exemples structurés
```json
{"liquidity_bias": 0.30, "order_book": {"spread_bps": 0.155, "imbalance_10bps": 0.12, "bid_wall": 64601.0},
 "liquidation_zones": "unavailable: no reliable public liquidation data on Hyperliquid"}
```
```json
{"timeframes": {"15m": {"sweep_bull_bars_ago": 1, "equal_lows": null, "in_ob_bull": true}}}
```
