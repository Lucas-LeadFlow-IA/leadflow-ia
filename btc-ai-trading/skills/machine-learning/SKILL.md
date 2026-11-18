---
name: machine-learning
description: Apprentissage quantitatif pour le BTC — méta-labeling des setups (logistique, Random Forest, Gradient Boosting sklearn), calibration score→probabilité, classifieur de régime vs règles, détection d'anomalies IsolationForest, validation walk-forward purgée contre le look-ahead, le data leakage et l'overfitting. À utiliser pour entraîner, évaluer ou activer un modèle.
metadata:
  code: machine_learning/, scripts/train_models.py
  commands: "python main.py train-ml"
  version: "1.0"
---

# Machine Learning

## Description
Couche ML optionnelle : chaque composant n'est activé que s'il bat sa référence **hors échantillon, après coûts**.

## Objectif
Améliorer les décisions mesurablement, jamais « faire intelligent ».

## Compétences
- Étiquettes : simulation forward de chaque setup candidat (mêmes règles et coûts que le backtester), déduplication.
- Modèles : régression logistique (référence), Random Forest, HistGradientBoosting (équivalent GBM ; XGBoost non justifié ici).
- Calibration isotone du score (stockée en JSON, pas de pickle).
- Anomalies : IsolationForest (contamination 2 %) sur features H1.

## Méthodes — prévention des biais
- Features strictement causales (test de troncature) ; splits **walk-forward expansifs** ; purge des
  échantillons dont la fenêtre d'étiquette chevauche le test + embargo ; jamais entraîné et évalué sur la même période.
- Survivorship bias : sans objet (un seul actif, BTC, données de la plateforme utilisée).
- Modèles sauvegardés avec SHA-256 vérifié au chargement (joblib = pickle).

## Règles de décision (activation)
- Filtre de trades : n OOS ≥ 100, Brier < taux de base, AUC ≥ 0,55, R moyen conservé > R moyen global.
- Calibration : Brier OOS < taux de base, ≥ 50 échantillons ; sinon confiance « non calibrée ».
- Régime ML : +3 points de précision équilibrée vs règle. Anomalies : lift ≥ 1,3 et ≥ 20 barres signalées.
- Aucune activation automatique en production : revue humaine + redémarrage.

## Conditions de validation — résultats réels (18/11/2026, 280 setups étiquetés)
| Composant | Résultat OOS | Statut |
|---|---|---|
| Filtre de trades | pas de gain économique | désactivé |
| Calibration | Brier 0,215 vs 0,212 base | non calibrée |
| Régime ML | 0,50 vs règle 0,51 | non utilisé |
| Anomalies | lift 1,63 (71 barres) | **activé** |

## Conditions de refus
- < 60 setups étiquetés → « insufficient_data ».

## Exemples structurés
```json
{"trade_filter": {"best": "random_forest", "enabled": false, "reason": "no economic uplift after costs"}}
```
