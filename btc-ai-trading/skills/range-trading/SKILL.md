---
name: range-trading
description: Stratégie de range trading BTC — fade des bornes d'un range H1 établi (ADX faible, EMA50 plate) après sweep, faux breakout ou épuisement RSI en M15, stop au-delà de la borne, objectif au milieu du range. À utiliser pour analyser, backtester ou ajuster le trading en marché latéral.
metadata:
  strategy: range_trading
  code: strategies/range_trading.py
  timeframes: "15m entry, 1h context"
  version: "1.0"
---

# Range Trading (M15 / H1)

## Description
Stratégie dédiée au régime latéral (et basse volatilité), choisie par le playbook quand ADX H1 < 22.

## Objectif
Acheter le bas / vendre le haut d'un range réel, avec un stop là où le range est invalidé.

## Compétences
- Range : canal de Donchian 48 barres H1, largeur 0,8 %–6 %, ADX < 22, |pente EMA50| < 0,15 ATR, efficiency ratio < 0,35.
- Rejet : sweep M15 ≤ 3 barres, faux breakout, ou RSI M15 < 40 avec bougie haussière (long).

## Méthodes
- Entrée passive (limite maker) dans les 25 % extrêmes du range ; stop = borne ± 0,5 ATR H1 ; TP = milieu (R/R ≥ 1,2) en limite maker.
- Invalidation : ADX H1 > 28 dans le sens opposé (tendance qui émerge) ; durée max 12 h.

## Règles de décision
- Autorisée seulement en régime SIDEWAYS ou LOW_VOL (playbook), dans les deux directions.
- Jamais de fade contre un BOS H1 de moins de 2 barres ; jamais au milieu du range.

## Conditions de validation
- Backtest 15m : **3 trades, PF 1,60 — non validé (échantillon)**.

## Conditions de refus
- Pas de range, largeur hors bornes, prix au milieu, BOS H1 récent contraire, R/R insuffisant.

## Exemples structurés
```json
{"strategy": "range_trading", "direction": "LONG", "entry_type": "limit", "entry_price": 63850, "stop_loss": 63420,
 "take_profit": 64560, "reasons": ["H1 range 63,600–65,520 (3.0%), ADX 14", "price at 13% of range", "rejection: sweep"]}
```
