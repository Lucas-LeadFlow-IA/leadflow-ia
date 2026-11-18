---
name: scalping
description: Stratégie de scalping BTC sur Hyperliquid — déclencheurs M1 dans une tendance M5/M15, entrées passives post-only, TP en limite maker, stop dimensionné sur l'ATR M5 pour rester plusieurs fois au-dessus des coûts. À utiliser pour analyser, backtester ou ajuster le scalping, et pour comprendre pourquoi il trade rarement après frais.
metadata:
  strategy: scalping
  code: strategies/scalping.py
  timeframes: "1m entry, 5m confirm, 15m context"
  version: "1.0"
---

# Scalping (M1 / M5 / M15)

## Description
Petites opportunités dans le sens d'une tendance courte, avec un contrôle strict des frais et du slippage.

## Objectif
Capturer des mouvements courts **seulement** quand le gain attendu couvre largement les coûts
(taker 0,045 %, maker 0,015 %, slippage).

## Compétences
- Contexte M15 : EMA20 > EMA50, prix > EMA50, ADX ≥ 18.
- Confirmation M5 : prix du bon côté du VWAP, EMA9 > EMA20.
- Déclencheur M1 : reprise de l'EMA20 après pullback, ou sweep de liquidité ≤ 2 barres ; RSI M1 45-70.
- Microstructure live : spread ≤ 1,5 bp, déséquilibre du carnet pas fortement contraire (≥ −0,3).

## Méthodes
- Entrée **ALO post-only** au prix courant (maker), TP **reduce-only GTC** (maker), SL trigger-market.
- Stop = 1 à 2 ATR(5m) au-delà de l'extrême M1 ; TP = 1,5 R ; breakeven à 0,8 R ; sortie temporelle 45 min.

## Règles de décision
- Le Risk Manager exige un stop ≥ 3× le coût aller-retour → beaucoup de scalps sont refusés : c'est voulu.

## Conditions de validation
- Backtest 1m (≈ 3,5 jours servis par l'API) : **5 trades, PF 0,39 — non validé**. Échantillon insuffisant ;
  laisser le collecteur accumuler des bougies 1m avant toute conclusion.

## Conditions de refus
- Tendance M15 absente, M5 du mauvais côté du VWAP, spread trop large, carnet contraire, régime non autorisé.

## Exemples structurés
```json
{"strategy": "scalping", "direction": "LONG", "entry_type": "limit", "entry_price": 64650, "stop_loss": 64560,
 "take_profit": 64785, "tp_as_limit": true, "score": 66,
 "reasons": ["M15 trend up (ADX 21)", "M5 above VWAP with EMA9/EMA20 aligned", "M1 trigger: EMA20 reclaim", "spread 0.15 bps, imbalance +0.18"]}
```
```json
{"rejected": "scalping LONG: spread 2.10 bps too wide for scalping"}
```
