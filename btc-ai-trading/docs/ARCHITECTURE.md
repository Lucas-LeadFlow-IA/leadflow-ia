# Architecture technique

## Flux d'une décision (toutes les `DECISION_INTERVAL_SECONDS`, 15 s par défaut)

1. **Synchronisation** : `exchange.get_account_state()` (clearinghouseState + frontendOpenOrders en
   testnet/live, simulé en paper). Mise à jour de l'equity (réalisé + latent) dans `RiskState`.
2. **Réconciliation** (`execution/reconciliation.py`) : position fermée côté exchange → trade finalisé ;
   taille différente → adoptée + protection redimensionnée ; SL manquant → réinstallé (échec → fermeture + HALT) ;
   ordres incohérents → annulés ; position non gérée ou sens opposé → désynchronisation → HALT.
3. **Coupe-circuits** (`RiskManager.circuit_breakers`) → kill switch.
4. **Procédure d'urgence** si demandée (politique `flatten` ou `protect`).
5. **Snapshot** (`core/snapshot.py`) : dernière bougie **clôturée** par timeframe + précédente, carnet, flux, funding.
6. Si position : agents 1-4 (pour garder le régime à jour) puis `Strategy.manage` (breakeven, trailing,
   invalidation, sortie temporelle). Sinon : pipeline complet → signal → Risk Manager → exécution
   (une seule tentative par setup et par bougie).
7. Persistance : décisions, ordres, equity (1/min), événements ; position gérée dans `runtime/`.

Boucle rapide (1 s) : `exchange.on_market_update()` (déclenchement des TP/SL et fills en paper).

## Données

- `MarketDataService` : bootstrap REST de 1 500 bougies × 6 timeframes, puis WebSocket (`candle`,
  `l2Book`, `trades`, `activeAssetCtx`), ping toutes les 20 s, reconnexion à backoff exponentiel avec
  re-souscription et re-remplissage REST des trous. Sondage REST du contexte (funding/mark) toutes les 30 s.
- Budget de poids côté client à 900/min (limite documentée : 1 200/min/IP).
- Features recalculées seulement à la clôture d'une nouvelle bougie (cache par timeframe).

## Pourquoi un moteur de backtest maison (et pas VectorBT)

Il fallait : (1) exécuter **le même code** d'agents et de gestion de position que le live ; (2) modéliser
ordres passifs partiellement remplis, stops intrabar pessimistes, gaps, funding horaire réel, kill switch
et limites de risque journalières. Un moteur vectorisé ne permet pas ces règles séquentielles sans
dupliquer la logique. Coût : ~1–7 s par run de 5 000 barres.

## Pourquoi pas TA-Lib

Dépendance C (installation difficile sous Windows / images slim). Les indicateurs sont implémentés en
pandas/NumPy, vérifiés (RSI de Wilder calculé à la main) et **testés contre le look-ahead**.

## Modèle de coûts (`backtesting/costs.py`, partagé live/backtest)

- Entrée marché : taker + slippage 2 bp ; entrée limite : maker.
- Sortie stop : taker + 5 bp ; TP limite : maker ; TP trigger : taker + 2 bp.
- Funding : `taille × prix × taux` par heure (taux historique réel en backtest, courant en paper).
- Risque d'un trade = `taille × |entrée − stop| + coûts d'entrée + coûts de sortie au stop`.

## Persistance

| Où | Quoi |
|---|---|
| Base (SQLite par défaut, PostgreSQL en Docker) | trades, décisions, equity, événements, ordres |
| `runtime/kill_switch.json` | état du kill switch (écrit avant toute action) |
| `runtime/risk_state_<mode>.json` | equity début de jour, plus haut, pertes consécutives, pause |
| `runtime/position_<mode>.json` | position gérée (restaurée au redémarrage puis réconciliée) |
| `runtime/paper_account.json` | compte papier |
| `models/` | modèles ML + métadonnées (SHA-256), calibration JSON |
| `reports/` | rapports de backtest, ML, walk-forward |

## Choix assumés

- Une seule position, jamais d'ajout : supprime par construction martingale, pyramidage et moyenne à la baisse.
- Levier plafonné à 1 dans le code (`HARD_CEILINGS.max_leverage = 1`) : l'augmenter exige une modification de code revue.
- Aucun LLM dans la boucle de décision : explications générées de façon déterministe à partir des règles.
