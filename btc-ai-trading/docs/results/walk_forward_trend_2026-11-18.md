# Walk-forward study — trend following exit variants (1h)

Variant chosen on each TRAIN window (best profit factor, >= 10 trades), then evaluated on the next TEST window.

| Test window | Chosen | Test trades | Test PF | Test net $ | Baseline trades | Baseline PF | Baseline net $ |
|---|---|---|---|---|---|---|---|
| → 2026-08-21 | no_choch_exit | 5 | 0.0 | -11.46 | 7 | 0.0 | -13.46 |
| → 2026-09-19 | no_choch_exit | 6 | 0.0 | -12.32 | 7 | 0.007460062856505422 | -12.00 |
| → 2026-10-19 | no_choch_exit | 5 | 1.035225626324468 | 0.30 | 5 | 1.8505196239035386 | 4.02 |
| → 2026-11-18 | no_choch_exit | 11 | 1.5405163984230903 | 5.32 | 17 | 0.461911174656817 | -9.11 |

**OOS walk-forward selection**: 27 trades, PF 0.5677618142266113, net -18.17 $, expectancy -0.672932052772684

**OOS fixed baseline**: 36 trades, PF 0.35299313307932256, net -30.55 $, expectancy -0.8486691977453019

