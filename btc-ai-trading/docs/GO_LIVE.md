# Passage PAPER → TESTNET → LIVE

Il n'existe **aucune obligation** de passer en réel. Si les critères ne sont pas remplis, on reste en paper.
Aucun composant logiciel (agent, dashboard, Telegram) ne peut changer de mode : seul un humain, via
`.env` + redémarrage + confirmation au terminal, le peut.

## Étape 0 — Pré-requis non techniques
- [ ] Vérifier l'éligibilité légale dans votre pays (âge, juridiction, restrictions d'accès) et les
      conditions d'utilisation d'Hyperliquid. **Ne jamais contourner une restriction** (VPN, etc.).
- [ ] Comprendre que les objectifs journaliers (200 → 1 000 $) sont exploratoires et non garantis.
- [ ] N'engager que de l'argent dont la perte totale est acceptable.

## Étape 1 — PAPER (≥ 14 jours)
- [ ] `python main.py run` en continu (Docker conseillé), `download-data` quotidien.
- [ ] Aucun HALT inexpliqué ; les HALT expliqués ont été analysés (`/api/risk`, table `events`).
- [ ] Backtests + walk-forward **validés** (tous les critères : PF > 1,2, ≥ 100 trades, DD < 8 %,
      espérance > 0, stabilité) sur plusieurs périodes et régimes. *Statut au 18/11/2026 : non validé.*
- [ ] Les résultats paper sont cohérents avec le backtest (même ordre de grandeur de PF et de coûts).

## Étape 2 — TESTNET (≥ 25 trades)
```
TRADING_MODE=testnet
HL_ACCOUNT_ADDRESS=0x...            # compte principal testnet
HL_API_WALLET_PRIVATE_KEY=0x...     # API wallet testnet (voir SECURITY.md)
```
`python main.py check-connection` → `python main.py run`
- [ ] Chaque entrée : ordre confirmé, **SL visible dans l'interface testnet** juste après l'entrée.
- [ ] Test d'échec du SL (ex. couper le réseau pendant l'entrée) → position fermée et HALT.
- [ ] Redémarrage du programme avec une position ouverte → réconciliation correcte, SL conservé.
- [ ] Arrêt d'urgence depuis le dashboard **et** depuis Telegram → ordres annulés, position traitée.
- [ ] Fermeture manuelle d'une position dans l'interface → détectée, trade enregistré, aucune désynchronisation persistante.
- [ ] Frais et funding enregistrés = ceux affichés par Hyperliquid.
- [ ] 25 trades sans erreur critique d'exécution.

## Étape 3 — LIVE (très petite taille)
1. Créer une API wallet **mainnet** dédiée (SECURITY.md). Déposer un capital réduit (ex. 100–200 $).
2. `.env` :
```
TRADING_MODE=live
LIVE_TRADING_CONFIRMATION=I ACCEPT REAL MONEY RISK ON HYPERLIQUID MAINNET
LIVE_ELIGIBILITY_ACKNOWLEDGED=true
MAX_LEVERAGE=1
MARGIN_MODE=isolated
INITIAL_CAPITAL_USD=<capital réellement déposé>
```
3. `python main.py run --live` dans un terminal interactif (Docker : `docker compose run --rm -it app python main.py run --live`),
   puis taper le **code aléatoire** affiché. Toute autre saisie annule.
4. Surveiller quotidiennement : rapport Telegram, page Risque, comparaison paper/live.

## Augmentation de taille
Uniquement si, sur ≥ 100 trades live : PF après coûts > 1,2, drawdown < 8 %, écart live/backtest
expliqué. Augmenter par paliers (ex. ×1,5) en modifiant `INITIAL_CAPITAL_USD` / le dépôt, **jamais**
les pourcentages de risque au-delà des plafonds codés.

## Retour arrière immédiat
`/emergency_stop CONFIRM` (Telegram) ou bouton rouge (dashboard) → `TRADING_MODE=paper` → révoquer l'API wallet si doute.
