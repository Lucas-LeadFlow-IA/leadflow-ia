---
name: backtesting
description: Backtesting événementiel des stratégies BTC sur l'historique Hyperliquid — frais maker/taker, spread/slippage, funding horaire réel, fills partiels, stops/TP intrabar pessimistes, gaps, drawdown, kill switch, rapports et critères de validation, walk-forward des variantes. À utiliser pour lancer, lire ou étendre un backtest et juger si une stratégie est validée.
metadata:
  code: backtesting/engine.py, backtesting/metrics.py, backtesting/report.py, backtesting/walk_forward.py
  commands: "python main.py download-data && python main.py backtest --research && python main.py walk-forward"
  version: "1.0"
---

# Backtesting

## Description
Simulateur barre par barre qui réutilise **exactement** les agents et la gestion de position du live.

## Objectif
Mesurer l'espérance nette (après frais, funding et slippage) et la stabilité, jamais le seul win rate.

## Compétences
- Données : bougies Hyperliquid (~5000 par intervalle : 1m ≈ 3,5 j, 15m ≈ 52 j, 1h ≈ 208 j, 4h ≈ 833 j) + funding horaire (900 j).
- Coûts : taker 0,045 %, maker 0,015 %, slippage 2 bp (marché) / 5 bp (stop), funding historique.
- Ordres limites : remplissage complet si le prix traverse d'un tick, **partiel** (50 %) sur simple contact.
- Intrabar : stop prioritaire si SL et TP dans la même barre ; gap → exécution à l'ouverture.

## Méthodes
Décision à la clôture de la barre i, exécution à l'ouverture de i+1 ; timeframes supérieurs visibles
seulement une fois clôturés ; kill switch et limites de risque appliqués comme en live.
Rapport : comparatif, par stratégie / régime / direction / motif de sortie / période, validation.

## Règles de décision — critères de validation (tous requis)
PF après coûts > 1,2 · ≥ 100 trades · DD max < 8 % · espérance nette > 0 · ≥ 75 % des périodes actives rentables.

## Conditions de validation
- `tests/test_backtest_ml.py` : invariant comptable (equity finale = initiale + Σ P&L nets), jamais deux positions,
  stop prioritaire, gap, limite non remplie sur simple contact, purge walk-forward.

## Conditions de refus
- Moins de 100 trades ou périodes instables → « non validé », quel que soit le P&L.

## Exemples structurés (résultats réels du 18/11/2026)
| Run | Trades | PF | Net $ | DD % | Validé |
|---|---|---|---|---|---|
| Scalping (1m) | 5 | 0,39 | −4,73 | 0,65 | non |
| Intraday (15m) | 9 | 0,37 | −8,96 | 1,22 | non |
| Trend following (1h) | 62 | 0,59 | −32,79 | 5,44 | non |
| Range trading (15m) | 3 | 1,60 | +1,66 | 0,25 | non (échantillon) |
| Adaptatif (15m) | 26 | 0,66 | −9,29 | 2,41 | non |
