# BTC AI Trading System — Hyperliquid

Système multi-agents de trading **BTC uniquement** (perpétuel BTC sur Hyperliquid), long et short,
avec trois modes strictement séparés : **PAPER** (défaut), **TESTNET**, **LIVE** (désactivé par défaut).

> ⚠️ **État au 18/11/2026 — à lire avant tout.** Le système est fonctionnel de bout en bout (données
> temps réel, 8 agents, risque, exécution papier, dashboard, Telegram, backtests, ML). En revanche,
> **aucune stratégie n'a démontré d'espérance positive après coûts** sur l'historique disponible
> (voir [Résultats](#résultats-actuels-backtests-et-ml)). Conformément à la priorité « protéger le
> capital », la seule utilisation raisonnable aujourd'hui est le **mode PAPER** pour accumuler des
> données réelles. Les objectifs de 200 → 1 000 $/jour sont exploratoires : aucun trade n'est forcé pour les atteindre.

---

## 1. Architecture

```
                       Hyperliquid (mainnet pour les données, testnet/mainnet pour l'exécution)
             REST /info (lecture)   WebSocket wss://…/ws (candle, l2Book, trades, activeAssetCtx)
                        │                         │
                        ▼                         ▼
                 ┌────────────────────────────────────────┐
                 │  market_data/  (bootstrap REST + flux,  │  bougies CLÔTURÉES uniquement,
                 │  reconnexion, ping, fraîcheur des flux) │  fraîcheur suivie par flux
                 └───────────────────┬────────────────────┘
                                     ▼  MarketSnapshot (identique live / backtest)
  ┌──────────── agents/pipeline.py ─────────────────────────────────────────────────────┐
  │ 1 Market Scanner → 2 Technical Analyst → 3 Liquidity Analyst → 4 Regime Detector   │
  │        → 5 Adaptive Strategy Engine (scalping / intraday / trend / range / NO TRADE)│
  │        → [filtre ML si validé OOS] → 6 RISK MANAGER (veto absolu, sizing)          │
  └──────────────────────────────────┬───────────────────────────────────────────────────┘
                                     ▼ TradeSignal approuvé
        7 Execution Agent ── PaperExchange (simulé, rien de signé)
                         └─ HyperliquidExchange (SDK officiel, API wallet, testnet/live)
                                     ▼
        8 Performance Analyst → base de données (SQLite / PostgreSQL) → API FastAPI → Dashboard / Telegram

  Orchestrateur (agents/orchestrator.py) : synchro compte + réconciliation, coupe-circuits,
  kill switch persistant, procédure d'urgence, rapports.
```

| Agent | Fichier | Rôle |
|---|---|---|
| 1 Market Scanner | `agents/market_scanner.py` | prix, volumes, volatilité, spread, anomalies, opportunités — ne trade jamais |
| 2 Technical Analyst | `agents/technical_analyst.py` | EMA 9/20/50/200, RSI, MACD, VWAP, ATR, ADX, Bollinger, volume profile, S/R, BOS, CHOCH, HH/HL/LH/LL ; biais = ≥ 3 groupes de facteurs d'accord |
| 3 Liquidity Analyst | `agents/liquidity_analyst.py` | sweeps, equal highs/lows, FVG, order blocks, faux breakouts, déséquilibre/murs du carnet, flux agresseur |
| 4 Regime Detector | `agents/regime_detector.py` | 7 régimes + transition, hystérésis, NO TRADE, calendrier d'événements, anomalies ML |
| 5 Strategy Engine | `agents/strategy_engine.py` | playbook régime → stratégies, score, explication, invalidations |
| 6 Risk Manager | `agents/risk_manager.py` | sizing avec coûts, 15+ contrôles, coupe-circuits, plafonds codés |
| 7 Execution Agent | `agents/execution_agent.py` | ordres, confirmation des fills, partiels, SL vérifié obligatoire, urgence |
| 8 Performance Analyst | `agents/performance_analyst.py` | métriques, par stratégie/régime, recommandations (jamais d'auto-modification) |

Détails : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 2. Structure du projet

```
btc-ai-trading/
├── agents/            8 agents + pipeline + orchestrateur
├── analysis/          indicateurs, structure/SMC, carnet, pipeline de features (causal)
├── backtesting/       moteur événementiel, coûts, métriques, rapports, walk-forward
├── config/            settings (pydantic), garde LIVE, calendrier d'événements
├── core/              modèles de domaine, MarketSnapshot
├── dashboard/api/     backend FastAPI          dashboard/web/  Next.js + TypeScript + Tailwind
├── database/          SQLAlchemy (trades, décisions, equity, événements, ordres)
├── execution/         paper, client Hyperliquid (SDK), arrondis, réconciliation
├── machine_learning/  étiquetage, walk-forward purgé, filtre, calibration, régime, anomalies
├── market_data/       client REST /info, WebSocket, store, historique
├── monitoring/        logs JSON avec masquage des secrets
├── risk/              limites + plafonds, sizing, état, kill switch
├── skills/            15 SKILL.md (copiés dans .claude/skills pour Claude Code)
├── strategies/        scalping, intraday, trend following, range trading, registre
├── telegram/          bot (liste blanche, arrêt d'urgence en 2 étapes)
├── scripts/           téléchargement, backtests, ML, walk-forward, sync des skills
├── tests/             89 tests (pytest)
├── docs/              ARCHITECTURE, SECURITY, GO_LIVE
├── main.py  requirements.txt  pyproject.toml  Dockerfile  docker-compose.yml  .env.example
```

## 3. Installation

Prérequis : Python ≥ 3.11 (testé 3.13), Node.js ≥ 18 (testé 22) pour construire le dashboard.

**Linux / macOS**
```bash
cd btc-ai-trading
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                     # PAPER par défaut, aucune clé nécessaire
(cd dashboard/web && npm ci && npx next build)   # génère dashboard/web/out servi par l'API
```

**Windows (PowerShell)**
```powershell
cd btc-ai-trading
py -3 -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
cd dashboard\web ; npm ci ; npx next build ; cd ..\..
```

**Docker (PostgreSQL inclus)**
```bash
cp .env.example .env
docker compose up -d --build            # dashboard sur http://127.0.0.1:8000
```

## 4. Lancement

| Commande | Effet |
|---|---|
| `python main.py check-connection` | test lecture seule : métadonnées BTC, carnet, bougies (+ compte si `HL_ACCOUNT_ADDRESS`) |
| `python main.py run` | système complet dans le mode du `.env` (PAPER par défaut) + API/dashboard + Telegram |
| `python main.py download-data` | télécharge l'historique servi par Hyperliquid dans `data/` |
| `python main.py backtest [--research]` | comparaison des 4 stratégies + adaptatif → `reports/` |
| `python main.py train-ml` | entraînement/évaluation walk-forward → `models/`, `reports/ml_report.md` |
| `python main.py walk-forward` | sélection walk-forward de variantes de sortie (trend following) |
| `python main.py kill-switch status` / `reset` | état / réinitialisation manuelle (saisie `RESET`) |

Dashboard : `http://127.0.0.1:8000` — jeton = `DASHBOARD_TOKEN` du `.env`, ou s'il est vide un jeton
aléatoire écrit dans `runtime/dashboard_token.txt`. Pages : Vue d'ensemble, Marché, Agents, Trades,
Risque, Paramètres (responsive, utilisable sur téléphone). En développement :
`NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev` dans `dashboard/web`.

Telegram (optionnel) : créer un bot via @BotFather, renseigner `TELEGRAM_BOT_TOKEN` et
`TELEGRAM_ALLOWED_USER_IDS` (votre identifiant numérique). Commandes : `/status /balance /positions
/performance /strategies /risk /pause /resume /emergency_stop` (+ `/emergency_stop CONFIRM` sous 60 s).
Aucune commande ne peut modifier les limites de risque.

## 5. Données et limites techniques

- `candleSnapshot` ne sert que les **~5 000 dernières bougies** par intervalle (vérifié : 1m ≈ 3,5 jours,
  5m ≈ 17 j, 15m ≈ 52 j, 1h ≈ 208 j, 4h ≈ 833 j). Relancez `download-data` régulièrement (ex. tâche
  quotidienne) : l'historique local s'agrandit. Import CSV possible (`market_data/history.import_csv`).
- Funding : historique horaire réel (`fundingHistory`, paginé par 500) utilisé dans les backtests.
- Pas d'historique de carnet L2 public : composante carnet neutre en backtest, active en live.
- Pas de flux d'actualités : le régime « news-driven » est détecté par les chocs de marché et un
  calendrier manuel (`config/event_calendar.json`).
- Zones de liquidation : **non estimées** (aucune donnée publique fiable) — rien n'est inventé.

## 6. Résultats actuels (backtests et ML)

Données Hyperliquid réelles, frais taker 0,045 % / maker 0,015 %, slippage 2 bp (stop 5 bp), funding réel,
capital 1 000 $, risque 0,25 %/trade. Rapport complet : `reports/backtest_*.md` (régénérable).

| Run | Période | Trades | Win rate | PF | Net $ | DD max | Validé |
|---|---|---|---|---|---|---|---|
| Scalping (1m) | 3,5 jours | 5 | 20 % | 0,39 | −4,73 | 0,65 % | ❌ |
| Intraday (15m) | 52 jours | 9 | 22 % | 0,37 | −8,96 | 1,22 % | ❌ |
| Trend following (1h) | 6,5 mois | 62 | 26 % | 0,59 | −32,79 | 5,44 % | ❌ |
| Range trading (15m) | 52 jours | 3 | 33 % | 1,60 | +1,66 | 0,25 % | ❌ (échantillon) |
| Adaptatif (15m) | 52 jours | 26 | 27 % | 0,66 | −9,29 | 2,41 % | ❌ |

Critères (tous requis) : PF > 1,2 après coûts, ≥ 100 trades, DD < 8 %, espérance > 0, stabilité par période.
Walk-forward des variantes de sortie du trend following : meilleure variante OOS PF 0,57 (référence 0,35) — encore négative.
ML (walk-forward purgé, 280 setups) : filtre de trades **non activé** (pas de gain après coûts), confiance
**non calibrée** (Brier OOS pas meilleur que le taux de base), classifieur de régime **pas meilleur que les
règles**, détection d'anomalies **activée** (lift 1,63).

Instantané daté des rapports : [`docs/results/`](docs/results/).

Lecture honnête : le contrôle du risque fonctionne (pertes bornées, drawdown < 8 % partout), mais
l'avantage statistique n'est pas démontré. Prochaines étapes : accumuler des données (paper 24/7 +
collecte), tester de nouvelles hypothèses **en walk-forward uniquement**, ne jamais passer en réel sans validation.

## 7. Connexion Hyperliquid

1. **Lecture seule (paper)** : aucune clé. `python main.py check-connection`.
2. **Testnet** : sur https://app.hyperliquid-testnet.xyz, obtenir des fonds de test, puis créer une
   **API wallet** (menu API). Renseigner dans `.env` : `TRADING_MODE=testnet`, `HL_ACCOUNT_ADDRESS`
   (adresse publique du compte principal) et `HL_API_WALLET_PRIVATE_KEY` (clé de l'API wallet — **jamais
   la clé principale**). `python main.py check-connection` puis `python main.py run`.
3. **Live** : procédure complète dans [`docs/GO_LIVE.md`](docs/GO_LIVE.md).

L'API wallet peut trader mais **ne peut pas retirer de fonds** ; le code ne contient de toute façon aucune
fonction de transfert ou de retrait. Révocation : [`docs/SECURITY.md`](docs/SECURITY.md).

## 8. Passage sécurisé PAPER → TESTNET → LIVE (résumé)

1. PAPER ≥ 14 jours sans erreur critique, données suffisantes, backtests/walk-forward **validés**.
2. TESTNET ≥ 25 trades : chaque position protégée par un SL vérifié, réconciliation sans désynchronisation,
   kill switch testé (dashboard + Telegram), redémarrage en position testé.
3. Vérification **légale et plateforme** (pays, âge, conditions Hyperliquid) — jamais de contournement.
4. LIVE à très petite taille : `TRADING_MODE=live`, phrase de confirmation exacte, `LIVE_ELIGIBILITY_ACKNOWLEDGED=true`,
   levier 1, `python main.py run --live`, puis saisie d'un **code aléatoire affiché** au terminal.
   Aucun agent, API ou commande Telegram ne peut passer en LIVE.

## 9. Tests

```bash
python -m pytest -q                 # 89 tests (dont 1 appel réseau réel en lecture seule)
python -m pytest -q -m "not network"
cd dashboard/web && npx tsc --noEmit
```
Couvert : exactitude des indicateurs (RSI de Wilder vérifié à la main), **absence de look-ahead**
(troncature), structure/SMC, client REST (retries) et WebSocket (reconnexion + re-souscription),
plafonds de risque, sizing, kill switch, veto, coupe-circuits, broker papier, exécution (SL vérifié,
fill partiel, échec du SL → fermeture d'urgence), réconciliation, parsing des réponses documentées,
garde LIVE, masquage des secrets, invariants comptables du backtest, walk-forward purgé, API (auth,
contrôles, LIVE refusé), Telegram (liste blanche, confirmation), base de données, format des skills.

## 10. Ce qui n'est pas (encore) vérifié en conditions réelles

- **Exécution testnet/live** : le client signé utilise le SDK officiel et le parsing est testé sur les
  réponses documentées, mais aucun ordre réel n'a été envoyé depuis cet environnement (pas de clé).
  La première étape testnet est donc obligatoire (docs/GO_LIVE.md).
- **Telegram** : testé avec un transport simulé (l'API Telegram n'était pas joignable ici).
- **Paper** : le modèle de remplissage des ordres passifs (traversée du prix) est une approximation.

## 11. Roadmap

- **Mois 1** (fait) : architecture, API, agents, skills, stratégies, backtesting, dashboard, tests.
- **Mois 2** : paper 24/7, collecte continue, nouvelles hypothèses en walk-forward, enrichissement du classifieur de régime.
- **Mois 3** : validations finales, testnet complet, éventuel live à très petite taille **si et seulement si** les critères sont remplis.
