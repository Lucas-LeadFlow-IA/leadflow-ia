---
name: hyperliquid-execution
description: Exécution des ordres BTC sur Hyperliquid (paper, testnet, live) via le SDK Python officiel — ordres IOC/ALO/GTC, stop-loss et take-profit trigger reduce-only, vérification des fills, ordres partiels, annulations, réconciliation avec le compte, procédure d'urgence. À utiliser pour toute question d'ordres, de connexion API wallet, de nonces, d'arrondis ou d'incident d'exécution.
metadata:
  agent: execution_agent
  code: agents/execution_agent.py, execution/, market_data/hyperliquid_info.py
  docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
  version: "1.0"
---

# Hyperliquid Execution (Agent 7 — Execution Agent)

## Description
Seul composant qui envoie des ordres. En PAPER, il parle au `PaperExchange` (rien n'est signé) ;
en TESTNET/LIVE au `HyperliquidExchange` (SDK officiel, API wallet dédiée).

## Objectif
Ouvrir, protéger, ajuster et fermer **une** position, sans jamais supposer qu'un ordre est exécuté.

## Compétences
- Ordres : `order` (limit IOC / ALO / GTC, trigger `{"triggerPx","isMarket":true,"tpsl":"sl"|"tp"}`), `reduce_only`, `cloid` 128 bits.
- Annulation par oid / cloid ; `update_leverage` (1x, isolée).
- Lecture : `clearinghouseState`, `frontendOpenOrders`, `orderStatus`, `userFillsByTime`, `userFunding` avec l'adresse du **compte principal**.
- Arrondis : prix ≤ 5 chiffres significatifs et ≤ 6 − szDecimals décimales (BTC → entiers), tailles à `szDecimals` (5).
- Nonces : actions sérialisées, espacées ≥ 5 ms (nonce = horodatage ms du SDK, unique par signataire).

## Méthodes
1. Pré-vol : compte à plat, aucun ordre BTC → sinon refus.
2. Levier 1x isolé.
3. Entrée IOC plafonnée (0,1 %) ou ALO passive (timeout 90 s) ; confirmation par `orderStatus` **et** position réelle.
4. Partiel : annulation du reste ; protection dimensionnée sur la taille réelle.
5. Stop-loss trigger reduce-only, **vérifié au repos** (3 essais) ; échec → fermeture d'urgence + HALT.
6. TP trigger (ou limite maker reduce-only) ; échec → avertissement (le stop protège).
7. Resserrement : nouveau stop vérifié **avant** annulation de l'ancien ; jamais d'élargissement.
8. Réconciliation à chaque cycle : position fermée par l'exchange, taille adoptée, stop manquant réinstallé, ordres incohérents annulés, désynchronisation → HALT.

## Règles de décision
- `scheduleCancel` (dead man's switch) **non utilisé** : il annulerait aussi les stop-loss.
- Aucune méthode de transfert ou de retrait n'existe dans le code.

## Conditions de validation
- `tests/test_execution.py` : protection vérifiée, fill partiel, échec du SL → fermeture, pré-vol, parsing des réponses documentées.
- Testnet : voir docs/GO_LIVE.md (checklist de 25 trades testnet sans incident).

## Conditions de refus
- Exchange non à plat, levier non appliqué, réponse `err`, statut inconnu → pas d'ouverture.

## Exemples structurés
```json
{"kind": "stop_loss", "side": "sell", "size": 0.00303, "trigger": 63900, "px": 57510, "reduce_only": true, "state": "resting", "oid": 77738308}
```
```json
{"status": "ok", "response": {"type": "order", "data": {"statuses": [{"error": "Order must have minimum value of $10."}]}}}
```
