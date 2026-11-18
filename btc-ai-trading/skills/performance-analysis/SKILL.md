---
name: performance-analysis
description: Analyse de performance du système BTC — enregistrement des trades, win rate, profit factor, espérance, frais, funding, slippage, drawdown, Sharpe/Sortino, performance par stratégie et par régime, erreurs d'exécution, recommandations sans modification automatique. À utiliser pour produire un rapport, comparer paper/testnet/live ou décider (humainement) de désactiver une stratégie.
metadata:
  agent: performance_analyst
  code: agents/performance_analyst.py, backtesting/metrics.py, database/
  version: "1.0"
---

# Performance Analysis (Agent 8 — Performance Analyst)

## Description
Enregistre chaque trade clôturé (base de données) et calcule les métriques avec le même code que le backtester.

## Objectif
Identifier ce qui fonctionne et ce qui dégrade les résultats, sur données réelles, sans jamais changer la production seul.

## Compétences
- Métriques : trades, gagnants/perdants, win rate, PF, espérance $ et R, frais, funding, slippage,
  gain/perte moyens, payoff, pertes consécutives max, durée moyenne, rendement, drawdown, Sharpe/Sortino (≥ 10 jours).
- Ventilation par stratégie, régime, direction, motif de sortie ; erreurs d'exécution (7 jours).

## Méthodes
- P&L net = brut − frais (entrée + sortie, issus des fills) − funding (`userFunding` ou simulation).
- R multiple = P&L net / risque initial (incluant coûts).
- Rapport quotidien envoyé sur Telegram après 00:05 UTC.

## Règles de décision
- Stratégie avec ≥ 20 trades et PF < 1 → **recommandation** de désactivation (via `ENABLED_STRATEGIES`)
  après revue humaine et nouveaux tests walk-forward. `auto_parameter_changes: disabled by design`.
- < 20 trades → aucun verdict statistique.

## Conditions de validation
- Cohérence comptable vérifiée par tests ; mêmes fonctions que le backtest.

## Conditions de refus
- Ne jamais présenter le win rate seul comme preuve ; ne jamais extrapoler un objectif journalier.

## Exemples structurés
```json
{"overall": {"trades": 34, "win_rate": 0.41, "profit_factor": 1.08, "expectancy_usd": 0.12, "fees": 3.1, "funding": 0.4},
 "recommendations": ["trend_following: PF 0.85 over 22 trades — degrading. Recommendation: disable via ENABLED_STRATEGIES after human review and new walk-forward tests."]}
```
