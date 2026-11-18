---
name: intraday
description: Stratégie intraday BTC — entrées M15 sur pullback dans une zone de valeur (EMA20, FVG, order block, sweep) confirmée, avec contexte M30/H1, stop dynamique (breakeven puis trailing ATR). À utiliser pour analyser, backtester ou ajuster l'intraday et ses conditions d'entrée/sortie.
metadata:
  strategy: intraday
  code: strategies/intraday.py
  timeframes: "15m entry, 30m confirm, 1h context"
  version: "1.0"
---

# Intraday (M15 / M30 / H1)

## Description
Suivre les mouvements intrajournaliers dans le sens du biais H1 en entrant sur retracement confirmé.

## Objectif
Entrer après une respiration du marché, avec un stop logique et un objectif non bloqué par une résistance proche.

## Compétences
- Biais H1 : prix vs EMA50, pente EMA50, structure non opposée.
- Force M30 : ADX ≥ 18, EMA20/50 alignées.
- Zone de valeur M15 : EMA20, FVG, order block, ou sweep ≤ 3 barres.
- Confirmation M15 : bougie qui clôture au-delà du plus haut/bas précédent, ou BOS/CHOCH ≤ 2 barres ; RSI 40-68 (long).
- Contrôle d'obstacle : résistance (support) H1/M15 à moins de 1,5 R → refus.

## Méthodes
- Entrée marché (IOC plafonnée à 0,1 %), stop sous le pullback −0,3 ATR (1 à 2,5 ATR), TP 2 R.
- Gestion : breakeven à +1 R, trailing 1,5 ATR après +1,5 R, sortie sur CHOCH contraire, durée max 8 h.

## Règles de décision
- Confirmation technique requise sur 15m/1h (Technical Analyst), score ≥ seuil.

## Conditions de validation
- Backtest 15m (52 jours) : **9 trades, PF 0,37 — non validé** (échantillon trop faible, résultat négatif).

## Conditions de refus
- Biais H1 absent, M30 sans force, pas de zone de valeur, pas de confirmation, obstacle proche, RSI hors bande.

## Exemples structurés
```json
{"strategy": "intraday", "direction": "SHORT", "entry_price": 64400, "stop_loss": 64780, "take_profit": 63640, "score": 71,
 "reasons": ["H1 below rising EMA50...", "M30 ADX 24", "M15 value zone: FVG/OB", "M15 confirmation: candle, structure break"],
 "invalidations": ["M15 close beyond stop 64,780", "bullish CHOCH on M15", "H1 close above EMA50"]}
```
