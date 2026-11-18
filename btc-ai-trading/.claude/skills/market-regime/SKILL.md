---
name: market-regime
description: Détection du régime de marché BTC (tendance haussière/baissière forte, range, haute/basse volatilité, instable, news-driven) avec hystérésis et capacité d'imposer NO TRADE. À utiliser pour classer le marché, expliquer pourquoi une stratégie est autorisée ou interdite, ou évaluer le classifieur ML et le détecteur d'anomalies.
metadata:
  agent: regime_detector
  code: agents/regime_detector.py, machine_learning/regime_model.py, machine_learning/anomaly.py
  version: "1.0"
---

# Market Regime (Agent 4 — Regime Detector)

## Description
Classe le marché parmi 7 régimes (+ `unknown` = transition) à partir de H1/H4/M15, avec un état
**stable** protégé par hystérésis.

## Objectif
Choisir le bon terrain de jeu pour le moteur stratégique et dire **NO TRADE** quand le contexte est dangereux.

## Compétences
- 6 votes de tendance : ADX ≥ 22 + DI, empilement EMA, structure HH/HL, pente EMA50, prix vs EMA200, tendance H4.
- Volatilité : rang percentile de l'ATR % H1 (> 0,85 haute, < 0,15 + Bollinger étroit basse).
- News-driven : choc (|ret_z| ≥ 4,5 ou range ≥ 3,5 ATR avec vol_z ≥ 3) ou fenêtre du calendrier
  `config/event_calendar.json`, maintenu 45 min. Aucun flux d'actualités n'est branché (assumé).
- Instable : whipsaw M15, spread anormal, ou anomalie IsolationForest (activée seulement si validée OOS).

## Méthodes
Priorité : NEWS > UNSTABLE > tendance forte (ADX ≥ 22 et ≥ 4/6 votes) > HIGH_VOL > LOW_VOL > SIDEWAYS (ADX < 22) > UNKNOWN.
Hystérésis : un nouveau régime doit persister sur 2 clôtures 15m ; NEWS/UNSTABLE s'appliquent immédiatement.

## Règles de décision
- `no_trade = true` pour NEWS_DRIVEN, UNSTABLE, UNKNOWN.
- Playbook (strategies/registry.py) : tendance → trend/intraday/scalping dans le sens de la tendance ;
  range → range/scalping ; haute vol → intraday/trend avec score +10 et risque ×0,5 ; basse vol → range.

## Conditions de validation (ML)
- Classifieur ML gardé seulement s'il bat la règle de ≥ 3 points de précision équilibrée en walk-forward.
  Résultat actuel : 0,50 vs 0,51 → **non utilisé** (rapport `reports/ml_report.md`).
- Anomalies : lift des mouvements futurs ≥ 1,3 → actuel 1,63 → **activé**.

## Conditions de refus
- Données H1 insuffisantes → UNKNOWN (NO TRADE).

## Exemples structurés
```json
{"regime": "sideways", "raw_regime": "sideways", "reasons": ["ADX 12 < 22, no directional consensus (0 bull / 5 bear votes)"], "no_trade": false}
```
```json
{"regime": "news_driven", "reasons": ["1m return z=5.3", "scheduled event window: FOMC"], "no_trade": true}
```
