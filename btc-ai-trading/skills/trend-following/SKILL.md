---
name: trend-following
description: Stratégie de suivi de tendance BTC — entrées H1 après retracement vers l'EMA20 ou cassure de structure, dans le sens de la tendance H4, sorties adaptées à la volatilité (chandelier ATR, breakeven, TP de sécurité). À utiliser pour analyser, backtester ou ajuster le trend following et lire l'étude walk-forward des variantes de sortie.
metadata:
  strategy: trend_following
  code: strategies/trend_following.py, backtesting/walk_forward.py, scripts/walk_forward_study.py
  timeframes: "1h entry, 4h context"
  version: "1.0"
---

# Trend Following (H1 / H4)

## Description
Capturer les tendances importantes en entrant sur retracement ou confirmation et en laissant courir les gains.

## Objectif
Peu de trades, gains asymétriques : pertes contenues à 1 R, gagnants jusqu'à 4 R ou plus via le trailing.

## Compétences
- Tendance H4 : EMA50 vs EMA200, prix vs EMA50, ADX ≥ 18.
- Alignement H1 : EMA20 vs EMA50 et prix vs EMA50.
- Entrée : pullback touchant EMA20 (± 0,3 ATR) puis reprise, ou BOS H1 ; RSI H1 45-72 (long).

## Méthodes
- Stop sous le dernier swing H1 − 0,5 ATR (1,5 à 3,5 ATR) ; TP de sécurité 4 R.
- Breakeven à +1,5 R, chandelier 3 ATR après +2 R ; invalidation : CHOCH H1 contraire ou clôture H4 sous EMA50.

## Règles de décision
- Seulement dans le sens du régime de tendance stable (playbook).

## Conditions de validation (résultats réels, données Hyperliquid)
- Backtest 1h, 2026-05 → 2026-11 : **62 trades, PF 0,59, DD max 5,4 % — non validé**.
- Diagnostic : 27 sorties sur CHOCH H1 (sorties précoces), TP rares mais très rentables.
- Walk-forward (sélection sur le passé, test sur la période suivante) de 6 variantes de sortie :
  variante retenue `no_choch_exit` PF OOS 0,57 vs référence 0,35 → **amélioration mais toujours négatif**.
  Les paramètres de production n'ont pas été modifiés.

## Conditions de refus
- H4 non aligné, H1 non aligné, pas de pullback ni de BOS, RSI hors bande, confirmation technique absente.

## Exemples structurés
```json
{"strategy": "trend_following", "direction": "LONG", "entry_price": 66200, "stop_loss": 65150, "take_profit": 70400,
 "reasons": ["H4 trend up: EMA50 > EMA200, ADX 27", "H1 pullback to EMA20 reclaimed", "H1 RSI 58, MACD hist +41.2"]}
```
