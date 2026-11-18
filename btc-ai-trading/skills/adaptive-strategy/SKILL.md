---
name: adaptive-strategy
description: Moteur stratégique adaptatif BTC — sélection automatique entre scalping, intraday, trend following, range trading ou NO TRADE selon le régime stable, scoring des setups, explication (régime, choix, raisons d'entrée, invalidations). À utiliser pour comprendre ou modifier la sélection de stratégie, le playbook régime→stratégies ou le format des signaux.
metadata:
  agent: strategy_engine
  code: agents/strategy_engine.py, strategies/registry.py, agents/pipeline.py
  version: "1.0"
---

# Adaptive Strategy (Agent 5 — Strategy Engine)

## Description
Cerveau stratégique : à partir du régime **stable**, il autorise un sous-ensemble de stratégies et des
directions, fait évaluer chacune, score les setups et retient le meilleur au-dessus du seuil.

## Objectif
Ne prendre que les configurations alignées avec le contexte, et rester sans position sinon.

## Compétences
- Playbook (`PLAYBOOK`) : régime → (stratégies par priorité, directions, bonus de seuil).
- Score de confluence déterministe 0-100 (composantes visibles) — **pas une probabilité**.
- Filtre de coût : objectif ≥ 2× coûts aller-retour.
- Option ML : filtre de méta-labeling (activé seulement si validé OOS) et calibration score→probabilité.

## Méthodes
1. Régime stable (hystérésis 2 barres 15m) → stratégies éligibles ∩ `ENABLED_STRATEGIES`.
2. Chaque stratégie propose au plus un `TradeSetup` par direction autorisée, avec raisons et invalidations.
3. Seuil = `MIN_SETUP_SCORE` (60) + bonus régime ; choix = score max, puis priorité du playbook.
4. Le signal final passe au Risk Manager (veto absolu) puis à l'exécution.

## Règles de décision
- Pas de changement de stratégie sur du bruit : le playbook suit le régime stable, jamais le brut.
- Une seule tentative par (stratégie, direction, bougie d'entrée) en live.
- Le signal contient toujours : direction (LONG/SHORT/NO_TRADE), stratégie, régime, entrée, SL, TP,
  taille, risque USD, coût estimé, confiance, raisons, invalidations.

## Conditions de validation
- Comparaison backtest adaptative vs stratégies seules (`python main.py backtest`).

## Conditions de refus
- Régime NEWS/UNSTABLE/UNKNOWN, aucun setup, score < seuil, objectif trop petit vs coûts, veto ML ou risque.

## Exemples structurés
```json
{"direction": "NO_TRADE", "regime": "sideways",
 "strategy_rationale": "Regime 'sideways' -> playbook ['range_trading', 'scalping'], but no setup met the conditions/threshold -> NO TRADE.",
 "reasons": ["range LONG: price at 57% of range, not at the edge"]}
```
```json
{"direction": "LONG", "strategy": "trend_following", "regime": "strong_bullish_trend", "entry_price": 64700,
 "stop_loss": 63900, "take_profit": 67900, "size": 0.00303, "risk_usd": 2.49, "est_cost_usd": 0.20,
 "confidence": {"raw_score": 78, "calibrated": false, "probability": null},
 "invalidations": ["H1 close below EMA50", "bearish CHOCH on H1"]}
```
