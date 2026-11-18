---
name: risk-management
description: Gestion du risque et droit de veto absolu du Risk Manager BTC — dimensionnement par le risque avec frais/slippage, limites (0,25 %/trade, 1 %/jour, 8 % drawdown, 1 position, levier 1x, marge isolée), plafonds codés, coupe-circuits, kill switch. À utiliser pour toute question de taille de position, de limite, de veto, d'arrêt d'urgence ou de réinitialisation.
metadata:
  agent: risk_manager
  code: agents/risk_manager.py, risk/limits.py, risk/sizing.py, risk/state.py, risk/kill_switch.py
  version: "1.0"
---

# Risk Management (Agent 6 — Risk Manager)

## Description
Agent le plus important : tout trade doit obtenir un `RiskVerdict` approuvé. Il dimensionne, refuse,
et déclenche les coupe-circuits.

## Objectif
Protéger le capital avant tout ; ne jamais assouplir une limite pour atteindre un objectif de gain.

## Compétences
- Limites configurables (`.env`) bornées par des **plafonds codés** (`risk/limits.py`) :
  risque/trade ≤ 0,5 %, perte jour ≤ 2 %, drawdown ≤ 10 %, levier = 1, positions = 1.
- Taille : `risque / (|entrée − stop| + coûts entrée + coûts sortie au stop)`, plafonnée par le levier,
  arrondie à `szDecimals`, minimum 10 $ (règle Hyperliquid).
- État persistant : equity début de jour (UTC), plus haut d'equity, pertes consécutives, pause.

## Méthodes
Contrôles (tous requis) : kill switch, coupe-circuits, verrou journalier, pause après 3 pertes (120 min),
aucune position ni ordre ouvert sur l'exchange, côté du stop/TP, spread ≤ 5 bp, funding contraire
≤ 0,05 %/h, stop ≥ 3× coût aller-retour, R/R après coûts ≥ 1,2, risque réel ≤ budget, levier ≤ 1.
Budget = min(risque/trade, reste du budget journalier) ; ×0,5 en haute volatilité. Equity = réalisé + latent.

## Règles de décision
- Coupe-circuits → **HALT** : drawdown max, données > 90 s, ≥ 5 coupures WS/10 min, ≥ 6 échecs REST,
  désynchronisation du compte, ≥ 3 erreurs d'exécution/10 min. **BLOCK** : perte jour (jusqu'à 00:00 UTC), données > 30 s.
- Réveil après une veille de l'ordinateur (horloge murale en avance sur l'horloge monotone > 30 s) :
  rechargement des données et, pendant 3 min, données périmées / coupures WS / échecs REST → **BLOCK**
  au lieu de HALT. Après ce délai, la règle normale (HALT) s'applique. Drawdown, désynchronisation et
  erreurs d'exécution déclenchent toujours HALT.
- Kill switch : RUNNING / PAUSED (reprise possible) / HALTED (reset CLI uniquement, saisie `RESET`).
- Aucune martingale, aucun renforcement, aucune moyenne à la baisse (une position, jamais d'ajout).

## Conditions de validation
- `tests/test_risk.py` (plafonds, sizing, veto, coupe-circuits), `tests/test_system.py` (données périmées → HALT).

## Conditions de refus
- Toute vérification en échec → `approved: false`, taille 0, raisons listées.

## Exemples structurés
```json
{"approved": true, "size": 0.00303, "notional_usd": 196.0, "risk_usd": 2.49, "est_cost_usd": 0.20, "leverage": 0.196,
 "reasons": ["approved: risk $2.49 (0.249% equity)"]}
```
```json
{"approved": false, "reasons": ["stop distance 45.0 < 3.0x round-trip costs (78.4)"], "checks": {"stop_vs_costs": false}}
```
